import datetime as dt
import os
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    get_user_from_token,
    verify_password,
)
from .db import Base, SessionLocal, engine, get_db
from .models import Channel, Message, Reaction, Server, ServerMembership, User
from .schemas import (
    ChannelCreate,
    ChannelOut,
    MemberOut,
    MessageCreate,
    MessageOut,
    MessageUpdate,
    ReactionCreate,
    ReactionOut,
    ServerCreate,
    ServerOut,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    VoiceTokenOut,
    VoiceTokenRequest,
)
from .websocket_manager import ConnectionManager

load_dotenv()

app = FastAPI(title="Discord-like API", version="0.1.0")
manager = ConnectionManager()
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = PROJECT_ROOT / "dist"
INDEX_FILE = DIST_DIR / "index.html"
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
    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    if len(jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must be at least 32 characters")

    _, livekit_api_key, livekit_api_secret, _ = _voice_config()
    if livekit_api_key and len(livekit_api_secret) < 32:
        raise RuntimeError(
            "LIVEKIT_API_SECRET must be at least 32 characters"
        )

    Base.metadata.create_all(bind=engine)


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
        "camera=(), geolocation=(), interest-cohort=(), microphone=(self)",
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


def require_membership(db: Session, user_id: str, server_id: str) -> None:
    membership = db.scalar(
        select(ServerMembership).where(
            (ServerMembership.user_id == user_id)
            & (ServerMembership.server_id == server_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a server member")


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
    require_membership(db, current_user.id, channel.server_id)

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
    require_membership(db, current_user.id, channel.server_id)

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

    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(channel_id, payload_out))
    except RuntimeError:
        pass

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
    require_membership(db, current_user.id, channel.server_id)

    message.content = payload.content
    message.edited_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(message)

    payload_out = MessageOut.model_validate(message).model_dump()
    payload_out["event"] = "message.updated"
    payload_out["author"] = {"id": current_user.id, "username": current_user.username}

    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(channel_id, payload_out))
    except RuntimeError:
        pass

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
    require_membership(db, current_user.id, channel.server_id)

    db.delete(message)
    db.commit()

    payload_out = {"event": "message.deleted", "id": message_id, "channel_id": channel_id}

    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(channel_id, payload_out))
    except RuntimeError:
        pass


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
    require_membership(db, current_user.id, channel.server_id)
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
    require_membership(db, current_user.id, channel.server_id)

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

    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(channel_id, broadcast_payload))
    except RuntimeError:
        pass

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

    require_membership(db, current_user.id, channel.server_id)

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

    return VoiceTokenOut(
        token=token,
        url=livekit_url,
        room=room_name,
        identity=current_user.id,
        name=current_user.username,
    )


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
            require_membership(db, user.id, channel.server_id)
        except HTTPException:
            await websocket.close(code=1008)
            return

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
                            "user_id": user.id,
                            "username": user.username,
                            "channel_id": channel_id,
                        }
                        await manager.broadcast_except(channel_id, typing_payload, websocket)
                except (json.JSONDecodeError, KeyError):
                    pass
        except WebSocketDisconnect:
            manager.disconnect(channel_id, websocket)
    finally:
        db.close()


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
