import { pickColor, initialsFromName } from "../utils/helpers";

export default function MemberRail({ members, currentUserId, onClickMember }) {
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
              <span
                className={`status-dot ${member.id === currentUserId ? "online" : "offline"}`}
              />
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
