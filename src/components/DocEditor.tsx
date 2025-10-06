// src/components/DocEditor.tsx
import React, { useEffect, useState, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { supabase } from "../lib/supabaseClient";

interface DocEditorProps {
  docId: string;
}

const colors = ["#F87171", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA", "#F472B6", "#FCD34D"];

export default function DocEditor({ docId }: DocEditorProps) {
  const [user, setUser] = useState<any>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const ydoc = useMemo(() => new Y.Doc(), []);

  // 1️⃣ Fetch Supabase user on mount
  useEffect(() => {
    const fetchUser = async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Error getting session:", sessionError);
    return;
  }
  const u = session?.user;
  if (u) setUser(u);
  console.log("✅ User loaded:", u);
};

    fetchUser();
  }, []);

  // 2️⃣ Setup WebSocketProvider
  useEffect(() => {
    if (!user) return;

    const userColor = colors[Math.floor(Math.random() * colors.length)];

    const wsProvider = new WebsocketProvider(
      "ws://localhost:4000/yjs", // server URL
      docId, // room name
      ydoc
    );

    setProvider(wsProvider);

    wsProvider.on("status", (event) => {
      console.log("🔌 WS Status:", event.status); // connected / disconnected
    });

    console.log("✅ Provider initialized:", wsProvider);

    return () => {
      wsProvider.destroy();
      console.log("❌ Provider destroyed");
    };
  }, [user, docId, ydoc]);

  // 3️⃣ Setup Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({ document: ydoc }),
      ...(provider && user
        ? [
            CollaborationCursor.configure({
              provider,
              user: {
                name: user.email || "Anonymous",
              },
            }),
          ]
        : []),
    ],
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor || !user || !provider) return <p>Loading editor...</p>;

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: 10,
        background: "#fff",
        minHeight: "300px",
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
