import { useEffect, useState } from "react";
import { pickColor, initialsFromName } from "../utils/helpers";
import { api } from "../utils/api";

export default function FriendsList({ token, onStartDM }) {
  const [tab, setTab] = useState("all");
  const [friends, setFriends] = useState([]);
  const [addQuery, setAddQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFriends = async () => {
    try {
      const data = await api("/friends", { token });
      setFriends(data);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { loadFriends(); }, [token, tab]);

  const searchUsers = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const data = await api(`/users/search?q=${encodeURIComponent(q)}`, { token });
      setSearchResults(data);
    } catch (err) { setSearchResults([]); }
  };

  const sendRequest = async (userId) => {
    setError(""); setSuccess("");
    try {
      await api("/friends/request", { method: "POST", body: { recipient_id: userId }, token });
      setSuccess("Friend request sent!");
      setAddQuery("");
      setSearchResults([]);
      await loadFriends();
    } catch (err) { setError(err.message); }
  };

  const acceptRequest = async (friendshipId) => {
    try {
      await api(`/friends/${friendshipId}/accept`, { method: "POST", token });
      await loadFriends();
    } catch (err) { setError(err.message); }
  };

  const rejectRequest = async (friendshipId) => {
    try {
      await api(`/friends/${friendshipId}/reject`, { method: "POST", token });
      await loadFriends();
    } catch (err) { setError(err.message); }
  };

  const blockUser = async (friendshipId) => {
    try {
      await api(`/friends/${friendshipId}/block`, { method: "POST", token });
      await loadFriends();
    } catch (err) { setError(err.message); }
  };

  const filtered = friends.filter((f) => {
    if (tab === "all") return f.status === "accepted";
    if (tab === "pending") return f.status === "pending";
    if (tab === "blocked") return f.status === "blocked";
    return true;
  });

  const pendingCount = friends.filter((f) => f.status === "pending" && f.incoming).length;

  return (
    <div className="friends-panel">
      <div className="friends-tabs">
        <button type="button" className={`friends-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All</button>
        <button type="button" className={`friends-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          Pending{pendingCount > 0 ? <span className="friends-badge">{pendingCount}</span> : null}
        </button>
        <button type="button" className={`friends-tab ${tab === "blocked" ? "active" : ""}`} onClick={() => setTab("blocked")}>Blocked</button>
        <button type="button" className={`friends-tab add ${tab === "add" ? "active" : ""}`} onClick={() => setTab("add")}>Add Friend</button>
      </div>

      {error ? <div className="friends-error">{error}</div> : null}
      {success ? <div className="friends-success">{success}</div> : null}

      {tab === "add" ? (
        <div className="friends-add">
          <p className="friends-add-hint">You can add a friend with their username.</p>
          <div className="friends-add-row">
            <input
              className="friends-add-input"
              value={addQuery}
              onChange={(e) => { setAddQuery(e.target.value); searchUsers(e.target.value); }}
              placeholder="Enter a username"
            />
          </div>
          {searchResults.length > 0 ? (
            <div className="friends-search-results">
              {searchResults.map((u) => (
                <div key={u.id} className="friend-row">
                  <div className="friend-info">
                    <span className="avatar small" style={{ background: pickColor(u.username) }}>
                      {initialsFromName(u.username)}
                    </span>
                    <span className="friend-name">{u.username}</span>
                  </div>
                  <button type="button" className="chip solid" onClick={() => sendRequest(u.id)}>
                    Send Request
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="friends-list-body">
          {filtered.length === 0 ? (
            <p className="muted friends-empty">
              {tab === "all" ? "No friends yet. Add some!" : tab === "pending" ? "No pending requests." : "No blocked users."}
            </p>
          ) : (
            filtered.map((f) => (
              <div key={f.id} className="friend-row">
                <div className="friend-info">
                  <span className="avatar small" style={{ background: pickColor(f.user.username) }}>
                    {initialsFromName(f.user.username)}
                  </span>
                  <div>
                    <span className="friend-name">{f.user.username}</span>
                    <span className="muted friend-status">
                      {f.status === "pending" ? (f.incoming ? "Incoming request" : "Outgoing request") : f.status}
                    </span>
                  </div>
                </div>
                <div className="friend-actions">
                  {f.status === "accepted" ? (
                    <>
                      <button type="button" className="icon-btn" onClick={() => onStartDM(f.user.id)} title="Message">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" fill="currentColor" /></svg>
                      </button>
                      <button type="button" className="icon-btn" onClick={() => rejectRequest(f.id)} title="Remove">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z" fill="currentColor" /></svg>
                      </button>
                    </>
                  ) : f.status === "pending" && f.incoming ? (
                    <>
                      <button type="button" className="chip solid" onClick={() => acceptRequest(f.id)}>Accept</button>
                      <button type="button" className="chip" onClick={() => rejectRequest(f.id)}>Reject</button>
                    </>
                  ) : f.status === "pending" && !f.incoming ? (
                    <button type="button" className="chip" onClick={() => rejectRequest(f.id)}>Cancel</button>
                  ) : f.status === "blocked" ? (
                    <button type="button" className="chip" onClick={() => rejectRequest(f.id)}>Unblock</button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
