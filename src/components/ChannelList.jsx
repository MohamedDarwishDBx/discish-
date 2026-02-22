import { useState, useRef, useEffect } from "react";
import { HashIcon, VoiceIcon, PlusIcon, EditIcon, TrashIcon } from "./Icons";
import Modal from "./Modal";

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
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (renameId && renameInputRef.current) renameInputRef.current.focus();
  }, [renameId]);

  const handleContext = (e, channel) => {
    e.preventDefault();
    setCtxMenu({ channelId: channel.id, channelName: channel.name, x: e.clientX, y: e.clientY });
  };

  const closeCtx = () => setCtxMenu(null);

  const startRename = (id, name) => {
    setRenameId(id);
    setRenameValue(name);
    closeCtx();
  };

  const commitRename = () => {
    if (renameValue.trim() && renameId) onRenameChannel?.(renameId, renameValue.trim());
    setRenameId(null);
    setRenameValue("");
  };

  const renderChannel = (channel, icon) => {
    const unread = unreadCounts?.[channel.id] || 0;
    const isRenaming = renameId === channel.id;

    if (isRenaming) {
      return (
        <div key={channel.id} className="channel renaming">
          <span className="channel-icon">{icon}</span>
          <input
            ref={renameInputRef}
            className="channel-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setRenameId(null); setRenameValue(""); }
            }}
            onBlur={commitRename}
          />
        </div>
      );
    }

    return (
      <button
        key={channel.id}
        type="button"
        className={`channel ${channel.id === activeChannelId ? "active" : ""} ${unread > 0 ? "unread" : ""}`}
        onClick={() => onSelectChannel(channel.id)}
        onContextMenu={(e) => handleContext(e, channel)}
      >
        <span className="channel-icon">{icon}</span>
        <span className="channel-name">{channel.name}</span>
        {unread > 0 ? <span className="unread-badge">{unread > 99 ? "99+" : unread}</span> : null}
        {channel.type === "voice" && voiceConnected && voiceChannelId === channel.id ? (
          <span className="pill alt">Live</span>
        ) : null}
      </button>
    );
  };

  return (
    <>
      <div className="channel-group">
        <div className="group-row">
          <div className="group-title">Text Channels</div>
          {activeServerId ? (
            <button type="button" className="group-action" onClick={onCreateChannel}><PlusIcon size={16} /></button>
          ) : null}
        </div>
        {textChannels.map((channel) => renderChannel(channel, <HashIcon size={16} />))}
        {textChannels.length === 0 ? <p className="muted">No text channels</p> : null}
      </div>

      <div className="channel-group">
        <div className="group-row">
          <div className="group-title">Voice Channels</div>
          {activeServerId ? (
            <button type="button" className="group-action" onClick={onCreateChannel}><PlusIcon size={16} /></button>
          ) : null}
        </div>
        {voiceChannels.map((channel) => renderChannel(channel, <VoiceIcon size={16} />))}
        {voiceChannels.length === 0 ? <p className="muted">No voice channels</p> : null}
      </div>

      {ctxMenu ? (
        <>
          <button type="button" className="scrim transparent-scrim" onClick={closeCtx} aria-label="Close menu" />
          <div className="channel-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <button
              type="button"
              className="ctx-item"
              onClick={() => startRename(ctxMenu.channelId, ctxMenu.channelName)}
            >
              <EditIcon size={14} /> Rename
            </button>
            <button
              type="button"
              className="ctx-item danger"
              onClick={() => {
                setDeleteTarget({ id: ctxMenu.channelId, name: ctxMenu.channelName });
                closeCtx();
              }}
            >
              <TrashIcon size={14} /> Delete
            </button>
          </div>
        </>
      ) : null}

      <Modal
        open={!!deleteTarget}
        title="Delete Channel"
        onClose={() => setDeleteTarget(null)}
        onSubmit={() => {
          onDeleteChannel?.(deleteTarget.id);
          setDeleteTarget(null);
        }}
        submitLabel="Delete"
      >
        <p>Are you sure you want to delete <strong>#{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </>
  );
}
