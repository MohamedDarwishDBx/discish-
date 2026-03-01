import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

import { api, API_URL } from "./utils/api";
import { WS_URL, TOKEN_KEY } from "./utils/api";
import { formatDate, withTimeout } from "./utils/helpers";
import {
  VOICE_CONNECT_TIMEOUT_MS,
  buildVoiceMembers,
  clearAudioSink,
  syncRemoteAudioMuted,
} from "./utils/voice";

import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import Modal from "./components/Modal";
import ServerRail from "./components/ServerRail";
import ChannelList from "./components/ChannelList";
import MessageList from "./components/MessageList";
import Composer from "./components/Composer";
import VoiceStage from "./components/VoiceStage";
import VoiceStatusBar from "./components/VoiceStatusBar";
import MemberRail from "./components/MemberRail";
import ProfileCard from "./components/ProfileCard";
import TypingIndicator from "./components/TypingIndicator";
import DMList from "./components/DMList";
import FriendsList from "./components/FriendsList";
import UserProfilePopup from "./components/UserProfilePopup";
import ServerSettings from "./components/ServerSettings";
import PipPreview from "./components/PipPreview";
import RamadanPopup from "./components/RamadanPopup";
import PrayerCountdown from "./components/PrayerCountdown";
import {
  ChevronDownIcon,
  InviteIcon,
  PlusIcon,
  HashIcon,
  VoiceIcon,
  MenuIcon,
  AtIcon,
  SearchIcon,
} from "./components/Icons";

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
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [voiceMembers, setVoiceMembers] = useState([]);
  const [voiceError, setVoiceError] = useState("");
  const [screenShares, setScreenShares] = useState([]);
  const [videoFeeds, setVideoFeeds] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [voiceOccupants, setVoiceOccupants] = useState({});
  const [showServerModal, setShowServerModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [serverModalName, setServerModalName] = useState("");
  const [channelModalName, setChannelModalName] = useState("");
  const [channelModalType, setChannelModalType] = useState("text");
  const [modalLoading, setModalLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [memberRailOpen, setMemberRailOpen] = useState(() => window.innerWidth > 1200);
  const [typingUsers, setTypingUsers] = useState([]);
  const [dmChannels, setDmChannels] = useState([]);
  const [activeDM, setActiveDM] = useState(null);
  const [dmSearchQuery, setDmSearchQuery] = useState("");
  const [dmSearchResults, setDmSearchResults] = useState([]);
  const [profilePopupUser, setProfilePopupUser] = useState(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [presenceMap, setPresenceMap] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const messageListRef = useRef(null);
  const socketRef = useRef(null);
  const presenceSocketRef = useRef(null);
  const roomRef = useRef(null);
  const audioSinkRef = useRef(null);
  const voiceDeafenedRef = useRef(false);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutsRef = useRef({});
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const audioElementsRef = useRef({});
  const [ramadanTheme, setRamadanTheme] = useState(() => localStorage.getItem("discish_theme") === "ramadan");
  const [showRamadanPopup, setShowRamadanPopup] = useState(false);
  const ramadanAudioRef = useRef(null);

  /* ── Ramadan theme ── */

  useEffect(() => {
    document.documentElement.classList.toggle("ramadan-theme", ramadanTheme);
    localStorage.setItem("discish_theme", ramadanTheme ? "ramadan" : "default");
  }, [ramadanTheme]);

  const destroyRamadanAudio = () => {
    if (ramadanAudioRef.current) {
      ramadanAudioRef.current.pause();
      ramadanAudioRef.current = null;
    }
  };

  const toggleTheme = () => {
    setRamadanTheme((prev) => {
      const next = !prev;
      if (next) {
        setShowRamadanPopup(true);
        // Play local MP3 — new Audio().play() in click handler is always allowed
        destroyRamadanAudio();
        const audio = new Audio("/nasheed.mp3");
        audio.volume = 0.7;
        audio.play().catch(() => {});
        ramadanAudioRef.current = audio;
      }
      return next;
    });
  };

  /* ── Auth ── */

  const setAuthToken = (value) => {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setToken(value);
  };

  useEffect(() => {
    if (!token) { setUser(null); return; }
    api("/users/me", { token })
      .then((data) => setUser(data))
      .catch(() => setAuthToken(null));
  }, [token]);

  /* ── Derived state ── */

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId),
    [servers, activeServerId]
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  const isVoiceChannel = activeChannel?.type === "voice";

  const connectedVoiceChannel = useMemo(
    () => (voiceChannelId ? channels.find((c) => c.id === voiceChannelId) : null),
    [channels, voiceChannelId]
  );

  const filteredTextChannels = useMemo(() => {
    const search = channelSearch.trim().toLowerCase();
    return channels
      .filter((c) => c.type === "text")
      .filter((c) => (search ? c.name.toLowerCase().includes(search) : true));
  }, [channels, channelSearch]);

  const filteredVoiceChannels = useMemo(() => {
    const search = channelSearch.trim().toLowerCase();
    return channels
      .filter((c) => c.type === "voice")
      .filter((c) => (search ? c.name.toLowerCase().includes(search) : true));
  }, [channels, channelSearch]);

  const membersById = useMemo(() => {
    const map = {};
    members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members]);

  const myMember = useMemo(
    () => (user ? members.find((m) => m.id === user.id) : null),
    [members, user]
  );

  const displayMessages = useMemo(() => {
    const items = [];
    let lastDate = "";
    messages.forEach((msg) => {
      const dateLabel = formatDate(msg.created_at);
      if (dateLabel !== lastDate) {
        items.push({ type: "divider", id: `div-${dateLabel}`, label: dateLabel });
        lastDate = dateLabel;
      }
      items.push({ type: "message", ...msg });
    });
    return items;
  }, [messages]);

  /* ── Voice ── */

  const disconnectVoice = (options = { keepError: false }) => {
    const room = roomRef.current;
    if (room) { room.removeAllListeners(); room.disconnect(); }
    roomRef.current = null;
    setVoiceConnected(false);
    setVoiceConnecting(false);
    setVoiceChannelId(null);
    setVoiceMuted(false);
    setVoiceDeafened(false);
    setVoiceMembers([]);
    setScreenShares([]);
    setVideoFeeds([]);
    setIsScreenSharing(false);
    setIsCameraOn(false);
    setLocalScreenTrack(null);
    clearAudioSink(audioSinkRef);
    audioElementsRef.current = {};
    if (!options.keepError) setVoiceError("");
    if (token) api("/voice/disconnect", { method: "POST", token }).catch(() => {});
  };

  const refreshVoiceMembers = () => {
    const room = roomRef.current;
    if (!room || !user) { setVoiceMembers([]); return; }
    setVoiceMembers(buildVoiceMembers(room, user.id));
  };

  const connectVoiceChannel = async (channel) => {
    if (!channel || channel.type !== "voice" || !token || !user) return;
    if (voiceConnected && voiceChannelId === channel.id) return;

    disconnectVoice();
    setVoiceError("");
    setVoiceConnecting(true);

    try {
      const session = await api("/voice/token", {
        method: "POST",
        body: { channel_id: channel.id },
        token,
      });

      const room = new Room({ adaptiveStream: true, dynacast: true, stopLocalTrackOnUnpublish: true });
      roomRef.current = room;

      const updateMembers = () => setVoiceMembers(buildVoiceMembers(room, user.id));

      room.on(RoomEvent.ParticipantConnected, updateMembers);
      room.on(RoomEvent.ParticipantDisconnected, updateMembers);
      room.on(RoomEvent.TrackMuted, updateMembers);
      room.on(RoomEvent.TrackUnmuted, updateMembers);
      room.on(RoomEvent.ActiveSpeakersChanged, updateMembers);
      room.on(RoomEvent.LocalTrackPublished, updateMembers);
      room.on(RoomEvent.LocalTrackUnpublished, updateMembers);

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          el.playsInline = true;
          el.muted = voiceDeafenedRef.current;
          audioSinkRef.current?.appendChild(el);
          audioElementsRef.current[participant.identity] = el;
        } else if (track.kind === Track.Kind.Video) {
          const el = track.attach();
          el.autoplay = true;
          el.playsInline = true;
          const entry = { participantId: participant.identity, participantName: participant.name || participant.identity, track, element: el };
          if (track.source === Track.Source.ScreenShare) {
            setScreenShares((prev) => [...prev.filter((s) => !(s.participantId === entry.participantId && s.track.source === track.source)), entry]);
          } else if (track.source === Track.Source.Camera) {
            setVideoFeeds((prev) => [...prev.filter((v) => v.participantId !== entry.participantId), entry]);
          }
        }
        updateMembers();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((e) => e.remove());
          delete audioElementsRef.current[participant.identity];
        } else if (track.kind === Track.Kind.Video) {
          track.detach().forEach((e) => e.remove());
          if (track.source === Track.Source.ScreenShare) {
            setScreenShares((prev) => prev.filter((s) => !(s.participantId === participant.identity && s.track === track)));
          } else if (track.source === Track.Source.Camera) {
            setVideoFeeds((prev) => prev.filter((v) => v.participantId !== participant.identity));
          }
        }
        updateMembers();
      });

      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          setIsScreenSharing(true);
          if (pub.track) setLocalScreenTrack(pub.track);
        } else if (pub.source === Track.Source.Camera) {
          setIsCameraOn(true);
          if (pub.track) {
            const el = pub.track.attach();
            el.autoplay = true;
            el.playsInline = true;
            el.muted = true;
            const entry = { participantId: room.localParticipant.identity, participantName: room.localParticipant.name || room.localParticipant.identity, track: pub.track, element: el };
            setVideoFeeds((prev) => [...prev.filter((v) => v.participantId !== entry.participantId), entry]);
          }
        }
        updateMembers();
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          setIsScreenSharing(false);
          setLocalScreenTrack(null);
        } else if (pub.source === Track.Source.Camera) {
          setIsCameraOn(false);
          if (pub.track) pub.track.detach();
          setVideoFeeds((prev) => prev.filter((v) => v.participantId !== room.localParticipant.identity));
        }
        updateMembers();
      });

      room.on(RoomEvent.Disconnected, () => disconnectVoice({ keepError: true }));

      await withTimeout(room.connect(session.url, session.token), VOICE_CONNECT_TIMEOUT_MS, "Voice connection timed out.");
      await withTimeout(room.localParticipant.setMicrophoneEnabled(true), VOICE_CONNECT_TIMEOUT_MS, "Could not start microphone.");

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
    const next = !voiceMuted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setVoiceMuted(next);
      refreshVoiceMembers();
    } catch (err) {
      setVoiceError(err.message || "Unable to update microphone state");
    }
  };

  const toggleDeafen = () => setVoiceDeafened((prev) => !prev);

  const toggleScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!isScreenSharing, {
        audio: true,
        resolution: { width: 1920, height: 1080, frameRate: 30 },
        contentHint: "detail",
      });
    } catch (err) {
      if (err.name !== "NotAllowedError") setVoiceError(err.message || "Screen share failed");
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(!isCameraOn, {
        resolution: { width: 1280, height: 720, frameRate: 24 },
      });
    } catch (err) {
      setVoiceError(err.message || "Camera failed");
    }
  };

  const kickFromVoice = async (userId) => {
    if (!voiceChannelId) return;
    try {
      await api("/voice/kick", { method: "POST", body: { channel_id: voiceChannelId, user_id: userId }, token });
    } catch (err) { setVoiceError(err.message); }
  };

  useEffect(() => {
    voiceDeafenedRef.current = voiceDeafened;
    syncRemoteAudioMuted(audioSinkRef, voiceDeafened);
  }, [voiceDeafened]);

  /* ── Data loading ── */

  const loadServers = async () => {
    if (!token) return;
    setError("");
    try {
      const data = await api("/servers", { token });
      setServers(data);
      if (data.length > 0) setActiveServerId((prev) => prev || data[0].id);
      else setActiveServerId(null);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { if (user) loadServers(); }, [user]);

  useEffect(() => {
    if (!token || !user) return;
    api("/presence", { token }).then((data) => setPresenceMap(data)).catch(() => {});
    const ws = new WebSocket(`${WS_URL}/ws/presence?token=${token}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "presence.update") {
        setPresenceMap((prev) => ({ ...prev, [data.user_id]: data.status }));
      } else if (data.event === "voice.occupants") {
        setVoiceOccupants((prev) => {
          const next = { ...prev };
          if (data.members && data.members.length > 0) {
            next[data.channel_id] = data.members;
          } else {
            delete next[data.channel_id];
          }
          return next;
        });
      }
    };
    presenceSocketRef.current = ws;
    return () => { ws.close(); presenceSocketRef.current = null; };
  }, [token, user]);

  const loadUnreadCounts = async () => {
    if (!token) return;
    try {
      const data = await api("/channels/unread", { token });
      setUnreadCounts(data);
    } catch (err) { /* ignore */ }
  };

  useEffect(() => { if (user) loadUnreadCounts(); }, [user]);

  useEffect(() => {
    if (!activeChannelId || !token) return;
    api(`/channels/${activeChannelId}/read`, { method: "POST", token }).catch(() => {});
    setUnreadCounts((prev) => { const next = { ...prev }; delete next[activeChannelId]; return next; });
  }, [activeChannelId, token]);

  const loadDMChannels = async () => {
    if (!token) return;
    try {
      const data = await api("/dm", { token });
      setDmChannels(data);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { if (user) loadDMChannels(); }, [user]);

  const searchUsers = async (query) => {
    if (!query.trim() || !token) { setDmSearchResults([]); return; }
    try {
      const data = await api(`/users/search?q=${encodeURIComponent(query)}`, { token });
      setDmSearchResults(data);
    } catch (err) { setDmSearchResults([]); }
  };

  const startDM = async (recipientId) => {
    if (!token) return;
    try {
      const dm = await api("/dm", { method: "POST", body: { recipient_id: recipientId }, token });
      await loadDMChannels();
      setActiveDM(dm);
      setActiveServerId(null);
      setActiveChannelId(dm.id);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => {
    if (!token || !user) return;
    const match = window.location.pathname.match(/^\/join\/(.+)$/);
    if (!match) return;
    const serverId = match[1];
    (async () => {
      try {
        const server = await api(`/servers/${serverId}/join`, { method: "POST", token });
        await loadServers();
        setActiveServerId(server.id);
      } catch (err) { setError(err.message || "Failed to join server"); }
      finally { window.history.replaceState(null, "", "/"); }
    })();
  }, [token, user]);

  useEffect(() => {
    if (!token || !activeServerId) { setChannels([]); setMembers([]); return; }
    (async () => {
      try {
        const [ch, mem] = await Promise.all([
          api(`/servers/${activeServerId}/channels`, { token }),
          api(`/servers/${activeServerId}/members`, { token }),
        ]);
        setChannels(ch);
        setMembers(mem);
        api(`/voice/occupants/${activeServerId}`, { token }).then(setVoiceOccupants).catch(() => {});
        if (ch.length > 0) setActiveChannelId((prev) => ch.some((c) => c.id === prev) ? prev : ch[0].id);
        else setActiveChannelId(null);
      } catch (err) { setError(err.message); }
    })();
  }, [activeServerId, token]);

  useEffect(() => {
    if (!token || !activeChannelId || isVoiceChannel) {
      setMessages([]);
      if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
      return;
    }

    let active = true;
    api(`/channels/${activeChannelId}/messages`, { token })
      .then((data) => { if (active) setMessages(data); })
      .catch((err) => setError(err.message));

    if (socketRef.current) socketRef.current.close();
    const ws = new WebSocket(`${WS_URL}/ws/channels/${activeChannelId}?token=${token}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "message.created") {
        setMessages((prev) => prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]);
        api(`/channels/${activeChannelId}/read`, { method: "POST", token }).catch(() => {});
      } else if (payload.event === "message.updated") {
        setMessages((prev) => prev.map((m) => m.id === payload.id ? { ...m, content: payload.content, edited_at: payload.edited_at } : m));
      } else if (payload.event === "message.deleted") {
        setMessages((prev) => prev.filter((m) => m.id !== payload.id));
      } else if (payload.event === "reaction.updated") {
        setMessages((prev) => prev.map((m) => m.id === payload.message_id ? { ...m, reactions: payload.reactions } : m));
      } else if (payload.event === "typing.start") {
        const name = payload.username;
        setTypingUsers((prev) => prev.includes(name) ? prev : [...prev, name]);
        clearTimeout(typingTimeoutsRef.current[name]);
        typingTimeoutsRef.current[name] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== name));
          delete typingTimeoutsRef.current[name];
        }, 4000);
      }
    };
    socketRef.current = ws;
    return () => {
      active = false;
      ws.close();
      setTypingUsers([]);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
    };
  }, [activeChannelId, isVoiceChannel, token]);

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  /* ── Voice lifecycle ── */

  useEffect(() => {
    if (activeChannel?.type === "voice" && voiceConnected && voiceChannelId && voiceChannelId !== activeChannel.id) {
      disconnectVoice();
    }
  }, [activeChannel, voiceChannelId, voiceConnected]);

  useEffect(() => { if (!token) disconnectVoice(); }, [token]);
  useEffect(() => () => { socketRef.current?.close(); disconnectVoice(); }, []);

  /* ── Actions ── */

  const handleCreateServer = async () => {
    if (!serverModalName.trim()) return;
    setModalLoading(true);
    try {
      const server = await api("/servers", { method: "POST", body: { name: serverModalName.trim() }, token });
      setServers((prev) => [...prev, server]);
      setActiveServerId(server.id);
      setShowServerModal(false);
      setServerModalName("");
    } catch (err) { setError(err.message); }
    finally { setModalLoading(false); }
  };

  const handleCreateChannel = async () => {
    if (!activeServerId || !channelModalName.trim()) return;
    setModalLoading(true);
    try {
      const channel = await api(`/servers/${activeServerId}/channels`, {
        method: "POST", body: { name: channelModalName.trim(), type: channelModalType }, token,
      });
      setChannels((prev) => [...prev, channel]);
      setActiveChannelId(channel.id);
      setShowChannelModal(false);
      setChannelModalName("");
      setChannelModalType("text");
    } catch (err) { setError(err.message); }
    finally { setModalLoading(false); }
  };

  const handleCopyInvite = () => {
    if (!activeServerId) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${activeServerId}`).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!composer.trim() || !activeChannelId || isVoiceChannel) return;
    try {
      const msg = await api(`/channels/${activeChannelId}/messages`, { method: "POST", body: { content: composer }, token });
      setComposer("");
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, author: { id: user.id, username: user.username } }]);
    } catch (err) { setError(err.message); }
  };

  const sendTyping = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    ws.send(JSON.stringify({ event: "typing.start" }));
  }, []);

  const handleComposerChange = useCallback((value) => {
    setComposer(value);
    if (value.trim()) sendTyping();
  }, [sendTyping]);

  const uploadAndSendMessage = async (file, text) => {
    if (!activeChannelId || !token) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url, filename } = await uploadRes.json();

      const msg = await api(`/channels/${activeChannelId}/messages/with-attachment`, {
        method: "POST",
        body: { content: text || "", attachment_url: url, attachment_name: filename },
        token,
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [
        ...prev,
        { ...msg, author: { id: user.id, username: user.username } },
      ]);
    } catch (err) { setError(err.message); }
  };

  const editMessage = async (messageId, newContent) => {
    if (!activeChannelId) return;
    try {
      const updated = await api(`/channels/${activeChannelId}/messages/${messageId}`, {
        method: "PUT", body: { content: newContent }, token,
      });
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: updated.content, edited_at: updated.edited_at } : m));
    } catch (err) { setError(err.message); }
  };

  const deleteMessage = async (messageId) => {
    if (!activeChannelId) return;
    try {
      await api(`/channels/${activeChannelId}/messages/${messageId}`, { method: "DELETE", token });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) { setError(err.message); }
  };

  const renameChannel = async (channelId, newName) => {
    if (!activeServerId) return;
    try {
      const updated = await api(`/servers/${activeServerId}/channels/${channelId}`, {
        method: "PUT", body: { name: newName }, token,
      });
      setChannels((prev) => prev.map((c) => c.id === channelId ? { ...c, name: updated.name } : c));
    } catch (err) { setError(err.message); }
  };

  const deleteChannel = async (channelId) => {
    if (!activeServerId) return;
    try {
      await api(`/servers/${activeServerId}/channels/${channelId}`, { method: "DELETE", token });
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (activeChannelId === channelId) setActiveChannelId(null);
    } catch (err) { setError(err.message); }
  };

  const reactToMessage = async (messageId, emoji) => {
    if (!activeChannelId) return;
    try {
      const reactions = await api(`/channels/${activeChannelId}/messages/${messageId}/reactions`, {
        method: "PUT", body: { emoji }, token,
      });
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
    } catch (err) { setError(err.message); }
  };

  /* ── Render ── */

  if (!token || !user) {
    if (!showAuth) return (
      <>
        <LandingPage onOpenApp={() => setShowAuth(true)} ramadanTheme={ramadanTheme} onToggleTheme={toggleTheme} />
        <RamadanPopup open={showRamadanPopup} onClose={() => { setShowRamadanPopup(false); destroyRamadanAudio(); }} />
      </>
    );
    return <AuthScreen onAuth={setAuthToken} onBack={() => setShowAuth(false)} />;
  }

  return (
    <div className={`app-shell ${memberRailOpen ? "" : "members-hidden"}`}>
      <ServerRail
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={(id) => {
          setActiveServerId(id);
          if (!id) { setActiveChannelId(null); setActiveDM(null); }
          else { setActiveDM(null); }
        }}
        onCreateServer={() => setShowServerModal(true)}
        onLogout={() => setAuthToken(null)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="server-switch"
            onClick={() => { if (activeServerId) setShowServerSettings(true); }}
          >
            <span>{activeServer?.name || "Direct Messages"}</span>
            {activeServerId ? <span className="chevron"><ChevronDownIcon size={16} /></span> : null}
          </button>
          <div className="sidebar-header-actions">
            {activeServerId ? (
              <button type="button" className="icon-btn" onClick={handleCopyInvite} title="Copy invite link">
                {inviteCopied ? "Copied!" : <InviteIcon size={18} />}
              </button>
            ) : null}
            {activeServerId ? (
              <button type="button" className="icon-btn" onClick={() => setShowChannelModal(true)}><PlusIcon size={18} /></button>
            ) : null}
          </div>
        </div>
        {activeServerId ? (
          <>
            <div className="sidebar-nav">
              <button type="button" className="nav-item active">
                <span className="nav-icon"><HashIcon size={16} /></span>
                Channels
              </button>
            </div>

            <div className="sidebar-search">
              <SearchIcon size={16} />
              <input
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder="Search channels"
              />
            </div>

            <ChannelList
              textChannels={filteredTextChannels}
              voiceChannels={filteredVoiceChannels}
              activeChannelId={activeChannelId}
              voiceConnected={voiceConnected}
              voiceChannelId={voiceChannelId}
              activeServerId={activeServerId}
              unreadCounts={unreadCounts}
              voiceOccupants={voiceOccupants}
              voiceMembers={voiceMembers}
              onSelectChannel={(id) => { setActiveChannelId(id); setActiveDM(null); setSidebarOpen(false); }}
              onCreateChannel={() => setShowChannelModal(true)}
              onRenameChannel={renameChannel}
              onDeleteChannel={deleteChannel}
            />
          </>
        ) : (
          <DMList
            dmChannels={dmChannels}
            activeDMId={activeDM?.id}
            onSelectDM={(dm) => { setActiveDM(dm); setActiveChannelId(dm.id); setSidebarOpen(false); }}
            onStartNewDM={startDM}
            searchResults={dmSearchResults}
            onSearchUsers={searchUsers}
            searchQuery={dmSearchQuery}
            onSearchQueryChange={setDmSearchQuery}
          />
        )}

        {voiceConnected && connectedVoiceChannel ? (
          <VoiceStatusBar
            channel={connectedVoiceChannel}
            isScreenSharing={isScreenSharing}
            onGoToChannel={() => setActiveChannelId(connectedVoiceChannel.id)}
            onDisconnect={disconnectVoice}
          />
        ) : null}

        {ramadanTheme && <PrayerCountdown />}

        <ProfileCard
          user={user}
          voiceConnected={voiceConnected}
          voiceMuted={voiceMuted}
          voiceDeafened={voiceDeafened}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onClickProfile={() => setProfilePopupUser(user)}
          ramadanTheme={ramadanTheme}
          onToggleTheme={toggleTheme}
        />
      </aside>

      <main className="main">
        <header className="main-header">
          <button type="button" className="icon-btn mobile-only" onClick={() => setSidebarOpen((p) => !p)}>
            <MenuIcon size={20} />
          </button>
          {activeDM && !activeServerId ? (
            <div className="channel-title">
              <span className="hash"><AtIcon size={20} /></span>
              <div>
                <h3>{activeDM.recipient.username}</h3>
                <span className="muted">Direct Message</span>
              </div>
            </div>
          ) : activeChannel ? (
            <div className="channel-title">
              <span className="hash">{isVoiceChannel ? <VoiceIcon size={20} /> : <HashIcon size={20} />}</span>
              <div>
                <h3>{activeChannel.name}</h3>
                <span className="muted">{isVoiceChannel ? "Voice channel" : "Text channel"}</span>
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
                onClick={() => setMemberRailOpen((p) => !p)}
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

        {!activeServer && !activeDM ? (
          <FriendsList token={token} onStartDM={startDM} />
        ) : !activeServer && activeDM ? (
          <>
            <MessageList
              ref={messageListRef}
              displayMessages={displayMessages}
              membersById={membersById}
              currentUserId={user.id}
              currentUsername={user.username}
              onEditMessage={editMessage}
              onDeleteMessage={deleteMessage}
              onReactMessage={reactToMessage}
            />
            <Composer value={composer} onChange={handleComposerChange} onSubmit={sendMessage} onUpload={uploadAndSendMessage} channelName={activeDM.recipient.username} members={members} />
            <TypingIndicator typingUsers={typingUsers} />
          </>
        ) : !activeChannel ? (
          <div className="empty-state">
            <h2>No channels yet</h2>
            <p className="muted">Create a channel to start chatting.</p>
            <button type="button" className="chip solid" onClick={() => setShowChannelModal(true)}>Create a Channel</button>
          </div>
        ) : isVoiceChannel ? (
          <VoiceStage
            channelName={activeChannel.name}
            voiceConnected={voiceConnected}
            voiceConnecting={voiceConnecting}
            voiceChannelId={voiceChannelId}
            activeChannelId={activeChannelId}
            voiceMembers={voiceMembers}
            voiceMuted={voiceMuted}
            voiceDeafened={voiceDeafened}
            voiceError={voiceError}
            screenShares={screenShares}
            videoFeeds={videoFeeds}
            isScreenSharing={isScreenSharing}
            isCameraOn={isCameraOn}
            audioElementsRef={audioElementsRef}
            currentUserRole={myMember?.role}
            onJoin={() => connectVoiceChannel(activeChannel)}
            onLeave={disconnectVoice}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onToggleScreenShare={toggleScreenShare}
            onToggleCamera={toggleCamera}
            onKickParticipant={kickFromVoice}
          />
        ) : (
          <>
            <MessageList
              ref={messageListRef}
              displayMessages={displayMessages}
              membersById={membersById}
              currentUserId={user.id}
              currentUsername={user.username}
              onEditMessage={editMessage}
              onDeleteMessage={deleteMessage}
              onReactMessage={reactToMessage}
            />
            <Composer value={composer} onChange={handleComposerChange} onSubmit={sendMessage} onUpload={uploadAndSendMessage} channelName={activeChannel.name} members={members} />
            <TypingIndicator typingUsers={typingUsers} />
          </>
        )}
      </main>

      {memberRailOpen ? (
        <MemberRail
          members={members}
          currentUserId={user.id}
          presenceMap={presenceMap}
          onClickMember={(member) => setProfilePopupUser({ id: member.id, username: member.username, email: "", avatar_url: null, bio: null, banner_color: null })}
        />
      ) : null}

      {sidebarOpen ? (
        <button type="button" className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />
      ) : null}

      <Modal
        open={showServerModal}
        title="Create a Server"
        onClose={() => { setShowServerModal(false); setServerModalName(""); }}
        onSubmit={handleCreateServer}
        loading={modalLoading}
      >
        <label>
          Server Name
          <input value={serverModalName} onChange={(e) => setServerModalName(e.target.value)} placeholder="My Awesome Server" autoFocus required />
        </label>
      </Modal>

      <Modal
        open={showChannelModal}
        title="Create a Channel"
        onClose={() => { setShowChannelModal(false); setChannelModalName(""); setChannelModalType("text"); }}
        onSubmit={handleCreateChannel}
        loading={modalLoading}
      >
        <label>
          Channel Name
          <input value={channelModalName} onChange={(e) => setChannelModalName(e.target.value)} placeholder="general" autoFocus required />
        </label>
        <label>
          Channel Type
          <div className="modal-type-group">
            <button type="button" className={`modal-type-option ${channelModalType === "text" ? "selected" : ""}`} onClick={() => setChannelModalType("text")}><HashIcon size={16} /> Text</button>
            <button type="button" className={`modal-type-option ${channelModalType === "voice" ? "selected" : ""}`} onClick={() => setChannelModalType("voice")}><VoiceIcon size={16} /> Voice</button>
          </div>
        </label>
      </Modal>

      {showServerSettings && activeServer ? (
        <>
          <button type="button" className="scrim modal-scrim" onClick={() => setShowServerSettings(false)} aria-label="Close settings" />
          <div className="settings-overlay">
            <ServerSettings
              server={activeServer}
              members={members}
              currentUserId={user.id}
              token={token}
              onClose={() => setShowServerSettings(false)}
              onServerUpdated={(updated) => {
                setServers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
                setShowServerSettings(false);
              }}
              onServerDeleted={(id) => {
                setServers((prev) => prev.filter((s) => s.id !== id));
                setActiveServerId(null);
                setActiveChannelId(null);
                setShowServerSettings(false);
              }}
              onLeft={(id) => {
                setServers((prev) => prev.filter((s) => s.id !== id));
                setActiveServerId(null);
                setActiveChannelId(null);
                setShowServerSettings(false);
              }}
              onMembersUpdated={async () => {
                try {
                  const data = await api(`/servers/${activeServerId}/members`, { token });
                  setMembers(data);
                } catch (err) { /* ignore */ }
              }}
            />
          </div>
        </>
      ) : null}

      {profilePopupUser ? (
        <UserProfilePopup
          user={profilePopupUser}
          isOwnProfile={profilePopupUser.id === user.id}
          token={token}
          onClose={() => setProfilePopupUser(null)}
          onProfileUpdated={(updated) => {
            if (updated.id === user.id) setUser(updated);
            setProfilePopupUser(updated);
          }}
        />
      ) : null}

      {isScreenSharing && localScreenTrack ? (
        <PipPreview track={localScreenTrack} onStopSharing={toggleScreenShare} />
      ) : null}

      <div ref={audioSinkRef} style={{ display: "none" }} />
      <RamadanPopup open={showRamadanPopup} onClose={() => { setShowRamadanPopup(false); destroyRamadanAudio(); }} />
    </div>
  );
}
