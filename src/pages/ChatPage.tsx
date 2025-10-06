// src/pages/ChatPage.tsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { io, type Socket } from "socket.io-client";

// NOTE: don't create global socket outside the component — we create when we have a session.

interface Profile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  online?: boolean;
}

interface Channel {
  id: string;
  name: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [user, setUser] = useState<any>(null); // Supabase user object
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Socket ref
  const socketRef = useRef<Socket | null>(null);

  // Keep a ref of activeChannel so socket handler can read latest value
  const activeChannelRef = useRef<string | null>(activeChannel);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Restore user from Supabase session and listen to auth changes
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

    // Listen for auth state changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      // unsubscribe
      try {
        listener.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  // --- Initialize socket when user is present (authenticated)
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // ✅ Prevent duplicate connections
    if (socketRef.current) return;

    let mounted = true;

    const setupSocket = async () => {
      // ✅ Get a fresh Supabase JWT access token
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        console.warn(
          "⚠️ No Supabase access token found, cannot connect socket."
        );
        return;
      }

      const socket = io("http://localhost:4000", {
        transports: ["websocket"],
        auth: { token }, // ✅ send it to backend for verification
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

      const handler = (msg: any) => {
        if (msg?.channel_id && msg.channel_id === activeChannelRef.current) {
          setMessages((prev) => [...prev, msg]);
        }
      };

      socket.on("message:new", handler);

      socket.on("messages", (msgs: any[]) => {
        if (!activeChannelRef.current) return;
        const filtered = msgs.filter(
          (m) => m.channel_id === activeChannelRef.current
        );
        setMessages(filtered);
      });

      socket.on("error", (err: any) => {
        console.warn("Socket error:", err);
      });
    };

    setupSocket();

    return () => {
      mounted = false;
      if (socketRef.current) {
        try {
          socketRef.current.off("message:new");
          socketRef.current.off("messages");
          socketRef.current.disconnect();
        } catch {}
        socketRef.current = null;
      }
    };
  }, [user]);

  // --- Fetch profiles for display & group creation
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

  // --- Fetch channels the user belongs to
  useEffect(() => {
    if (!user) return;

    const fetchChannels = async () => {
      try {
        const { data: memberships, error: memError } = await supabase
          .from("channel_members")
          .select("channel_id")
          .eq("user_id", user.id);

        if (memError) throw memError;
        if (!memberships || memberships.length === 0) {
          setChannels([]);
          return;
        }

        const channelIds = memberships.map((m: any) => m.channel_id);

        const { data: chans, error: chanError } = await supabase
          .from("channels")
          .select("*")
          .in("id", channelIds);

        if (chanError) throw chanError;

        setChannels(chans || []);
        if (!activeChannel && chans && chans.length)
          setActiveChannel(chans[0].id);
      } catch (err) {
        console.error("Error fetching channels:", err);
      }
    };

    fetchChannels();
  }, [user]);

  // --- Fetch messages for active channel
  useEffect(() => {
    if (!activeChannel) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      // NOTE: server's messages table uses `channel` column (string). Query that.
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", activeChannel)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    };

    fetchMessages();

    // Have the socket join the channel (if connected)
    if (socketRef.current) {
      socketRef.current.emit("join", { channel_id: activeChannel });
    }
  }, [activeChannel, user]);

  // --- Send message
  // --- Send message

const sendMessage = async (file?: File) => {
  console.log("🚀 sendMessage called", { file, activeChannel, user });

  if (!user) {
    console.warn("⚠️ No user logged in, aborting sendMessage");
    return;
  }
  if (!activeChannel) {
    console.warn("⚠️ No active channel selected, aborting sendMessage");
    return;
  }

  let file_url: string | null = null;
  let file_name: string | null = null;
  let mime_type: string | null = null;
  let type: "text" | "image" | "file" | "video" | "audio" = "text";

  // ✅ If a file is attached, upload it to Supabase Storage
  if (file) {
    console.log("📁 Uploading file to storage:", file.name);

    const { data, error } = await supabase.storage
      .from("chat_uploads")
      .upload(`uploads/${Date.now()}_${file.name}`, file, {
        cacheControl: "3600",
        upsert: false,
  contentType: file.type,
      metadata: { user_id: supabase.auth.getUser()?.id }       });

    if (error) {
      console.error("❌ File upload failed:", error);
      return;
    }

    console.log("✅ File uploaded successfully:", data?.path);

    // Get signed URL for download
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("chat_uploads")
      .createSignedUrl(data.path, 60 * 60); // expires in 60s

    if (signedUrlError) {
      console.error("❌ Failed to create signed URL:", signedUrlError);
      return;
    }

    file_url = signedUrlData?.signedUrl ?? null;
    file_name = file.name;
    mime_type = file.type;

    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "audio";
    else type = "file";

    console.log("📄 File info:", { file_name, file_url, mime_type, type });
  }

  // ✅ Build message payload
  const payload = {
    channel_id: activeChannel,
    user_id: user.id,
    username: user.user_metadata?.full_name || user.email || "",
    text: text.trim() || null,
    file_url,
    file_name,
    mime_type,
    type,
  };

  console.log("📤 Sending message payload via socket:", payload);
  socketRef.current?.emit("message", payload);

  setText("");
};


  const toggleUserSelection = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const createGroup = async () => {
    if (!user || !selectedUsers.length || !newGroupName.trim()) return;

    try {
      // Create channel
      const { data: newChannel, error: chErr } = await supabase
        .from("channels")
        .insert([{ name: newGroupName.trim(), created_by: user.id }])
        .select()
        .single();

      if (chErr) throw chErr;
      if (!newChannel) return;

      // Add members
      const members = [user.id, ...selectedUsers];
      const { error: memErr } = await supabase
        .from("channel_members")
        .insert(
          members.map((uid) => ({ channel_id: newChannel.id, user_id: uid }))
        );

      if (memErr) throw memErr;

      // Refresh UI
      setChannels((prev) => [
        ...prev,
        { id: newChannel.id, name: newChannel.name },
      ]);
      setActiveChannel(newChannel.id);
      setShowCreateModal(false);
      setSelectedUsers([]);
      setNewGroupName("");
    } catch (err) {
      console.error("Create group error:", err);
    }
  };

  const getProfile = (id: string) => profiles[id] || {};

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          borderRight: "1px solid #dee2e6",
          padding: "10px",
          backgroundColor: "#f1f3f5",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h5>Channels / Groups</h5>
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch.id)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: ch.id === activeChannel ? "#0d6efd" : "#e9ecef",
              color: ch.id === activeChannel ? "#fff" : "#212529",
              cursor: "pointer",
            }}
          >
            {ch.name}
          </button>
        ))}
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            marginTop: "10px",
            padding: "8px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "#198754",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Create Group
        </button>
      </div>

      {/* Main Chat Panel */}
      <div
        style={{
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: "10px",
        }}
      >
        <h4>
          {activeChannel
            ? channels.find((c) => c.id === activeChannel)?.name.toUpperCase()
            : "Select a Group"}
        </h4>

        {/* Messages */}
        <div
          style={{
            flexGrow: 1,
            padding: "10px",
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            backgroundColor: "#f8f9fa",
          }}
        >
          {messages.map((m, i) => {
            const isMine = user && m.user_id === user.id;
            const profile = getProfile(m.user_id);
            const name = profile.full_name || "";

            const isImage = m.type === "image";
            const isVideo = m.type === "video";
            const isAudio = m.type === "audio";
            const isFile = m.type === "file";

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: isMine ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                    maxWidth: "70%",
                    backgroundColor: isMine ? "#0d6efd" : "#e9ecef",
                    color: isMine ? "#fff" : "#212529",
                    padding: "10px 15px",
                    borderRadius: "12px",
                  }}
                >
                  {!isMine && <strong>{name}</strong>}

                  {m.text && <div>{m.text}</div>}

                  {isImage && m.file_url && (
                    <img
                      src={m.file_url}
                      alt={m.file_name}
                      style={{
                        width: "200px",
                        borderRadius: "8px",
                        marginTop: "6px",
                      }}
                    />
                  )}
                  {isVideo && m.file_url && (
                    <video
                      controls
                      style={{ width: "250px", marginTop: "6px" }}
                    >
                      <source src={m.file_url} type={m.mime_type} />
                    </video>
                  )}
                  {isAudio && m.file_url && (
                    <audio controls style={{ marginTop: "6px" }}>
                      <source src={m.file_url} type={m.mime_type} />
                    </audio>
                  )}
                  {isFile && m.file_url && (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#fff",
                        textDecoration: "underline",
                        marginTop: "6px",
                      }}
                    >
                      {m.file_name}
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}

        <div
          style={{
            display: "flex",
            marginTop: "10px",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendMessage(file);
            }}
            style={{ display: "none" }}
            id="file-input"
          />
          <label htmlFor="file-input" style={{ cursor: "pointer" }}>
            📎
          </label>

          <input
            type="text"
            style={{
              flexGrow: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ced4da",
            }}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!user || !activeChannel}
          />
          <button
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#0d6efd",
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={() => sendMessage()}
            disabled={!user || !activeChannel || !text.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "8px",
              width: "400px",
              maxHeight: "80%",
              overflowY: "auto",
            }}
          >
            <h5>Create New Group</h5>
            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "10px",
                borderRadius: "6px",
                border: "1px solid #ced4da",
              }}
            />
            <h6>Select Members:</h6>
            {allUsers
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <div key={u.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUserSelection(u.id)}
                    />{" "}
                    {u.full_name || u.id}
                  </label>
                </div>
              ))}
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #ced4da",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#198754",
                  color: "#fff",
                }}
                disabled={!newGroupName.trim() || !selectedUsers.length}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
