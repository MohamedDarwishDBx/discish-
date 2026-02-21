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

function Modal({ open, title, onClose, onSubmit, children, submitLabel = "Create", loading = false }) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="scrim modal-scrim" onClick={onClose} aria-label="Close modal" />
      <div className="modal-overlay">
        <div className="modal-card">
          <div className="modal-header">
            <h3>{title}</h3>
            <button type="button" className="icon-btn" onClick={onClose}>X</button>
          </div>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
            <div className="modal-actions">
              <button type="button" className="chip" onClick={onClose}>Cancel</button>
              <button type="submit" className="chip solid" disabled={loading}>
                {loading ? "Working..." : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function LandingPage({ onOpenApp }) {
  return (
    <div className="landing">
      <div className="landing-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <nav className="landing-nav">
        <div className="landing-logo"><img src="/logo.png" alt="" className="landing-logo-icon" />Discish</div>
        <div className="landing-links">
          <a href="#features">Features</a>
          <a href="#safety">Safety</a>
          <a href="#support">Support</a>
        </div>
        <button type="button" className="landing-login-btn" onClick={onOpenApp}>
          Login
        </button>
      </nav>

      <section className="landing-hero">
        <div className="hero-content">
        <h1 className="landing-headline">
          Discish —<br />
          Discord El<br />
          Ghalaba 🇪🇬
        </h1>
        <p className="landing-subtitle">
          Discish is great for playing games and chilling with friends, or even
          building a worldwide community. Customize your own space to talk,
          play, and hang out.
        </p>
          <div className="landing-ctas">
            <button type="button" className="landing-btn secondary" onClick={onOpenApp}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11V3H8v6H2v12h20V11h-6Zm-6-6h4v14h-4V5ZM4 11h4v8H4v-8Zm16 8h-4v-6h4v6Z" /></svg>
              Explore Discish
            </button>
            <button type="button" className="landing-btn primary" onClick={onOpenApp}>
              Open Discish in your browser
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-logo-card">
            <img src="/logo.png" alt="Discish" className="discish-logo-img" />
          </div>
          <div className="hero-founder">
            <img src="/founder.jpg" alt="Mohamed Darwish — Founder" className="founder-photo" />
            <div className="founder-label">
              <span className="founder-name">Mohamed Darwish</span>
              <span className="founder-role">Founder</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H6l-2 2V4h16v12Z" /></svg>
          </div>
          <h3>Text Channels</h3>
          <p>Organize conversations by topic. Create as many channels as you need — from #general to #gaming.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Zm3-8h-2V9a1 1 0 0 0-2 0v3a1 1 0 0 0 1 1h3a1 1 0 0 0 0-2Z" /></svg>
          </div>
          <h3>Voice Chat</h3>
          <p>Jump into a voice channel and talk in real time. Low latency, crystal clear audio powered by LiveKit.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" /></svg>
          </div>
          <h3>Communities</h3>
          <p>Create your own server, invite friends with a link, and build your community from the ground up.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-logo"><img src="/logo.png" alt="" className="landing-logo-icon" />Discish</div>
        <p>A Discord-inspired chat platform. Built for fun.</p>
      </footer>
    </div>
  );
}

function AuthScreen({ onAuth, onBack }) {
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
        <button type="button" className="auth-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" /></svg>
          Back
        </button>
        <div className="auth-brand">Discish</div>
        <h2>{mode === "login" ? "Welcome back!" : "Create an account"}</h2>
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
  const [showAuth, setShowAuth] = useState(false);
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
  const [showServerModal, setShowServerModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [serverModalName, setServerModalName] = useState("");
  const [channelModalName, setChannelModalName] = useState("");
  const [channelModalType, setChannelModalType] = useState("text");
  const [modalLoading, setModalLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [memberRailOpen, setMemberRailOpen] = useState(true);
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

  // Handle /join/<server_id> invite links
  useEffect(() => {
    if (!token || !user) return;

    const path = window.location.pathname;
    const match = path.match(/^\/join\/(.+)$/);
    if (!match) return;

    const serverId = match[1];

    const joinServer = async () => {
      try {
        const server = await api(`/servers/${serverId}/join`, {
          method: "POST",
          token
        });
        await loadServers();
        setActiveServerId(server.id);
      } catch (err) {
        setError(err.message || "Failed to join server");
      } finally {
        window.history.replaceState(null, "", "/");
      }
    };

    joinServer();
  }, [token, user]);

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
    if (!serverModalName.trim()) return;
    setModalLoading(true);
    try {
      const server = await api("/servers", {
        method: "POST",
        body: { name: serverModalName.trim() },
        token
      });
      setServers((prev) => [...prev, server]);
      setActiveServerId(server.id);
      setShowServerModal(false);
      setServerModalName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!activeServerId || !channelModalName.trim()) return;
    setModalLoading(true);
    try {
      const channel = await api(`/servers/${activeServerId}/channels`, {
        method: "POST",
        body: { name: channelModalName.trim(), type: channelModalType },
        token
      });
      setChannels((prev) => [...prev, channel]);
      setActiveChannelId(channel.id);
      setShowChannelModal(false);
      setChannelModalName("");
      setChannelModalType("text");
    } catch (err) {
      setError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCopyInvite = () => {
    if (!activeServerId) return;
    const link = `${window.location.origin}/join/${activeServerId}`;
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
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
    if (!showAuth) {
      return <LandingPage onOpenApp={() => setShowAuth(true)} />;
    }
    return <AuthScreen onAuth={setAuthToken} onBack={() => setShowAuth(false)} />;
  }

  return (
    <div className={`app-shell ${memberRailOpen ? "" : "members-hidden"}`}>
      <aside className="server-rail">
        <button
          type="button"
          className={`server-btn home ${!activeServerId ? "active" : ""}`}
          onClick={() => {
            setActiveServerId(null);
            setActiveChannelId(null);
          }}
        >
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
          <button type="button" className="server-btn add" onClick={() => setShowServerModal(true)}>
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
            <span>{activeServer?.name || "Discish"}</span>
            <span className="chevron">v</span>
          </button>
          <div className="sidebar-header-actions">
            {activeServerId ? (
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyInvite}
                title="Copy invite link"
              >
                {inviteCopied ? "Copied!" : "Invite"}
              </button>
            ) : null}
            {activeServerId ? (
              <button type="button" className="icon-btn" onClick={() => setShowChannelModal(true)}>
                +
              </button>
            ) : null}
          </div>
        </div>

        <div className="sidebar-nav">
          <button type="button" className="nav-item active">
            <span className="nav-icon">#</span>
            Channels
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
            {activeServerId ? (
              <button type="button" className="group-action" onClick={() => setShowChannelModal(true)}>
                +
              </button>
            ) : null}
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
            {activeServerId ? (
              <button type="button" className="group-action" onClick={() => setShowChannelModal(true)}>
                +
              </button>
            ) : null}
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
          {activeChannel ? (
            <div className="channel-title">
              <span className="hash">{isVoiceChannel ? ")" : "#"}</span>
              <div>
                <h3>{activeChannel.name}</h3>
                <span className="muted">
                  {isVoiceChannel ? "Voice channel" : "Text channel"}
                </span>
              </div>
            </div>
          ) : (
            <div className="channel-title">
              <h3>{activeServer ? activeServer.name : "Welcome"}</h3>
            </div>
          )}
          {activeChannel ? (
            <div className="main-actions">
              <button
                type="button"
                className={`icon-btn ${memberRailOpen ? "active" : ""}`}
                onClick={() => setMemberRailOpen((prev) => !prev)}
                title="Toggle members"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM8 14c-3.3 0-6 1.6-6 3.5V20h8v-2a4 4 0 0 1 4-4h1.7A8.1 8.1 0 0 0 8 14Zm8 0a6.9 6.9 0 0 0-2.4.4A5.5 5.5 0 0 1 16 18v2h8v-2.5c0-1.9-2.7-3.5-6-3.5Z" />
                </svg>
              </button>
            </div>
          ) : null}
        </header>

        {error ? <div className="system-message">{error}</div> : null}

        {!activeServer ? (
          <div className="empty-state">
            <h2>Welcome to Discish</h2>
            <p className="muted">Join a server using an invite link, or create your own to get started.</p>
            <button type="button" className="chip solid" onClick={() => setShowServerModal(true)}>
              Create a Server
            </button>
          </div>
        ) : !activeChannel ? (
          <div className="empty-state">
            <h2>No channels yet</h2>
            <p className="muted">Create a channel to start chatting.</p>
            <button type="button" className="chip solid" onClick={() => setShowChannelModal(true)}>
              Create a Channel
            </button>
          </div>
        ) : isVoiceChannel ? (
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
              <div className="composer-field">
                <input
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder={`Message #${activeChannel?.name || ""}`}
                />
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

      {memberRailOpen ? (
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
      ) : null}

      {sidebarOpen ? (
        <button
          type="button"
          className="scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <Modal
        open={showServerModal}
        title="Create a Server"
        onClose={() => { setShowServerModal(false); setServerModalName(""); }}
        onSubmit={handleCreateServer}
        submitLabel="Create"
        loading={modalLoading}
      >
        <label>
          Server Name
          <input
            value={serverModalName}
            onChange={(e) => setServerModalName(e.target.value)}
            placeholder="My Awesome Server"
            autoFocus
            required
          />
        </label>
      </Modal>

      <Modal
        open={showChannelModal}
        title="Create a Channel"
        onClose={() => {
          setShowChannelModal(false);
          setChannelModalName("");
          setChannelModalType("text");
        }}
        onSubmit={handleCreateChannel}
        submitLabel="Create"
        loading={modalLoading}
      >
        <label>
          Channel Name
          <input
            value={channelModalName}
            onChange={(e) => setChannelModalName(e.target.value)}
            placeholder="general"
            autoFocus
            required
          />
        </label>
        <label>
          Channel Type
          <div className="modal-type-group">
            <button
              type="button"
              className={`modal-type-option ${channelModalType === "text" ? "selected" : ""}`}
              onClick={() => setChannelModalType("text")}
            >
              # Text
            </button>
            <button
              type="button"
              className={`modal-type-option ${channelModalType === "voice" ? "selected" : ""}`}
              onClick={() => setChannelModalType("voice")}
            >
              ) Voice
            </button>
          </div>
        </label>
      </Modal>
    </div>
  );
}
