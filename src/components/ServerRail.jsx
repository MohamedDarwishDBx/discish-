import { pickColor, initialsFromName } from "../utils/helpers";

export default function ServerRail({
  servers,
  activeServerId,
  onSelectServer,
  onCreateServer,
  onLogout,
}) {
  return (
    <aside className="server-rail">
      <button
        type="button"
        className={`server-btn home ${!activeServerId ? "active" : ""}`}
        onClick={() => onSelectServer(null)}
      >
        <span className="server-badge home">DM</span>
      </button>
      <div className="server-divider" />
      <div className="server-list">
        {servers.map((server) => (
          <button
            key={server.id}
            type="button"
            className={`server-btn ${server.id === activeServerId ? "active" : ""}`}
            onClick={() => onSelectServer(server.id)}
            aria-label={server.name}
          >
            <span
              className="server-badge"
              style={{ background: pickColor(server.name) }}
            >
              {initialsFromName(server.name)}
            </span>
          </button>
        ))}
        <button type="button" className="server-btn add" onClick={onCreateServer}>
          <span className="server-badge">+</span>
        </button>
      </div>
      <div className="rail-footer">
        <button type="button" className="rail-control" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
