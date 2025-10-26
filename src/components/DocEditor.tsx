// src/components/DocEditor.tsx - PROPERLY FIXED
import React, { useEffect, useState, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { io } from "socket.io-client";
import type { Socket } from "../types/socket.types";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { supabase } from "../lib/supabaseClient";

interface DocEditorProps {
  docId: string;
}

const SERVER_URL = "https://collaboration-suite-backend.onrender.com";

export default function DocEditor({ docId }: DocEditorProps) {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [permission, setPermission] = useState<string>("viewer");
  const [isOwner, setIsOwner] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);

  // Fetch user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.user) throw new Error("No session");

        console.log("✅ User:", session.user.email);
        setUser({ ...session.user, token: session.access_token });
      } catch (err: any) {
        console.error("❌ Auth error:", err);
        setError("Authentication failed");
      }
    };
    fetchUser();
  }, []);

  // Check ownership
  useEffect(() => {
    const checkOwnership = async () => {
      if (!user || !docId) return;

      try {
        const { data, error } = await supabase
          .from("documents")
          .select("owner_id")
          .eq("id", docId)
          .single();

        if (!error && data) {
          const owner = data.owner_id === user.id;
          setIsOwner(owner);
          console.log("📋 Ownership:", owner ? "OWNER" : "COLLABORATOR");
        }
      } catch (err) {
        console.error("❌ Ownership check error:", err);
      }
    };

    checkOwnership();
  }, [user, docId]);

  // Setup Y.js collaboration
  useEffect(() => {
    if (!user || !docId) return;

    console.log("🚀 Setting up Y.js for:", docId);

    // Cleanup old connections
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
      awarenessRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    setReady(false);
    setError(null);
    setSyncing(true);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create awareness
    const awareness = new awarenessProtocol.Awareness(ydoc);
    awarenessRef.current = awareness;

    // Set local awareness state
    awareness.setLocalState({
      user: {
        name: user.email,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      }
    });

// Around line 117, change the socket connection to:
const socket = io(`${SERVER_URL}/yjs`, {
  auth: { 
    token: user.token,
    docId: docId 
  },
  query: { 
    token: user.token,
    docId: docId 
  },
  extraHeaders: {
    'Authorization': `Bearer ${user.token}`
  },
  transports: ["websocket", "polling"],
});
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected");
      setReady(true);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Connection error:", err.message);
      setError(`Connection failed: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
      setReady(false);
    });

    socket.on("error", (err: any) => {
      console.error("❌ Socket error:", err);
      setError(err.message || "Connection error");
    });

    // Listen for permission
    socket.on("permission", ({ permission: perm }: { permission: string }) => {
      console.log("🔐 Permission received:", perm);
      setPermission(perm);
      setSyncing(false);
    });

    // Handle sync messages - SIMPLIFIED
    socket.on("sync", (data: ArrayBuffer | Uint8Array) => {
      try {
        const uint8Data = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        if (!uint8Data || uint8Data.length === 0) return;

        console.log("📥 Received sync message:", uint8Data.length, "bytes");

        const decoder = decoding.createDecoder(uint8Data);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === 0) {
          // Sync message
          const syncType = decoding.readVarUint(decoder);
          
          console.log("  → Sync type:", syncType === 0 ? "Step1" : syncType === 1 ? "Step2" : "Update");
          
          if (syncType === syncProtocol.messageYjsSyncStep1) {
            // Server wants our state
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 0);
            encoding.writeVarUint(encoder, syncProtocol.messageYjsSyncStep2);
            syncProtocol.writeSyncStep2(encoder, ydoc);
            socket.emit("sync", encoding.toUint8Array(encoder));
            console.log("  📤 Sent our state");
          } else if (syncType === syncProtocol.messageYjsSyncStep2) {
            // Server sending us the full state
            const update = decoding.readVarUint8Array(decoder);
            console.log("  → Applying full state:", update.length, "bytes");
            
            Y.applyUpdate(ydoc, update);
            
            // Check what was loaded
            const fragment = ydoc.getXmlFragment("default");
            console.log("  ✅ Document loaded! Fragment has", fragment.length, "nodes");
            
            // Force editor update
            if (editor) {
              editor.commands.setContent(editor.getJSON());
            }
          } else if (syncType === syncProtocol.messageYjsUpdate) {
            // Incremental update
            const update = decoding.readVarUint8Array(decoder);
            Y.applyUpdate(ydoc, update);
            console.log("✅ Update applied");
          }
        } else if (messageType === 1) {
          // Awareness message
          try {
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              decoding.readVarUint8Array(decoder),
              socket
            );
          } catch (err: any) {
            console.warn("⚠️ Awareness update skipped:", err.message);
          }
        }
      } catch (err: any) {
        console.error("❌ Sync error:", err.message);
        console.error("Stack:", err.stack);
      }
    });

    // Send document updates
    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== socket) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // messageSync
        encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate);
        encoding.writeVarUint8Array(encoder, update);
        socket.emit("sync", encoding.toUint8Array(encoder));
        console.log("📤 Sent update");
      }
    };
    ydoc.on("update", updateHandler);

    // Send awareness updates - FIXED
    const awarenessUpdateHandler = ({ added, updated, removed }: any, origin: any) => {
      const changedClients = added.concat(updated).concat(removed);
      if (changedClients.length > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1); // messageAwareness
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        );
        socket.emit("sync", encoding.toUint8Array(encoder));
      }
    };
    awareness.on("update", awarenessUpdateHandler);

    // Don't send initial sync - server sends us the state first
    console.log("⏳ Waiting for document state from server...");

    return () => {
      ydoc.off("update", updateHandler);
      awareness.off("update", awarenessUpdateHandler);
      awareness.destroy();
      socket.disconnect();
      ydoc.destroy();
      setReady(false);
    };
  }, [user, docId]);

  const isEditable = ready && (isOwner || permission === "editor");

  // Create editor
  const editor = useEditor({
    editable: isEditable,
    extensions: ready && ydocRef.current && awarenessRef.current
      ? [
          StarterKit.configure({ history: false }),
          Collaboration.configure({ document: ydocRef.current }),
          CollaborationCursor.configure({
            provider: { awareness: awarenessRef.current } as any,
            user: {
              name: user?.email || "Anonymous",
              color: '#' + Math.floor(Math.random()*16777215).toString(16)
            }
          }),
        ]
      : [StarterKit.configure({ history: true })],
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none p-4",
        style: "min-height: 400px;",
      },
    },
  }, [ready, ydocRef.current, awarenessRef.current, isEditable]);

  // Update editor editability
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable);
      console.log("✏️ Editable:", isEditable, "| Permission:", permission, "| Owner:", isOwner);
    }
  }, [editor, isEditable, permission, isOwner]);

  if (error) {
    return (
      <div className="alert alert-danger">
        <h5>❌ Error</h5>
        <p>{error}</p>
        <button className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  if (!user || !ready || !editor) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" />
          <p className="text-muted">Connecting...</p>
        </div>
      </div>
    );
  }

  const displayRole = isOwner ? "Owner" : permission === "editor" ? "Editor" : "Viewer";

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: "8px", background: "#fff", minHeight: "500px" }}>
      <div style={{ borderBottom: "1px solid #ddd", padding: "8px 12px", background: "#f8f9fa", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
          {syncing ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Syncing...
            </>
          ) : (
            <>✅ Connected • {isEditable ? "✏️ Editing" : "👁️ Viewing"} as {user.email}</>
          )}
        </span>
        <span className={`badge ${isOwner ? 'bg-success' : permission === 'editor' ? 'bg-primary' : 'bg-secondary'}`}>
          {displayRole}
        </span>
      </div>

      {isEditable && (
        <div style={{ borderBottom: "1px solid #ddd", padding: "8px 12px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}>
            <strong>B</strong>
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}>
            <em>I</em>
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}>
            H1
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}>
            H2
          </button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}>
            • List
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
