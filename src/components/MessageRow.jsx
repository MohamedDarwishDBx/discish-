import { pickColor, initialsFromName, formatTime } from "../utils/helpers";

export default function MessageRow({ message, authorName }) {
  return (
    <div className="message-row">
      <span
        className="avatar"
        style={{ background: pickColor(authorName) }}
      >
        {initialsFromName(authorName)}
      </span>
      <div className="message-body">
        <div className="message-meta">
          <span className="message-author">{authorName}</span>
          <span className="message-time">{formatTime(message.created_at)}</span>
        </div>
        <p className="message-text">{message.content}</p>
      </div>
    </div>
  );
}
