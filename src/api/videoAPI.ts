// src/api/videoAPI.ts
import { getSocket } from "./socket";

export function joinRoom(roomCode: string, userId: string) {
  const socket = getSocket();
  socket.emit("join-room", { roomCode, userId });
}

export function leaveRoom(roomCode: string) {
  const socket = getSocket();
  socket.emit("leave-room", { roomCode });
}
