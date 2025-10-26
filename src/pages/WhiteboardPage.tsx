import React, { useEffect, useRef, useState } from "react";
import * as Fabric from "fabric";
import { io } from "socket.io-client";
import type { Socket } from "../types/socket.types";
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Minus,
  Type,
  Eraser,
  Trash2,
  Download,
  Palette,
  Plus,
  Share2,
  X,
  ArrowLeft,
  Edit2,
  MoreVertical,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SOCKET_URL = "${import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || "http://localhost:4000"}";
const SYNC_THROTTLE = 100; // Reduced from 300 for better responsiveness

// ADD THESE LINES:
const USER_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

interface Whiteboard {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  canvas_data?: any;
}

interface ActiveUser {
  id: string;
  email: string;
  name?: string;
}

interface Collaborator {
  id: string;
  user_id: string;
  role: string;
  user_email: string;
}

export default function WhiteboardPage() {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<Fabric.Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [user, setUser] = useState<any>(null);
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [currentWhiteboard, setCurrentWhiteboard] = useState<Whiteboard | null>(
    null
  );
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(2);

  const [showCollabModal, setShowCollabModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newWhiteboardTitle, setNewWhiteboardTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newCollabEmail, setNewCollabEmail] = useState("");
  const [newCollabRole, setNewCollabRole] = useState<"editor" | "viewer">(
    "editor"
  );

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false);

  // ADD THIS FUNCTION:
  const getUserColor = (userId: string) => {
    const users = activeUsers.map((u) => u.id);
    const index = users.indexOf(userId);
    return USER_COLORS[index % USER_COLORS.length];
  };

  const lastSentRef = useRef(0);
  const pendingRef = useRef<any>(null);
  const isRemoteUpdateRef = useRef(false);
  const canvasSyncEnabledRef = useRef(false);
  const hasInitialLoadRef = useRef(false);  // ADD THIS LINE

  const API_URL = import.meta.env.VITE_API_URL || "${import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || "http://localhost:4000"}";

  // Fetch user
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchWhiteboards(session.access_token);
      }
    };
    fetchUser();
  }, []);

  // Fetch whiteboards
  const fetchWhiteboards = async (token: string) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/whiteboards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setWhiteboards(data || []);
    } catch (err) {
      console.error("Error fetching whiteboards:", err);
    }
  };

  // Create new whiteboard with modal
  const handleCreateClick = () => {
    setNewWhiteboardTitle("");
    setShowCreateModal(true);
  };

  const createWhiteboard = async () => {
    if (!newWhiteboardTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SOCKET_URL}/api/whiteboards`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newWhiteboardTitle }),
      });

      const data = await res.json();
      setWhiteboards((prev) => [data, ...prev]);
      setShowCreateModal(false);
      setNewWhiteboardTitle("");
      toast.success("Whiteboard created!");
    } catch (err) {
      console.error("Error creating whiteboard:", err);
      toast.error("Failed to create whiteboard");
    }
  };

  // Rename whiteboard
  const openRenameModal = (wb: Whiteboard) => {
    setRenameId(wb.id);
    setRenameTitle(wb.title);
    setShowRenameModal(true);
    setOpenDropdown(null);
  };

  const renameWhiteboard = async () => {
    if (!renameId || !renameTitle.trim()) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SOCKET_URL}/api/whiteboards/${renameId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: renameTitle }),
      });

      if (res.ok) {
        setWhiteboards((prev) =>
          prev.map((wb) =>
            wb.id === renameId ? { ...wb, title: renameTitle } : wb
          )
        );
        if (currentWhiteboard?.id === renameId) {
          setCurrentWhiteboard({ ...currentWhiteboard, title: renameTitle });
        }
        toast.success("Whiteboard renamed!");
        setShowRenameModal(false);
      }
    } catch (err) {
      toast.error("Failed to rename whiteboard");
    }
  };

  // Delete whiteboard
  const deleteWhiteboard = async (id: string) => {
    if (!window.confirm("Delete this whiteboard? This cannot be undone."))
      return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SOCKET_URL}/api/whiteboards/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setWhiteboards((prev) => prev.filter((wb) => wb.id !== id));
        if (currentWhiteboard?.id === id) {
          setCurrentWhiteboard(null);
        }
        toast.success("Whiteboard deleted");
      }
    } catch (err) {
      toast.error("Failed to delete whiteboard");
    }
    setOpenDropdown(null);
  };

  // Socket.IO connection
  useEffect(() => {
    if (!currentWhiteboard || !user) return;

    const connectSocket = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      socketRef.current = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: { token },
      });

      socketRef.current.on("connect", () => {
        console.log("✅ Socket connected");
        setIsLoadingCanvas(true);
        canvasSyncEnabledRef.current = false;

        socketRef.current?.emit("whiteboard:join", {
          whiteboardId: currentWhiteboard.id,
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
          },
        });
      });

socketRef.current.on("whiteboard:load", (json: any) => {
  if (!fabricRef.current) return;

  console.log("📥 Loading whiteboard from server");

  isRemoteUpdateRef.current = true;
  fabricRef.current.clear();

  if (json && json.objects && json.objects.length > 0) {
    fabricRef.current.loadFromJSON(json, () => {
      fabricRef.current?.renderAll();

      requestAnimationFrame(() => {
        fabricRef.current?.renderAll();
        isRemoteUpdateRef.current = false;
        canvasSyncEnabledRef.current = true;
        hasInitialLoadRef.current = true;  // ADD THIS LINE
        setIsLoadingCanvas(false);
      });
    });
  } else {
    fabricRef.current.renderAll();
    isRemoteUpdateRef.current = false;
    canvasSyncEnabledRef.current = true;
    hasInitialLoadRef.current = true;  // ADD THIS LINE
    setIsLoadingCanvas(false);
  }
});

      socketRef.current.on("whiteboard:update", (data: any) => {
        if (!fabricRef.current || !hasInitialLoadRef.current) return;

        // Support both old format (json only) and new format (data object)
        const json = data.json || data;
        const userId = data.userId;
        const userName = data.userName;

        console.log(
          "📨 Received update:",
          json?.objects?.length || 0,
          "objects"
        );

        isRemoteUpdateRef.current = true;

        fabricRef.current.loadFromJSON(json, () => {
          // Add visual indicators for remote changes
          if (userId && userId !== user.id) {
            fabricRef.current?.getObjects().forEach((obj: any) => {
              if (obj.modifiedBy === userId) {
                obj.set({
                  borderColor: getUserColor(userId),
                  borderScaleFactor: 2,
                });
              }
            });
          }

          fabricRef.current?.renderAll();

          requestAnimationFrame(() => {
            fabricRef.current?.renderAll();
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 50);
          });
        });

        // Show toast notification for remote changes
        if (userId && userId !== user.id && userName) {
          toast.info(`${userName} made changes`, {
            autoClose: 2000,
            position: "bottom-right",
          });
        }
      });
      socketRef.current.on("whiteboard:users", (users: ActiveUser[]) => {
        setActiveUsers(users);
      });

      socketRef.current.on("whiteboard:user-joined", (user: ActiveUser) => {
        toast.info(`${user.name || user.email} joined`);
      });

      socketRef.current.on("whiteboard:user-left", (user: ActiveUser) => {
        toast.info(`${user.name || user.email} left`);
      });

      socketRef.current.on("whiteboard:error", (error: any) => {
        toast.error(error.message);
      });
    };

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsLoadingCanvas(false);
      canvasSyncEnabledRef.current = false;
      isRemoteUpdateRef.current = false;
        hasInitialLoadRef.current = false;  // ADD THIS LINE

    };
  }, [currentWhiteboard, user]);

  // Initialize Fabric canvas
  useEffect(() => {
    if (
      !canvasElRef.current ||
      !canvasContainerRef.current ||
      !currentWhiteboard
    )
      return;

    const canvas = new Fabric.Canvas(canvasElRef.current, {
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true, // ADD THIS LINE
    });

    fabricRef.current = canvas;

    const resizeCanvas = () => {
      if (!fabricRef.current || !canvasContainerRef.current) return;
      const container = canvasContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        fabricRef.current.setDimensions({ width, height });
        fabricRef.current.renderAll();
      }
    };

    const initialResize = setTimeout(resizeCanvas, 100);
    window.addEventListener("resize", resizeCanvas);

    const requestSync = () => {
      // Don't sync if applying remote update
      if (isRemoteUpdateRef.current) {
        console.log("⏸️ Skipping sync - remote update");
        return;
      }

      // Don't sync until canvas is ready
      if (!canvasSyncEnabledRef.current) {
        console.log("⏸️ Skipping sync - canvas not ready");
        return;
      }

      const now = Date.now();

      const send = () => {
        if (!fabricRef.current || !socketRef.current) return;
        const json = fabricRef.current.toJSON([
          "selectable",
          "createdBy",
          "createdByName",
          "modifiedBy",
          "modifiedByName",
          "modifiedAt",
        ]); // Include custom properties
        console.log(
          "📤 Sending update with",
          json.objects?.length || 0,
          "objects"
        );

        // CHANGE THIS LINE to send user info:
        socketRef.current.emit("whiteboard:update", {
          json,
          userId: user.id,
          userName: user.user_metadata?.name || user.email,
        });

        lastSentRef.current = Date.now();
        pendingRef.current = null;
      };

      if (now - lastSentRef.current > SYNC_THROTTLE) {
        send();
      } else {
        if (pendingRef.current) clearTimeout(pendingRef.current);
        pendingRef.current = setTimeout(send, SYNC_THROTTLE);
      }
    };
    const onChange = () => {
      fabricRef.current?.renderAll(); // ADD THIS LINE
      requestSync();
    };
    canvas.on("object:added", onChange);
    canvas.on("object:modified", onChange);
    canvas.on("object:removed", onChange);
    canvas.on("path:created", onChange);

    // ADD THIS TO TRACK MODIFICATIONS:
    canvas.on("object:modified", (e: any) => {
      if (e.target) {
        e.target.set({
          modifiedBy: user.id,
          modifiedByName: user.user_metadata?.name || user.email,
          modifiedAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      clearTimeout(initialResize);
      canvas.dispose();
      window.removeEventListener("resize", resizeCanvas);
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [currentWhiteboard]);

  // Tool handlers
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");

    const active = canvas.getActiveObject();
    if (active) canvas.discardActiveObject();

    let drawingShape: any = null;
    let startX = 0;
    let startY = 0;

    if (tool === "pencil") {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new Fabric.PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = width;
      canvas.selection = false;

      // ADD THIS EVENT LISTENER:
      canvas.on("path:created", (e: any) => {
        if (e.path) {
          e.path.set({
            createdBy: user.id,
            createdByName: user.user_metadata?.name || user.email,
            modifiedBy: user.id,
            modifiedByName: user.user_metadata?.name || user.email,
          });
        }
      });
      return;
    }

    if (tool === "select") {
      canvas.selection = true;
      return;
    }

    const onMouseDown = (opt: any) => {
      const pointer = canvas.getPointer(opt.e);
      startX = pointer.x;
      startY = pointer.y;

      if (tool === "rectangle") {
        drawingShape = new Fabric.Rect({
          left: startX,
          top: startY,
          originX: "left",
          originY: "top",
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: width,
          selectable: true,

          createdBy: user.id,
          createdByName: user.user_metadata?.name || user.email,
          modifiedBy: user.id,
          modifiedByName: user.user_metadata?.name || user.email,
        });
        canvas.add(drawingShape);
      } else if (tool === "circle") {
        drawingShape = new Fabric.Ellipse({
          left: startX,
          top: startY,
          originX: "left",
          originY: "top",
          rx: 0,
          ry: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: width,
          selectable: true,

          createdBy: user.id,
          createdByName: user.user_metadata?.name || user.email,
          modifiedBy: user.id,
          modifiedByName: user.user_metadata?.name || user.email,
        });
        canvas.add(drawingShape);
      } else if (tool === "line") {
        drawingShape = new Fabric.Line([startX, startY, startX, startY], {
          stroke: color,
          strokeWidth: width,
          selectable: true,

          createdBy: user.id,
          createdByName: user.user_metadata?.name || user.email,
          modifiedBy: user.id,
          modifiedByName: user.user_metadata?.name || user.email,
        });
        canvas.add(drawingShape);
      } else if (tool === "text") {
        const text = new Fabric.IText("Type here...", {
          left: startX,
          top: startY,
          fill: color,
          fontSize: 24,
          fontFamily: "Arial",
          selectable: true,

          // ADD THESE LINES:
          createdBy: user.id,
          createdByName: user.user_metadata?.name || user.email,
          modifiedBy: user.id,
          modifiedByName: user.user_metadata?.name || user.email,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        return;
      } else if (tool === "erase") {
        const target = canvas.findTarget(opt.e);
        if (target) canvas.remove(target);
      }
    };

    const onMouseMove = (opt: any) => {
      if (!drawingShape) return;
      const pointer = canvas.getPointer(opt.e);
      const w = pointer.x - startX;
      const h = pointer.y - startY;

      if (drawingShape.type === "rect") {
        drawingShape.set({ width: Math.abs(w), height: Math.abs(h) });
        if (w < 0) drawingShape.set({ left: pointer.x });
        if (h < 0) drawingShape.set({ top: pointer.y });
      } else if (drawingShape.type === "ellipse") {
        drawingShape.set({ rx: Math.abs(w) / 2, ry: Math.abs(h) / 2 });
        drawingShape.set({
          left: startX + (w < 0 ? w : 0),
          top: startY + (h < 0 ? h : 0),
        });
      } else if (drawingShape.type === "line") {
        drawingShape.set({ x2: pointer.x, y2: pointer.y });
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      drawingShape = null;
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);
  }, [tool, color, width]);

  const clearCanvas = () => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = "#ffffff";
    socketRef.current?.emit("whiteboard:update", fabricRef.current.toJSON());
    toast.success("Canvas cleared");
  };

  const exportPng = () => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({
      format: "png",
      multiplier: 2,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${currentWhiteboard?.title || "whiteboard"}.png`;
    a.click();
    toast.success("Exported!");
  };

  // Collaborators
  const fetchCollaborators = async () => {
    if (!currentWhiteboard) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${SOCKET_URL}/api/whiteboards/${currentWhiteboard.id}/collaborators`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setCollaborators(data || []);
    } catch (err) {
      console.error("Error fetching collaborators:", err);
    }
  };

  const addCollaborator = async () => {
    if (!currentWhiteboard || !newCollabEmail.trim()) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${SOCKET_URL}/api/whiteboards/${currentWhiteboard.id}/collaborators`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: newCollabEmail.trim(),
            role: newCollabRole,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Collaborator added!");
      setNewCollabEmail("");
      fetchCollaborators();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removeCollaborator = async (collabId: string) => {
    if (!currentWhiteboard || !window.confirm("Remove collaborator?")) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      await fetch(
        `${SOCKET_URL}/api/whiteboards/${currentWhiteboard.id}/collaborators/${collabId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Collaborator removed");
      fetchCollaborators();
    } catch (err) {
      toast.error("Failed to remove collaborator");
    }
  };

  const openCollabModal = () => {
    setShowCollabModal(true);
    fetchCollaborators();
  };

  const ToolButton = ({ icon: Icon, name, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg transition-all duration-200 hover:scale-105 ${
        active
          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50"
          : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-blue-300"
      }`}
      title={name}
    >
      <Icon size={20} />
    </button>
  );

  // Whiteboard selection view
  if (!currentWhiteboard) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "40px 20px",
        }}
      >
        <ToastContainer />
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "30px",
            }}
          >
            <h1
              style={{ fontSize: "32px", fontWeight: "bold", color: "white" }}
            >
              My Whiteboards
            </h1>
            <button
              onClick={handleCreateClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                background: "white",
                color: "#667eea",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              }}
            >
              <Plus size={20} />
              New Whiteboard
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {whiteboards.map((wb) => (
              <div
                key={wb.id}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.2s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 12px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                }}
              >
                <div
                  style={{ position: "absolute", top: "16px", right: "16px" }}
                >
                  {wb.owner_id === user?.id && (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdown(
                            openDropdown === wb.id ? null : wb.id
                          );
                        }}
                        style={{
                          padding: "8px",
                          background: "#f3f4f6",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openDropdown === wb.id && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "100%",
                            marginTop: "4px",
                            background: "white",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            padding: "4px",
                            zIndex: 10,
                            minWidth: "120px",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameModal(wb);
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              background: "transparent",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <Edit2 size={14} />
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteWhiteboard(wb.id);
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              background: "transparent",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              borderRadius: "4px",
                              color: "#ef4444",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div
                  onClick={() => setCurrentWhiteboard(wb)}
                  style={{ cursor: "pointer" }}
                >
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    {wb.title}
                  </h3>
                  <p style={{ fontSize: "14px", color: "#6b7280" }}>
                    Updated {new Date(wb.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "400px",
                width: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                Create New Whiteboard
              </h2>
              <input
                type="text"
                placeholder="Whiteboard title"
                value={newWhiteboardTitle}
                onChange={(e) => setNewWhiteboardTitle(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && createWhiteboard()}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
                autoFocus
              />
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "10px 20px",
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createWhiteboard}
                  style={{
                    padding: "10px 20px",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Modal */}
        {showRenameModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowRenameModal(false)}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                maxWidth: "400px",
                width: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                Rename Whiteboard
              </h2>
              <input
                type="text"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && renameWhiteboard()}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
                autoFocus
              />
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowRenameModal(false)}
                  style={{
                    padding: "10px 20px",
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={renameWhiteboard}
                  style={{
                    padding: "10px 20px",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Whiteboard editor view
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <ToastContainer />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setCurrentWhiteboard(null)}
            style={{
              padding: "8px",
              background: "#f3f4f6",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div
            style={{
              padding: "8px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Palette className="text-white" size={24} />
          </div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#1f2937",
              margin: 0,
            }}
          >
            {currentWhiteboard.title}
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "#f9fafb",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
            }}
          >
            <label
              style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}
            >
              Color
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: "40px",
                height: "32px",
                borderRadius: "6px",
                cursor: "pointer",
                border: "2px solid #e5e7eb",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "#f9fafb",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
            }}
          >
            <label
              style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}
            >
              Size
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: "100px" }}
            />
            <span
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#6b7280",
                minWidth: "24px",
                textAlign: "center",
              }}
            >
              {width}
            </span>
          </div>

          <div
            style={{ height: "32px", width: "1px", background: "#d1d5db" }}
          ></div>

          <div style={{ display: "flex", gap: "8px" }}>
            <ToolButton
              icon={MousePointer2}
              name="Select"
              active={tool === "select"}
              onClick={() => setTool("select")}
            />
            <ToolButton
              icon={Pencil}
              name="Pen"
              active={tool === "pencil"}
              onClick={() => setTool("pencil")}
            />
            <ToolButton
              icon={Square}
              name="Rectangle"
              active={tool === "rectangle"}
              onClick={() => setTool("rectangle")}
            />
            <ToolButton
              icon={Circle}
              name="Circle"
              active={tool === "circle"}
              onClick={() => setTool("circle")}
            />
            <ToolButton
              icon={Minus}
              name="Line"
              active={tool === "line"}
              onClick={() => setTool("line")}
            />
            <ToolButton
              icon={Type}
              name="Text"
              active={tool === "text"}
              onClick={() => setTool("text")}
            />
            <ToolButton
              icon={Eraser}
              name="Eraser"
              active={tool === "erase"}
              onClick={() => setTool("erase")}
            />
          </div>

          <div
            style={{ height: "32px", width: "1px", background: "#d1d5db" }}
          ></div>

          <button
            onClick={openCollabModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <Share2 size={18} />
            Share ({activeUsers.length})
          </button>



          {/* ADD THIS COLOR LEGEND */}
          {activeUsers.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "white",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#6b7280",
                }}
              >
                Active:
              </span>
              {activeUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  title={u.name || u.email}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: getUserColor(u.id),
                      border: u.id === user.id ? "2px solid #000" : "none",
                    }}
                  ></div>
                  <span style={{ fontSize: "12px", color: "#374151" }}>
                    {u.id === user.id ? "You" : u.name || u.email.split("@")[0]}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={clearCanvas}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <Trash2 size={18} />
            Clear
          </button>

          <button
            onClick={exportPng}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "20px",
          display: "flex",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {isLoadingCanvas && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "4px solid #e5e7eb",
                    borderTop: "4px solid #3b82f6",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 12px",
                  }}
                ></div>
                <p style={{ color: "#6b7280" }}>Loading whiteboard...</p>
              </div>
            </div>
          )}
          <div
            ref={canvasContainerRef}
            style={{ width: "100%", height: "100%", position: "relative" }}
          >
            <canvas ref={canvasElRef} id="fabric-canvas" />
          </div>
        </div>
      </div>

      {/* Collaborator Modal */}
      {showCollabModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCollabModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ fontSize: "20px", fontWeight: "600" }}>
                Share Whiteboard
              </h2>
              <button
                onClick={() => setShowCollabModal(false)}
                style={{
                  padding: "8px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Active Users ({activeUsers.length})
              </h3>
              {activeUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: "8px 12px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{u.name || u.email}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                background: "#f9fafb",
                borderRadius: "12px",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Add Collaborator
              </h3>
              <input
                type="email"
                placeholder="Email address"
                value={newCollabEmail}
                onChange={(e) => setNewCollabEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  marginBottom: "8px",
                }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={newCollabRole}
                  onChange={(e) => setNewCollabRole(e.target.value as any)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                  }}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={addCollaborator}
                  disabled={!newCollabEmail.trim()}
                  style={{
                    padding: "10px 20px",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Collaborators
              </h3>
              {collaborators.length === 0 ? (
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  No collaborators yet
                </p>
              ) : (
                collaborators.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                      background: "#f9fafb",
                      borderRadius: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "500" }}>
                        {c.user_email}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {c.role}
                      </div>
                    </div>
                    <button
                      onClick={() => removeCollaborator(c.id)}
                      style={{
                        padding: "6px 12px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
