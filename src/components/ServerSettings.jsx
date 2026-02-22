import { useState } from "react";
import { api } from "../utils/api";
import { pickColor, initialsFromName } from "../utils/helpers";

const ROLE_RANK = { owner: 4, admin: 3, moderator: 2, member: 1 };
const ROLE_OPTIONS = ["admin", "moderator", "member"];

export default function ServerSettings({
  server,
  members,
  currentUserId,
  token,
  onClose,
  onServerUpdated,
  onServerDeleted,
  onLeft,
  onMembersUpdated,
}) {
  const [tab, setTab] = useState("overview");
  const [name, setName] = useState(server.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const myMember = members.find((m) => m.id === currentUserId);
  const myRole = myMember?.role || "member";
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const handleRename = async () => {
    if (!name.trim() || name === server.name) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api(`/servers/${server.id}`, {
        method: "PUT", body: { name: name.trim() }, token,
      });
      onServerUpdated(updated);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this server? This cannot be undone.")) return;
    try {
      await api(`/servers/${server.id}`, { method: "DELETE", token });
      onServerDeleted(server.id);
    } catch (err) { setError(err.message); }
  };

  const handleLeave = async () => {
    if (!confirm("Leave this server?")) return;
    try {
      await api(`/servers/${server.id}/leave`, { method: "POST", token });
      onLeft(server.id);
    } catch (err) { setError(err.message); }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await api(`/servers/${server.id}/members/${memberId}/role`, {
        method: "PUT", body: { role: newRole }, token,
      });
      onMembersUpdated();
    } catch (err) { setError(err.message); }
  };

  const handleKick = async (memberId) => {
    if (!confirm("Kick this member?")) return;
    try {
      await api(`/servers/${server.id}/members/${memberId}`, { method: "DELETE", token });
      onMembersUpdated();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>{server.name} — Settings</h2>
        <button type="button" className="icon-btn" onClick={onClose}>X</button>
      </div>

      <div className="settings-tabs">
        <button type="button" className={`settings-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button type="button" className={`settings-tab ${tab === "members" ? "active" : ""}`} onClick={() => setTab("members")}>Members</button>
      </div>

      {error ? <div className="friends-error">{error}</div> : null}

      {tab === "overview" ? (
        <div className="settings-section">
          {isOwnerOrAdmin ? (
            <>
              <label className="profile-edit-label">
                Server Name
                <input className="profile-edit-input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <button type="button" className="chip solid" onClick={handleRename} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <p className="muted">You don't have permission to edit server settings.</p>
          )}

          <hr className="settings-divider" />

          {myRole === "owner" ? (
            <button type="button" className="chip danger-btn" onClick={handleDelete}>Delete Server</button>
          ) : (
            <button type="button" className="chip" onClick={handleLeave}>Leave Server</button>
          )}
        </div>
      ) : (
        <div className="settings-section">
          {members.map((m) => (
            <div key={m.id} className="friend-row">
              <div className="friend-info">
                <span className="avatar small" style={{ background: pickColor(m.username) }}>
                  {initialsFromName(m.username)}
                </span>
                <div>
                  <span className="friend-name">{m.username}</span>
                  <span className="muted friend-status">{m.role}</span>
                </div>
              </div>
              {isOwnerOrAdmin && m.id !== currentUserId && ROLE_RANK[myRole] > ROLE_RANK[m.role] ? (
                <div className="friend-actions">
                  <select
                    className="role-select"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  >
                    {ROLE_OPTIONS.filter((r) => ROLE_RANK[r] < ROLE_RANK[myRole]).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button type="button" className="chip danger-btn" onClick={() => handleKick(m.id)}>Kick</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
