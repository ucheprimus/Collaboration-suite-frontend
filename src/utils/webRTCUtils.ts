// src/utils/webRTCUtils.ts

export interface PeerConnectionInfo {
  connection: RTCPeerConnection;
  stream: MediaStream;
}

/**
 * Creates a new RTCPeerConnection with proper ICE server configuration.
 */
export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void
): RTCPeerConnection {
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // Optionally add your TURN server later:
      // { urls: "turn:turn.yourserver.com", username: "user", credential: "pass" }
    ],
  };

  const peer = new RTCPeerConnection(configuration);

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  peer.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) onTrack(stream);
  };

  return peer;
}

/**
 * Attaches local stream tracks to the peer connection.
 */
export function addLocalTracks(peer: RTCPeerConnection, stream: MediaStream) {
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
}

/**
 * Creates an SDP offer and sets it as the local description.
 */
export async function createOffer(peer: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  return offer;
}

/**
 * Creates an SDP answer and sets it as the local description.
 */
export async function createAnswer(peer: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  return answer;
}

/**
 * Applies a remote session description.
 */
export async function applyRemoteDescription(
  peer: RTCPeerConnection,
  description: RTCSessionDescriptionInit
) {
  await peer.setRemoteDescription(new RTCSessionDescription(description));
}

/**
 * Adds an ICE candidate to the peer.
 */
export async function addIceCandidate(peer: RTCPeerConnection, candidate: RTCIceCandidateInit) {
  try {
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn("Failed to add ICE candidate:", err);
  }
}
