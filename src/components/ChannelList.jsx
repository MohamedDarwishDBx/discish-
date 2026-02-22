import { useState } from "react";

export default function ChannelList({
  textChannels,
  voiceChannels,
  activeChannelId,
  voiceConnected,
  voiceChannelId,
  activeServerId,
  unreadCounts,
  onSelectChannel,
  onCreateChannel,
  onRenameChannel,
  onDeleteChannel,
}) {
  const [ctxMenu, setCtxMenu] = useState(null);

  const handleContext = (e, channel) => {
    e.preventDefault();
    setCtxMenu({ channelId: channel.id, channelName: channel.name, x: e.clientX, y: e.clientY });
  };

  const closeCtx = () => setCtxMenu(null);

  return (
    <>
      <div className="channel-group">
        <div className="group-row">
          <div className="group-title">Text Channels</div>
          {activeServerId ? (
            <button type="button" className="group-action" onClick={onCreateChannel}>+</button>
          ) : null}
        </div>
        {textChannels.map((channel) => {
          const unread = unreadCounts?.[channel.id] || 0;
          return (
            <button
              key={channel.id}
              type="button"
              className={`channel ${channel.id === activeChannelId ? "active" : ""} ${unread > 0 ? "unread" : ""}`}
              onClick={() => onSelectChannel(channel.id)}
              onContextMenu={(e) => handleContext(e, channel)}
            >
              <span className="channel-icon">#</span>
              <span className="channel-name">{channel.name}</span>
              {unread > 0 ? <span className="unread-badge">{unread > 99 ? "99+" : unread}</span> : null}
            </button>
          );
        })}
        {textChannels.length === 0 ? <p className="muted">No text channels</p> : null}
      </div>

      <div className="channel-group">
        <div className="group-row">
          <div className="group-title">Voice Channels</div>
          {activeServerId ? (
            <button type="button" className="group-action" onClick={onCreateChannel}>+</button>
          ) : null}
        </div>
        {voiceChannels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            className={`channel ${channel.id === activeChannelId ? "active" : ""}`}
            onClick={() => onSelectChannel(channel.id)}
            onContextMenu={(e) => handleContext(e, channel)}
          >
            <span className="channel-icon">)</span>
            <span className="channel-name">{channel.name}</span>
            {voiceConnected && voiceChannelId === channel.id ? (
              <span className="pill alt">Live</span>
            ) : null}
          </button>
        ))}
        {voiceChannels.length === 0 ? <p className="muted">No voice channels</p> : null}
      </div>

      {ctxMenu ? (
        <>
          <button type="button" className="scrim transparent-scrim" onClick={closeCtx} aria-label="Close menu" />
          <div className="channel-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <button
              type="button"
              className="ctx-item"
              onClick={() => {
                const newName = prompt("Rename channel:", ctxMenu.channelName);
                if (newName && newName.trim()) onRenameChannel?.(ctxMenu.channelId, newName.trim());
                closeCtx();
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="ctx-item danger"
              onClick={() => {
                if (confirm(`Delete #${ctxMenu.channelName}?`)) onDeleteChannel?.(ctxMenu.channelId);
                closeCtx();
              }}
            >
              Delete
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
