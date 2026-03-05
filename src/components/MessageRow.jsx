import { useState } from "react";
import { pickColor, initialsFromName, formatTime } from "../utils/helpers";
import EmojiPicker from "./EmojiPicker";

function renderWithMentions(text, currentUsername) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const isSelf = currentUsername && part.slice(1).toLowerCase() === currentUsername.toLowerCase();
      return (
        <span key={i} className={`mention ${isSelf ? "mention-self" : ""}`}>{part}</span>
      );
    }
    return part;
  });
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
function isImageUrl(url) {
  if (!url) return false;
  return IMAGE_EXTENSIONS.some((ext) => url.toLowerCase().endsWith(ext));
}

export default function MessageRow({ message, authorName, isOwn, currentUserId, currentUsername, onEdit, onDelete, onReact, grouped }) {
  const [hovering, setHovering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [showPicker, setShowPicker] = useState(false);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      setEditText(message.content);
      return;
    }
    onEdit(message.id, trimmed);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditText(message.content);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") handleCancelEdit();
  };

  const reactions = message.reactions || [];

  return (
    <div
      className={`message-row ${grouped ? "message-row-grouped" : ""}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowPicker(false); }}
    >
      {grouped ? (
        <span className="avatar-spacer" />
      ) : (
        <span className="avatar" style={{ background: pickColor(authorName) }}>
          {initialsFromName(authorName)}
        </span>
      )}
      <div className="message-body">
        {!grouped && (
          <div className="message-meta">
            <span className="message-author">{authorName}</span>
            <span className="message-time">{formatTime(message.created_at)}</span>
            {message.edited_at ? <span className="message-edited">(edited)</span> : null}
          </div>
        )}
        {editing ? (
          <form className="message-edit-form" onSubmit={handleSaveEdit}>
            <input
              className="message-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="message-edit-hint">
              escape to <button type="button" className="link-btn-inline" onClick={handleCancelEdit}>cancel</button>
              {" \u2022 "}
              enter to <button type="submit" className="link-btn-inline">save</button>
            </div>
          </form>
        ) : (
          <>
            {message.content ? <p className="message-text">{renderWithMentions(message.content, currentUsername)}</p> : null}
            {message.attachment_url ? (
              <div className="message-attachment">
                {isImageUrl(message.attachment_url) ? (
                  <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                    <img src={message.attachment_url} alt={message.attachment_name || "attachment"} className="attachment-image" />
                  </a>
                ) : (
                  <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="attachment-link">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm4 18H6V4h7v5h5v11Z" /></svg>
                    <span>{message.attachment_name || "Download"}</span>
                  </a>
                )}
              </div>
            ) : null}
          </>
        )}
        {reactions.length > 0 ? (
          <div className="message-reactions">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`reaction-chip ${r.users?.includes(currentUserId) ? "active" : ""}`}
                onClick={() => onReact(message.id, r.emoji)}
                title={r.usernames?.join(", ") || ""}
              >
                <span className="reaction-emoji">{r.emoji}</span>
                <span className="reaction-count">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {hovering && !editing ? (
        <div className="message-actions">
          <button
            type="button"
            className="msg-action-btn"
            onClick={() => setShowPicker((p) => !p)}
            title="Add Reaction"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2ZM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8Zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5Zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11Zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5Z" /></svg>
          </button>
          {isOwn ? (
            <>
              <button
                type="button"
                className="msg-action-btn"
                onClick={() => { setEditing(true); setEditText(message.content); }}
                title="Edit"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" /></svg>
              </button>
              <button
                type="button"
                className="msg-action-btn danger"
                onClick={() => onDelete(message.id)}
                title="Delete"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z" /></svg>
              </button>
            </>
          ) : null}
          {showPicker ? (
            <EmojiPicker
              onSelect={(emoji) => onReact(message.id, emoji)}
              onClose={() => setShowPicker(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
