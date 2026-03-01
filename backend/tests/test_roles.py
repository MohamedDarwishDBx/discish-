from tests.conftest import _register_and_login


def _setup_server_with_two_members(client, owner_headers, member_headers):
    """Create server, add second user, return (server_id, owner_id, member_id)."""
    server = client.post("/servers", json={"name": "RoleTest"}, headers=owner_headers).json()
    server_id = server["id"]
    client.post(f"/servers/{server_id}/join", headers=member_headers)
    members = client.get(f"/servers/{server_id}/members", headers=owner_headers).json()
    owner_id = next(m for m in members if m["role"] == "owner")["id"]
    member_id = next(m for m in members if m["role"] == "member")["id"]
    return server_id, owner_id, member_id


def test_owner_can_change_member_role(client, auth_headers, second_auth_headers):
    server_id, _, member_id = _setup_server_with_two_members(client, auth_headers, second_auth_headers)
    resp = client.put(f"/servers/{server_id}/members/{member_id}/role", json={
        "role": "moderator",
    }, headers=auth_headers)
    assert resp.status_code == 200

    members = client.get(f"/servers/{server_id}/members", headers=auth_headers).json()
    updated = next(m for m in members if m["id"] == member_id)
    assert updated["role"] == "moderator"


def test_member_cannot_change_roles(client, auth_headers, second_auth_headers):
    server_id, owner_id, _ = _setup_server_with_two_members(client, auth_headers, second_auth_headers)
    resp = client.put(f"/servers/{server_id}/members/{owner_id}/role", json={
        "role": "member",
    }, headers=second_auth_headers)
    assert resp.status_code == 403


def test_owner_can_kick_member(client, auth_headers, second_auth_headers):
    server_id, _, member_id = _setup_server_with_two_members(client, auth_headers, second_auth_headers)
    resp = client.delete(f"/servers/{server_id}/members/{member_id}", headers=auth_headers)
    assert resp.status_code == 204

    members = client.get(f"/servers/{server_id}/members", headers=auth_headers).json()
    assert all(m["id"] != member_id for m in members)


def test_member_cannot_kick(client, auth_headers, second_auth_headers):
    server_id, owner_id, _ = _setup_server_with_two_members(client, auth_headers, second_auth_headers)
    resp = client.delete(f"/servers/{server_id}/members/{owner_id}", headers=second_auth_headers)
    assert resp.status_code == 403


def test_promote_to_admin_then_demote(client, auth_headers, second_auth_headers):
    server_id, _, member_id = _setup_server_with_two_members(client, auth_headers, second_auth_headers)

    # Promote to admin
    resp = client.put(f"/servers/{server_id}/members/{member_id}/role", json={
        "role": "admin",
    }, headers=auth_headers)
    assert resp.status_code == 200

    # Demote back to member
    resp = client.put(f"/servers/{server_id}/members/{member_id}/role", json={
        "role": "member",
    }, headers=auth_headers)
    assert resp.status_code == 200


def test_join_and_leave_server(client, auth_headers, second_auth_headers):
    server = client.post("/servers", json={"name": "JoinLeave"}, headers=auth_headers).json()
    server_id = server["id"]

    # Join
    resp = client.post(f"/servers/{server_id}/join", headers=second_auth_headers)
    assert resp.status_code == 200

    # Leave
    resp = client.post(f"/servers/{server_id}/leave", headers=second_auth_headers)
    assert resp.status_code == 204

    members = client.get(f"/servers/{server_id}/members", headers=auth_headers).json()
    assert len(members) == 1  # only owner remains


def test_delete_server_only_owner(client, auth_headers, second_auth_headers):
    server = client.post("/servers", json={"name": "DeleteTest"}, headers=auth_headers).json()
    server_id = server["id"]
    client.post(f"/servers/{server_id}/join", headers=second_auth_headers)

    # Member cannot delete
    resp = client.delete(f"/servers/{server_id}", headers=second_auth_headers)
    assert resp.status_code == 403

    # Owner can delete
    resp = client.delete(f"/servers/{server_id}", headers=auth_headers)
    assert resp.status_code == 204
