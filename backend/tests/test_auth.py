def test_register_success(client):
    resp = client.post("/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "secure123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["email"] == "new@example.com"
    assert "id" in data


def test_register_duplicate_email(client):
    payload = {"username": "user1", "email": "dup@example.com", "password": "secure123"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json={
        "username": "user2",
        "email": "dup@example.com",
        "password": "secure123",
    })
    assert resp.status_code == 400


def test_register_duplicate_username(client):
    client.post("/auth/register", json={
        "username": "taken",
        "email": "a@example.com",
        "password": "secure123",
    })
    resp = client.post("/auth/register", json={
        "username": "taken",
        "email": "b@example.com",
        "password": "secure123",
    })
    assert resp.status_code == 400


def test_login_success(client):
    client.post("/auth/register", json={
        "username": "logintest",
        "email": "login@example.com",
        "password": "secure123",
    })
    resp = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "secure123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "username": "logintest",
        "email": "login@example.com",
        "password": "secure123",
    })
    resp = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


def test_login_nonexistent_email(client):
    resp = client.post("/auth/login", json={
        "email": "nobody@example.com",
        "password": "whatever",
    })
    assert resp.status_code == 401


def test_me_authenticated(client, auth_headers):
    resp = client.get("/users/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"


def test_me_unauthenticated(client):
    resp = client.get("/users/me")
    assert resp.status_code == 403
