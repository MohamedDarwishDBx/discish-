import { useEffect, useRef } from "react";
import { ScreenShareOffIcon } from "./Icons";

export default function PipPreview({ track, onStopSharing }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const container = videoRef.current;
    if (!container || !track) return;

    const el = track.attach();
    el.className = "pip-video";
    el.autoplay = true;
    el.playsInline = true;
    el.muted = true;
    container.innerHTML = "";
    container.appendChild(el);

    return () => {
      track.detach().forEach((e) => e.remove());
      container.innerHTML = "";
    };
  }, [track]);

  if (!track) return null;

  return (
    <div className="pip-overlay">
      <div className="pip-video-container" ref={videoRef} />
      <div className="pip-controls">
        <span className="pip-label">You are sharing your screen</span>
        <button type="button" className="pip-stop-btn" onClick={onStopSharing}>
          <ScreenShareOffIcon size={14} /> Stop
        </button>
      </div>
    </div>
  );
}
