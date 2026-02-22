import { pickColor, initialsFromName } from "../utils/helpers";

export default function ProfileCard({
  user,
  voiceConnected,
  voiceMuted,
  voiceDeafened,
  onToggleMute,
  onToggleDeafen,
}) {
  return (
    <div className="profile-card">
      <div className="profile-main">
        <span
          className="avatar small"
          style={{ background: pickColor(user.username) }}
        >
          {initialsFromName(user.username)}
        </span>
        <div>
          <p>{user.username}</p>
          <span className="muted">
            {voiceConnected ? "In voice" : "Online"}
          </span>
        </div>
      </div>
      <div className="profile-actions">
        <button
          type="button"
          className={`icon-btn ${voiceMuted ? "active" : ""}`}
          onClick={onToggleMute}
          disabled={!voiceConnected}
        >
          Mic
        </button>
        <button
          type="button"
          className={`icon-btn ${voiceDeafened ? "active" : ""}`}
          onClick={onToggleDeafen}
          disabled={!voiceConnected}
        >
          Deafen
        </button>
      </div>
    </div>
  );
}
