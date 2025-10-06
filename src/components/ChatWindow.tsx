// frontend/src/components/ChatWindow.tsx
import React, { useEffect, useState } from "react";
import { useSocket } from "../context/SocketProvider";

interface Message {
  id: string | number;
  user_id: string;
  username: string;
  channel: string;
  text: string;
  created_at: string;
}

export default function ChatWindow({ channel }: { channel: string }) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
  if (!socket) return;

  const user_id = localStorage.getItem("user_id") || "anon";
  const username = localStorage.getItem("username") || "Guest";

  console.log("📡 Joining channel:", channel);
  socket.emit("join", { channel_id: channel, user_id, username }); // ✅ fixed key

  const handleMessages = (msgs: Message[]) => {
    console.log("📥 History loaded:", msgs);
    setMessages(msgs);
  };

  const handleMessage = (msg: Message) => {
    console.log("📥 New message received:", msg);
    setMessages((prev) => [...prev, msg]);
  };

  socket.on("messages", handleMessages);
  socket.on("message:new", handleMessage); // ✅ correct event name

  return () => {
    socket.off("messages", handleMessages);
    socket.off("message:new", handleMessage); // ✅ cleanup
  };
}, [socket, channel]);



const sendMessage = () => {
  if (!input.trim() || !socket) return;

  const user_id = localStorage.getItem("user_id") || "anon";
  const username = localStorage.getItem("username") || "Guest";

  const msg = { channel_id: channel, user_id, username, text: input }; // ✅ use channel_id
  console.log("🚀 Sending message:", msg);
  socket.emit("message", msg);

  setInput("");
};


  return (
    <div className="d-flex flex-column flex-grow-1">
      <div className="flex-grow-1 border rounded p-2 mb-2 overflow-auto">
        {messages.length === 0 && (
          <div className="text-muted">No messages yet...</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="mb-1">
            <strong>{m.username}:</strong> {m.text}
          </div>
        ))}
      </div>
      <div className="d-flex">
        <input
          type="text"
          className="form-control me-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button className="btn btn-primary" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
