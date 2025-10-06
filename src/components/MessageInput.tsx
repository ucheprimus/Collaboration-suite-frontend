import { useState } from "react";

interface MessageInputProps {
  onSend: (content: string) => void;
}

export default function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!message.trim()) return;
  //   onSend(message.trim());
  //   setMessage("");
  // };

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!message.trim()) return;
  console.log("📤 Sending message:", message); // 👈 add this
  onSend(message.trim());
  setMessage("");
};

  return (
    <form
      onSubmit={handleSubmit}
      className="d-flex border-top p-2 bg-light"
      style={{ position: "sticky", bottom: 0 }}
    >
      <input
        type="text"
        className="form-control me-2"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="submit" className="btn btn-primary">
        Send
      </button>
    </form>
  );
}
