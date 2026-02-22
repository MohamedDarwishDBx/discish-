import { useRef, useState } from "react";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

function isImageFile(name) {
  return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

export default function Composer({ value, onChange, onSubmit, onUpload, channelName }) {
  const fileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setPendingFile(file);
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver}>
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
      <form className="composer" onSubmit={handleSubmit}>
        <button type="button" className="composer-upload-btn" onClick={() => fileRef.current?.click()} title="Upload file">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <input type="file" ref={fileRef} onChange={handleFileChange} style={{ display: "none" }} />
        <div className="composer-field">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
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
