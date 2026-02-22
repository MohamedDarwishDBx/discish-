import { CloseIcon } from "./Icons";

export default function Modal({ open, title, onClose, onSubmit, children, submitLabel = "Create", loading = false }) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="scrim modal-scrim" onClick={onClose} aria-label="Close modal" />
      <div className="modal-overlay">
        <div className="modal-card">
          <div className="modal-header">
            <h3>{title}</h3>
            <button type="button" className="icon-btn" onClick={onClose}><CloseIcon size={18} /></button>
          </div>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
            <div className="modal-actions">
              <button type="button" className="chip" onClick={onClose}>Cancel</button>
              <button type="submit" className="chip solid" disabled={loading}>
                {loading ? "Working..." : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
