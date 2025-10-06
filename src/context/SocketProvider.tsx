// frontend/src/context/SocketProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<{ socket: Socket | null }>({ socket: null });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("⚠️ No auth token found for socket connection");
      return;
    }

    const s = io("http://localhost:4000", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on("connect", () => console.log("✅ Socket connected:", s.id));
    s.on("connect_error", (err) => console.error("❌ Socket connect error:", err.message));
    s.on("disconnect", () => console.log("⚠️ Socket disconnected"));

    setSocket(s);
    return () => s.disconnect();
  }, []);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
