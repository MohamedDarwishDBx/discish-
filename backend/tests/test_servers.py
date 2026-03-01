def test_create_server(client, auth_headers):
    resp = client.post("/servers", json={"name": "My Server"}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My Server"
    assert "id" in data
    assert "owner_id" in data


def test_list_servers_only_joined(client, auth_headers, second_auth_headers):
    client.post("/servers", json={"name": "Server A"}, headers=auth_headers)
    client.post("/servers", json={"name": "Server B"}, headers=second_auth_headers)

    resp = client.get("/servers", headers=auth_headers)
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Server A" in names
    assert "Server B" not in names


def test_server_has_default_channel(client, auth_headers):
    resp = client.post("/servers", json={"name": "WithChannel"}, headers=auth_headers)
    server_id = resp.json()["id"]

    channels = client.get(f"/servers/{server_id}/channels", headers=auth_headers).json()
    assert len(channels) >= 1
    assert channels[0]["name"] == "general"


def test_non_member_cannot_access_channels(client, auth_headers, second_auth_headers):
    resp = client.post("/servers", json={"name": "Private"}, headers=auth_headers)
    server_id = resp.json()["id"]

    resp = client.get(f"/servers/{server_id}/channels", headers=second_auth_headers)
    assert resp.status_code == 403


def test_create_channel(client, auth_headers):
    server = client.post("/servers", json={"name": "ChanTest"}, headers=auth_headers).json()
    resp = client.post(
        f"/servers/{server['id']}/channels",
        json={"name": "voice-chat", "type": "voice"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "voice-chat"
    assert resp.json()["type"] == "voice"


def test_list_members(client, auth_headers):
    server = client.post("/servers", json={"name": "Members"}, headers=auth_headers).json()
    resp = client.get(f"/servers/{server['id']}/members", headers=auth_headers)
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"
