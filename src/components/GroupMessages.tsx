// src/components/GroupMessages.tsx - FIXED VERSION WITH IMPROVED REPLY UI
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Socket } from "socket.io-client";

interface Profile {
  id: string;
  full_name?: string;
  avatar_url?: string;
}

interface Channel {
  id: string;
  name: string;
  is_dm?: boolean;
  created_by?: string;
}

interface Message {
  id?: string;
  channel_id: string;
  user_id: string;
  text?: string;
  file_url?: string;
  file_name?: string;
  mime_type?: string;
  type: "text" | "image" | "video" | "audio" | "file";
  created_at?: string;
  reply_to?: string;
  reply_to_message?: Message;
}

interface Props {
  user: any;
  socket: Socket | null;
  profiles: Record<string, Profile>;
  allUsers: Profile[];
}

export default function GroupMessages({
  user,
  socket,
  profiles,
  allUsers,
}: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [swipedMessage, setSwipedMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeChannelRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement>>({});

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    const fetchChannels = async () => {
      try {
        const { data: chans, error: chanError } = await supabase
          .from("channels")
          .select(
            `
            id,
            name,
            is_dm,
            created_by,
            created_at,
            channel_members!inner(user_id)
          `
          )
          .eq("channel_members.user_id", user.id)
          .eq("is_dm", false)
          .order("created_at", { ascending: false });

        if (chanError) throw chanError;

        const transformedChannels = (chans || []).map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          is_dm: ch.is_dm,
          created_by: ch.created_by,
          created_at: ch.created_at,
        }));

        setChannels(transformedChannels);
        if (!activeChannel && transformedChannels.length > 0) {
          setActiveChannel(transformedChannels[0].id);
        }
      } catch (err: any) {
        console.error("Error fetching group channels:", err);
      }
    };

    fetchChannels();
  }, [user]);

  useEffect(() => {
    if (!activeChannel) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", activeChannel)
        .order("created_at", { ascending: true });

      const messagesWithReplies = await Promise.all(
        (data || []).map(async (msg) => {
          if (msg.reply_to) {
            const { data: replyMsg } = await supabase
              .from("messages")
              .select("*")
              .eq("id", msg.reply_to)
              .single();

            return { ...msg, reply_to_message: replyMsg };
          }
          return msg;
        })
      );

      setMessages(messagesWithReplies);
    };

    fetchMessages();

    if (socket) {
      socket.emit("join", { channel_id: activeChannel });
    }
  }, [activeChannel, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async (msg: Message) => {
      if (msg?.channel_id && msg.channel_id === activeChannelRef.current) {
        if (msg.reply_to) {
          const { data: replyMsg } = await supabase
            .from("messages")
            .select("*")
            .eq("id", msg.reply_to)
            .single();

          msg.reply_to_message = replyMsg;
        }

        setMessages((prev) => {
          const isDuplicate = prev.some((m) => m.id === msg.id);
          if (isDuplicate) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleTyping = ({ userId, channelId, isTyping: typing }: any) => {
      if (channelId === activeChannelRef.current && userId !== user.id) {
        setIsTyping((prev) => ({ ...prev, [userId]: typing }));

        if (typing) {
          setTimeout(() => {
            setIsTyping((prev) => ({ ...prev, [userId]: false }));
          }, 3000);
        }
      }
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("typing", handleTyping);
    };
  }, [socket, user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(Array.from(files));
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const emitTyping = () => {
    if (!activeChannel || !socket) return;

    socket.emit("typing", { channelId: activeChannel, isTyping: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { channelId: activeChannel, isTyping: false });
    }, 2000);
  };

  const sendMessage = async () => {
    if (!user || !activeChannel) return;
    if (!text.trim() && attachedFiles.length === 0) return;

    if (text.trim() && attachedFiles.length === 0) {
      const payload = {
        channel_id: activeChannel,
        user_id: user.id,
        username: user.user_metadata?.full_name || user.email || "",
        text: text.trim(),
        file_url: null,
        file_name: null,
        mime_type: null,
        type: "text" as const,
        reply_to: replyingTo?.id || null,
      };

      socket?.emit("message", payload);
      setText("");
      setReplyingTo(null);
      return;
    }

    for (const file of attachedFiles) {
      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `uploads/${timestamp}_${randomStr}_${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat_uploads")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("File upload failed:", uploadError);
          alert(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: signedUrlData } = await supabase.storage
          .from("chat_uploads")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);

        const file_url = signedUrlData?.signedUrl ?? null;

        let type: "text" | "image" | "file" | "video" | "audio" = "file";
        if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("video/")) type = "video";
        else if (file.type.startsWith("audio/")) type = "audio";

        const payload = {
          channel_id: activeChannel,
          user_id: user.id,
          username: user.user_metadata?.full_name || user.email || "",
          text: text.trim() || null,
          file_url,
          file_name: file.name,
          mime_type: file.type,
          type,
          reply_to: replyingTo?.id || null,
        };

        socket?.emit("message", payload);
      } catch (err) {
        console.error("Error uploading file:", err);
        alert(`Error uploading ${file.name}`);
      }
    }

    setText("");
    setAttachedFiles([]);
    setReplyingTo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setShowMenu(null);
    } catch (err) {
      console.error("Delete message error:", err);
      alert("Failed to delete message");
    }
  };

  const deleteGroup = async (channelId: string) => {
    if (!confirm("Delete this group?")) return;

    try {
      const channel = channels.find((c) => c.id === channelId);

      if (!channel || channel.created_by !== user.id) {
        alert("Only the owner can delete this group");
        return;
      }

      await supabase.from("messages").delete().eq("channel_id", channelId);
      await supabase
        .from("channel_members")
        .delete()
        .eq("channel_id", channelId);
      await supabase.from("channels").delete().eq("id", channelId);

      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (activeChannel === channelId) {
        setActiveChannel(null);
      }
    } catch (err) {
      console.error("Delete group error:", err);
      alert("Failed to delete group");
    }
  };

  const toggleUserSelection = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const createGroup = async () => {
    if (!user || !selectedUsers.length || !newGroupName.trim()) return;

    try {
      const { data: newChannel, error: chErr } = await supabase
        .from("channels")
        .insert([
          { name: newGroupName.trim(), created_by: user.id, is_dm: false },
        ])
        .select()
        .single();

      if (chErr) throw chErr;

      const members = [user.id, ...selectedUsers];
      await supabase
        .from("channel_members")
        .insert(
          members.map((uid) => ({ channel_id: newChannel.id, user_id: uid }))
        );

      setChannels((prev) => [
        ...prev,
        {
          id: newChannel.id,
          name: newChannel.name,
          is_dm: false,
          created_by: user.id,
        },
      ]);
      setActiveChannel(newChannel.id);
      setShowCreateModal(false);
      setSelectedUsers([]);
      setNewGroupName("");
    } catch (err) {
      console.error("Create group error:", err);
    }
  };

  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current[messageId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.style.backgroundColor = "#fff3cd";
      setTimeout(() => {
        element.style.backgroundColor = "";
      }, 1500);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, messageId: string) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent, messageId: string) => {
    if (touchStart === null) return;

    const currentTouch = e.touches[0].clientX;
    const diff = touchStart - currentTouch;

    if (diff > 50) {
      setSwipedMessage(messageId);
    } else {
      setSwipedMessage(null);
    }
  };

  const handleTouchEnd = (msg: Message) => {
    if (swipedMessage === msg.id) {
      setReplyingTo(msg);
    }
    setTouchStart(null);
    setSwipedMessage(null);
  };

  const activeChannelData = channels.find((c) => c.id === activeChannel);
  const isGroupOwner = activeChannelData?.created_by === user?.id;
  const typingUsers = Object.entries(isTyping)
    .filter(([_, typing]) => typing)
    .map(([userId]) => profiles[userId]?.full_name || "Someone")
    .join(", ");

  return (
    <>
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          borderRight: "1px solid #dee2e6",
          backgroundColor: "#f1f3f5",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "10px" }}>
          <h5 style={{ margin: "0 0 10px 0" }}>Groups</h5>
        </div>

        <div
          style={{
            flexGrow: 1,
            overflowY: "auto",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {channels.map((ch) => (
            <div key={ch.id} style={{ position: "relative" }}>
              <button
                onClick={() => setActiveChannel(ch.id)}
                style={{
                  width: "100%",
                  padding: "10px",
                  paddingRight: ch.created_by === user.id ? "40px" : "10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: ch.id === activeChannel ? "#0d6efd" : "#fff",
                  color: ch.id === activeChannel ? "#fff" : "#212529",
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                👥 {ch.name}
              </button>
              {ch.created_by === user.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteGroup(ch.id);
                  }}
                  style={{
                    position: "absolute",
                    right: "15px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: ch.id === activeChannel ? "#fff" : "#dc3545",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                  title="Delete group"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
          {channels.length === 0 && (
            <p
              style={{
                color: "#6c757d",
                fontSize: "14px",
                textAlign: "center",
                marginTop: "20px",
              }}
            >
              No groups yet
            </p>
          )}
        </div>

        <div style={{ padding: "10px" }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#198754",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            + Create Group
          </button>
        </div>
      </div>

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h4>
            {activeChannel
              ? activeChannelData?.name.toUpperCase()
              : "Select a Group"}
          </h4>
          {isGroupOwner && activeChannel && (
            <span style={{ fontSize: "12px", color: "#6c757d" }}>👑 Owner</span>
          )}
        </div>

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
            const profile = profiles[m.user_id] || {};
            const name = profile?.full_name || "";

            return (
              <div
                key={m.id || i}
                ref={(el) => {
                  if (el && m.id) messageRefs.current[m.id] = el;
                }}
                style={{
                  display: "flex",
                  justifyContent: isMine ? "flex-end" : "flex-start",
                  marginBottom: "8px",
                  transition: "background-color 0.3s",
                }}
                onTouchStart={(e) => m.id && handleTouchStart(e, m.id)}
                onTouchMove={(e) => m.id && handleTouchMove(e, m.id)}
                onTouchEnd={() => handleTouchEnd(m)}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                    maxWidth: "70%",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: isMine ? "#0d6efd" : "#e9ecef",
                      color: isMine ? "#fff" : "#212529",
                      padding: "10px 35px 10px 15px",
                      borderRadius: "12px",
                      wordBreak: "break-word",
                      position: "relative",
                    }}
                  >
                    {!isMine && (
                      <strong style={{ marginBottom: "4px", display: "block" }}>
                        {name}
                      </strong>
                    )}
{/* SLACK-STYLE REPLY PREVIEW */}
{m.reply_to_message && (
  <div
    onClick={() => m.reply_to && scrollToMessage(m.reply_to)}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "4px",
      marginBottom: "6px",
      paddingLeft: "6px",
      borderLeft: `2px solid ${isMine ? "rgba(255,255,255,0.5)" : "#1264a3"}`,
      cursor: "pointer",
      fontSize: "12px",
      opacity: 0.85,
      maxWidth: "250px", // 👈 ADDED - limits width
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.opacity = "1";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.opacity = "0.85";
    }}
  >
    <span style={{ fontSize: "10px", flexShrink: 0 }}>↩</span> {/* 👈 ADDED flexShrink */}
    <span style={{ 
      fontWeight: "700",
      color: isMine ? "rgba(255,255,255,0.95)" : "#1264a3",
      flexShrink: 0, // 👈 ADDED - prevents name squishing
      whiteSpace: "nowrap", // 👈 ADDED - keeps name on one line
    }}>
      {profiles[m.reply_to_message.user_id]?.full_name || "User"}
    </span>
    <span style={{ 
      color: isMine ? "rgba(255,255,255,0.85)" : "#616061",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      flex: 1,
      minWidth: 0, // 👈 ADDED - allows proper ellipsis
    }}>
      {m.reply_to_message.text || "📎 Attachment"}
    </span>
  </div>
)}

{m.text && (
  <div style={{ 
    fontSize: "15px", 
    lineHeight: "1.46668",
  }}>
    {m.text}
  </div>
)}

                    {m.type === "image" && m.file_url && (
                      <img
                        src={m.file_url}
                        alt={m.file_name || "Image"}
                        style={{
                          width: "200px",
                          borderRadius: "8px",
                          marginTop: "6px",
                        }}
                      />
                    )}

                    {m.type === "video" && m.file_url && (
                      <video
                        controls
                        style={{
                          width: "250px",
                          borderRadius: "8px",
                          marginTop: "6px",
                        }}
                      >
                        <source src={m.file_url} type={m.mime_type} />
                      </video>
                    )}

                    {m.type === "audio" && m.file_url && (
                      <audio
                        controls
                        style={{ marginTop: "6px", width: "100%" }}
                      >
                        <source src={m.file_url} type={m.mime_type} />
                      </audio>
                    )}

                    {m.type === "file" && m.file_url && (
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: isMine ? "#fff" : "#0d6efd",
                          textDecoration: "underline",
                          marginTop: "6px",
                          display: "block",
                        }}
                      >
                        📎 {m.file_name || "Download"}
                      </a>
                    )}

                    <button
                      onClick={() =>
                        setShowMenu(showMenu === m.id ? null : m.id || null)
                      }
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        background: "none",
                        border: "none",
                        color: isMine ? "#fff" : "#6c757d",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: "2px 4px",
                      }}
                    >
                      ⋮
                    </button>

                    {showMenu === m.id && (
                      <div
                        style={{
                          position: "absolute",
                          top: "30px",
                          right: "8px",
                          backgroundColor: "#fff",
                          border: "1px solid #dee2e6",
                          borderRadius: "6px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          zIndex: 10,
                          minWidth: "120px",
                        }}
                      >
                        <button
                          onClick={() => {
                            setReplyingTo(m);
                            setShowMenu(null);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "none",
                            background: "none",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "14px",
                          }}
                        >
                          ↩️ Reply
                        </button>
                        {isMine && (
                          <button
                            onClick={() => m.id && deleteMessage(m.id)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              border: "none",
                              background: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "14px",
                              color: "#dc3545",
                            }}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {typingUsers && (
            <div
              style={{
                color: "#6c757d",
                fontSize: "14px",
                fontStyle: "italic",
              }}
            >
              {typingUsers} {typingUsers.includes(",") ? "are" : "is"} typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {replyingTo && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#fff3cd",
              borderRadius: "6px",
              border: "1px solid #ffc107",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>
                Replying to {profiles[replyingTo.user_id]?.full_name || "User"}:
              </strong>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                {replyingTo.text?.substring(0, 50) || "File"}
                {replyingTo.text && replyingTo.text.length > 50 && "..."}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "#6c757d",
              }}
            >
              ×
            </button>
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#e7f3ff",
              borderRadius: "6px",
              border: "1px solid #b3d9ff",
            }}
          >
            <strong style={{ fontSize: "14px" }}>
              {attachedFiles.length} file{attachedFiles.length > 1 ? "s" : ""}{" "}
              attached
            </strong>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    fontSize: "13px",
                    border: "1px solid #dee2e6",
                  }}
                >
                  <span>📎 {file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#dc3545",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            marginTop: "10px",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: "none" }}
            id="group-file-input"
          />
          <label
            htmlFor="group-file-input"
            style={{
              cursor: "pointer",
              fontSize: "24px",
              userSelect: "none",
              position: "relative",
            }}
          >
            📎
            {attachedFiles.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-8px",
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {attachedFiles.length}
              </span>
            )}
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
            onChange={(e) => {
              setText(e.target.value);
              emitTyping();
            }}
            onKeyPress={(e) => {
              if (
                e.key === "Enter" &&
                (text.trim() || attachedFiles.length > 0)
              ) {
                sendMessage();
              }
            }}
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
              opacity:
                !user ||
                !activeChannel ||
                (!text.trim() && attachedFiles.length === 0)
                  ? 0.5
                  : 1,
            }}
            onClick={sendMessage}
            disabled={
              !user ||
              !activeChannel ||
              (!text.trim() && attachedFiles.length === 0)
            }
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
            zIndex: 1000,
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
            <p
              style={{
                color: "#6c757d",
                fontSize: "14px",
                marginBottom: "15px",
              }}
            >
              Create a group and select members
            </p>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: "500",
                }}
              >
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #ced4da",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: "500",
                }}
              >
                Select Members ({selectedUsers.length} selected)
              </label>
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  padding: "8px",
                }}
              >
                {allUsers
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      style={{
                        padding: "8px 10px",
                        marginBottom: "6px",
                        borderRadius: "4px",
                        backgroundColor: selectedUsers.includes(u.id)
                          ? "#d1e7dd"
                          : "#f8f9fa",
                        cursor: "pointer",
                        border: selectedUsers.includes(u.id)
                          ? "2px solid #198754"
                          : "1px solid #dee2e6",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.id)}
                        onChange={() => {}}
                        style={{ cursor: "pointer" }}
                      />
                      <span>{u.full_name || u.id}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedUsers([]);
                  setNewGroupName("");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                disabled={!newGroupName.trim() || selectedUsers.length === 0}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor:
                    newGroupName.trim() && selectedUsers.length > 0
                      ? "#198754"
                      : "#6c757d",
                  color: "#fff",
                  cursor:
                    newGroupName.trim() && selectedUsers.length > 0
                      ? "pointer"
                      : "not-allowed",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
