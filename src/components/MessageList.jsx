import { forwardRef } from "react";
import MessageRow from "./MessageRow";

const MessageList = forwardRef(function MessageList({ displayMessages, membersById }, ref) {
  return (
    <section className="messages" ref={ref}>
      {displayMessages.map((message) => {
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

        return <MessageRow key={message.id} message={message} authorName={authorName} />;
      })}
    </section>
  );
});

export default MessageList;
