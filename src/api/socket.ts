// src/api/socket.ts
import { io, Socket } from "socket.io-client";
import { supabase } from "./supabaseClient";

let socket: Socket | null = null;

export const connectSocket = async () => {
  if (socket?.connected) return socket; // reuse existing socket

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
    auth: { token },
  });

  socket.on("connect", () => console.log("✅ Connected to socket:", socket.id));
  socket.on("disconnect", () => console.log("❌ Disconnected from socket"));

  return socket;
};

export const getSocket = () => {
  if (!socket) throw new Error("Socket not initialized. Call connectSocket() first.");
  return socket;
};
