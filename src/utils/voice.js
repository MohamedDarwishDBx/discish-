import { Track } from "livekit-client";

export const VOICE_CONNECT_TIMEOUT_MS = 12000;

export const participantMuted = (participant) => {
  const audioPublications = Array.from(participant.audioTrackPublications.values());
  if (audioPublications.length === 0) {
    return true;
  }
  return audioPublications.every((publication) => publication.isMuted);
};

export const participantHasSource = (participant, source) => {
  for (const pub of participant.videoTrackPublications.values()) {
    if (pub.source === source && pub.track && !pub.isMuted) return true;
  }
  return false;
};

export const buildVoiceMembers = (room, currentUserId) => {
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
      isYou: participant.identity === currentUserId,
      isScreenSharing: participantHasSource(participant, Track.Source.ScreenShare),
      isCameraOn: participantHasSource(participant, Track.Source.Camera),
    }))
    .sort((first, second) => {
      if (first.isYou) return -1;
      if (second.isYou) return 1;
      return first.username.localeCompare(second.username);
    });
};

export const clearAudioSink = (audioSinkRef) => {
  const sink = audioSinkRef.current;
  if (!sink) return;
  while (sink.firstChild) {
    sink.removeChild(sink.firstChild);
  }
};

export const syncRemoteAudioMuted = (audioSinkRef, muted) => {
  const sink = audioSinkRef.current;
  if (!sink) return;
  sink.querySelectorAll("audio").forEach((node) => {
    node.muted = muted;
  });
};
