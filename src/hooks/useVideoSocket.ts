import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "../api/socket";
import { supabase } from "../lib/supabaseClient";

const serverUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

let socket: Socket = getSocket();

supabase.auth.getSession().then((r: any) => {
  const token = r.data.session?.access_token;
  if (token && socket) (socket as any).auth = { token };
});

export function useVideoSocket(roomId: string | null) {
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (!roomId || !socket) return;

    socket.emit("video:join-room", { roomId });

    socket.on("video:participants-update", ({ participants: p }: any) => {
      setParticipants(p || []);
    });

    return () => {
      socket.off("video:participants-update");
      socket.emit("video:leave-room", { roomId });
    };
  }, [roomId]);

  return { participants };
}