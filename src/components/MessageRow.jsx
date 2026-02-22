import { useState } from "react";
import { pickColor, initialsFromName, formatTime } from "../utils/helpers";

export default function MessageRow({ message, authorName, isOwn, onEdit, onDelete }) {
  const [hovering, setHovering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

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

  return (
    <div
      className="message-row"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <span className="avatar" style={{ background: pickColor(authorName) }}>
        {initialsFromName(authorName)}
      </span>
      <div className="message-body">
        <div className="message-meta">
          <span className="message-author">{authorName}</span>
          <span className="message-time">{formatTime(message.created_at)}</span>
          {message.edited_at ? <span className="message-edited">(edited)</span> : null}
        </div>
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
          <p className="message-text">{message.content}</p>
        )}
      </div>
      {isOwn && hovering && !editing ? (
        <div className="message-actions">
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
        </div>
      ) : null}
    </div>
  );
}
