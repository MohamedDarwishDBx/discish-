import { useState } from "react";
import { CloseIcon } from "./Icons";

const COMMON_EMOJIS = [
  "\u{1F44D}", "\u{1F44E}", "\u{2764}\uFE0F", "\u{1F602}", "\u{1F622}",
  "\u{1F60D}", "\u{1F525}", "\u{1F389}", "\u{1F914}", "\u{1F44F}",
  "\u{1F4AF}", "\u{1F440}", "\u{1F60E}", "\u{1F631}", "\u{1F64F}",
  "\u{2705}", "\u{274C}", "\u{1F680}", "\u{1F308}", "\u{1F381}",
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? COMMON_EMOJIS.filter(() => true)
    : COMMON_EMOJIS;

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-header">
        <input
          className="emoji-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          autoFocus
        />
        <button type="button" className="icon-btn" onClick={onClose}><CloseIcon size={14} /></button>
      </div>
      <div className="emoji-grid">
        {filtered.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-btn"
            onClick={() => { onSelect(emoji); onClose(); }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
