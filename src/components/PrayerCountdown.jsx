import { useEffect, useRef, useState } from "react";

const PRAYER_NAMES = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const ADHAN_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function dateStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export default function PrayerCountdown({ compact }) {
  const [times, setTimes] = useState(null);
  const [cityName, setCityName] = useState("Cairo");
  const [countdown, setCountdown] = useState("");
  const [nextLabel, setNextLabel] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [tz, setTz] = useState("Africa/Cairo");
  const [adhanPlaying, setAdhanPlaying] = useState(false);
  const [adhanPrayer, setAdhanPrayer] = useState("");
  const playedRef = useRef(new Set());
  const adhanAudioRef = useRef(null);

  useEffect(() => {
    const fetchByCoords = (lat, lng) => {
      fetch(`https://api.aladhan.com/v1/timings/${dateStr()}?latitude=${lat}&longitude=${lng}&method=5`)
        .then((r) => r.json())
        .then((data) => {
          setTimes(data.data.timings);
          setTz(data.data.meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
        })
        .catch(() => {});
    };

    const fetchByCairo = () => {
      fetch(`https://api.aladhan.com/v1/timingsByCity/${dateStr()}?city=Cairo&country=Egypt&method=5`)
        .then((r) => r.json())
        .then((data) => {
          setTimes(data.data.timings);
          setTz("Africa/Cairo");
          setCityName("Cairo");
        })
        .catch(() => {});
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchByCoords(pos.coords.latitude, pos.coords.longitude);
          // Try to get city name from reverse geocoding
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
            .then((r) => r.json())
            .then((data) => {
              const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state || "";
              if (city) setCityName(city);
            })
            .catch(() => {});
        },
        () => fetchByCairo(),
        { timeout: 5000 },
      );
    } else {
      fetchByCairo();
    }
  }, []);

  useEffect(() => {
    if (!times) return;

    const tick = () => {
      const nowStr = new Date().toLocaleString("en-US", { timeZone: tz });
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

      // Check if any prayer time is now — play adhan
      for (const name of ADHAN_PRAYERS) {
        const pt = parseTime(times[name]);
        const elapsed = now - pt;
        if (elapsed >= 0 && elapsed < 30000 && !playedRef.current.has(name)) {
          playedRef.current.add(name);
          if (adhanAudioRef.current) {
            adhanAudioRef.current.pause();
            adhanAudioRef.current = null;
          }
          const audio = new Audio("/adhan.mp3");
          audio.volume = 0.8;
          audio.play().catch(() => {});
          audio.addEventListener("ended", () => {
            setAdhanPlaying(false);
            setAdhanPrayer("");
            adhanAudioRef.current = null;
          });
          adhanAudioRef.current = audio;
          setAdhanPlaying(true);
          setAdhanPrayer(name);
          break;
        }
      }
    };

    playedRef.current = new Set();
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      if (adhanAudioRef.current) {
        adhanAudioRef.current.pause();
        adhanAudioRef.current = null;
      }
    };
  }, [times, tz]);

  const stopAdhan = () => {
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current = null;
    }
    setAdhanPlaying(false);
    setAdhanPrayer("");
  };

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

      {adhanPlaying && (
        <div className="adhan-banner">
          <span className="adhan-label">🔊 {adhanPrayer} Adhan</span>
          <button type="button" className="adhan-stop-btn" onClick={stopAdhan}>
            Stop
          </button>
        </div>
      )}

      {showSchedule && (
        <div className="prayer-schedule">
          <div className="prayer-schedule-title">Prayer Times — {cityName}</div>
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
