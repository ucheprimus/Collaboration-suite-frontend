import { io } from "../lib/socket";
import type { Socket } from "../types/socket.types";
import { supabase } from "../lib/supabaseClient";

const SERVER_URL = import.meta.env.VITE_API_URL || "${import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || "http://localhost:4000"}";

let socket: Socket | null = null;

export const connectSocket = (): Socket => {
  if (socket) return socket;

  socket = io(SERVER_URL, {
    transports: ["websocket"],
    autoConnect: false,
  });

  socket.on("connect", () => console.log("✅ Connected to socket:", socket?.id));

  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    socket = connectSocket();
  }
  return socket;
};

export const initSocket = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!socket) {
    socket = connectSocket();
  }

  if (token) {
    (socket as any).auth = { token };
  }

  socket.connect();
  return socket;
};