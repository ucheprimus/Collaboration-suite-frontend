// src/hooks/useWebRTCConnection.ts
import { useCallback, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCOptions {
  socket: Socket | null;
  roomId: string;
  userId: string;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

export function useWebRTCConnection({
  socket,
  roomId,
  userId,
  localVideoRef,
  remoteVideoRef,
}: UseWebRTCOptions) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const servers: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const setupLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error("🎙️ Failed to access camera/mic:", err);
      alert("Please allow camera and microphone access.");
      return null;
    }
  }, [localVideoRef]);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(servers);

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (socket && event.candidate) socket.emit("ice-candidate", { roomId, candidate: event.candidate });
    };

    pc.onconnectionstatechange = () => console.log("🧩 Peer state:", pc.connectionState);
    peerConnectionRef.current = pc;
    return pc;
  }, [socket, roomId, remoteVideoRef]);

  const startConnection = useCallback(async () => {
    if (!socket || !roomId || !userId) return;
    const pc = createPeerConnection();
    const localStream = await setupLocalStream();
    if (!localStream) return;
    localStream.getTracks().forEach((track) => {
      if (!pc.getSenders().some((s) => s.track === track)) pc.addTrack(track, localStream);
    });
    socket.emit("join-room", { roomId, userId });
  }, [socket, roomId, userId, createPeerConnection, setupLocalStream]);

  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ offer, from }: any) => {
      if (from === userId) return;
      const pc = createPeerConnection();
      const localStream = await setupLocalStream();
      localStream?.getTracks().forEach((t) => {
        if (!pc.getSenders().some((s) => s.track === t)) pc.addTrack(t, localStream);
      });
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer, from: userId });
    };

    const handleAnswer = async ({ answer, from }: any) => {
      if (from === userId) return;
      const pc = peerConnectionRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleCandidate = async ({ candidate }: any) => {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("❄️ ICE candidate error:", err);
      }
    };

    const handleUserLeft = () => {
      if (remoteVideoRef.current?.srcObject instanceof MediaStream) {
        (remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        remoteVideoRef.current.srcObject = null;
      }
    };

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleCandidate);
    socket.on("user-left", handleUserLeft);

    return () => {
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleCandidate);
      socket.off("user-left", handleUserLeft);
    };
  }, [socket, roomId, userId, createPeerConnection, setupLocalStream]);

  const closeConnection = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteVideoRef.current?.srcObject instanceof MediaStream) {
      (remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteVideoRef]);

  return { startConnection, closeConnection };
}
