def test_send_message(client, auth_headers, server_and_channel):
    _, channel = server_and_channel
    resp = client.post(
        f"/channels/{channel['id']}/messages",
        json={"content": "Hello world"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "Hello world"
    assert "id" in data
    assert data["channel_id"] == channel["id"]


def test_list_messages(client, auth_headers, server_and_channel):
    _, channel = server_and_channel
    client.post(f"/channels/{channel['id']}/messages", json={"content": "msg1"}, headers=auth_headers)
    client.post(f"/channels/{channel['id']}/messages", json={"content": "msg2"}, headers=auth_headers)

    resp = client.get(f"/channels/{channel['id']}/messages", headers=auth_headers)
    assert resp.status_code == 200
    messages = resp.json()
    assert len(messages) == 2
    contents = {m["content"] for m in messages}
    assert contents == {"msg1", "msg2"}


def test_edit_own_message(client, auth_headers, server_and_channel):
    _, channel = server_and_channel
    msg = client.post(
        f"/channels/{channel['id']}/messages",
        json={"content": "original"},
        headers=auth_headers,
    ).json()

    resp = client.put(
        f"/channels/{channel['id']}/messages/{msg['id']}",
        json={"content": "edited"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "edited"
    assert resp.json()["edited_at"] is not None


def test_delete_own_message(client, auth_headers, server_and_channel):
    _, channel = server_and_channel
    msg = client.post(
        f"/channels/{channel['id']}/messages",
        json={"content": "to delete"},
        headers=auth_headers,
    ).json()

    resp = client.delete(f"/channels/{channel['id']}/messages/{msg['id']}", headers=auth_headers)
    assert resp.status_code == 204

    messages = client.get(f"/channels/{channel['id']}/messages", headers=auth_headers).json()
    assert all(m["id"] != msg["id"] for m in messages)


def test_cannot_edit_other_users_message(client, auth_headers, second_auth_headers, server_and_channel):
    server, channel = server_and_channel
    # Add second user to server
    invite = server["id"]
    client.post(f"/servers/{invite}/join", headers=second_auth_headers)

    msg = client.post(
        f"/channels/{channel['id']}/messages",
        json={"content": "private"},
        headers=auth_headers,
    ).json()

    resp = client.put(
        f"/channels/{channel['id']}/messages/{msg['id']}",
        json={"content": "hacked"},
        headers=second_auth_headers,
    )
    assert resp.status_code == 403


def test_cannot_send_without_membership(client, auth_headers, second_auth_headers, server_and_channel):
    _, channel = server_and_channel
    resp = client.post(
        f"/channels/{channel['id']}/messages",
        json={"content": "intruder"},
        headers=second_auth_headers,
    )
    assert resp.status_code == 403
