from tests.conftest import _register_and_login


def _setup_server_with_member(client, owner_headers, member_headers):
    """Create a server, add a second user as member, return (server_id, member_user_id)."""
    server = client.post("/servers", json={"name": "Timeout Test"}, headers=owner_headers).json()
    server_id = server["id"]
    client.post(f"/servers/{server_id}/join", headers=member_headers)
    members = client.get(f"/servers/{server_id}/members", headers=owner_headers).json()
    member = next(m for m in members if m["role"] == "member")
    return server_id, member["id"]


# --- Create timeout ---

def test_owner_can_timeout_member(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    resp = client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id,
        "duration_minutes": 5,
        "reason": "spamming",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == member_id
    assert data["reason"] == "spamming"
    assert "expires_at" in data


def test_timeout_without_reason(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    resp = client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id,
        "duration_minutes": 15,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["reason"] is None


def test_member_cannot_timeout(client, auth_headers, second_auth_headers):
    server_id, _ = _setup_server_with_member(client, auth_headers, second_auth_headers)
    # Get owner's user id
    members = client.get(f"/servers/{server_id}/members", headers=auth_headers).json()
    owner_id = next(m for m in members if m["role"] == "owner")["id"]
    # Member tries to timeout owner
    resp = client.post(f"/servers/{server_id}/timeout", json={
        "user_id": owner_id,
        "duration_minutes": 5,
    }, headers=second_auth_headers)
    assert resp.status_code == 403


def test_cannot_timeout_equal_role(client, auth_headers):
    """Owner cannot timeout themselves (equal role)."""
    server = client.post("/servers", json={"name": "Self Timeout"}, headers=auth_headers).json()
    me = client.get("/users/me", headers=auth_headers).json()
    resp = client.post(f"/servers/{server['id']}/timeout", json={
        "user_id": me["id"],
        "duration_minutes": 5,
    }, headers=auth_headers)
    assert resp.status_code == 403


def test_timeout_nonexistent_member(client, auth_headers):
    server = client.post("/servers", json={"name": "Ghost"}, headers=auth_headers).json()
    resp = client.post(f"/servers/{server['id']}/timeout", json={
        "user_id": "nonexistent-id",
        "duration_minutes": 5,
    }, headers=auth_headers)
    assert resp.status_code == 404


# --- Remove timeout ---

def test_remove_timeout(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 60,
    }, headers=auth_headers)

    resp = client.delete(f"/servers/{server_id}/timeout/{member_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_remove_nonexistent_timeout(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    resp = client.delete(f"/servers/{server_id}/timeout/{member_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_member_cannot_remove_timeout(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 60,
    }, headers=auth_headers)
    # Member tries to remove their own timeout
    resp = client.delete(f"/servers/{server_id}/timeout/{member_id}", headers=second_auth_headers)
    assert resp.status_code == 403


# --- List timeouts ---

def test_list_timeouts(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 60,
    }, headers=auth_headers)

    resp = client.get(f"/servers/{server_id}/timeouts", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == member_id


def test_list_timeouts_empty(client, auth_headers):
    server = client.post("/servers", json={"name": "Empty"}, headers=auth_headers).json()
    resp = client.get(f"/servers/{server['id']}/timeouts", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_member_cannot_list_timeouts(client, auth_headers, second_auth_headers):
    server_id, _ = _setup_server_with_member(client, auth_headers, second_auth_headers)
    resp = client.get(f"/servers/{server_id}/timeouts", headers=second_auth_headers)
    assert resp.status_code == 403


# --- Timeout enforcement ---

def test_timed_out_user_cannot_send_message(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    channels = client.get(f"/servers/{server_id}/channels", headers=auth_headers).json()
    channel_id = channels[0]["id"]

    # Timeout the member
    client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 60,
    }, headers=auth_headers)

    # Member tries to send a message
    resp = client.post(f"/channels/{channel_id}/messages", json={
        "content": "I'm timed out",
    }, headers=second_auth_headers)
    assert resp.status_code == 403
    assert "timed out" in resp.json()["detail"].lower()


def test_user_can_message_after_timeout_removed(client, auth_headers, second_auth_headers):
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)
    channels = client.get(f"/servers/{server_id}/channels", headers=auth_headers).json()
    channel_id = channels[0]["id"]

    # Timeout then remove
    client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 60,
    }, headers=auth_headers)
    client.delete(f"/servers/{server_id}/timeout/{member_id}", headers=auth_headers)

    # Member should be able to send again
    resp = client.post(f"/channels/{channel_id}/messages", json={
        "content": "I'm free!",
    }, headers=second_auth_headers)
    assert resp.status_code == 200


def test_timeout_replaces_existing(client, auth_headers, second_auth_headers):
    """Creating a new timeout for the same user replaces the old one."""
    server_id, member_id = _setup_server_with_member(client, auth_headers, second_auth_headers)

    client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 5, "reason": "first",
    }, headers=auth_headers)

    resp = client.post(f"/servers/{server_id}/timeout", json={
        "user_id": member_id, "duration_minutes": 60, "reason": "second",
    }, headers=auth_headers)
    assert resp.status_code == 200

    timeouts = client.get(f"/servers/{server_id}/timeouts", headers=auth_headers).json()
    assert len(timeouts) == 1
    assert timeouts[0]["reason"] == "second"
