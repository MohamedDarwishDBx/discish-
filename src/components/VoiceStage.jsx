import { useState } from "react";
import { pickColor, initialsFromName } from "../utils/helpers";

export default function VoiceStage({
  channelName,
  voiceConnected,
  voiceConnecting,
  voiceChannelId,
  activeChannelId,
  voiceMembers,
  voiceMuted,
  voiceDeafened,
  voiceError,
  audioSinkRef,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
}) {
  const [pttHeld, setPttHeld] = useState(false);

  const speakingCount = voiceMembers.filter((p) => p.speaking).length;

  return (
    <section className="voice-stage">
      <div className="voice-header-card">
        <div className="voice-header-info">
          <div className="voice-channel-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V7a4 4 0 0 1 4-4Zm-6 9a6 6 0 0 0 5 5.91V21h2v-3.09A6 6 0 0 0 18 12h-2a4 4 0 1 1-8 0H6Z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h3 className="voice-channel-name">{channelName || "Voice"}</h3>
            <p className="muted voice-meta">
              {voiceConnected
                ? `${voiceMembers.length} connected${speakingCount > 0 ? ` · ${speakingCount} speaking` : ""}`
                : "Click Join to start talking"}
            </p>
          </div>
        </div>

        {voiceError ? <div className="voice-error">{voiceError}</div> : null}

        {voiceConnected ? (
          <div className="voice-quality">
            <span className="voice-quality-dot good" />
            <span className="voice-quality-label">Good connection</span>
          </div>
        ) : null}

        <div className="voice-controls">
          {!voiceConnected ? (
            <button
              type="button"
              className="voice-join-btn"
              disabled={voiceConnecting}
              onClick={onJoin}
            >
              {voiceConnecting ? (
                <>
                  <span className="send-spinner" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M17 11h-4V7h-2v4H7v2h4v4h2v-4h4z" fill="currentColor" />
                  </svg>
                  Join Voice
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`voice-ctrl-btn ${voiceMuted ? "active" : ""}`}
                onClick={onToggleMute}
                title={voiceMuted ? "Unmute" : "Mute"}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  {voiceMuted ? (
                    <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V7a4 4 0 0 1 4-4ZM1 1l22 22-1.4 1.4-5.1-5.1A6 6 0 0 1 13 17.91V21h-2v-3.09a6 6 0 0 1-5-5.91h2a4 4 0 0 0 6.3 3.27L12 13v-1L6 6V7a6 6 0 0 0 .05.75L2.4 4.1 1 1Z" fill="currentColor" />
                  ) : (
                    <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V7a4 4 0 0 1 4-4Zm-6 9a6 6 0 0 0 5 5.91V21h2v-3.09A6 6 0 0 0 18 12h-2a4 4 0 1 1-8 0H6Z" fill="currentColor" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                className={`voice-ctrl-btn ${voiceDeafened ? "active" : ""}`}
                onClick={onToggleDeafen}
                title={voiceDeafened ? "Undeafen" : "Deafen"}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  {voiceDeafened ? (
                    <path d="M3.63 3.63a1 1 0 0 1 1.41 0l15.56 15.56a1 1 0 0 1-1.41 1.41l-2.48-2.48A8 8 0 0 1 4 12V9a8 8 0 0 1 2.46-5.77L3.63 5.05a1 1 0 0 1 0-1.42ZM20 12v-1a8 8 0 0 0-14.32-4.9l1.41 1.42A6 6 0 0 1 18 11v1a6 6 0 0 1-.34 2l1.48 1.48c.54-1.06.86-2.25.86-3.48Zm-4 0a4 4 0 0 0-8 0v1.17l8 8V12Z" fill="currentColor" />
                  ) : (
                    <path d="M12 2a8 8 0 0 0-8 8v4a8 8 0 0 0 16 0v-4a8 8 0 0 0-8-8Zm-2 8a2 2 0 1 1 4 0v4a2 2 0 1 1-4 0v-4Z" fill="currentColor" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                className="voice-ctrl-btn disconnect"
                onClick={onLeave}
                title="Disconnect"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.38-.02L1.21 13.9a1 1 0 0 1 0-1.41C4.07 9.69 7.85 8 12 8s7.93 1.69 10.79 4.49a1 1 0 0 1 0 1.41l-1.59 1.65a1 1 0 0 1-1.38.02c-.79-.73-1.68-1.36-2.66-1.85a1 1 0 0 1-.56-.9v-3.1A15.9 15.9 0 0 0 12 9Z" fill="currentColor" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="voice-participants-grid">
        {voiceMembers.length === 0 ? (
          <p className="muted voice-empty">No one in voice yet — be the first to join!</p>
        ) : (
          voiceMembers.map((participant) => (
            <div
              key={participant.id}
              className={`voice-participant-card ${participant.speaking ? "speaking" : ""}`}
            >
              <div className={`voice-avatar-ring ${participant.speaking ? "ring-active" : ""}`}>
                <span
                  className="avatar voice-avatar"
                  style={{ background: pickColor(participant.username) }}
                >
                  {initialsFromName(participant.username)}
                </span>
              </div>
              <span className="voice-participant-name">
                {participant.username}
                {participant.isYou ? " (you)" : ""}
              </span>
              <div className="voice-participant-status">
                {participant.muted ? (
                  <span className="voice-status-icon muted-icon" title="Muted">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V7a4 4 0 0 1 4-4ZM1 1l22 22" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                  </span>
                ) : participant.speaking ? (
                  <span className="voice-status-icon speaking-icon" title="Speaking">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 10v4h4l5 5V5L7 10H3Z" fill="var(--success)" /><path d="M16.5 12A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4Z" fill="var(--success)" /></svg>
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div ref={audioSinkRef} style={{ display: "none" }} />
    </section>
  );
}
