import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { pickColor, initialsFromName } from "../utils/helpers";
import { CloseIcon } from "./Icons";
import Modal from "./Modal";

const ROLE_RANK = { owner: 4, admin: 3, moderator: 2, member: 1 };
const ROLE_OPTIONS = ["admin", "moderator", "member"];
const TIMEOUT_DURATIONS = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "1 hour", value: 60 },
  { label: "24 hours", value: 1440 },
];

function TimeoutIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

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
  const [confirmAction, setConfirmAction] = useState(null);
  const [timeoutDuration, setTimeoutDuration] = useState(5);
  const [timeoutReason, setTimeoutReason] = useState("");
  const [timeouts, setTimeouts] = useState([]);
  const [loadingTimeouts, setLoadingTimeouts] = useState(false);

  const myMember = members.find((m) => m.id === currentUserId);
  const myRole = myMember?.role || "member";
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const loadTimeouts = async () => {
    setLoadingTimeouts(true);
    try {
      const data = await api(`/servers/${server.id}/timeouts`, { token });
      setTimeouts(data);
    } catch (err) { setError(err.message); }
    finally { setLoadingTimeouts(false); }
  };

  useEffect(() => {
    if (tab === "timeouts" && isOwnerOrAdmin) {
      loadTimeouts();
    }
  }, [tab]);

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
    try {
      await api(`/servers/${server.id}`, { method: "DELETE", token });
      onServerDeleted(server.id);
    } catch (err) { setError(err.message); }
  };

  const handleLeave = async () => {
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
    try {
      await api(`/servers/${server.id}/members/${memberId}`, { method: "DELETE", token });
      onMembersUpdated();
    } catch (err) { setError(err.message); }
  };

  const handleTimeout = async (memberId) => {
    try {
      await api(`/servers/${server.id}/timeout`, {
        method: "POST",
        body: {
          user_id: memberId,
          duration_minutes: timeoutDuration,
          reason: timeoutReason || null,
        },
        token,
      });
      setConfirmAction(null);
      setTimeoutDuration(5);
      setTimeoutReason("");
    } catch (err) { setError(err.message); }
  };

  const handleRemoveTimeout = async (userId) => {
    try {
      await api(`/servers/${server.id}/timeout/${userId}`, { method: "DELETE", token });
      setTimeouts((prev) => prev.filter((t) => t.user_id !== userId));
    } catch (err) { setError(err.message); }
  };

  const formatExpiry = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d - now;
    if (diffMs <= 0) return "Expired";
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m remaining`;
    const diffHr = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return `${diffHr}h ${remMin}m remaining`;
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>{server.name} — Settings</h2>
        <button type="button" className="icon-btn" onClick={onClose}><CloseIcon size={18} /></button>
      </div>

      <div className="settings-tabs">
        <button type="button" className={`settings-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button type="button" className={`settings-tab ${tab === "members" ? "active" : ""}`} onClick={() => setTab("members")}>Members</button>
        {isOwnerOrAdmin ? (
          <button type="button" className={`settings-tab ${tab === "timeouts" ? "active" : ""}`} onClick={() => setTab("timeouts")}>Timeouts</button>
        ) : null}
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
            <button
              type="button"
              className="chip danger-btn"
              onClick={() => setConfirmAction({ type: "delete" })}
            >
              Delete Server
            </button>
          ) : (
            <button
              type="button"
              className="chip"
              onClick={() => setConfirmAction({ type: "leave" })}
            >
              Leave Server
            </button>
          )}
        </div>
      ) : tab === "members" ? (
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
                  <button
                    type="button"
                    className="chip"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => {
                      setTimeoutDuration(5);
                      setTimeoutReason("");
                      setConfirmAction({ type: "timeout", memberId: m.id, memberName: m.username });
                    }}
                  >
                    <TimeoutIcon size={14} />
                    Timeout
                  </button>
                  <button
                    type="button"
                    className="chip danger-btn"
                    onClick={() => setConfirmAction({ type: "kick", memberId: m.id, memberName: m.username })}
                  >
                    Kick
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : tab === "timeouts" ? (
        <div className="settings-section">
          {loadingTimeouts ? (
            <p className="muted">Loading timeouts...</p>
          ) : timeouts.length === 0 ? (
            <p className="muted">No active timeouts.</p>
          ) : (
            timeouts.map((t) => (
              <div key={t.id} className="friend-row">
                <div className="friend-info">
                  <span className="avatar small" style={{ background: pickColor(t.username) }}>
                    {initialsFromName(t.username)}
                  </span>
                  <div>
                    <span className="friend-name">{t.username}</span>
                    <span className="muted friend-status">
                      {formatExpiry(t.expires_at)}
                      {t.reason ? ` — ${t.reason}` : ""}
                    </span>
                  </div>
                </div>
                <div className="friend-actions">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => handleRemoveTimeout(t.user_id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      <Modal
        open={confirmAction?.type === "delete"}
        title="Delete Server"
        onClose={() => setConfirmAction(null)}
        onSubmit={() => { handleDelete(); setConfirmAction(null); }}
        submitLabel="Delete"
      >
        <p>Are you sure you want to delete <strong>{server.name}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal
        open={confirmAction?.type === "leave"}
        title="Leave Server"
        onClose={() => setConfirmAction(null)}
        onSubmit={() => { handleLeave(); setConfirmAction(null); }}
        submitLabel="Leave"
      >
        <p>Are you sure you want to leave <strong>{server.name}</strong>?</p>
      </Modal>

      <Modal
        open={confirmAction?.type === "kick"}
        title="Kick Member"
        onClose={() => setConfirmAction(null)}
        onSubmit={() => { handleKick(confirmAction.memberId); setConfirmAction(null); }}
        submitLabel="Kick"
      >
        <p>Are you sure you want to kick <strong>{confirmAction?.memberName}</strong>?</p>
      </Modal>

      <Modal
        open={confirmAction?.type === "timeout"}
        title="Timeout Member"
        onClose={() => setConfirmAction(null)}
        onSubmit={() => { handleTimeout(confirmAction.memberId); }}
        submitLabel="Timeout"
      >
        <p>Timeout <strong>{confirmAction?.memberName}</strong> for:</p>
        <select
          className="role-select"
          style={{ width: "100%", marginBottom: 8 }}
          value={timeoutDuration}
          onChange={(e) => setTimeoutDuration(Number(e.target.value))}
        >
          {TIMEOUT_DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <label className="profile-edit-label">
          Reason (optional)
          <input
            className="profile-edit-input"
            value={timeoutReason}
            onChange={(e) => setTimeoutReason(e.target.value)}
            placeholder="Enter a reason..."
          />
        </label>
      </Modal>
    </div>
  );
}
