import { pickColor, initialsFromName } from "../utils/helpers";

function presenceClass(userId, currentUserId, presenceMap) {
  if (userId === currentUserId) return "online";
  const status = presenceMap?.[userId];
  if (status === "online") return "online";
  if (status === "idle") return "idle";
  if (status === "dnd") return "dnd";
  return "offline";
}

export default function MemberRail({ members, currentUserId, presenceMap, onClickMember }) {
  return (
    <aside className="member-rail">
      <div className="member-header">
        <div>
          <p className="eyebrow">Members</p>
          <h4>{members.length} total</h4>
        </div>
      </div>

      <div className="member-group">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            className="member-row member-row-btn"
            onClick={() => onClickMember?.(member)}
          >
            <div className="avatar-wrap">
              <span
                className="avatar small"
                style={{ background: pickColor(member.username) }}
              >
                {initialsFromName(member.username)}
              </span>
              <span className={`status-dot ${presenceClass(member.id, currentUserId, presenceMap)}`} />
            </div>
            <div>
              <p>{member.username}</p>
              <span className="muted">{member.role}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
