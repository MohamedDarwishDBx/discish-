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
  return (
    <section className="voice-stage">
      <div className="voice-card">
        <div>
          <h3>{channelName || "Voice"}</h3>
          <p className="muted">
            {voiceConnected
              ? `${voiceMembers.length} participant(s) connected`
              : "Join to start speaking"}
          </p>
          {voiceError ? <span className="form-error">{voiceError}</span> : null}
        </div>
        <div className="profile-actions">
          <button
            type="button"
            className="chip solid"
            disabled={voiceConnecting || (voiceConnected && voiceChannelId === activeChannelId)}
            onClick={onJoin}
          >
            {voiceConnecting ? "Connecting..." : voiceConnected ? "Connected" : "Join Voice"}
          </button>
          <button
            type="button"
            className="chip"
            disabled={!voiceConnected}
            onClick={onLeave}
          >
            Leave
          </button>
          <button
            type="button"
            className={`icon-btn ${voiceMuted ? "active" : ""}`}
            disabled={!voiceConnected}
            onClick={onToggleMute}
          >
            Mic
          </button>
          <button
            type="button"
            className={`icon-btn ${voiceDeafened ? "active" : ""}`}
            disabled={!voiceConnected}
            onClick={onToggleDeafen}
          >
            Deafen
          </button>
        </div>
      </div>

      <div className="voice-participants">
        {voiceMembers.length === 0 ? (
          <p className="muted">Nobody in voice yet</p>
        ) : (
          voiceMembers.map((participant) => (
            <div key={participant.id} className="voice-member">
              <div className="profile-main">
                <span
                  className="avatar small"
                  style={{ background: pickColor(participant.username) }}
                >
                  {initialsFromName(participant.username)}
                </span>
                <div>
                  <p>
                    {participant.username}
                    {participant.isYou ? " (you)" : ""}
                  </p>
                  <span className="muted">
                    {participant.speaking ? "Speaking" : "Listening"}
                  </span>
                </div>
              </div>
              <span className={`pill ${participant.muted ? "" : "alt"}`}>
                {participant.muted ? "Muted" : "Mic On"}
              </span>
            </div>
          ))
        )}
      </div>
      <div ref={audioSinkRef} style={{ display: "none" }} />
    </section>
  );
}
