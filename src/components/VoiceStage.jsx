import { useEffect, useRef, useState } from "react";
import { pickColor, initialsFromName } from "../utils/helpers";
import { ScreenShareIcon, ScreenShareOffIcon, VideoIcon, VideoOffIcon, HeadphonesIcon, DeafenIcon } from "./Icons";

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
  screenShares = [],
  videoFeeds = [],
  isScreenSharing = false,
  isCameraOn = false,
  audioElementsRef,
  currentUserRole,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onToggleCamera,
  onKickParticipant,
}) {
  const speakingCount = voiceMembers.filter((p) => p.speaking).length;
  const anyoneStreaming = voiceMembers.some((p) => p.isScreenSharing);

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
            <span className={`voice-quality-dot ${anyoneStreaming ? "live" : "good"}`} />
            <span className="voice-quality-label">
              {anyoneStreaming ? "Live Stream" : "Good connection"}
            </span>
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
                  {voiceDeafened ? <DeafenIcon size={20} /> : <HeadphonesIcon size={20} />}
              </button>
              <button
                type="button"
                className={`voice-ctrl-btn ${isCameraOn ? "sharing" : ""}`}
                onClick={onToggleCamera}
                title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
              >
                {isCameraOn ? <VideoIcon size={20} /> : <VideoOffIcon size={20} />}
              </button>
              <button
                type="button"
                className={`voice-ctrl-btn ${isScreenSharing ? "sharing" : ""}`}
                onClick={onToggleScreenShare}
                title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
              >
                {isScreenSharing ? <ScreenShareOffIcon size={20} /> : <ScreenShareIcon size={20} />}
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

      {screenShares.length > 0 ? (
        <div className="screen-share-grid">
          {screenShares.map((share) => (
            <ScreenShareTile key={share.participantId + "-screen"} share={share} audioElementsRef={audioElementsRef} />
          ))}
        </div>
      ) : null}

      <div className="voice-participants-grid">
        {voiceMembers.length === 0 ? (
          <p className="muted voice-empty">No one in voice yet -- be the first to join!</p>
        ) : (
          voiceMembers.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              videoFeed={videoFeeds.find((v) => v.participantId === participant.id)}
              currentUserRole={currentUserRole}
              onKickParticipant={onKickParticipant}
            />
          ))
        )}
      </div>

    </section>
  );
}

function ScreenShareTile({ share, audioElementsRef }) {
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    const container = videoRef.current;
    if (!container || !share.element) return;
    container.innerHTML = "";
    share.element.className = "screen-share-video";
    container.appendChild(share.element);
    return () => { container.innerHTML = ""; };
  }, [share.element]);

  const goFullscreen = () => {
    const el = tileRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    const audioEl = audioElementsRef?.current?.[share.participantId];
    if (audioEl) {
      audioEl.volume = val / 100;
    }
  };

  return (
    <div className="screen-share-tile" ref={tileRef} onDoubleClick={goFullscreen}>
      <div className="screen-share-video-container" ref={videoRef} />
      <div className="screen-share-label">
        <span className="live-badge">LIVE</span>
        {share.participantName}&apos;s screen
      </div>
      <div className="volume-slider-container">
        <svg className="volume-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          {volume === 0 ? (
            <path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.18l2.45 2.45a4.22 4.22 0 0 0 .05-.63Zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z" fill="currentColor" />
          ) : volume < 50 ? (
            <path d="M3 10v4h4l5 5V5L7 10H3Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4Z" fill="currentColor" />
          ) : (
            <path d="M3 10v4h4l5 5V5L7 10H3Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z" fill="currentColor" />
          )}
        </svg>
        <input
          type="range"
          className="volume-slider"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          title={`Volume: ${volume}%`}
        />
      </div>
      <button type="button" className="fullscreen-btn" onClick={goFullscreen} title="Fullscreen">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm12 7h-3v2h5v-5h-2v3ZM14 5v2h3v3h2V5h-5Z" fill="currentColor" /></svg>
      </button>
    </div>
  );
}

function ParticipantCard({ participant, videoFeed, currentUserRole, onKickParticipant }) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const hasVideo = !!videoFeed;

  useEffect(() => {
    const container = videoRef.current;
    if (!container || !videoFeed?.element) return;
    container.innerHTML = "";
    videoFeed.element.className = "webcam-video";
    container.appendChild(videoFeed.element);
    return () => { container.innerHTML = ""; };
  }, [videoFeed?.element]);

  const goFullscreen = () => {
    const el = cardRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  };

  return (
    <div ref={cardRef} className={`voice-participant-card ${participant.speaking ? "speaking" : ""} ${hasVideo ? "has-video" : ""} ${participant.isScreenSharing ? "is-streaming" : ""}`}>
      {!participant.isYou && ["owner", "admin", "moderator"].includes(currentUserRole) && onKickParticipant ? (
        <button
          type="button"
          className="voice-kick-btn"
          title={`Kick ${participant.username}`}
          onClick={(e) => { e.stopPropagation(); onKickParticipant(participant.id); }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      ) : null}
      {hasVideo ? (
        <div className="video-tile" ref={videoRef} onDoubleClick={goFullscreen}>
          <button type="button" className="fullscreen-btn" onClick={goFullscreen} title="Fullscreen">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm12 7h-3v2h5v-5h-2v3ZM14 5v2h3v3h2V5h-5Z" fill="currentColor" /></svg>
          </button>
        </div>
      ) : (
        <div className={`voice-avatar-ring ${participant.speaking ? "ring-active" : ""}`}>
          <span
            className="avatar voice-avatar"
            style={{ background: pickColor(participant.username) }}
          >
            {initialsFromName(participant.username)}
          </span>
        </div>
      )}

      {participant.isScreenSharing ? (
        <span className="participant-live-badge">LIVE</span>
      ) : null}

      <div className={`voice-participant-info ${hasVideo ? "overlay" : ""}`}>
        <span className="voice-participant-name">
          {participant.username}
          {participant.isYou ? " (you)" : ""}
        </span>
        <div className="voice-participant-status">
          {participant.isScreenSharing ? (
            <span className="voice-status-icon screen-icon" title="Sharing screen">
              <ScreenShareIcon size={14} />
            </span>
          ) : null}
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
    </div>
  );
}
