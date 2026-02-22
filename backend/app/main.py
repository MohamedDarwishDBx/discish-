import asyncio
import datetime as dt
import os
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import Session

from .auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    get_user_from_token,
    verify_password,
)
from .db import Base, SessionLocal, engine, get_db
from .models import Channel, ChannelCategory, DMChannelMember, Friendship, Message, Reaction, ReadReceipt, Server, ServerMembership, User
from .schemas import (
    CategoryCreate,
    CategoryOut,
    ChannelCreate,
    ChannelOut,
    ChannelUpdate,
    DMChannelCreate,
    DMChannelOut,
    FriendshipOut,
    MemberOut,
    MessageCreate,
    MessageCreateWithAttachment,
    MessageOut,
    MessageUpdate,
    ReactionCreate,
    ReactionOut,
    RoleUpdate,
    ServerCreate,
    ServerOut,
    ServerUpdate,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    UserProfileUpdate,
    VoiceTokenOut,
    VoiceTokenRequest,
)
from .websocket_manager import ConnectionManager

load_dotenv()

app = FastAPI(title="Discord-like API", version="0.1.0")
manager = ConnectionManager()
_presence: dict[str, str] = {}
_presence_sockets: set[WebSocket] = set()
_voice_occupants: dict[str, list[dict]] = {}  # channel_id -> [{user_id, username, avatar_url}]
_main_loop: asyncio.AbstractEventLoop | None = None


def _fire_and_forget(coro) -> None:
    """Schedule an async coroutine from a sync (threadpool) context."""
    if _main_loop and _main_loop.is_running():
        asyncio.run_coroutine_threadsafe(coro, _main_loop)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = PROJECT_ROOT / "dist"
INDEX_FILE = DIST_DIR / "index.html"
UPLOADS_DIR = PROJECT_ROOT / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
CSP_CONNECT_SRC = os.getenv("CSP_CONNECT_SRC", "").strip()

_rate_limit_lock = threading.Lock()
_rate_limit_hits: dict[str, list[float]] = {}


def _cors_origins() -> list[str]:
    raw_value = os.getenv("CORS_ORIGINS", "").strip()
    if raw_value:
        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]

    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
    if render_hostname:
        origins.append(f"https://{render_hostname}")
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    global _main_loop
    _main_loop = asyncio.get_running_loop()

    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    if len(jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must be at least 32 characters")

    _, livekit_api_key, livekit_api_secret, _ = _voice_config()
    if livekit_api_key and len(livekit_api_secret) < 32:
        raise RuntimeError(
            "LIVEKIT_API_SECRET must be at least 32 characters"
        )

    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)


def _run_migrations(eng):
    """Add columns that create_all won't add to existing tables."""
    stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_color VARCHAR(7)",
        "ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_dm BOOLEAN DEFAULT false",
        "ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id VARCHAR REFERENCES channel_categories(id)",
        "ALTER TABLE channels ALTER COLUMN server_id DROP NOT NULL",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(512)",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)",
    ]
    with eng.connect() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))
        conn.commit()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _rate_rule(method: str, path: str) -> tuple[str, int, int] | None:
    if method == "POST" and path == "/auth/register":
        return "auth_register", 10, 300
    if method == "POST" and path == "/auth/login":
        return "auth_login", 30, 60
    if method == "POST" and path == "/voice/token":
        return "voice_token", 120, 60
    if method == "POST" and path.startswith("/channels/") and path.endswith("/messages"):
        return "message_create", 120, 60
    return None


def _enforce_rate_limit(request: Request) -> JSONResponse | None:
    rule = _rate_rule(request.method, request.url.path)
    if not rule:
        return None

    rule_id, limit, window_seconds = rule
    now = time.time()
    client_ip = _client_ip(request)
    key = f"{client_ip}|{rule_id}|{window_seconds}"

    with _rate_limit_lock:
        hits = _rate_limit_hits.get(key, [])
        hits = [entry for entry in hits if entry > now - window_seconds]
        if len(hits) >= limit:
            retry_after = int(max(1, window_seconds - (now - hits[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        _rate_limit_hits[key] = hits

    return None


def _connect_src_policy() -> str:
    if CSP_CONNECT_SRC:
        return CSP_CONNECT_SRC
    # LiveKit JS SDK uses both fetch(http/https) and websocket(ws/wss) signaling.
    return "'self' http: https: ws: wss:"


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    rate_limited = _enforce_rate_limit(request)
    if rate_limited:
        return rate_limited

    response = await call_next(request)
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(self), microphone=(self), display-capture=(self), geolocation=(), interest-cohort=()",
    )
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "script-src 'self'; "
        f"connect-src {_connect_src_policy()}; "
        "frame-ancestors 'none'; "
        "base-uri 'self'",
    )
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload",
        )
    return response


def _livekit_http_health_url(raw_url: str) -> str:
    candidate = raw_url.strip()
    if candidate.startswith("ws://"):
        return "http://" + candidate[len("ws://") :]
    if candidate.startswith("wss://"):
        return "https://" + candidate[len("wss://") :]
    if candidate.startswith("http://") or candidate.startswith("https://"):
        return candidate
    return f"http://{candidate}"


@app.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict:
    checks = {"database": False, "voice": False}
    errors: dict[str, str] = {}

    try:
        db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as exc:  # pragma: no cover
        errors["database"] = str(exc)

    livekit_url, _, _, _ = _voice_config()
    if livekit_url:
        health_url = _livekit_http_health_url(livekit_url)
        try:
            with urllib.request.urlopen(health_url, timeout=2) as response:
                checks["voice"] = response.status < 500
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            errors["voice"] = str(exc)
    else:
        errors["voice"] = "LIVEKIT_URL is not configured"

    ready = all(checks.values())
    status_code = 200 if ready else 503
    payload = {"status": "ready" if ready else "degraded", "checks": checks}
    if errors:
        payload["errors"] = errors
    return JSONResponse(status_code=status_code, content=payload)


@app.post("/auth/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    existing = db.scalar(
        select(User).where(
            (User.email == payload.email) | (User.username == payload.username)
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.id)
    return Token(access_token=token)


@app.get("/users/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return current_user


@app.put("/users/me", response_model=UserOut)
def update_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    if payload.username is not None:
        existing = db.scalar(
            select(User).where(
                (User.username == payload.username) & (User.id != current_user.id)
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = payload.username
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.banner_color is not None:
        current_user.banner_color = payload.banner_color
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/users/search", response_model=list[UserOut])
def search_users(
    q: str = Query("", min_length=1, max_length=80),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    if not q.strip():
        return []
    results = db.scalars(
        select(User)
        .where(User.username.ilike(f"%{q.strip()}%"))
        .where(User.id != current_user.id)
        .limit(20)
    ).all()
    return results


@app.get("/users/{user_id}", response_model=UserOut)
def get_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/dm", response_model=list[DMChannelOut])
def list_dm_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DMChannelOut]:
    my_dm_ids = db.scalars(
        select(DMChannelMember.channel_id).where(DMChannelMember.user_id == current_user.id)
    ).all()
    if not my_dm_ids:
        return []

    results = []
    for ch_id in my_dm_ids:
        channel = db.get(Channel, ch_id)
        if not channel or not channel.is_dm:
            continue
        other_member = db.scalar(
            select(DMChannelMember).where(
                (DMChannelMember.channel_id == ch_id)
                & (DMChannelMember.user_id != current_user.id)
            )
        )
        if not other_member:
            continue
        other_user = db.get(User, other_member.user_id)
        if not other_user:
            continue
        results.append(DMChannelOut(id=channel.id, recipient=UserOut.model_validate(other_user)))
    return results


@app.post("/dm", response_model=DMChannelOut)
def create_or_get_dm_channel(
    payload: DMChannelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DMChannelOut:
    recipient = db.get(User, payload.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    my_dms = db.scalars(
        select(DMChannelMember.channel_id).where(DMChannelMember.user_id == current_user.id)
    ).all()
    for ch_id in my_dms:
        other = db.scalar(
            select(DMChannelMember).where(
                (DMChannelMember.channel_id == ch_id)
                & (DMChannelMember.user_id == recipient.id)
            )
        )
        if other:
            channel = db.get(Channel, ch_id)
            if channel and channel.is_dm:
                return DMChannelOut(id=channel.id, recipient=UserOut.model_validate(recipient))

    channel = Channel(name=f"dm-{current_user.id}-{recipient.id}", type="text", is_dm=True)
    db.add(channel)
    db.flush()
    db.add(DMChannelMember(channel_id=channel.id, user_id=current_user.id))
    db.add(DMChannelMember(channel_id=channel.id, user_id=recipient.id))
    db.commit()
    db.refresh(channel)
    return DMChannelOut(id=channel.id, recipient=UserOut.model_validate(recipient))


@app.get("/friends", response_model=list[FriendshipOut])
def list_friends(
    status: str = Query("all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FriendshipOut]:
    stmt = select(Friendship).where(
        or_(
            Friendship.requester_id == current_user.id,
            Friendship.addressee_id == current_user.id,
        )
    )
    if status != "all":
        stmt = stmt.where(Friendship.status == status)

    friendships = db.scalars(stmt).all()
    result = []
    for f in friendships:
        if f.requester_id == current_user.id:
            other_user = db.get(User, f.addressee_id)
            incoming = False
        else:
            other_user = db.get(User, f.requester_id)
            incoming = True
        if other_user:
            result.append(FriendshipOut(
                id=f.id,
                user=UserOut.model_validate(other_user),
                status=f.status,
                incoming=incoming,
            ))
    return result


@app.post("/friends/request", response_model=FriendshipOut)
def send_friend_request(
    payload: DMChannelCreate,  # reuse: has recipient_id
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FriendshipOut:
    recipient = db.get(User, payload.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    existing = db.scalar(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == recipient.id),
                and_(Friendship.requester_id == recipient.id, Friendship.addressee_id == current_user.id),
            )
        )
    )
    if existing:
        if existing.status == "blocked":
            raise HTTPException(status_code=400, detail="Cannot send friend request")
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        raise HTTPException(status_code=400, detail="Friend request already exists")

    friendship = Friendship(requester_id=current_user.id, addressee_id=recipient.id, status="pending")
    db.add(friendship)
    db.commit()
    db.refresh(friendship)
    return FriendshipOut(
        id=friendship.id,
        user=UserOut.model_validate(recipient),
        status="pending",
        incoming=False,
    )


@app.post("/friends/{friendship_id}/accept", response_model=FriendshipOut)
def accept_friend_request(
    friendship_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FriendshipOut:
    friendship = db.get(Friendship, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if friendship.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if friendship.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    friendship.status = "accepted"
    friendship.updated_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(friendship)

    other_user = db.get(User, friendship.requester_id)
    return FriendshipOut(
        id=friendship.id,
        user=UserOut.model_validate(other_user),
        status="accepted",
        incoming=True,
    )


@app.post("/friends/{friendship_id}/reject", status_code=204)
def reject_friend_request(
    friendship_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    friendship = db.get(Friendship, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if friendship.addressee_id != current_user.id and friendship.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(friendship)
    db.commit()


@app.post("/friends/{friendship_id}/block", response_model=FriendshipOut)
def block_user(
    friendship_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FriendshipOut:
    friendship = db.get(Friendship, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if friendship.requester_id != current_user.id and friendship.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    friendship.status = "blocked"
    friendship.updated_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(friendship)

    if friendship.requester_id == current_user.id:
        other_user = db.get(User, friendship.addressee_id)
        incoming = False
    else:
        other_user = db.get(User, friendship.requester_id)
        incoming = True
    return FriendshipOut(
        id=friendship.id,
        user=UserOut.model_validate(other_user),
        status="blocked",
        incoming=incoming,
    )


@app.get("/servers", response_model=list[ServerOut])
def list_servers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ServerOut]:
    servers = db.scalars(
        select(Server)
        .join(ServerMembership)
        .where(ServerMembership.user_id == current_user.id)
    ).all()
    return servers


@app.post("/servers", response_model=ServerOut)
def create_server(
    payload: ServerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServerOut:
    server = Server(name=payload.name, owner_id=current_user.id)
    db.add(server)
    db.flush()

    membership = ServerMembership(
        user_id=current_user.id, server_id=server.id, role="owner"
    )
    db.add(membership)

    default_channel = Channel(server_id=server.id, name="general", type="text")
    db.add(default_channel)

    db.commit()
    db.refresh(server)
    return server


@app.put("/servers/{server_id}", response_model=ServerOut)
def update_server(
    server_id: str,
    payload: ServerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServerOut:
    require_membership(db, current_user.id, server_id)
    membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can rename servers")

    server = db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    server.name = payload.name
    db.commit()
    db.refresh(server)
    return server


@app.delete("/servers/{server_id}", status_code=204)
def delete_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    require_membership(db, current_user.id, server_id)
    membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can delete a server")

    server = db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(server)
    db.commit()


@app.post("/servers/{server_id}/leave", status_code=204)
def leave_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Not a member")
    if membership.role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot leave. Transfer ownership or delete the server.")
    db.delete(membership)
    db.commit()


def require_membership(db: Session, user_id: str, server_id: str) -> None:
    membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == user_id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a server member")


def require_channel_access(db: Session, user_id: str, channel: Channel) -> None:
    if channel.is_dm:
        dm_member = db.scalar(
            select(DMChannelMember).where(
                (DMChannelMember.channel_id == channel.id)
                & (DMChannelMember.user_id == user_id)
            )
        )
        if not dm_member:
            raise HTTPException(status_code=403, detail="Not a DM participant")
    else:
        if not channel.server_id:
            raise HTTPException(status_code=403, detail="Invalid channel")
        require_membership(db, user_id, channel.server_id)


async def _broadcast_voice_occupants(channel_id: str) -> None:
    members = _voice_occupants.get(channel_id, [])
    payload = {"event": "voice.occupants", "channel_id": channel_id, "members": members}
    for ws in list(_presence_sockets):
        try:
            await ws.send_json(payload)
        except Exception:
            _presence_sockets.discard(ws)


def _remove_voice_occupant(user_id: str) -> str | None:
    """Remove user from any voice channel they occupy. Returns channel_id or None."""
    for ch_id, members in list(_voice_occupants.items()):
        before = len(members)
        _voice_occupants[ch_id] = [m for m in members if m["user_id"] != user_id]
        if len(_voice_occupants[ch_id]) != before:
            if not _voice_occupants[ch_id]:
                del _voice_occupants[ch_id]
            return ch_id
    return None


def _voice_config() -> tuple[str, str, str, int]:
    livekit_url = os.getenv("LIVEKIT_URL", "").strip()
    api_key = os.getenv("LIVEKIT_API_KEY", "").strip()
    api_secret = os.getenv("LIVEKIT_API_SECRET", "").strip()

    ttl_value = os.getenv("LIVEKIT_TOKEN_TTL_MIN", "240")
    try:
        ttl_minutes = int(ttl_value)
    except ValueError:
        ttl_minutes = 240
    ttl_minutes = min(max(ttl_minutes, 15), 1440)

    return livekit_url, api_key, api_secret, ttl_minutes


@app.post("/servers/{server_id}/join", response_model=ServerOut)
def join_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServerOut:
    server = db.get(Server, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    existing = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if not existing:
        db.add(
            ServerMembership(user_id=current_user.id, server_id=server_id)
        )
        db.commit()

    return server


@app.get("/servers/{server_id}/channels", response_model=list[ChannelOut])
def list_channels(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChannelOut]:
    require_membership(db, current_user.id, server_id)
    channels = db.scalars(select(Channel).where(Channel.server_id == server_id)).all()
    return channels


@app.post("/servers/{server_id}/channels", response_model=ChannelOut)
def create_channel(
    server_id: str,
    payload: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChannelOut:
    require_membership(db, current_user.id, server_id)
    channel = Channel(server_id=server_id, name=payload.name, type=payload.type)
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@app.put("/servers/{server_id}/channels/{channel_id}", response_model=ChannelOut)
def update_channel(
    server_id: str,
    channel_id: str,
    payload: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChannelOut:
    require_membership(db, current_user.id, server_id)
    channel = db.get(Channel, channel_id)
    if not channel or channel.server_id != server_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    channel.name = payload.name
    db.commit()
    db.refresh(channel)
    return channel


@app.delete("/servers/{server_id}/channels/{channel_id}", status_code=204)
def delete_channel(
    server_id: str,
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    require_membership(db, current_user.id, server_id)
    membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can delete channels")
    channel = db.get(Channel, channel_id)
    if not channel or channel.server_id != server_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    db.delete(channel)
    db.commit()


@app.get("/servers/{server_id}/categories", response_model=list[CategoryOut])
def list_categories(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CategoryOut]:
    require_membership(db, current_user.id, server_id)
    return db.scalars(
        select(ChannelCategory)
        .where(ChannelCategory.server_id == server_id)
        .order_by(ChannelCategory.position)
    ).all()


@app.post("/servers/{server_id}/categories", response_model=CategoryOut)
def create_category(
    server_id: str,
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    require_membership(db, current_user.id, server_id)
    max_pos = db.scalar(
        select(func.max(ChannelCategory.position))
        .where(ChannelCategory.server_id == server_id)
    ) or 0
    category = ChannelCategory(
        server_id=server_id,
        name=payload.name,
        position=max_pos + 1,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@app.get("/servers/{server_id}/members", response_model=list[MemberOut])
def list_members(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    require_membership(db, current_user.id, server_id)
    rows = db.execute(
        select(User.id, User.username, ServerMembership.role)
        .join(ServerMembership, ServerMembership.user_id == User.id)
        .where(ServerMembership.server_id == server_id)
    ).all()
    return [
        MemberOut(id=row.id, username=row.username, role=row.role)
        for row in rows
    ]


@app.put("/servers/{server_id}/members/{member_id}/role", response_model=MemberOut)
def update_member_role(
    server_id: str,
    member_id: str,
    payload: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemberOut:
    require_membership(db, current_user.id, server_id)

    # Check requester's role
    requester_membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if requester_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can change roles")

    if payload.role == "owner" and requester_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can assign owner role")

    # Find target membership
    target_membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == member_id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")

    if target_membership.role == "owner" and requester_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Cannot change owner's role")

    target_membership.role = payload.role
    db.commit()

    target_user = db.get(User, member_id)
    return MemberOut(id=target_user.id, username=target_user.username, role=payload.role)


@app.delete("/servers/{server_id}/members/{member_id}", status_code=204)
def kick_member(
    server_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    require_membership(db, current_user.id, server_id)

    requester_membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == current_user.id)
            & (ServerMembership.server_id == server_id)
        )
    )
    ROLE_RANK = {"owner": 4, "admin": 3, "moderator": 2, "member": 1}
    if ROLE_RANK.get(requester_membership.role, 0) < 2:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target_membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == member_id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found")

    if ROLE_RANK.get(target_membership.role, 0) >= ROLE_RANK.get(requester_membership.role, 0):
        raise HTTPException(status_code=403, detail="Cannot kick someone with equal or higher role")

    db.delete(target_membership)
    db.commit()


@app.get("/channels/{channel_id}/messages", response_model=list[MessageOut])
def list_messages(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    before: dt.datetime | None = None,
) -> list[MessageOut]:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    stmt = select(Message).where(Message.channel_id == channel_id)
    if before:
        stmt = stmt.where(Message.created_at < before)
    stmt = stmt.order_by(Message.created_at.desc()).limit(limit)
    messages = list(reversed(db.scalars(stmt).all()))

    result = []
    for msg in messages:
        out = MessageOut.model_validate(msg).model_copy()
        out.reactions = _aggregate_reactions(msg, db)
        result.append(out)
    return result


@app.post("/channels/{channel_id}/messages", response_model=MessageOut)
def create_message(
    channel_id: str,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    message = Message(
        channel_id=channel_id,
        author_id=current_user.id,
        content=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    payload_out = MessageOut.model_validate(message).model_dump()
    payload_out["event"] = "message.created"
    payload_out["author"] = {
        "id": current_user.id,
        "username": current_user.username,
    }

    _fire_and_forget(manager.broadcast(channel_id, payload_out))

    return message


import uuid as _uuid_mod

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".zip", ".mp3", ".mp4"}


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    unique_name = f"{_uuid_mod.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / unique_name
    dest.write_bytes(data)

    url = f"/uploads/{unique_name}"
    return {"url": url, "filename": file.filename}


@app.get("/uploads/{filename}", include_in_schema=False)
async def serve_upload(filename: str):
    safe_name = Path(filename).name
    candidate = UPLOADS_DIR / safe_name
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(candidate)


@app.post("/channels/{channel_id}/messages/with-attachment", response_model=MessageOut)
def create_message_with_attachment(
    channel_id: str,
    payload: MessageCreateWithAttachment,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    if not payload.content.strip() and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="Message must have content or attachment")

    message = Message(
        channel_id=channel_id,
        author_id=current_user.id,
        content=payload.content or "",
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    payload_out = MessageOut.model_validate(message).model_dump()
    payload_out["event"] = "message.created"
    payload_out["author"] = {"id": current_user.id, "username": current_user.username}

    _fire_and_forget(manager.broadcast(channel_id, payload_out))

    return message


@app.put("/channels/{channel_id}/messages/{message_id}", response_model=MessageOut)
def update_message(
    channel_id: str,
    message_id: str,
    payload: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    message = db.get(Message, message_id)
    if not message or message.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's message")

    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    message.content = payload.content
    message.edited_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(message)

    payload_out = MessageOut.model_validate(message).model_dump()
    payload_out["event"] = "message.updated"
    payload_out["author"] = {"id": current_user.id, "username": current_user.username}

    _fire_and_forget(manager.broadcast(channel_id, payload_out))

    return message


@app.delete("/channels/{channel_id}/messages/{message_id}", status_code=204)
def delete_message(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    message = db.get(Message, message_id)
    if not message or message.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's message")

    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    db.delete(message)
    db.commit()

    payload_out = {"event": "message.deleted", "id": message_id, "channel_id": channel_id}

    _fire_and_forget(manager.broadcast(channel_id, payload_out))


@app.post("/channels/{channel_id}/read", status_code=204)
def mark_channel_read(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    existing = db.scalar(
        select(ReadReceipt).where(
            (ReadReceipt.user_id == current_user.id)
            & (ReadReceipt.channel_id == channel_id)
        )
    )
    if existing:
        existing.last_read_at = dt.datetime.now(dt.timezone.utc)
    else:
        db.add(ReadReceipt(
            user_id=current_user.id,
            channel_id=channel_id,
            last_read_at=dt.datetime.now(dt.timezone.utc),
        ))
    db.commit()


@app.get("/channels/unread")
def get_unread_counts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func as sa_func

    receipts = db.execute(
        select(ReadReceipt.channel_id, ReadReceipt.last_read_at)
        .where(ReadReceipt.user_id == current_user.id)
    ).all()
    receipt_map = {r.channel_id: r.last_read_at for r in receipts}

    # Get channels the user has access to (server channels + DMs)
    from .models import DMChannelMember, ServerMembership

    server_channel_ids = db.scalars(
        select(Channel.id)
        .join(Server, Channel.server_id == Server.id)
        .join(ServerMembership, ServerMembership.server_id == Server.id)
        .where(ServerMembership.user_id == current_user.id)
        .where(Channel.type == "text")
    ).all()

    dm_channel_ids = db.scalars(
        select(DMChannelMember.channel_id)
        .where(DMChannelMember.user_id == current_user.id)
    ).all()

    all_channel_ids = list(set(server_channel_ids + dm_channel_ids))

    result = {}
    for ch_id in all_channel_ids:
        last_read = receipt_map.get(ch_id)
        if last_read:
            count = db.scalar(
                select(sa_func.count(Message.id))
                .where(Message.channel_id == ch_id)
                .where(Message.created_at > last_read)
                .where(Message.author_id != current_user.id)
            )
        else:
            count = db.scalar(
                select(sa_func.count(Message.id))
                .where(Message.channel_id == ch_id)
                .where(Message.author_id != current_user.id)
            )
        if count and count > 0:
            result[ch_id] = count

    return result


def _aggregate_reactions(message: Message, db: Session) -> list[dict]:
    reactions = db.scalars(
        select(Reaction).where(Reaction.message_id == message.id)
    ).all()
    grouped: dict[str, list[str]] = {}
    for r in reactions:
        grouped.setdefault(r.emoji, []).append(r.user_id)
    return [
        {"emoji": emoji, "count": len(users), "users": users}
        for emoji, users in grouped.items()
    ]


@app.get("/channels/{channel_id}/messages/{message_id}/reactions", response_model=list[ReactionOut])
def get_reactions(
    channel_id: str,
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReactionOut]:
    message = db.get(Message, message_id)
    if not message or message.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Message not found")
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)
    return _aggregate_reactions(message, db)


@app.put("/channels/{channel_id}/messages/{message_id}/reactions", response_model=list[ReactionOut])
def toggle_reaction(
    channel_id: str,
    message_id: str,
    payload: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReactionOut]:
    message = db.get(Message, message_id)
    if not message or message.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Message not found")
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    require_channel_access(db, current_user.id, channel)

    existing = db.scalar(
        select(Reaction).where(
            (Reaction.message_id == message_id)
            & (Reaction.user_id == current_user.id)
            & (Reaction.emoji == payload.emoji)
        )
    )
    if existing:
        db.delete(existing)
    else:
        db.add(Reaction(message_id=message_id, user_id=current_user.id, emoji=payload.emoji))
    db.commit()

    aggregated = _aggregate_reactions(message, db)
    broadcast_payload = {
        "event": "reaction.updated",
        "message_id": message_id,
        "channel_id": channel_id,
        "reactions": aggregated,
    }

    _fire_and_forget(manager.broadcast(channel_id, broadcast_payload))

    return aggregated


@app.post("/voice/token", response_model=VoiceTokenOut)
def create_voice_token(
    payload: VoiceTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VoiceTokenOut:
    channel = db.get(Channel, payload.channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.type != "voice":
        raise HTTPException(status_code=400, detail="Channel is not a voice channel")

    require_channel_access(db, current_user.id, channel)

    livekit_url, api_key, api_secret, ttl_minutes = _voice_config()
    if not livekit_url or not api_key or not api_secret:
        raise HTTPException(
            status_code=503,
            detail="Voice service is not configured",
        )

    try:
        from livekit import api as livekit_api
    except Exception as exc:  # pragma: no cover - only triggers when missing dep
        raise HTTPException(
            status_code=503,
            detail="Voice dependency not installed",
        ) from exc

    room_name = f"voice-{channel.id}"
    token = (
        livekit_api.AccessToken(api_key, api_secret)
        .with_identity(current_user.id)
        .with_name(current_user.username)
        .with_ttl(dt.timedelta(minutes=ttl_minutes))
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    old_ch = _remove_voice_occupant(current_user.id)
    if old_ch:
        _fire_and_forget(_broadcast_voice_occupants(old_ch))

    occupant = {"user_id": current_user.id, "username": current_user.username, "avatar_url": current_user.avatar_url}
    members = _voice_occupants.setdefault(payload.channel_id, [])
    if not any(m["user_id"] == current_user.id for m in members):
        members.append(occupant)
    _fire_and_forget(_broadcast_voice_occupants(payload.channel_id))

    return VoiceTokenOut(
        token=token,
        url=livekit_url,
        room=room_name,
        identity=current_user.id,
        name=current_user.username,
    )


@app.post("/voice/disconnect", status_code=204)
async def voice_disconnect(
    current_user: User = Depends(get_current_user),
) -> None:
    ch_id = _remove_voice_occupant(current_user.id)
    if ch_id:
        await _broadcast_voice_occupants(ch_id)


@app.get("/voice/occupants/{server_id}")
def voice_occupants(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, server_id)
    channels = db.scalars(
        select(Channel).where(
            (Channel.server_id == server_id) & (Channel.type == "voice")
        )
    ).all()
    result = {}
    for ch in channels:
        members = _voice_occupants.get(ch.id, [])
        if members:
            result[ch.id] = members
    return result


@app.websocket("/ws/channels/{channel_id}")
async def channel_socket(
    websocket: WebSocket,
    channel_id: str,
    token: Annotated[str, Query()],
) -> None:
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)
            return

        channel = db.get(Channel, channel_id)
        if not channel:
            await websocket.close(code=1008)
            return

        try:
            require_channel_access(db, user.id, channel)
        except HTTPException:
            await websocket.close(code=1008)
            return

        user_id = user.id
        username = user.username
    finally:
        db.close()

    await manager.connect(channel_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                import json
                data = json.loads(raw)
                if data.get("event") == "typing.start":
                    typing_payload = {
                        "event": "typing.start",
                        "user_id": user_id,
                        "username": username,
                        "channel_id": channel_id,
                    }
                    await manager.broadcast_except(channel_id, typing_payload, websocket)
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        manager.disconnect(channel_id, websocket)


@app.websocket("/ws/presence")
async def presence_socket(
    websocket: WebSocket,
    token: Annotated[str, Query()],
) -> None:
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008)
            return
        user_id = user.id
    finally:
        db.close()

    await websocket.accept()
    _presence[user_id] = "online"
    _presence_sockets.add(websocket)

    status_payload = {"event": "presence.update", "user_id": user_id, "status": "online"}
    for ws in list(_presence_sockets):
        if ws is not websocket:
            try:
                await ws.send_json(status_payload)
            except Exception:
                _presence_sockets.discard(ws)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                import json
                data = json.loads(raw)
                if data.get("event") == "presence.update" and data.get("status") in ("online", "idle", "dnd", "offline"):
                    _presence[user_id] = data["status"]
                    payload = {"event": "presence.update", "user_id": user_id, "status": data["status"]}
                    for ws in list(_presence_sockets):
                        if ws is not websocket:
                            try:
                                await ws.send_json(payload)
                            except Exception:
                                _presence_sockets.discard(ws)
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        pass
    finally:
        _presence_sockets.discard(websocket)
        _presence[user_id] = "offline"
        offline_payload = {"event": "presence.update", "user_id": user_id, "status": "offline"}
        for ws in list(_presence_sockets):
            try:
                await ws.send_json(offline_payload)
            except Exception:
                _presence_sockets.discard(ws)

        voice_ch = _remove_voice_occupant(user_id)
        if voice_ch:
            await _broadcast_voice_occupants(voice_ch)


@app.get("/presence")
def get_presence(current_user: User = Depends(get_current_user)):
    return {uid: status for uid, status in _presence.items() if status != "offline"}


@app.get("/", include_in_schema=False)
async def serve_root() -> FileResponse:
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")
    return FileResponse(INDEX_FILE)


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str) -> FileResponse:
    blocked_prefixes = {
        "auth",
        "users",
        "servers",
        "channels",
        "voice",
        "ws",
        "health",
        "docs",
        "openapi.json",
        "redoc",
        "dm",
        "friends",
        "upload",
        "uploads",
        "presence",
    }
    first_segment = full_path.split("/", 1)[0]
    if first_segment in blocked_prefixes:
        raise HTTPException(status_code=404, detail="Not found")

    candidate = DIST_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    raise HTTPException(status_code=404, detail="Frontend build not found")
