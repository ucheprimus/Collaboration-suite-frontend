// src/hooks/useChat.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import { io } from "socket.io-client";
import type { Socket } from "../types/socket.types";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "https://collaboration-suite-backend.onrender.com";

export interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  channel_id: string;
  text: string;
  created_at: string;
}

export function useChat(user: any, activeChannel: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // ✅ connect socket when user logs in
  useEffect(() => {
    if (!user) return;

    const s = io(SOCKET_URL, {
      transports: ["websocket"],
      query: { userId: user.id },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    s.on("disconnect", (reason) => {
      console.warn("⚠️ Socket disconnected:", reason);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user?.id]);

  // ✅ load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChannel) return;

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", activeChannel)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) console.error("❌ Error loading messages:", error.message);
      else setMessages(data as Message[]);
    };

    loadMessages();
  }, [activeChannel]);

  // ⚠️ optional realtime DB listener (remove if socket duplicates)
  useEffect(() => {
    if (!activeChannel) return;

    const channel = supabase
      .channel(`messages:channel_id=eq.${activeChannel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannel}`,
        },
        (payload) => {
          if (payload.new && payload.new.id) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel]);

  // ✅ socket listener
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (!msg || msg.channel_id !== activeChannel) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, activeChannel]);

  return { messages, setMessages, socket };
}
