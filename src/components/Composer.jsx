import { useEffect, useRef, useState } from "react";
import { pickColor, initialsFromName } from "../utils/helpers";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

function isImageFile(name) {
  return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

function getMentionQuery(text, cursorPos) {
  const before = text.slice(0, cursorPos);
  const match = before.match(/@(\w*)$/);
  return match ? match[1] : null;
}

export default function Composer({ value, onChange, onSubmit, onUpload, channelName, members }) {
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionResults = (members || []).filter((m) =>
    mentionQuery !== null && m.username.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 8);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(newValue);
    setMentionQuery(getMentionQuery(newValue, cursor));
  };

  const insertMention = (username) => {
    const input = inputRef.current;
    if (!input) return;
    const cursor = input.selectionStart;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const mentionStart = before.lastIndexOf("@");
    const newValue = before.slice(0, mentionStart) + `@${username} ` + after;
    onChange(newValue);
    setMentionQuery(null);
    setTimeout(() => {
      const newCursor = mentionStart + username.length + 2;
      input.focus();
      input.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (mentionResults[mentionIndex]) {
          e.preventDefault();
          insertMention(mentionResults[mentionIndex].username);
        }
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mentionQuery !== null && mentionResults.length > 0 && mentionResults[mentionIndex]) {
      insertMention(mentionResults[mentionIndex].username);
      return;
    }
    if (pendingFile) {
      setUploading(true);
      try {
        await onUpload(pendingFile, value);
        setPendingFile(null);
        onChange("");
        if (fileRef.current) fileRef.current.value = "";
      } finally {
        setUploading(false);
      }
      return;
    }
    onSubmit(e);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setPendingFile(file);
        return;
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setPendingFile(file);
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver} className="composer-wrap">
      {pendingFile ? (
        <div className="composer-attachment-preview">
          {isImageFile(pendingFile.name) ? (
            <img src={URL.createObjectURL(pendingFile)} alt="preview" className="attachment-thumb" />
          ) : (
            <div className="attachment-file-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm4 18H6V4h7v5h5v11Z" /></svg>
            </div>
          )}
          <span className="attachment-name">{pendingFile.name}</span>
          <button type="button" className="attachment-remove" onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z" /></svg>
          </button>
        </div>
      ) : null}

      {mentionQuery !== null && mentionResults.length > 0 ? (
        <div className="mention-autocomplete">
          {mentionResults.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`mention-option ${i === mentionIndex ? "active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m.username); }}
            >
              <span className="avatar small" style={{ background: pickColor(m.username) }}>
                {initialsFromName(m.username)}
              </span>
              <span>{m.username}</span>
            </button>
          ))}
        </div>
      ) : null}

      <form className="composer" onSubmit={handleSubmit}>
        <button type="button" className="composer-upload-btn" onClick={() => fileRef.current?.click()} title="Upload file">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <input type="file" ref={fileRef} onChange={handleFileChange} style={{ display: "none" }} />
        <div className="composer-field">
          <input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`Message #${channelName || ""}`}
          />
        </div>
        <button type="submit" className="send-btn" disabled={uploading} aria-label="Send">
          {uploading ? (
            <span className="send-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20 22 12 3 4v6l12 2-12 2v6Z" /></svg>
          )}
        </button>
      </form>
    </div>
  );
}
