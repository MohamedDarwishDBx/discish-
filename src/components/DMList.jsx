import { useState } from "react";
import { pickColor, initialsFromName } from "../utils/helpers";

export default function DMList({
  dmChannels,
  activeDMId,
  onSelectDM,
  onStartNewDM,
  searchResults,
  onSearchUsers,
  searchQuery,
  onSearchQueryChange,
}) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="dm-list">
      <div className="dm-header">
        <span className="dm-title">Direct Messages</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowSearch((p) => !p)}
          title="New DM"
        >
          +
        </button>
      </div>

      {showSearch ? (
        <div className="dm-search">
          <input
            className="dm-search-input"
            value={searchQuery}
            onChange={(e) => { onSearchQueryChange(e.target.value); onSearchUsers(e.target.value); }}
            placeholder="Find a user..."
            autoFocus
          />
          {searchResults.length > 0 ? (
            <div className="dm-search-results">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="dm-search-result"
                  onClick={() => { onStartNewDM(u.id); setShowSearch(false); onSearchQueryChange(""); }}
                >
                  <span className="avatar small" style={{ background: pickColor(u.username) }}>
                    {initialsFromName(u.username)}
                  </span>
                  <span>{u.username}</span>
                </button>
              ))}
            </div>
          ) : searchQuery.trim().length > 0 ? (
            <p className="muted dm-no-results">No users found</p>
          ) : null}
        </div>
      ) : null}

      <div className="dm-channels">
        {dmChannels.map((dm) => (
          <button
            key={dm.id}
            type="button"
            className={`dm-channel ${dm.id === activeDMId ? "active" : ""}`}
            onClick={() => onSelectDM(dm)}
          >
            <span className="avatar small" style={{ background: pickColor(dm.recipient.username) }}>
              {initialsFromName(dm.recipient.username)}
            </span>
            <span className="dm-channel-name">{dm.recipient.username}</span>
          </button>
        ))}
        {dmChannels.length === 0 && !showSearch ? (
          <p className="muted dm-empty">No conversations yet</p>
        ) : null}
      </div>
    </div>
  );
}
