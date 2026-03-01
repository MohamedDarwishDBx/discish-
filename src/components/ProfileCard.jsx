import { pickColor, initialsFromName } from "../utils/helpers";
import { MicIcon, MicOffIcon, HeadphonesIcon, DeafenIcon } from "./Icons";

export default function ProfileCard({
  user,
  voiceConnected,
  voiceMuted,
  voiceDeafened,
  onToggleMute,
  onToggleDeafen,
  onClickProfile,
  ramadanTheme,
  onToggleTheme,
}) {
  return (
    <div className="profile-card">
      <button type="button" className="profile-main profile-main-clickable" onClick={onClickProfile}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="avatar small profile-card-avatar" />
        ) : (
          <span className="avatar small" style={{ background: pickColor(user.username) }}>
            {initialsFromName(user.username)}
          </span>
        )}
        <div>
          <p>{user.username}</p>
          <span className="muted">
            {voiceConnected ? "In voice" : "Online"}
          </span>
        </div>
      </button>
      <div className="profile-actions">
        <button
          type="button"
          className={`icon-btn ${voiceMuted ? "active" : ""}`}
          onClick={onToggleMute}
          disabled={!voiceConnected}
          title={voiceMuted ? "Unmute" : "Mute"}
        >
          {voiceMuted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
        </button>
        <button
          type="button"
          className={`icon-btn ${voiceDeafened ? "active" : ""}`}
          onClick={onToggleDeafen}
          disabled={!voiceConnected}
          title={voiceDeafened ? "Undeafen" : "Deafen"}
        >
          {voiceDeafened ? <DeafenIcon size={18} /> : <HeadphonesIcon size={18} />}
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          title={ramadanTheme ? "Default Theme" : "Ramadan Theme"}
        >
          {ramadanTheme ? "\u{1F319}" : "\u2600\uFE0F"}
        </button>
      </div>
    </div>
  );
}
