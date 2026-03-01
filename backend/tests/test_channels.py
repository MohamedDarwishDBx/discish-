from tests.conftest import _register_and_login


def test_delete_channel_with_read_receipts(client, auth_headers):
    """Deleting a channel that has read receipts should succeed (cascade fix)."""
    server = client.post("/servers", json={"name": "CascadeTest"}, headers=auth_headers).json()
    server_id = server["id"]
    channels = client.get(f"/servers/{server_id}/channels", headers=auth_headers).json()
    channel_id = channels[0]["id"]

    # Send a message then mark channel as read (creates a ReadReceipt row)
    client.post(f"/channels/{channel_id}/messages", json={"content": "hello"}, headers=auth_headers)
    client.post(f"/channels/{channel_id}/read", headers=auth_headers)

    # Delete the channel — previously this caused FK violation
    resp = client.delete(f"/servers/{server_id}/channels/{channel_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_delete_channel_with_messages(client, auth_headers):
    """Deleting a channel with messages should cascade delete them."""
    server = client.post("/servers", json={"name": "MsgCascade"}, headers=auth_headers).json()
    server_id = server["id"]
    ch = client.post(f"/servers/{server_id}/channels", json={"name": "temp", "type": "text"}, headers=auth_headers).json()

    client.post(f"/channels/{ch['id']}/messages", json={"content": "msg1"}, headers=auth_headers)
    client.post(f"/channels/{ch['id']}/messages", json={"content": "msg2"}, headers=auth_headers)

    resp = client.delete(f"/servers/{server_id}/channels/{ch['id']}", headers=auth_headers)
    assert resp.status_code == 204


def test_delete_channel_requires_admin(client, auth_headers, second_auth_headers):
    """Members cannot delete channels."""
    server = client.post("/servers", json={"name": "PermTest"}, headers=auth_headers).json()
    server_id = server["id"]
    client.post(f"/servers/{server_id}/join", headers=second_auth_headers)
    channels = client.get(f"/servers/{server_id}/channels", headers=auth_headers).json()

    resp = client.delete(f"/servers/{server_id}/channels/{channels[0]['id']}", headers=second_auth_headers)
    assert resp.status_code == 403


def test_delete_nonexistent_channel(client, auth_headers):
    server = client.post("/servers", json={"name": "Ghost"}, headers=auth_headers).json()
    resp = client.delete(f"/servers/{server['id']}/channels/fake-id", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_channel_with_multiple_read_receipts(client, auth_headers, second_auth_headers):
    """Multiple users' read receipts should all cascade on channel delete."""
    server = client.post("/servers", json={"name": "MultiReceipt"}, headers=auth_headers).json()
    server_id = server["id"]
    client.post(f"/servers/{server_id}/join", headers=second_auth_headers)
    channels = client.get(f"/servers/{server_id}/channels", headers=auth_headers).json()
    channel_id = channels[0]["id"]

    # Both users read the channel
    client.post(f"/channels/{channel_id}/messages", json={"content": "hi"}, headers=auth_headers)
    client.post(f"/channels/{channel_id}/read", headers=auth_headers)
    client.post(f"/channels/{channel_id}/read", headers=second_auth_headers)

    resp = client.delete(f"/servers/{server_id}/channels/{channel_id}", headers=auth_headers)
    assert resp.status_code == 204
