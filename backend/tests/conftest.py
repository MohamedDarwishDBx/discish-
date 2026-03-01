import os

os.environ["JWT_SECRET"] = "test-secret-must-be-at-least-32-characters-long"
os.environ["DATABASE_URL"] = "sqlite:///test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# SQLite needs foreign key enforcement enabled per-connection
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _rec):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def reset_db():
    from app.main import _rate_limit_hits
    _rate_limit_hits.clear()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=False)


def _register_and_login(client, username, email, password="password123"):
    reg = client.post("/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    assert reg.status_code == 200, f"Register failed: {reg.text}"
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers(client):
    """Register a test user and return Authorization headers."""
    return _register_and_login(client, "testuser", "test@example.com")


@pytest.fixture()
def second_auth_headers(client):
    """Register a second test user and return Authorization headers."""
    return _register_and_login(client, "user2", "user2@example.com")


@pytest.fixture()
def server_and_channel(client, auth_headers):
    """Create a server (with default #general channel) and return (server, channel)."""
    resp = client.post("/servers", json={"name": "Test Server"}, headers=auth_headers)
    server = resp.json()
    channels = client.get(f"/servers/{server['id']}/channels", headers=auth_headers).json()
    return server, channels[0]
