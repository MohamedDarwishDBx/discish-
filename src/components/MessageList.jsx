import { forwardRef } from "react";
import MessageRow from "./MessageRow";

const GROUP_THRESHOLD_MS = 30 * 1000; // 30 seconds

function shouldGroup(prev, curr) {
  if (!prev || prev.type === "divider" || !curr) return false;
  const prevAuthor = prev.author_id || prev.author?.id;
  const currAuthor = curr.author_id || curr.author?.id;
  if (prevAuthor !== currAuthor) return false;
  const prevTime = new Date(prev.created_at).getTime();
  const currTime = new Date(curr.created_at).getTime();
  return currTime - prevTime < GROUP_THRESHOLD_MS;
}

const MessageList = forwardRef(function MessageList(
  { displayMessages, membersById, currentUserId, currentUsername, onEditMessage, onDeleteMessage, onReactMessage },
  ref,
) {
  return (
    <section className="messages" ref={ref}>
      {displayMessages.map((message, idx) => {
        if (message.type === "divider") {
          return (
            <div key={message.id} className="date-divider">
              <span>{message.label}</span>
            </div>
          );
        }

        const authorName =
          message.author?.username ||
          membersById[message.author_id]?.username ||
          "Unknown";

        const grouped = shouldGroup(displayMessages[idx - 1], message);

        return (
          <MessageRow
            key={message.id}
            message={message}
            authorName={authorName}
            isOwn={message.author_id === currentUserId || message.author?.id === currentUserId}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onEdit={onEditMessage}
            onDelete={onDeleteMessage}
            onReact={onReactMessage}
            grouped={grouped}
          />
        );
      })}
    </section>
  );
});

export default MessageList;
