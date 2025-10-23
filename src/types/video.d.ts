// src/types/video.d.ts

export interface VideoRoom {
  id: string;
  title: string;
  description?: string;
  room_code: string;
  created_by: string;
  is_public: boolean;
  scheduled_start?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
  is_active: boolean;
}

export interface VideoParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string | null;
  role: "host" | "guest" | "cohost";
}

export interface VideoAccessRequest {
  id: string;
  room_id: string;
  user_id: string;
  requested_at: string;
  status: "pending" | "approved" | "denied";
  decision_at?: string | null;
  decided_by?: string | null;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface PeerInfo {
  id: string;
  stream: MediaStream;
}

/**
 * Socket event types
 */
export interface SocketEventMap {
  "join-room": { roomCode: string };
  "user-joined": { userId: string };
  "user-left": { userId: string };
  "offer": { sdp: RTCSessionDescriptionInit; to: string };
  "answer": { sdp: RTCSessionDescriptionInit; to: string };
  "ice-candidate": { candidate: RTCIceCandidateInit; to: string };
  "chat-message": ChatMessage;
}
