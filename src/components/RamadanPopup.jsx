import { useEffect, useState } from "react";

const CONFETTI_COUNT = 80;
const CONFETTI_COLORS = ["#e8a832", "#d44a3a", "#4caf50", "#3a8fd4", "#f5b742", "#ff6b9d", "#a855f7"];

function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

export default function RamadanPopup({ open, onClose }) {
  const [confetti, setConfetti] = useState([]);
  const [showIframe, setShowIframe] = useState(false);

  useEffect(() => {
    if (!open) { setShowIframe(false); return; }
    // Generate confetti pieces
    const pieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      left: randomBetween(0, 100),
      delay: randomBetween(0, 2),
      duration: randomBetween(2, 4),
      size: randomBetween(6, 12),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: randomBetween(0, 360),
      type: Math.random() > 0.5 ? "circle" : "rect",
    }));
    setConfetti(pieces);
    setShowIframe(true);
  }, [open]);

  const handleClose = () => {
    setShowIframe(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="ramadan-popup-overlay" onClick={handleClose}>
      <div className="ramadan-popup" onClick={(e) => e.stopPropagation()}>
        {/* Confetti */}
        <div className="ramadan-confetti-container">
          {confetti.map((c) => (
            <div
              key={c.id}
              className={`ramadan-confetti-piece ${c.type}`}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
                width: c.type === "circle" ? c.size : c.size * 0.6,
                height: c.size,
                background: c.color,
                transform: `rotate(${c.rotation}deg)`,
              }}
            />
          ))}
        </div>

        {/* Lantern decoration */}
        <div className="ramadan-popup-lanterns">
          <svg viewBox="0 0 48 72" width="40" height="60" className="ramadan-popup-lantern left">
            <line x1="24" y1="0" x2="24" y2="12" stroke="#e8a832" strokeWidth="2" />
            <ellipse cx="24" cy="12" rx="4" ry="3" fill="#e8a832" />
            <path d="M14 16 Q12 30 14 50 Q18 58 24 60 Q30 58 34 50 Q36 30 34 16 Z" fill="#e8a832" opacity="0.3" stroke="#e8a832" strokeWidth="1.5" />
            <path d="M17 18 Q16 30 17 48 Q20 54 24 56 Q28 54 31 48 Q32 30 31 18 Z" fill="#e8a832" opacity="0.2" />
            <circle cx="24" cy="36" r="4" fill="#e8a832" opacity="0.6" />
          </svg>
          <svg viewBox="0 0 48 72" width="40" height="60" className="ramadan-popup-lantern right">
            <line x1="24" y1="0" x2="24" y2="12" stroke="#e8a832" strokeWidth="2" />
            <ellipse cx="24" cy="12" rx="4" ry="3" fill="#e8a832" />
            <path d="M14 16 Q12 30 14 50 Q18 58 24 60 Q30 58 34 50 Q36 30 34 16 Z" fill="#e8a832" opacity="0.3" stroke="#e8a832" strokeWidth="1.5" />
            <path d="M17 18 Q16 30 17 48 Q20 54 24 56 Q28 54 31 48 Q32 30 31 18 Z" fill="#e8a832" opacity="0.2" />
            <circle cx="24" cy="36" r="4" fill="#e8a832" opacity="0.6" />
          </svg>
        </div>

        <div className="ramadan-popup-crescent">&#x262A;</div>
        <h2 className="ramadan-popup-title">Ramadan Kareem</h2>
        <p className="ramadan-popup-subtitle">from Discish!</p>
        <div className="ramadan-popup-stars">&#x2728; &#x2B50; &#x2728;</div>
        <button type="button" className="ramadan-popup-btn" onClick={handleClose}>
          Allah Akram
        </button>
      </div>

      {/* Hidden YouTube embed — autoplay with allow attribute bypasses browser restrictions */}
      {showIframe && (
        <iframe
          src="https://www.youtube.com/embed/A2b-CzPKtGw?autoplay=1&start=25&end=43&controls=0&showinfo=0&rel=0"
          allow="autoplay; encrypted-media"
          style={{ position: "absolute", width: 1, height: 1, top: -9999, left: -9999, border: "none", opacity: 0 }}
          title="Ramadan nasheed"
        />
      )}
    </div>
  );
}
