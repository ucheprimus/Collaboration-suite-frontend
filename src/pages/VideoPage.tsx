// src/pages/VideoPage.tsx - COMPLETE FIXED VERSION
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Nav,
  Button,
  Spinner,
  Modal,
  Form,
  Alert,
  Table,
  Badge,
  Tab,
} from "react-bootstrap";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaCopy,
  FaCheck,
  FaDesktop,
  FaComments,
  FaUsers,
  FaClock,
} from "react-icons/fa";

import { io } from "socket.io-client";
import type { Socket } from "../types/socket.types";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "../lib/supabaseClient";
import type { Inserts } from "../lib/supabaseClient";

const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "https://collaboration-suite-backend.onrender.com";

interface Participant {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  isSelf?: boolean;
  socketId?: string;
  stream?: MediaStream;
}

interface ChatMessage {
  id?: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

interface VideoRoom {
  id: string;
  title: string;
  room_code: string;
  is_public: boolean;
  scheduled_start: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  is_active: boolean;
  created_by: string;
}

export default function VideoPage() {
  const session = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [view, setView] = useState<"create" | "history" | "call">("create");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [currentRoomTitle, setCurrentRoomTitle] = useState<string>("");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const [isHost, setIsHost] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const [activeRooms, setActiveRooms] = useState<VideoRoom[]>([]);
  const [pastRooms, setPastRooms] = useState<VideoRoom[]>([]);

  const [newRoom, setNewRoom] = useState({
    title: "",
    description: "",
    is_public: true,
    scheduled_start: "",
  });
  const [joinCode, setJoinCode] = useState("");

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const callStartTimeRef = useRef<number | null>(null);

  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (view === "call" && !callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
    }

    if (view === "call") {
      const interval = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - callStartTimeRef.current) / 1000
          );
          setCallDuration(elapsed);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      callStartTimeRef.current = null;
      setCallDuration(0);
    }
  }, [view]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setSessionReady(true);
      } else {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
          if (s?.user) setSessionReady(true);
        });
        return () => sub.subscription.unsubscribe();
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (!sessionReady || !session) return;

    const s = io(SERVER_URL, {
      auth: { token: (session as any).access_token },
    });

    s.on("connect", () => console.log("🔗 Socket connected:", s.id));
    s.on("disconnect", () => console.log("❌ Socket disconnected"));
    setSocket(s);

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [sessionReady, session]);

  useEffect(() => {
    if (!sessionReady || view !== "create") return;

    const fetchRooms = async () => {
      try {
        const { data: active, error: activeError } = await supabase
          .from("video_rooms")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (activeError) throw activeError;

        const validActive = (active || []).filter((room) => {
          if (!room.started_at) return true;
          const ageMinutes =
            (Date.now() - new Date(room.started_at).getTime()) / 60000;
          return ageMinutes <= 60;
        });

        setActiveRooms(validActive);
      } catch (err) {
        console.error("Error fetching active rooms:", err);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [sessionReady, view]);

  useEffect(() => {
    if (!sessionReady || view !== "history") return;

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("video_rooms")
          .select("*")
          .eq("is_active", false)
          .order("ended_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setPastRooms(data || []);
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    fetchHistory();
  }, [sessionReady, view]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.new.user_id === session?.user?.id) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", payload.new.user_id)
            .single();

          interface ProfileData {
            full_name: string;
          }

          const newMsg: ChatMessage = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            user_name: (profile as ProfileData | null)?.full_name || "Unknown",

            message: payload.new.message,
            created_at: payload.new.created_at,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, session]);

  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && view === "call") {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current
        .play()
        .catch((err) => console.error("Play error:", err));
    }
  }, [localStreamRef.current, view, cameraOn]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleParticipantsUpdate = async (data: { participants: any[] }) => {
      console.log("👥 Participants update received:", data.participants.length);
      console.log("   Self ID:", session?.user?.id);
      console.log("   Self socket:", socket?.id);

      const enrichedParticipants = await Promise.all(
        data.participants
          .filter((p) => p.user_id !== session?.user?.id) // ✅ EXCLUDE SELF
          .map(async (p) => {
            if (!p.user_name) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", p.user_id)
                .single();

              interface ProfileData {
                full_name: string;
              }
              p.user_name =
                (profile as ProfileData | null)?.full_name || "Guest";
            }

            const result = {
              id: p.user_id,
              user_id: p.user_id,
              user_name: p.user_name,
              role: p.role,
              isSelf: false, // Never self since we filtered
              socketId: p.socketId || p.user_id,
            };

            console.log(
              "   Remote Participant:",
              result.user_name,
              "socketId:",
              result.socketId
            );
            return result;
          })
      );

      setParticipants(enrichedParticipants);

      console.log(`✅ Set ${enrichedParticipants.length} remote participants`);
    };

    const handleChatMessage = (data: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id && m.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const handleUserJoined = async ({
      userId,
      socketId,
      userName,
    }: {
      userId: string;
      socketId: string;
      userName?: string;
    }) => {
      console.log(
        "🎉 User joined:",
        userName || userId,
        "socket:",
        socketId,
        "Self:",
        session?.user?.id
      );

      // ✅ Prevent connecting to yourself
      if (userId === session?.user?.id) {
        console.log("⚠️ Ignoring self join");
        return;
      }

      // ✅ Prevent duplicate connections
      if (peersRef.current.has(socketId)) {
        console.log("♻️ Already connected to", socketId);
        return;
      }

      console.log("📞 Creating peer connection for:", userName || socketId);
      await createPeerConnection(socketId, true);
    };

    const handleOffer = async ({
      offer,
      from,
    }: {
      offer: RTCSessionDescriptionInit;
      from: string;
    }) => {
      console.log("📨 Received offer from:", from);
      const peer = await createPeerConnection(from, false);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("webrtc:answer", { roomId, answer, to: from });
      console.log("📤 Sent answer to:", from);
    };

    const handleAnswer = async ({
      answer,
      from,
    }: {
      answer: RTCSessionDescriptionInit;
      from: string;
    }) => {
      console.log("📨 Received answer from:", from);
      const peer = peersRef.current.get(from);
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Answer processed for:", from);
      } else {
        console.warn("⚠️ No peer found for answer from:", from);
      }
    };

    const handleIceCandidate = async ({
      candidate,
      from,
    }: {
      candidate: RTCIceCandidateInit;
      from: string;
    }) => {
      const peer = peersRef.current.get(from);
      if (peer && candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("❄️ ICE candidate added for:", from);
        } catch (err) {
          console.error("❄️ ICE error:", err);
        }
      }
    };

    const handleUserLeft = ({ socketId }: { socketId: string }) => {
      console.log("👋 User left:", socketId);
      const peer = peersRef.current.get(socketId);
      if (peer) {
        peer.close();
        peersRef.current.delete(socketId);
      }

      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));

      if (activeSpeakerId === socketId) {
        setActiveSpeakerId(null);
      }
    };

    socket.on("video:meeting-ended", ({ reason }) => {
      alert(reason || "Meeting has been ended by the host");
      handleEndCall();
    });

    // Add this inside your useEffect that listens to socket events
    socket.on("video:room-ended", ({ reason }) => {
      alert(reason || "Meeting has ended");
      handleEndCall(); // Your existing end call function
    });

    // Also add error handler
    socket.on("video:error", ({ message }) => {
      setError(message);
      if (message.includes("ended")) {
        handleEndCall();
      }
    });

    socket.on("video:participants-update", handleParticipantsUpdate);
    socket.on("video:chat-message", handleChatMessage);
    socket.on("webrtc:user-joined", handleUserJoined);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("webrtc:user-left", handleUserLeft);

    return () => {
      socket.off("video:participants-update", handleParticipantsUpdate);
      socket.off("video:chat-message", handleChatMessage);
      socket.off("webrtc:user-joined", handleUserJoined);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("webrtc:user-left", handleUserLeft);
    };
  }, [socket, roomId, session, activeSpeakerId]);

  const startLocalStream = async () => {
    try {
      let stream: MediaStream;

      if (testMode) {
        // TEST MODE: Create synthetic video and audio
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;

        const drawFrame = () => {
          const time = Date.now() / 1000;
          const gradient = ctx.createLinearGradient(0, 0, 640, 480);
          gradient.addColorStop(0, `hsl(${(time * 50) % 360}, 70%, 50%)`);
          gradient.addColorStop(1, `hsl(${(time * 50 + 180) % 360}, 70%, 30%)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 640, 480);

          ctx.fillStyle = "white";
          ctx.font = "bold 40px Arial";
          ctx.textAlign = "center";
          ctx.fillText("TEST MODE", 320, 200);
          ctx.font = "20px Arial";
          ctx.fillText(session?.user?.email || "Test User", 320, 250);
          ctx.fillText(new Date().toLocaleTimeString(), 320, 290);
        };

        const interval = setInterval(drawFrame, 1000 / 30);
        const videoStream = canvas.captureStream(30);

        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.01;
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();

        const audioDestination = audioContext.createMediaStreamDestination();
        gainNode.connect(audioDestination);

        stream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ]);

        // Store cleanup references
        (stream as any)._testModeInterval = interval;
        (stream as any)._audioContext = audioContext;
        (stream as any)._oscillator = oscillator;

        console.log("✅ Test mode stream created");
      } else {
        // REAL MODE: Get actual camera and microphone
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          console.log("✅ Real camera/mic stream created");
          console.log("Video tracks:", stream.getVideoTracks().length);
          console.log("Audio tracks:", stream.getAudioTracks().length);
        } catch (permissionError: any) {
          // If permission denied, show helpful error
          if (
            permissionError.name === "NotAllowedError" ||
            permissionError.name === "PermissionDeniedError"
          ) {
            throw new Error(
              "Camera/microphone access denied. Please allow permissions and try again."
            );
          } else if (permissionError.name === "NotFoundError") {
            throw new Error(
              "No camera or microphone found. Please connect a device and try again."
            );
          } else {
            throw permissionError;
          }
        }
      }

      localStreamRef.current = stream;

      // Apply current mic/camera state to the stream
      stream.getAudioTracks().forEach((track) => (track.enabled = micOn));
      stream.getVideoTracks().forEach((track) => (track.enabled = cameraOn));

      return stream;
    } catch (err: any) {
      console.error("❌ Error starting local stream:", err);
      setError(`Camera/Mic error: ${err.message}`);
      throw err;
    }
  };

  const createPeerConnection = async (
    socketId: string,
    isInitiator: boolean
  ): Promise<RTCPeerConnection> => {
    console.log("🔧 Creating peer connection:", {
      socketId,
      isInitiator,
      hasLocal: !!localStreamRef.current,
    });

    if (peersRef.current.has(socketId)) {
      console.log("♻️ Reusing existing peer for:", socketId);

      return peersRef.current.get(socketId)!;
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peer.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit("webrtc:ice-candidate", {
          roomId,
          candidate: e.candidate,
          to: socketId,
        });
      }
    };

    peer.ontrack = (e) => {
      const stream = e.streams[0];

      setParticipants((prev) => {
        const updated = prev.map((p) =>
          p.socketId === socketId ? { ...p, stream } : p
        );

        if (!activeSpeakerId && mainVideoRef.current) {
          setTimeout(() => {
            if (mainVideoRef.current) {
              mainVideoRef.current.srcObject = stream;
              setActiveSpeakerId(socketId);
            }
          }, 100);
        }

        return updated;
      });
    };

    peer.onconnectionstatechange = () => {
      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        peer.close();
        peersRef.current.delete(socketId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current!);
      });
    }

    peersRef.current.set(socketId, peer);

    if (isInitiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket?.emit("webrtc:offer", { roomId, offer, to: socketId });
    }

    return peer;
  };

  const createRoomInSupabase = async () => {
    if (!session?.user?.id) return null;

    const payload: Inserts<"video_rooms"> = {
      title: newRoom.title?.trim() || "Untitled Meeting",
      description: newRoom.description?.trim() || "",
      is_public: newRoom.is_public ?? true,
      scheduled_start: newRoom.scheduled_start || null,
      created_by: session.user.id,
      started_at: new Date().toISOString(),
      is_active: true,
    };

    try {
      const { data, error } = await supabase
        .from("video_rooms")
        .insert([payload])
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to create room");
      }

      const participantPayload: Inserts<"video_participants"> = {
        room_id: data.id,
        user_id: session.user.id,
        role: "host",
        joined_at: new Date().toISOString(),
      };

      await supabase.from("video_participants").insert([participantPayload]);

      return data;
    } catch (err) {
      setError("Failed to create room");
      return null;
    }
  };

  const joinRoom = async (roomCodeOrId: string, useRoomId = false) => {
    if (!socket || !session) {
      setError("Not connected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = useRoomId
        ? supabase
            .from("video_rooms")
            .select("*")
            .eq("id", roomCodeOrId)
            .single()
        : supabase
            .from("video_rooms")
            .select("*")
            .eq("room_code", roomCodeOrId)
            .single();

      const { data: room, error: roomError } = await query;

      if (roomError || !room) throw new Error("Room not found");
      if (!room.is_active) throw new Error("Room has ended");

      // ✅ CHECK IF USER IS HOST
      const userIsHost = room.created_by === session.user.id;
      setIsHost(userIsHost);

      console.log(`🎯 User role: ${userIsHost ? "HOST" : "GUEST"}`);

      await startLocalStream();

      if (!localStreamRef.current) {
        throw new Error("Failed to initialize media stream");
      }

      const participantPayload: Inserts<"video_participants"> = {
        room_id: room.id,
        user_id: session.user.id,
        role: userIsHost ? "host" : "guest",
        joined_at: new Date().toISOString(),
      };

      await supabase
        .from("video_participants")
        .upsert([participantPayload], { onConflict: "room_id,user_id" });

      // Fetch participants
      const { data: participantsData } = await supabase
        .from("video_participants")
        .select("user_id, role")
        .eq("room_id", room.id)
        .is("left_at", null);

      if (participantsData) {
        const enriched = await Promise.all(
          participantsData.map(async (p: any) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", p.user_id)
              .single();

            return {
              id: p.user_id,
              user_id: p.user_id,
              user_name: profile?.full_name || "Guest",
              role: p.role,
              isSelf: p.user_id === session.user.id,
              socketId: p.user_id,
            };
          })
        );
        setParticipants(enriched);
      }

      // Fetch chat messages
      const { data: chatData } = await supabase
        .from("video_messages")
        .select("id, user_id, message, created_at")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });

      if (chatData) {
        const enriched = await Promise.all(
          chatData.map(async (m: any) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", m.user_id)
              .single();

            return {
              id: m.id,
              user_id: m.user_id,
              user_name: profile?.full_name || "Unknown",
              message: m.message,
              created_at: m.created_at,
            };
          })
        );
        setMessages(enriched);
      }

      socket.emit("video:join-room", {
        roomId: room.id,
        userId: session.user.id,
        userName: session.user.user_metadata?.full_name || "Guest",
      });

      setRoomId(room.id);
      setCurrentRoomCode(room.room_code);
      setCurrentRoomTitle(room.title);
      setView("call");

      setTimeout(async () => {
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current
            .play()
            .catch((err) => console.error("Local video play error:", err));
        }

        const otherParticipants = participants.filter(
          (p) => !p.isSelf && p.socketId !== socket.id
        );

        for (const participant of otherParticipants) {
          if (
            participant.socketId &&
            participant.socketId !== session.user.id
          ) {
            await createPeerConnection(participant.socketId, true);
          }
        }
      }, 500);
    } catch (err: any) {
      setError(err?.message || "Failed to join");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = messageInput.trim();
    if (!text || !roomId || !session?.user || !socket) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage: ChatMessage = {
      id: tempId,
      user_id: session.user.id,
      user_name: session.user.user_metadata?.full_name || "You",
      message: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageInput("");

    try {
      const messagePayload: Inserts<"video_messages"> = {
        room_id: roomId,
        user_id: session.user.id,
        message: text,
      };

      const { data, error } = await supabase
        .from("video_messages")
        .insert([messagePayload])
        .select()
        .single();

      if (error || !data)
        throw new Error(error?.message || "Failed to send message");

      socket.emit("video:chat-message", {
        roomId,
        id: data.id,
        user_id: session.user.id,
        user_name: session.user.user_metadata?.full_name || "You",
        message: text,
        created_at: data.created_at,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: data.id, created_at: data.created_at }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Failed to send");
    }
  };

  const handleConfirmCreate = async () => {
    setShowCreateModal(false);
    setLoading(true);
    const room = await createRoomInSupabase();
    if (room) {
      await joinRoom(room.id, true);
    }
    setLoading(false);
  };

  const handleConfirmJoin = async () => {
    if (!joinCode.trim()) return;
    setShowJoinModal(false);
    await joinRoom(joinCode.trim(), false);
  };

  const handleEndCall = async () => {
    try {
      // Update participant status in database
      if (roomId && session?.user) {
        const updatePayload: Partial<Inserts<"video_participants">> = {
          left_at: new Date().toISOString(),
        };

        await supabase
          .from("video_participants")
          .update(updatePayload)
          .eq("room_id", roomId)
          .eq("user_id", session.user.id);
      }

      // Close all peer connections
      peersRef.current.forEach((peer) => {
        peer.close();
      });
      peersRef.current.clear();

      // Stop local media stream and cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        // Cleanup test mode resources if they exist
        if ((localStreamRef.current as any)._testModeInterval) {
          clearInterval((localStreamRef.current as any)._testModeInterval);
        }
        if ((localStreamRef.current as any)._audioContext) {
          try {
            await (localStreamRef.current as any)._audioContext.close();
          } catch (err) {
            console.error("Error closing audio context:", err);
          }
        }

        localStreamRef.current = null;
      }

      // Notify server about leaving
      if (socket && roomId) {
        socket.emit("webrtc:leave", { roomId });
        socket.emit("video:leave-room", { roomId });
      }

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        localVideoRef.current.pause();
      }
      if (mainVideoRef.current) {
        mainVideoRef.current.srcObject = null;
        mainVideoRef.current.pause();
      }

      // Reset all state
      setRoomId(null);
      setCurrentRoomCode(null);
      setCurrentRoomTitle("");
      setParticipants([]);
      setMessages([]);
      setActiveSpeakerId(null);
      setMicOn(true);
      setCameraOn(true);
      setView("create");
    } catch (err) {
      console.error("Error ending call:", err);
      // Still navigate away even if cleanup fails
      setView("create");
    }
  };

  const handleEndMeeting = async () => {
    if (!roomId || !isHost) {
      console.error("❌ Only host can end meeting");
      return;
    }

    const confirmEnd = window.confirm(
      "⚠️ This will end the meeting for EVERYONE. Continue?"
    );

    if (!confirmEnd) return;

    try {
      console.log(`🛑 HOST ending meeting ${roomId}`);

      // Mark room as inactive
      await supabase
        .from("video_rooms")
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq("id", roomId);

      // Mark all participants as left
      await supabase
        .from("video_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .is("left_at", null);

      // Notify server to broadcast end to everyone
      socket?.emit("video:end-meeting", { roomId });

      // Clean up and leave
      await handleEndCall();
    } catch (err) {
      console.error("Error ending meeting:", err);
      setError("Failed to end meeting");
    }
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const newState = !micOn;
    localStreamRef.current
      .getAudioTracks()
      .forEach((t) => (t.enabled = newState));
    setMicOn(newState);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const newState = !cameraOn;
    localStreamRef.current
      .getVideoTracks()
      .forEach((t) => (t.enabled = newState));
    setCameraOn(newState);
  };

  const switchToSpeaker = useCallback(
    (participantSocketId: string, stream: MediaStream) => {
      if (mainVideoRef.current) {
        mainVideoRef.current.srcObject = stream;
        setActiveSpeakerId(participantSocketId);
      }
    },
    []
  );

  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!sessionReady) {
    return (
      <Container className="vh-100 d-flex justify-content-center align-items-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="vh-100 d-flex flex-column justify-content-center align-items-center">
        <Spinner animation="border" />
        <p className="mt-3">Setting up video...</p>
      </Container>
    );
  }

  return (
    <div
      style={{
        marginLeft: view === "call" ? "0" : "0", // Remove margin completely when in call

        padding: "0",
        minHeight: "100vh",
        background: "#f5f7fa",
      }}
    >
      {view !== "call" && (
        <Container fluid className="py-3">
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Nav
            variant="tabs"
            activeKey={view}
            onSelect={(v) => setView(v as any)}
            className="mb-3 justify-content-center"
          >
            <Nav.Item>
              <Nav.Link eventKey="create">Create / Join</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="history">History</Nav.Link>
            </Nav.Item>
          </Nav>

          {view === "create" && (
            <div className="mt-4">
              <div className="d-flex justify-content-center mb-3">
                <Form.Check
                  type="switch"
                  id="test-mode"
                  label="🎭 Test Mode"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                />
              </div>

              <h4 className="text-center">Video Meetings</h4>

              <div className="d-flex justify-content-center gap-3 my-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowJoinModal(true)}
                >
                  Join Room
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Room
                </Button>
              </div>

              <Row className="justify-content-center">
                <Col lg={10}>
                  <Card className="shadow-sm">
                    <Card.Header>
                      <h5 className="mb-0">Active Meetings</h5>
                    </Card.Header>
                    <Card.Body>
                      {activeRooms.length === 0 ? (
                        <p className="text-muted text-center">
                          No active meetings
                        </p>
                      ) : (
                        <Table responsive hover>
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Room Code</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeRooms.map((room) => (
                              <tr key={room.id}>
                                <td>
                                  <strong>{room.title}</strong>
                                </td>
                                <td>
                                  <code>{room.room_code}</code>
                                  <Button
                                    size="sm"
                                    variant="link"
                                    onClick={() => copyRoomCode(room.room_code)}
                                  >
                                    {copiedCode === room.room_code ? (
                                      <FaCheck color="green" />
                                    ) : (
                                      <FaCopy />
                                    )}
                                  </Button>
                                </td>
                                <td>
                                  <Badge bg="success">Active</Badge>
                                </td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() =>
                                      joinRoom(room.room_code, false)
                                    }
                                  >
                                    Join
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          {view === "history" && (
            <Row className="justify-content-center">
              <Col lg={10}>
                <Card className="shadow-sm">
                  <Card.Header>
                    <h5 className="mb-0">Call History</h5>
                  </Card.Header>
                  <Card.Body>
                    {pastRooms.length === 0 ? (
                      <p className="text-muted text-center">No past meetings</p>
                    ) : (
                      <Table responsive hover>
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Room Code</th>
                            <th>Started</th>
                            <th>Ended</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pastRooms.map((room) => (
                            <tr key={room.id}>
                              <td>{room.title}</td>
                              <td>
                                <code>{room.room_code}</code>
                              </td>
                              <td>
                                {room.started_at
                                  ? new Date(room.started_at).toLocaleString()
                                  : "-"}
                              </td>
                              <td>
                                {room.ended_at
                                  ? new Date(room.ended_at).toLocaleString()
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </Container>
      )}

{view === "call" && (
  <div
    style={{ 
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10000,
      background: "#000",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* TOP BAR */}
    <div style={{
      background: "rgba(0,0,0,0.8)",
      padding: "12px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
    }}>
      <div>
        <h5 style={{ color: "#fff", margin: 0, fontSize: "16px" }}>
          {currentRoomTitle}
        </h5>
        <div style={{ color: "#999", fontSize: "12px", marginTop: "4px" }}>
          <FaClock style={{ marginRight: "6px" }} />
          {formatDuration(callDuration)}
          {isHost && <Badge bg="success" style={{ marginLeft: "8px", fontSize: "10px" }}>HOST</Badge>}
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Badge bg="secondary" style={{ padding: "6px 12px" }}>
          Room: {currentRoomCode}
        </Badge>
        <Button size="sm" variant="link" onClick={() => copyRoomCode(currentRoomCode || "")}>
          {copiedCode === currentRoomCode ? <FaCheck color="#4CAF50" /> : <FaCopy />}
        </Button>
      </div>
    </div>

    {/* MAIN CONTENT - Video + Sidebar */}
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      
      {/* LEFT - Main Video Area */}
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        
        {/* Main Speaker Video */}
        <video
          ref={mainVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />

        {!activeSpeakerId && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "#fff",
          }}>
            <div style={{ fontSize: "60px", marginBottom: "16px", opacity: 0.4 }}>🎥</div>
            <h3 style={{ marginBottom: "8px", fontWeight: "500", fontSize: "20px" }}>
              Waiting for participants...
            </h3>
            <p style={{ color: "#999", fontSize: "14px" }}>
              Share room code: <strong>{currentRoomCode}</strong>
            </p>
          </div>
        )}

        {/* Bottom Participant Thumbnails */}
        <div style={{
          position: "absolute",
          bottom: "80px",
          left: "20px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          maxWidth: "calc(100% - 40px)",
        }}>
          {/* Your Video */}
          <div style={{
            width: "180px",
            height: "120px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "2px solid #4CAF50",
            background: "#000",
            position: "relative",
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: cameraOn ? "block" : "none",
              }}
            />
            {!cameraOn && (
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  color: "#fff",
                  fontWeight: "600",
                }}>
                  {session?.user?.user_metadata?.full_name?.[0]?.toUpperCase() || "Y"}
                </div>
              </div>
            )}
            <div style={{
              position: "absolute",
              bottom: "6px",
              left: "6px",
              right: "6px",
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span>You {isHost && "👑"}</span>
              <span>{micOn ? "🎤" : "🔇"}</span>
            </div>
          </div>

          {/* Other Participants */}
          {participants.filter(p => !p.isSelf).map((participant) => (
            <ParticipantThumbnailSimple
              key={participant.socketId || participant.id}
              participant={participant}
              isActive={activeSpeakerId === (participant.socketId || participant.id)}
              onSelect={() => {
                if (participant.stream) {
                  switchToSpeaker(participant.socketId || participant.id, participant.stream);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* RIGHT SIDEBAR - Chat & People */}
      <div style={{
        width: "320px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #ddd",
      }} className="d-none d-lg-flex">
        
        <Tab.Container defaultActiveKey="chat">
          <Nav variant="tabs" style={{ borderBottom: "1px solid #ddd" }}>
            <Nav.Item style={{ flex: 1 }}>
              <Nav.Link eventKey="chat" style={{ textAlign: "center", fontSize: "13px", padding: "10px" }}>
                <FaComments style={{ marginRight: "5px" }} /> Chat
              </Nav.Link>
            </Nav.Item>
            <Nav.Item style={{ flex: 1 }}>
              <Nav.Link eventKey="people" style={{ textAlign: "center", fontSize: "13px", padding: "10px" }}>
                <FaUsers style={{ marginRight: "5px" }} /> People ({participants.length + 1})
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* CHAT TAB */}
            <Tab.Pane eventKey="chat" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "15px", background: "#f9f9f9" }}>
                {messages.length === 0 ? (
                  <p style={{ color: "#999", fontSize: "13px", textAlign: "center", marginTop: "20px" }}>
                    No messages yet
                  </p>
                ) : (
                  messages.map((m, idx) => (
                    <div key={m.id || idx} style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                        <strong>{m.user_name}</strong>
                        <span style={{ marginLeft: "6px" }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div style={{
                        background: "#fff",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        border: "1px solid #e0e0e0",
                      }}>
                        {m.message}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: "12px", borderTop: "1px solid #ddd" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Form.Control
                    size="sm"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button size="sm" variant="primary" onClick={sendMessage} disabled={!messageInput.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </Tab.Pane>

            {/* PEOPLE TAB */}
            <Tab.Pane eventKey="people" style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {/* You */}
              <div style={{
                display: "flex",
                alignItems: "center",
                padding: "8px",
                borderBottom: "1px solid #f0f0f0",
                background: "rgba(76, 175, 80, 0.1)",
                borderRadius: "8px",
                marginBottom: "8px",
              }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                }}>
                  {session?.user?.user_metadata?.full_name?.[0]?.toUpperCase() || "Y"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600" }}>
                    You {isHost && "👑"}
                  </div>
                  {isHost && <Badge bg="success" style={{ fontSize: "9px" }}>Host</Badge>}
                </div>
              </div>

              {/* Other Participants */}
              {participants.filter(p => !p.isSelf).length === 0 ? (
                <p style={{ color: "#999", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
                  No other participants
                </p>
              ) : (
                participants.filter(p => !p.isSelf).map((p) => (
                  <div key={p.id} style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px",
                    borderBottom: "1px solid #f0f0f0",
                  }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "10px",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}>
                      {p.user_name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "500" }}>{p.user_name}</div>
                      {p.role === "host" && <Badge bg="primary" style={{ fontSize: "9px" }}>Host</Badge>}
                    </div>
                  </div>
                ))
              )}
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </div>
    </div>

    {/* BOTTOM CONTROLS */}
    <div style={{
      background: "rgba(0,0,0,0.9)",
      padding: "16px 24px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "12px",
      borderTop: "1px solid rgba(255,255,255,0.1)",
    }}>
      <Button
        onClick={toggleMic}
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: micOn ? "rgba(255,255,255,0.15)" : "#dc3545",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {micOn ? <FaMicrophone size={18} color="#fff" /> : <FaMicrophoneSlash size={18} color="#fff" />}
      </Button>

      <Button
        onClick={toggleCamera}
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: cameraOn ? "rgba(255,255,255,0.15)" : "#dc3545",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {cameraOn ? <FaVideo size={18} color="#fff" /> : <FaVideoSlash size={18} color="#fff" />}
      </Button>

      <Button
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="Share Screen"
      >
        <FaDesktop size={18} color="#fff" />
      </Button>

      {isHost ? (
        <Button
          onClick={handleEndMeeting}
          style={{
            height: "48px",
            borderRadius: "24px",
            background: "#dc3545",
            border: "none",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          <FaPhoneSlash size={16} />
          End Meeting
        </Button>
      ) : (
        <Button
          onClick={handleEndCall}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "#dc3545",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Leave Call"
        >
          <FaPhoneSlash size={18} color="#fff" />
        </Button>
      )}
    </div>
  </div>
)}

      {/* CREATE MEETING MODAL */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Meeting</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Title */}
            <Form.Group className="mb-3">
              <Form.Label>Meeting Title *</Form.Label>
              <Form.Control
                placeholder="Team Standup"
                value={newRoom.title}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, title: e.target.value })
                }
              />
            </Form.Group>

            {/* Description */}
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Optional meeting details..."
                value={newRoom.description}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, description: e.target.value })
                }
              />
            </Form.Group>

            {/* Scheduled Start */}
            <Form.Group className="mb-3">
              <Form.Label>Scheduled Start</Form.Label>
              <Form.Control
                type="datetime-local"
                value={newRoom.scheduled_start}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, scheduled_start: e.target.value })
                }
              />
              <Form.Text muted>Leave empty to start immediately.</Form.Text>
            </Form.Group>

            {/* Public Room Switch */}
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                label="Public room"
                checked={newRoom.is_public}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, is_public: e.target.checked })
                }
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmCreate}
            disabled={!newRoom.title.trim()}
          >
            Create & Join
          </Button>
        </Modal.Footer>
      </Modal>

      {/* JOIN MEETING MODAL */}
      <Modal show={showJoinModal} onHide={() => setShowJoinModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Join Meeting</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Room Code</Form.Label>
              <Form.Control
                placeholder="Enter room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmJoin}
            disabled={!joinCode.trim()}
          >
            Join
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// PARTICIPANT THUMBNAIL COMPONENT
interface ParticipantThumbnailProps {
  participant: Participant;
  isActive: boolean;
  onSelect: () => void;
}

function ParticipantThumbnail({
  participant,
  isActive,
  onSelect,
}: ParticipantThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch((err) => console.error("Play error:", err));
    }
  }, [participant.stream]);

  return (
    <div
      onClick={onSelect}
      style={{
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        border: isActive ? "3px solid #4CAF50" : "2px solid #555",
        background: "#000",
        cursor: "pointer",
        aspectRatio: "4/3",
        transition: "border 0.3s",
      }}
    >
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "#fff",
              fontWeight: "600",
            }}
          >
            {participant.user_name?.[0]?.toUpperCase() || "?"}
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: "5px",
          left: "5px",
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: "500",
        }}
      >
        {participant.user_name}
        {participant.role === "host" && " 👑"}
      </div>

      {isActive && (
        <div
          style={{
            position: "absolute",
            top: "5px",
            right: "5px",
            background: "#4CAF50",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: "600",
          }}
        >
          🔊 LIVE
        </div>
      )}
    </div>
  );
}
