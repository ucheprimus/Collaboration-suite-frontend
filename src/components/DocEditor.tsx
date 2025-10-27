// src/components/DocEditor.tsx - FIXED: Prevents premature socket creation
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
  const [contentLoaded, setContentLoaded] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);
  const editorRef = useRef<any>(null);
  const mountedRef = useRef(false);

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

  // Setup Y.js collaboration - FIXED with proper guards
  useEffect(() => {
    if (!user?.token || !docId) {
      console.log("⏸️ Waiting for user token and docId...");
      return;
    }

    // Prevent double mounting in React Strict Mode
    if (mountedRef.current) {
      console.log("⏸️ Already mounted, skipping...");
      return;
    }
    mountedRef.current = true;

    console.log("🚀 Setting up Y.js for:", docId);

    setReady(false);
    setError(null);
    setSyncing(true);
    setContentLoaded(false);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const awareness = new awarenessProtocol.Awareness(ydoc);
    awarenessRef.current = awareness;

    awareness.setLocalState({
      user: {
        name: user.email,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      }
    });

    // CRITICAL: Verify we have token before creating socket
    if (!user.token) {
      console.error("❌ No token available!");
      setError("Authentication token missing");
      return;
    }

    console.log("🔐 Using token:", user.token.substring(0, 20) + "...");
    console.log("📄 DocId:", docId);

    // Create socket connection with verified credentials
    const socket = io(`${SERVER_URL}/yjs`, {
      auth: { 
        token: user.token
      },
      query: { 
        docId: docId 
      },
      transports: ["websocket", "polling"],
      reconnection: false,
      timeout: 10000
    });
    
    socketRef.current = socket;
    let isConnected = false;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      isConnected = true;
      setReady(true);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Connection error:", err.message);
      console.error("   Token:", user.token ? "Present" : "Missing");
      console.error("   DocId:", docId || "Missing");
      setError(`Connection failed: ${err.message}`);
      setReady(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
      isConnected = false;
      setReady(false);
    });

    socket.on("error", (err: any) => {
      console.error("❌ Socket error:", err);
      setError(err.message || "Connection error");
    });

    socket.on("permission", ({ permission: perm }: { permission: string }) => {
      console.log("🔐 Permission received:", perm);
      setPermission(perm);
      setSyncing(false);
    });

    socket.on("sync", (data: ArrayBuffer | Uint8Array) => {
      try {
        const uint8Data = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        if (!uint8Data || uint8Data.length === 0) return;

        console.log("📥 Received sync message:", uint8Data.length, "bytes");

        const decoder = decoding.createDecoder(uint8Data);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === 0) {
          const syncType = decoding.readVarUint(decoder);
          
          console.log("  → Sync type:", syncType === 0 ? "Step1" : syncType === 1 ? "Step2" : "Update");
          
          if (syncType === syncProtocol.messageYjsSyncStep1) {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 0);
            encoding.writeVarUint(encoder, syncProtocol.messageYjsSyncStep2);
            syncProtocol.writeSyncStep2(encoder, ydoc);
            socket.emit("sync", encoding.toUint8Array(encoder));
            console.log("  📤 Sent our state");
          } else if (syncType === syncProtocol.messageYjsSyncStep2) {
            const update = decoding.readVarUint8Array(decoder);
            console.log("  → Applying full state:", update.length, "bytes");
            
            Y.applyUpdate(ydoc, update);
            
            const fragment = ydoc.getXmlFragment("default");
            console.log("  ✅ Document loaded! Fragment has", fragment.length, "nodes");
            
            setContentLoaded(true);
            
            // Force editor refresh with delay to ensure editor is ready
            setTimeout(() => {
              if (editorRef.current) {
                console.log("🔄 Forcing editor content refresh");
                editorRef.current.commands.setContent(editorRef.current.getJSON());
              }
            }, 150);
          } else if (syncType === syncProtocol.messageYjsUpdate) {
            const update = decoding.readVarUint8Array(decoder);
            Y.applyUpdate(ydoc, update);
            console.log("✅ Update applied");
          }
        } else if (messageType === 1) {
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
      }
    });

    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== socket && isConnected) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0);
        encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate);
        encoding.writeVarUint8Array(encoder, update);
        socket.emit("sync", encoding.toUint8Array(encoder));
        console.log("📤 Sent update");
      }
    };
    ydoc.on("update", updateHandler);

    const awarenessUpdateHandler = ({ added, updated, removed }: any) => {
      if (!isConnected) return;
      const changedClients = added.concat(updated).concat(removed);
      if (changedClients.length > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        );
        socket.emit("sync", encoding.toUint8Array(encoder));
      }
    };
    awareness.on("update", awarenessUpdateHandler);

    console.log("⏳ Waiting for document state from server...");

    return () => {
      console.log("🧹 Cleaning up Y.js connection for:", docId);
      mountedRef.current = false;
      
      ydoc.off("update", updateHandler);
      awareness.off("update", awarenessUpdateHandler);
      awareness.destroy();
      
      if (socket.connected) {
        socket.disconnect();
      }
      socket.removeAllListeners();
      
      ydoc.destroy();
      
      socketRef.current = null;
      awarenessRef.current = null;
      ydocRef.current = null;
    };
  }, [user?.token, docId]); // Only depend on token and docId

  const isEditable = ready && (isOwner || permission === "editor");

  // Create editor - ONLY when ready
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
    onCreate: ({ editor }) => {
      console.log("✅ Editor created");
      editorRef.current = editor;
      
      // If content already loaded, refresh
      if (contentLoaded && ydocRef.current) {
        const fragment = ydocRef.current.getXmlFragment("default");
        if (fragment.length > 0) {
          console.log("🔄 Content already loaded, refreshing editor");
          setTimeout(() => {
            editor.commands.setContent(editor.getJSON());
          }, 150);
        }
      }
    },
    onDestroy: () => {
      console.log("🗑️ Editor destroyed");
      editorRef.current = null;
    }
  }, [ready, ydocRef.current, awarenessRef.current, isEditable, user]);

  // Store editor ref
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Force refresh when both ready
  useEffect(() => {
    if (editor && contentLoaded && ydocRef.current) {
      const fragment = ydocRef.current.getXmlFragment("default");
      if (fragment.length > 0) {
        console.log("🔄 Both editor and content ready - forcing refresh");
        setTimeout(() => {
          editor.commands.setContent(editor.getJSON());
        }, 150);
      }
    }
  }, [editor, contentLoaded]);

  // Update editability
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
          <p className="text-muted">
            {!user ? "Loading user..." : !ready ? "Connecting..." : "Initializing editor..."}
          </p>
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