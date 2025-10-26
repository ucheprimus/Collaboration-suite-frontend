import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "https://collaboration-suite-backend.onrender.com";

console.log("🔌 Socket URL:", SOCKET_URL);

// Create ONE socket instance for the entire app
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Connect once
export const connectSocket = (token?: string) => {
  if (!socket.connected) {
    socket.auth = { token };
    socket.connect();
    console.log("🔌 Connecting to:", SOCKET_URL);
  }
};

// Disconnect
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
