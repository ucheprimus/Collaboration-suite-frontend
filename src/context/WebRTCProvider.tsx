import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useSocketContext } from "./SocketProvider";
import { useMediaStream } from "../hooks/useMediaDevices";

interface Peer {
  id: string;
  stream: MediaStream;
}

interface WebRTCContextType {
  localStream: MediaStream | null;
  peers: Peer[];
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
}

const WebRTCContext = createContext<WebRTCContextType>({
  localStream: null,
  peers: [],
  joinRoom: () => {},
  leaveRoom: () => {},
});

export const WebRTCProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocketContext();
  const { localStream } = useMediaStream();
  const [peers, setPeers] = useState<Peer[]>([]);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  // Join a room and handle signaling
  const joinRoom = (roomId: string) => {
    if (!socket || !localStream) return;
    socket.emit("join-room", { roomId });

    socket.on("user-joined", async ({ id }) => {
      console.log("🟢 User joined:", id);
      const pc = createPeerConnection(id);
      peerConnections.current[id] = pc;

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc-offer", { to: id, offer });
    });

    socket.on("webrtc-offer", async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      peerConnections.current[from] = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, answer });
    });

    socket.on("webrtc-answer", async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("webrtc-ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });
  };

  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("webrtc-ice-candidate", {
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setPeers((prev) => {
        if (prev.find((p) => p.id === peerId)) return prev;
        return [...prev, { id: peerId, stream }];
      });
    };

    return pc;
  };

  const leaveRoom = () => {
    setPeers([]);
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
  };

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  return (
    <WebRTCContext.Provider value={{ localStream, peers, joinRoom, leaveRoom }}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTCContext = () => useContext(WebRTCContext);
