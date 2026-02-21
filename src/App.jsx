import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://127.0.0.1:8000");
const WS_URL = API_URL.replace(/^http/, "ws");
const TOKEN_KEY = "discord_clone_token";
const VOICE_CONNECT_TIMEOUT_MS = 12000;

const avatarPalette = [
  "#5865f2",
  "#57f287",
  "#eb459e",
  "#fee75c",
  "#ed4245",
  "#3ba55c",
  "#7289da",
  "#faa61a"
];

const pickColor = (seed = "") => {
  const hash = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarPalette[hash % avatarPalette.length];
};

const initialsFromName = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatTime = (value) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

const participantMuted = (participant) => {
  const audioPublications = Array.from(participant.audioTrackPublications.values());
  if (audioPublications.length === 0) {
    return true;
  }
  return audioPublications.every((publication) => publication.isMuted);
};

const buildVoiceMembers = (room, currentUserId) => {
  if (!room) {
    return [];
  }

  const allParticipants = [
    room.localParticipant,
    ...Array.from(room.remoteParticipants.values())
  ];

  return allParticipants
    .map((participant) => ({
      id: participant.identity,
      username: participant.name || participant.identity,
      muted: participantMuted(participant),
      speaking: participant.isSpeaking,
      isYou: participant.identity === currentUserId
    }))
    .sort((first, second) => {
      if (first.isYou) return -1;
      if (second.isYou) return 1;
      return first.username.localeCompare(second.username);
    });
};

const clearAudioSink = (audioSinkRef) => {
  const sink = audioSinkRef.current;
  if (!sink) return;
  while (sink.firstChild) {
    sink.removeChild(sink.firstChild);
  }
};

const syncRemoteAudioMuted = (audioSinkRef, muted) => {
  const sink = audioSinkRef.current;
  if (!sink) return;
  sink.querySelectorAll("audio").forEach((node) => {
    node.muted = muted;
  });
};

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = detail?.detail || "Request failed";
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api("/auth/register", {
          body: { username, email, password },
          method: "POST"
        });
      }

      const token = await api("/auth/login", {
        body: { email, password },
        method: "POST"
      });
      onAuth(token.access_token);
    } catch (err) {
      setError(err.message || "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h2>{mode === "login" ? "Welcome back" : "Create an account"}</h2>
        <p className="muted">
          {mode === "login"
            ? "Sign in to continue"
            : "Use your email to get started"}
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" ? (
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourname"
                required
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="........"
              required
            />
          </label>
          {error ? <span className="form-error">{error}</span> : null}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode((prev) => (prev === "login" ? "register" : "login"));
            setError("");
          }}
        >
          {mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [activeServerId, setActiveServerId] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [composer, setComposer] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [loadingServers, setLoadingServers] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [voiceMembers, setVoiceMembers] = useState([]);
  const [voiceError, setVoiceError] = useState("");
  const messageListRef = useRef(null);
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const audioSinkRef = useRef(null);
  const voiceDeafenedRef = useRef(false);

  const setAuthToken = (value) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setToken(value);
  };

  const activeServer = useMemo(
    () => servers.find((server) => server.id === activeServerId),
    [servers, activeServerId]
  );

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  const isVoiceChannel = activeChannel?.type === "voice";

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    api("/users/me", { token })
      .then((data) => setUser(data))
      .catch(() => setAuthToken(null));
  }, [token]);

  const loadServers = async () => {
    if (!token) return;
    setLoadingServers(true);
    setError("");
    try {
      const data = await api("/servers", { token });
      setServers(data);
      if (data.length > 0) {
        setActiveServerId((prev) => prev || data[0].id);
      } else {
        setActiveServerId(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingServers(false);
    }
  };

  const disconnectVoice = (options = { keepError: false }) => {
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      room.disconnect();
    }

    roomRef.current = null;
    setVoiceConnected(false);
    setVoiceConnecting(false);
    setVoiceChannelId(null);
    setVoiceMuted(false);
    setVoiceDeafened(false);
    setVoiceMembers([]);
    clearAudioSink(audioSinkRef);

    if (!options.keepError) {
      setVoiceError("");
    }
  };

  const refreshVoiceMembers = () => {
    const room = roomRef.current;
    if (!room || !user) {
      setVoiceMembers([]);
      return;
    }
    setVoiceMembers(buildVoiceMembers(room, user.id));
  };

  const connectVoiceChannel = async (channel) => {
    if (!channel || channel.type !== "voice" || !token || !user) {
      return;
    }
    if (voiceConnected && voiceChannelId === channel.id) {
      return;
    }

    disconnectVoice();
    setVoiceError("");
    setVoiceConnecting(true);

    try {
      const voiceSession = await api("/voice/token", {
        method: "POST",
        body: { channel_id: channel.id },
        token
      });

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true
      });
      roomRef.current = room;

      const updateMembers = () => {
        setVoiceMembers(buildVoiceMembers(room, user.id));
      };

      room.on(RoomEvent.ParticipantConnected, updateMembers);
      room.on(RoomEvent.ParticipantDisconnected, updateMembers);
      room.on(RoomEvent.TrackMuted, updateMembers);
      room.on(RoomEvent.TrackUnmuted, updateMembers);
      room.on(RoomEvent.ActiveSpeakersChanged, updateMembers);
      room.on(RoomEvent.LocalTrackPublished, updateMembers);
      room.on(RoomEvent.LocalTrackUnpublished, updateMembers);

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        const audioEl = track.attach();
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.muted = voiceDeafenedRef.current;
        audioSinkRef.current?.appendChild(audioEl);
        updateMembers();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        track.detach().forEach((element) => element.remove());
        updateMembers();
      });

      room.on(RoomEvent.Disconnected, () => {
        disconnectVoice({ keepError: true });
      });

      await withTimeout(
        room.connect(voiceSession.url, voiceSession.token),
        VOICE_CONNECT_TIMEOUT_MS,
        "Voice connection timed out. Check network/firewall and retry."
      );
      await withTimeout(
        room.localParticipant.setMicrophoneEnabled(true),
        VOICE_CONNECT_TIMEOUT_MS,
        "Could not start microphone. Check browser mic permissions."
      );

      setVoiceConnected(true);
      setVoiceConnecting(false);
      setVoiceChannelId(channel.id);
      setVoiceMuted(false);
      setVoiceDeafened(false);
      updateMembers();
    } catch (err) {
      disconnectVoice({ keepError: true });
      setVoiceConnecting(false);
      setVoiceError(err.message || "Unable to join voice channel");
    }
  };

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;

    const nextMuted = !voiceMuted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setVoiceMuted(nextMuted);
      refreshVoiceMembers();
    } catch (err) {
      setVoiceError(err.message || "Unable to update microphone state");
    }
  };

  const toggleDeafen = () => {
    setVoiceDeafened((prev) => !prev);
  };

  useEffect(() => {
    voiceDeafenedRef.current = voiceDeafened;
    syncRemoteAudioMuted(audioSinkRef, voiceDeafened);
  }, [voiceDeafened]);

  useEffect(() => {
    if (!user) return;
    loadServers();
  }, [user]);

  useEffect(() => {
    if (!token || !activeServerId) {
      setChannels([]);
      setMembers([]);
      return;
    }

    const fetchData = async () => {
      try {
        const [channelData, memberData] = await Promise.all([
          api(`/servers/${activeServerId}/channels`, { token }),
          api(`/servers/${activeServerId}/members`, { token })
        ]);
        setChannels(channelData);
        setMembers(memberData);
        if (channelData.length > 0) {
          setActiveChannelId((prev) =>
            channelData.some((channel) => channel.id === prev)
              ? prev
              : channelData[0].id
          );
        } else {
          setActiveChannelId(null);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    fetchData();
  }, [activeServerId, token]);

  useEffect(() => {
    if (!token || !activeChannelId || isVoiceChannel) {
      setMessages([]);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    let isActive = true;

    api(`/channels/${activeChannelId}/messages`, { token })
      .then((data) => {
        if (isActive) setMessages(data);
      })
      .catch((err) => setError(err.message));

    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(
      `${WS_URL}/ws/channels/${activeChannelId}?token=${token}`
    );
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "message.created") {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === payload.id)) {
            return prev;
          }
          return [...prev, payload];
        });
      }
    };
    socketRef.current = ws;

    return () => {
      isActive = false;
      ws.close();
    };
  }, [activeChannelId, isVoiceChannel, token]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!activeChannel) {
      disconnectVoice();
      return;
    }

    if (activeChannel.type !== "voice" && voiceConnected) {
      disconnectVoice();
      return;
    }

    if (
      activeChannel.type === "voice" &&
      voiceConnected &&
      voiceChannelId &&
      voiceChannelId !== activeChannel.id
    ) {
      disconnectVoice();
    }
  }, [activeChannel, voiceChannelId, voiceConnected]);

  useEffect(() => {
    if (!token) {
      disconnectVoice();
    }
  }, [token]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      disconnectVoice();
    };
  }, []);

  const filteredTextChannels = useMemo(() => {
    const search = channelSearch.trim().toLowerCase();
    return channels
      .filter((channel) => channel.type === "text")
      .filter((channel) =>
        search ? channel.name.toLowerCase().includes(search) : true
      );
  }, [channels, channelSearch]);

  const filteredVoiceChannels = useMemo(() => {
    const search = channelSearch.trim().toLowerCase();
    return channels
      .filter((channel) => channel.type === "voice")
      .filter((channel) =>
        search ? channel.name.toLowerCase().includes(search) : true
      );
  }, [channels, channelSearch]);

  const membersById = useMemo(() => {
    const map = {};
    members.forEach((member) => {
      map[member.id] = member;
    });
    return map;
  }, [members]);

  const displayMessages = useMemo(() => {
    const items = [];
    let lastDate = "";
    messages.forEach((message) => {
      const dateLabel = formatDate(message.created_at);
      if (dateLabel !== lastDate) {
        items.push({ type: "divider", id: `div-${dateLabel}`, label: dateLabel });
        lastDate = dateLabel;
      }
      items.push({ type: "message", ...message });
    });
    return items;
  }, [messages]);

  const handleCreateServer = async () => {
    const name = window.prompt("Server name?");
    if (!name) return;
    try {
      const server = await api("/servers", {
        method: "POST",
        body: { name },
        token
      });
      setServers((prev) => [...prev, server]);
      setActiveServerId(server.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateChannel = async () => {
    if (!activeServerId) return;
    const name = window.prompt("Channel name?");
    if (!name) return;
    const requestedType = window
      .prompt("Channel type? (text/voice)", "text")
      ?.trim()
      .toLowerCase();
    const type = requestedType || "text";
    if (type !== "text" && type !== "voice") {
      setError('Channel type must be "text" or "voice"');
      return;
    }

    try {
      const channel = await api(`/servers/${activeServerId}/channels`, {
        method: "POST",
        body: { name, type },
        token
      });
      setChannels((prev) => [...prev, channel]);
      setActiveChannelId(channel.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!composer.trim() || !activeChannelId || isVoiceChannel) return;

    try {
      const message = await api(`/channels/${activeChannelId}/messages`, {
        method: "POST",
        body: { content: composer },
        token
      });
      setComposer("");
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }
        return [
          ...prev,
          { ...message, author: { id: user.id, username: user.username } }
        ];
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const joinActiveVoiceChannel = async () => {
    if (!activeChannel || activeChannel.type !== "voice") return;
    await connectVoiceChannel(activeChannel);
  };

  const leaveVoiceChannel = () => {
    disconnectVoice();
  };

  if (!token || !user) {
    return <AuthScreen onAuth={setAuthToken} />;
  }

  if (servers.length === 0 && !loadingServers) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>Create your first server</h2>
          <p className="muted">Start by creating a server for your community.</p>
          {error ? <span className="form-error">{error}</span> : null}
          <button className="auth-btn" type="button" onClick={handleCreateServer}>
            Create server
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => setAuthToken(null)}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="server-rail">
        <button type="button" className="server-btn home">
          <span className="server-badge home">DM</span>
        </button>
        <div className="server-divider" />
        <div className="server-list">
          {servers.map((server) => (
            <button
              key={server.id}
              type="button"
              className={`server-btn ${
                server.id === activeServerId ? "active" : ""
              }`}
              onClick={() => setActiveServerId(server.id)}
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
          <button type="button" className="server-btn add" onClick={handleCreateServer}>
            <span className="server-badge">+</span>
          </button>
        </div>
        <div className="rail-footer">
          <button type="button" className="rail-control" onClick={() => setAuthToken(null)}>
            Logout
          </button>
        </div>
      </aside>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button type="button" className="server-switch">
            <span>{activeServer?.name || ""}</span>
            <span className="chevron">v</span>
          </button>
          <button type="button" className="icon-btn" onClick={handleCreateChannel}>
            +
          </button>
        </div>
        <p className="sidebar-tagline">{activeServer?.tagline || "Text channels"}</p>

        <div className="sidebar-nav">
          <button type="button" className="nav-item active">
            <span className="nav-icon">#</span>
            Channels
          </button>
          <button type="button" className="nav-item">
            <span className="nav-icon">*</span>
            Events
          </button>
        </div>

        <div className="sidebar-search">
          <input
            value={channelSearch}
            onChange={(event) => setChannelSearch(event.target.value)}
            placeholder="Search channels"
          />
        </div>

        <div className="channel-group">
          <div className="group-row">
            <div className="group-title">Text Channels</div>
            <button type="button" className="group-action" onClick={handleCreateChannel}>
              +
            </button>
          </div>
          {filteredTextChannels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className={`channel ${
                channel.id === activeChannelId ? "active" : ""
              }`}
              onClick={() => {
                setActiveChannelId(channel.id);
                setSidebarOpen(false);
              }}
            >
              <span className="channel-icon">#</span>
              <span className="channel-name">{channel.name}</span>
            </button>
          ))}
          {filteredTextChannels.length === 0 ? (
            <p className="muted">No text channels</p>
          ) : null}
        </div>

        <div className="channel-group">
          <div className="group-row">
            <div className="group-title">Voice Channels</div>
            <button type="button" className="group-action" onClick={handleCreateChannel}>
              +
            </button>
          </div>
          {filteredVoiceChannels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className={`channel ${
                channel.id === activeChannelId ? "active" : ""
              }`}
              onClick={() => {
                setActiveChannelId(channel.id);
                setSidebarOpen(false);
              }}
            >
              <span className="channel-icon">)</span>
              <span className="channel-name">{channel.name}</span>
              {voiceConnected && voiceChannelId === channel.id ? (
                <span className="pill alt">Live</span>
              ) : null}
            </button>
          ))}
          {filteredVoiceChannels.length === 0 ? (
            <p className="muted">No voice channels</p>
          ) : null}
        </div>

        <div className="channel-group">
          <div className="group-title">Direct Messages</div>
          <p className="muted">Coming soon</p>
        </div>

        <div className="profile-card">
          <div className="profile-main">
            <span
              className="avatar small"
              style={{ background: pickColor(user.username) }}
            >
              {initialsFromName(user.username)}
            </span>
            <div>
              <p>{user.username}</p>
              <span className="muted">
                {voiceConnected ? "In voice" : "Online"}
              </span>
            </div>
          </div>
          <div className="profile-actions">
            <button
              type="button"
              className={`icon-btn ${voiceMuted ? "active" : ""}`}
              onClick={toggleMute}
              disabled={!voiceConnected}
            >
              Mic
            </button>
            <button
              type="button"
              className={`icon-btn ${voiceDeafened ? "active" : ""}`}
              onClick={toggleDeafen}
              disabled={!voiceConnected}
            >
              Deafen
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="main-header">
          <button
            type="button"
            className="icon-btn mobile-only"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            Channels
          </button>
          <div className="channel-title">
            <span className="hash">{isVoiceChannel ? ")" : "#"}</span>
            <div>
              <h3>{activeChannel?.name || ""}</h3>
              <span className="muted">
                {isVoiceChannel ? "Voice channel" : "Text channel"}
              </span>
            </div>
          </div>
          <div className="main-actions">
            <button type="button" className="icon-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-6.2V11a7 7 0 1 0-14 0v4.8L3 17.8v1.2h18v-1.2l-2-2Z" />
              </svg>
            </button>
            <button type="button" className="icon-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 3 8 11l4 4-6 6h4l6-6 4 4 4-4-8-8Z" />
              </svg>
            </button>
            <button type="button" className="icon-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM8 14c-3.3 0-6 1.6-6 3.5V20h8v-2a4 4 0 0 1 4-4h1.7A8.1 8.1 0 0 0 8 14Zm8 0a6.9 6.9 0 0 0-2.4.4A5.5 5.5 0 0 1 16 18v2h8v-2.5c0-1.9-2.7-3.5-6-3.5Z" />
              </svg>
            </button>
            <div className="search-pill">
              <input placeholder="Search" />
              <span>s</span>
            </div>
          </div>
        </header>

        {error ? <div className="system-message">{error}</div> : null}

        {isVoiceChannel ? (
          <section className="voice-stage">
            <div className="voice-card">
              <div>
                <h3>{activeChannel?.name || "Voice"}</h3>
                <p className="muted">
                  {voiceConnected
                    ? `${voiceMembers.length} participant(s) connected`
                    : "Join to start speaking"}
                </p>
                {voiceError ? <span className="form-error">{voiceError}</span> : null}
              </div>
              <div className="profile-actions">
                <button
                  type="button"
                  className="chip solid"
                  disabled={voiceConnecting || (voiceConnected && voiceChannelId === activeChannelId)}
                  onClick={joinActiveVoiceChannel}
                >
                  {voiceConnecting ? "Connecting..." : voiceConnected ? "Connected" : "Join Voice"}
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={!voiceConnected}
                  onClick={leaveVoiceChannel}
                >
                  Leave
                </button>
                <button
                  type="button"
                  className={`icon-btn ${voiceMuted ? "active" : ""}`}
                  disabled={!voiceConnected}
                  onClick={toggleMute}
                >
                  Mic
                </button>
                <button
                  type="button"
                  className={`icon-btn ${voiceDeafened ? "active" : ""}`}
                  disabled={!voiceConnected}
                  onClick={toggleDeafen}
                >
                  Deafen
                </button>
              </div>
            </div>

            <div className="voice-participants">
              {voiceMembers.length === 0 ? (
                <p className="muted">Nobody in voice yet</p>
              ) : (
                voiceMembers.map((participant) => (
                  <div key={participant.id} className="voice-member">
                    <div className="profile-main">
                      <span
                        className="avatar small"
                        style={{ background: pickColor(participant.username) }}
                      >
                        {initialsFromName(participant.username)}
                      </span>
                      <div>
                        <p>
                          {participant.username}
                          {participant.isYou ? " (you)" : ""}
                        </p>
                        <span className="muted">
                          {participant.speaking ? "Speaking" : "Listening"}
                        </span>
                      </div>
                    </div>
                    <span className={`pill ${participant.muted ? "" : "alt"}`}>
                      {participant.muted ? "Muted" : "Mic On"}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div ref={audioSinkRef} style={{ display: "none" }} />
          </section>
        ) : (
          <>
            <section className="messages" ref={messageListRef}>
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

                return (
                  <div key={message.id} className="message-row">
                    <span
                      className="avatar"
                      style={{ background: pickColor(authorName) }}
                    >
                      {initialsFromName(authorName)}
                    </span>
                    <div className="message-body">
                      <div className="message-meta">
                        <span className="message-author">{authorName}</span>
                        <span className="message-time">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      <p className="message-text">{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </section>

            <form className="composer" onSubmit={sendMessage}>
              <button type="button" className="composer-btn">
                +
              </button>
              <div className="composer-field">
                <input
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder="Message"
                />
                <div className="composer-icons">
                  <button type="button" className="icon-btn ghost">
                    GIF
                  </button>
                  <button type="button" className="icon-btn ghost">
                    :)
                  </button>
                  <button type="button" className="icon-btn ghost">
                    +
                  </button>
                </div>
              </div>
              <button type="submit" className="send-btn" aria-label="Send">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 20 22 12 3 4v6l12 2-12 2v6Z" />
                </svg>
              </button>
            </form>
          </>
        )}
      </main>

      <aside className="member-rail">
        <div className="member-header">
          <div>
            <p className="eyebrow">Members</p>
            <h4>{members.length} total</h4>
          </div>
        </div>

        <div className="member-group">
          {members.map((member) => (
            <div key={member.id} className="member-row">
              <div className="avatar-wrap">
                <span
                  className="avatar small"
                  style={{ background: pickColor(member.username) }}
                >
                  {initialsFromName(member.username)}
                </span>
                <span
                  className={`status-dot ${
                    member.id === user.id ? "online" : "offline"
                  }`}
                />
              </div>
              <div>
                <p>{member.username}</p>
                <span className="muted">{member.role}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}
    </div>
  );
}
