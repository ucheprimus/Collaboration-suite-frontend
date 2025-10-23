// src/socket/socketClient.ts
import { Socket } from "socket.io-client";

// ------------------------
// Cached socket instance
// ------------------------
let socket: Socket | null = null;

/**
 * Set the current socket (from SocketProvider)
 */
export const setSocket = (s: Socket | null) => {
  socket = s;
};

/**
 * Get the current socket instance
 */
export const getSocket = (): Socket | null => socket;

/**
 * Disconnect the socket safely
 */
export const disconnectSocket = (): void => {
  if (socket) {
    console.log("🚪 Disconnecting socket:", socket.id);
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/**
 * Emit an event safely
 */
export const emitEvent = (event: string, payload?: any) => {
  if (!socket || !socket.connected) {
    console.warn(`⚠️ Cannot emit "${event}" — socket not connected`);
    return;
  }
  socket.emit(event, payload);
};

/**
 * Listen to an event safely
 */
export const onEvent = (event: string, callback: (data: any) => void) => {
  if (!socket) {
    console.warn(`⚠️ Cannot listen to "${event}" — socket not initialized`);
    return;
  }
  socket.on(event, callback);
};
