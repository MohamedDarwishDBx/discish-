from tests.conftest import _register_and_login


def _setup_voice_channel(client, owner_headers):
    """Create a server with a voice channel, return (server_id, voice_channel_id)."""
    server = client.post("/servers", json={"name": "VoiceTest"}, headers=owner_headers).json()
    server_id = server["id"]
    ch = client.post(f"/servers/{server_id}/channels", json={
        "name": "voice-room", "type": "voice",
    }, headers=owner_headers).json()
    return server_id, ch["id"]


def test_voice_kick_requires_moderator(client, auth_headers, second_auth_headers):
    """Regular members cannot kick from voice."""
    server_id, voice_ch_id = _setup_voice_channel(client, auth_headers)
    client.post(f"/servers/{server_id}/join", headers=second_auth_headers)

    me = client.get("/users/me", headers=auth_headers).json()
    resp = client.post("/voice/kick", json={
        "channel_id": voice_ch_id, "user_id": me["id"],
    }, headers=second_auth_headers)
    assert resp.status_code == 403


def test_voice_kick_missing_params(client, auth_headers):
    resp = client.post("/voice/kick", json={}, headers=auth_headers)
    assert resp.status_code == 400


def test_voice_kick_missing_user_id(client, auth_headers):
    server_id, voice_ch_id = _setup_voice_channel(client, auth_headers)
    resp = client.post("/voice/kick", json={
        "channel_id": voice_ch_id,
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_voice_kick_nonexistent_channel(client, auth_headers):
    resp = client.post("/voice/kick", json={
        "channel_id": "fake-channel", "user_id": "fake-user",
    }, headers=auth_headers)
    assert resp.status_code == 404


def test_voice_kick_text_channel_rejected(client, auth_headers):
    """Cannot kick from a text channel."""
    server = client.post("/servers", json={"name": "TextOnly"}, headers=auth_headers).json()
    channels = client.get(f"/servers/{server['id']}/channels", headers=auth_headers).json()
    text_ch_id = channels[0]["id"]  # #general is text

    resp = client.post("/voice/kick", json={
        "channel_id": text_ch_id, "user_id": "some-user",
    }, headers=auth_headers)
    assert resp.status_code == 400
    assert "not a voice channel" in resp.json()["detail"].lower()


def test_voice_kick_owner_can_kick(client, auth_headers, second_auth_headers):
    """Owner (role rank >= 2) can kick — the LiveKit call may fail in test
    env but the permission check should pass."""
    server_id, voice_ch_id = _setup_voice_channel(client, auth_headers)
    client.post(f"/servers/{server_id}/join", headers=second_auth_headers)
    members = client.get(f"/servers/{server_id}/members", headers=auth_headers).json()
    member_id = next(m for m in members if m["role"] == "member")["id"]

    # This will pass permission checks but may 204 or 500 depending on
    # LiveKit config — we just verify it doesn't return 403
    resp = client.post("/voice/kick", json={
        "channel_id": voice_ch_id, "user_id": member_id,
    }, headers=auth_headers)
    assert resp.status_code != 403
