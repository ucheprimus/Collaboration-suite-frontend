import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "../types/socket.types";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean; // Add this to the interface
}

const SocketContext = createContext<SocketContextType>({ 
  socket: null,
  isConnected: false 
});

// Export BOTH names so imports work
export const useSocket = () => useContext(SocketContext);
export const useSocketContext = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Use VITE_SOCKET_URL from environment, fallback to port 4000 (your backend port)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || "https://collaboration-suite-backend.onrender.com";
    
    console.log("🔌 Initializing Socket.IO connection to:", socketUrl);
    
    const newSocket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true, // Important for CORS
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      setIsConnected(false);
    });

    newSocket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
    });

    socketRef.current = newSocket;

    return () => {
      console.log("🧹 Cleaning up socket connection");
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
