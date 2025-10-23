// src/pages/ChatPage.tsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { io, type Socket } from "socket.io-client";
import DirectMessages from "../components/DirectMessages";
import GroupMessages from "../components/GroupMessages";

interface Profile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  online?: boolean;
}

export default function ChatPage() {
  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<"dm" | "group">("dm");
  const socketRef = useRef<Socket | null>(null);

  // Auth setup
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session?.user) {
        setUser(data.session.user);
      } else {
        setUser(null);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      try {
        listener.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  // Socket setup
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (socketRef.current) return;

    const setupSocket = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        console.warn("⚠️ No Supabase access token found");
        return;
      }

      const socket = io("http://localhost:4000", {
        transports: ["websocket"],
        auth: { token },
        withCredentials: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
      });

      socket.on("connect_error", (err: any) => {
        console.error("❌ Socket connection error:", err.message);
      });

      socket.on("disconnect", (reason: any) => {
        console.log("⚠️ Socket disconnected:", reason);
      });

      socket.on("error", (err: any) => {
        console.warn("Socket error:", err);
      });
    };

    setupSocket();

    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
      }
    };
  }, [user]);

  // Fetch profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) {
        console.error("Error fetching profiles:", error);
        return;
      }
      if (data) {
        const map: Record<string, Profile> = {};
        data.forEach((p) => (map[p.id] = p));
        setProfiles(map);
        setAllUsers(data);
      }
    };
    fetchProfiles();
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Tab Selector */}
      <div
        style={{
          width: "60px",
          backgroundColor: "#212529",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "20px",
          gap: "15px",
        }}
      >
        <button
          onClick={() => setActiveTab("dm")}
          style={{
            width: "45px",
            height: "45px",
            borderRadius: "50%",
            border: activeTab === "dm" ? "3px solid #0d6efd" : "none",
            backgroundColor: activeTab === "dm" ? "#0d6efd" : "#495057",
            color: "#fff",
            cursor: "pointer",
            fontSize: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          title="Direct Messages"
        >
          💬
        </button>
        <button
          onClick={() => setActiveTab("group")}
          style={{
            width: "45px",
            height: "45px",
            borderRadius: "50%",
            border: activeTab === "group" ? "3px solid #0d6efd" : "none",
            backgroundColor: activeTab === "group" ? "#0d6efd" : "#495057",
            color: "#fff",
            cursor: "pointer",
            fontSize: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          title="Groups"
        >
          👥
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {activeTab === "dm" ? (
          <DirectMessages
            user={user}
            socket={socketRef.current}
            profiles={profiles}
            allUsers={allUsers}
          />
        ) : (
          <GroupMessages
            user={user}
            socket={socketRef.current}
            profiles={profiles}
            allUsers={allUsers}
          />
        )}
      </div>
    </div>
  );
}