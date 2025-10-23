import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "@supabase/auth-helpers-react";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const session = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!socketRef.current) {
      // create socket once
      socketRef.current = io(import.meta.env.VITE_API_URL || "http://localhost:4000", {
        auth: { token: session?.access_token },
        transports: ["websocket"],
        withCredentials: true,
      });

      const s = socketRef.current;

      s.on("connect", () => {
        console.log("🔌 Connected to Socket.IO");
        setConnected(true);
      });

      s.on("disconnect", () => {
        console.log("❌ Disconnected from Socket.IO");
        setConnected(false);
      });
    } else if (session?.access_token) {
      // update token on the existing socket
      socketRef.current.auth = { token: session.access_token };
      socketRef.current.connect();
    }

    return () => {
      // only disconnect when component unmounts
      return () => {
        socketRef.current?.disconnect();
      };
    };
  }, [session?.access_token]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => useContext(SocketContext);
