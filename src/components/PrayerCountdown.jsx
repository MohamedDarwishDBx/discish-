import { useEffect, useState } from "react";

const PRAYER_NAMES = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

export default function PrayerCountdown({ compact }) {
  const [times, setTimes] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [nextLabel, setNextLabel] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    fetch("https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5")
      .then((r) => r.json())
      .then((data) => setTimes(data.data.timings))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!times) return;

    const tick = () => {
      // Use Cairo timezone for correct comparison regardless of user's location
      const nowStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
      const now = new Date(nowStr);

      const parseTime = (str) => {
        const [h, m] = str.split(":").map(Number);
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        return d;
      };

      const fajr = parseTime(times.Fajr);
      const maghrib = parseTime(times.Maghrib);

      let target, label;
      if (now >= fajr && now < maghrib) {
        target = maghrib;
        label = "Iftar";
      } else {
        if (now >= maghrib) {
          target = new Date(fajr);
          target.setDate(target.getDate() + 1);
        } else {
          target = fajr;
        }
        label = "Fajr";
      }

      const diff = Math.max(0, target - now);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      setNextLabel(label);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [times]);

  if (!times) return null;

  return (
    <div className={`prayer-countdown ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className="prayer-countdown-main"
        onClick={() => setShowSchedule((p) => !p)}
      >
        <span className="prayer-icon">🕌</span>
        <div className="prayer-countdown-text">
          <span className="prayer-label">{nextLabel} in</span>
          <span className="prayer-time">{countdown}</span>
        </div>
        <span className="prayer-chevron">{showSchedule ? "▲" : "▼"}</span>
      </button>

      {showSchedule && (
        <div className="prayer-schedule">
          <div className="prayer-schedule-title">Prayer Times — Cairo</div>
          {PRAYER_NAMES.map((name) => (
            <div key={name} className={`prayer-row ${name === "Maghrib" ? "highlight" : ""}`}>
              <span>{name}</span>
              <span>{times[name]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
