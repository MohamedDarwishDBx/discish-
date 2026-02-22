import { VoiceIcon } from "./Icons";

export default function VoiceStatusBar({ channel, onGoToChannel, onDisconnect }) {
  return (
    <div className="voice-status-bar">
      <div className="voice-status-info">
        <span className="voice-status-dot" />
        <div>
          <p className="voice-status-label">Voice Connected</p>
          <button
            type="button"
            className="voice-status-channel"
            onClick={onGoToChannel}
          >
            <VoiceIcon size={14} /> {channel.name}
          </button>
        </div>
      </div>
      <button type="button" className="voice-disconnect-btn" onClick={onDisconnect} title="Disconnect">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.96.96 0 0 1 0-1.36C3.46 8.72 7.46 7 12 7s8.54 1.72 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.98.98 0 0 1-.71.29c-.27 0-.52-.1-.7-.28a11.3 11.3 0 0 0-2.67-1.85.99.99 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9Z" /></svg>
      </button>
    </div>
  );
}
