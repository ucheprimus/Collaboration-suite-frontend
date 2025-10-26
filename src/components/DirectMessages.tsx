// src/components/DirectMessages.tsx - COMPLETE FIXED VERSION
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
  other_user_id?: string;
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

export default function DirectMessages({
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
  const [showDMModal, setShowDMModal] = useState(false);
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
          .eq("is_dm", true)
          .order("created_at", { ascending: false });

        if (chanError) throw chanError;

        const channelsWithNames = await Promise.all(
          (chans || []).map(async (ch: any) => {
            const { data: members } = await supabase
              .from("channel_members")
              .select("user_id")
              .eq("channel_id", ch.id)
              .neq("user_id", user.id)
              .limit(1);

            const otherUserId = members?.[0]?.user_id;

            if (otherUserId) {
              const otherProfile = profiles[otherUserId];
              return {
                id: ch.id,
                name: otherProfile?.full_name || "Unknown User",
                is_dm: ch.is_dm,
                created_by: ch.created_by,
                created_at: ch.created_at,
                other_user_id: otherUserId,
              };
            }
            return {
              id: ch.id,
              name: ch.name,
              is_dm: ch.is_dm,
              created_by: ch.created_by,
              created_at: ch.created_at,
            };
          })
        );

        setChannels(channelsWithNames || []);
        if (!activeChannel && channelsWithNames.length > 0) {
          setActiveChannel(channelsWithNames[0].id);
        }
      } catch (err: any) {
        console.error("Error fetching DM channels:", err);
      }
    };

    fetchChannels();
  }, [user, profiles]);

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

    try {
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

      const textToSend = text.trim();

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
            text: textToSend || null,
            file_url,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            type,
            reply_to: replyingTo?.id || null,
          };

          socket?.emit("message", payload);
        } catch (err) {
          alert(`Error uploading ${file.name}`);
        }
      }

      setText("");
      setAttachedFiles([]);
      setReplyingTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Error in sendMessage:", err);
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

  const createDM = async (otherUserId: string) => {
    if (!user) return;

    try {
      const { data: existingChannels } = await supabase
        .from("channel_members")
        .select("channel_id")
        .eq("user_id", user.id);

      if (existingChannels) {
        for (const membership of existingChannels) {
          const { data: channelMembers } = await supabase
            .from("channel_members")
            .select("user_id, channels!inner(is_dm)")
            .eq("channel_id", membership.channel_id);

          if (channelMembers && channelMembers.length === 2) {
            const isDM = channelMembers[0]?.channels?.is_dm;
            const hasOtherUser = channelMembers.some(
              (m) => m.user_id === otherUserId
            );

            if (isDM && hasOtherUser) {
              setActiveChannel(membership.channel_id);
              setShowDMModal(false);
              return;
            }
          }
        }
      }

      const otherProfile = profiles[otherUserId];
      const dmName = `DM: ${otherProfile?.full_name || "User"}`;

      const { data: newChannel, error: chErr } = await supabase
        .from("channels")
        .insert([{ name: dmName, created_by: user.id, is_dm: true }])
        .select()
        .single();

      if (chErr) throw chErr;

      await supabase.from("channel_members").insert([
        { channel_id: newChannel.id, user_id: user.id },
        { channel_id: newChannel.id, user_id: otherUserId },
      ]);

      setChannels((prev) => [
        ...prev,
        {
          id: newChannel.id,
          name: otherProfile?.full_name || "Unknown User",
          is_dm: true,
          other_user_id: otherUserId,
        },
      ]);
      setActiveChannel(newChannel.id);
      setShowDMModal(false);
    } catch (err) {
      console.error("Create DM error:", err);
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
          <h5 style={{ margin: "0 0 10px 0" }}>Direct Messages</h5>
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
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              style={{
                padding: "10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: ch.id === activeChannel ? "#0d6efd" : "#fff",
                color: ch.id === activeChannel ? "#fff" : "#212529",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              💬 {ch.name}
            </button>
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
              No direct messages yet
            </p>
          )}
        </div>

        <div style={{ padding: "10px" }}>
          <button
            onClick={() => setShowDMModal(true)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#6610f2",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            💬 New Direct Message
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
        <h4>
          {activeChannel
            ? channels.find((c) => c.id === activeChannel)?.name.toUpperCase()
            : "Select a Chat"}
        </h4>

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
            const name = (profile as Profile)?.full_name || "";

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
                        onClick={() =>
                          m.reply_to && scrollToMessage(m.reply_to)
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginBottom: "6px",
                          paddingLeft: "6px",
                          borderLeft: `2px solid ${
                            isMine ? "rgba(255,255,255,0.5)" : "#1264a3"
                          }`,
                          cursor: "pointer",
                          fontSize: "12px",
                          opacity: 0.85,
                          maxWidth: "250px", // 👈 FIXED WIDTH LIMIT
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "0.85";
                        }}
                      >
                        <span style={{ fontSize: "10px", flexShrink: 0 }}>
                          ↩
                        </span>
                        <span
                          style={{
                            fontWeight: "700",
                            color: isMine
                              ? "rgba(255,255,255,0.95)"
                              : "#1264a3",
                            flexShrink: 0,
                            whiteSpace: "nowrap", // 👈 PREVENTS NAME FROM WRAPPING
                          }}
                        >
                          {profiles[m.reply_to_message.user_id]?.full_name ||
                            "User"}
                        </span>
                        <span
                          style={{
                            color: isMine
                              ? "rgba(255,255,255,0.85)"
                              : "#616061",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {m.reply_to_message.text || "📎 Attachment"}
                        </span>
                      </div>
                    )}

                    {m.text && (
                      <div
                        style={{
                          fontSize: "15px",
                          lineHeight: "1.46668",
                        }}
                      >
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <strong style={{ fontSize: "14px" }}>
                {attachedFiles.length} file{attachedFiles.length > 1 ? "s" : ""}{" "}
                attached
              </strong>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
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
                      padding: "0 4px",
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
            id="dm-file-input"
          />
          <label
            htmlFor="dm-file-input"
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

      {showDMModal && (
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
            <h5>Start Direct Message</h5>
            <p style={{ color: "#6c757d", fontSize: "14px" }}>
              Select a user to start chatting
            </p>
            {allUsers
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <div
                  key={u.id}
                  onClick={() => createDM(u.id)}
                  style={{
                    padding: "10px",
                    marginBottom: "8px",
                    borderRadius: "6px",
                    backgroundColor: "#f8f9fa",
                    cursor: "pointer",
                    border: "1px solid #dee2e6",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e9ecef";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }}
                >
                  {u.full_name || u.id}
                </div>
              ))}
            <div style={{ marginTop: "15px", textAlign: "right" }}>
              <button
                onClick={() => setShowDMModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
