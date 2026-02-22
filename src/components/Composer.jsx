export default function Composer({ value, onChange, onSubmit, channelName }) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <div className="composer-field">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Message #${channelName || ""}`}
        />
      </div>
      <button type="submit" className="send-btn" aria-label="Send">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 20 22 12 3 4v6l12 2-12 2v6Z" />
        </svg>
      </button>
    </form>
  );
}
