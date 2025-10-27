// src/pages/DocPage.tsx - FIXED variable naming
import React, { useState, useEffect } from "react";
import DocEditor from "../components/DocEditor";
import { Dropdown, Modal, Form, Button, Badge, Spinner } from "react-bootstrap";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../lib/supabaseClient";

interface Document {
  id: string;
  title: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  owner_id: string;
}

interface Collaborator {
  id: string;
  user_id: string;
  permission: "viewer" | "editor";
  user_email?: string;
  user_name?: string;
  added_at?: string;
}

export default function DocPage() {
  const [docId, setDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);
  const [newCollabEmail, setNewCollabEmail] = useState("");
  const [newCollabPermission, setNewCollabPermission] = useState<"viewer" | "editor">("editor");

  const API_URL = import.meta.env.VITE_API_URL || "https://collaboration-suite-backend.onrender.com";

  const getToken = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("❌ Session error:", error);
        return null;
      }
      
      if (!session) {
        console.error("❌ No session found");
        return null;
      }

      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      
      if (expiresAt - now < 300000) {
        console.log("🔄 Token expiring soon, refreshing...");
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error("❌ Token refresh failed:", refreshError);
          return session.access_token;
        }
        
        console.log("✅ Token refreshed");
        return newSession.access_token;
      }

      return session.access_token;
    } catch (err) {
      console.error("❌ getToken error:", err);
      return null;
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      const session = data.session;
      
      if (!session) {
        setUserId(null);
        setLoading(false);
        toast.error("You must be logged in.");
        return;
      }

      setUserId(session.user.id);
      fetchDocs();
    };

    fetchUser();
  }, []);

  useEffect(() => {
    if (docId) {
      const doc = documents.find(d => d.id === docId);
      setCurrentDoc(doc || null);
    }
  }, [docId, documents]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      
      if (!token) {
        toast.error("Authentication required. Please log in again.");
        return;
      }

      console.log("📡 Fetching documents...");

      const response = await fetch(`${API_URL}/docs/user`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Fetched", data.length, "documents");
      setDocuments(data || []);
    } catch (err: any) {
      console.error("❌ Error fetching docs:", err);
      toast.error(`Failed to fetch documents: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createDoc = async () => {
    if (!userId) {
      toast.error("You must be logged in.");
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/docs/user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle || "Untitled Document",
          description: newDescription,
          is_public: isPublic,
          owner_id: userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create doc");
      }

      const data = await response.json();
      setDocuments((prev) => [data, ...prev]);
      setDocId(data.id);
      toast.success("Document created ✅");

      setNewTitle("");
      setNewDescription("");
      setIsPublic(true);
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create document");
      console.error("❌ Error creating doc:", err);
    }
  };

  const renameDoc = async () => {
    if (!renameId) return;

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/docs/${renameId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: renameTitle }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Rename failed");
      }

      const data = await response.json();
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === renameId ? { ...doc, title: data.title } : doc
        )
      );
      setRenameId(null);
      setRenameTitle("");
      toast.success("Document renamed ✅");
    } catch (err: any) {
      toast.error(err.message || "Rename failed");
      console.error("❌ Error renaming doc:", err);
    }
  };

  const deleteDoc = async (id: string) => {
    if (!window.confirm("Delete this document?")) return;

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/docs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      if (docId === id) setDocId(null);
      toast.success("Document deleted 🗑️");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
      console.error("❌ Error deleting doc:", err);
    }
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/docs/${id}/visibility`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public: !current }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update visibility");
      }

      const data = await response.json();
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, is_public: data.is_public } : doc
        )
      );
      toast.success(data.is_public ? "Made Public 🌍" : "Made Private 🔒");
    } catch (err: any) {
      toast.error(err.message || "Failed to update visibility");
      console.error("❌ Error updating visibility:", err);
    }
  };

  const fetchCollaborators = async () => {
    if (!docId) return;

    setLoadingCollabs(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/api/collaborators/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setCollaborators(data);
    } catch (err: any) {
      console.error("❌ Error fetching collaborators:", err);
      toast.error(err.message || "Failed to fetch collaborators");
      setCollaborators([]);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const openCollabModal = () => {
    setShowCollabModal(true);
    fetchCollaborators();
  };

  const addCollaborator = async () => {
    if (!docId || !newCollabEmail.trim()) return;

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/api/collaborators/${docId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newCollabEmail.trim(),
          permission: newCollabPermission,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add collaborator");
      }

      toast.success("Collaborator added ✅");
      setNewCollabEmail("");
      await fetchCollaborators();
    } catch (err: any) {
      console.error("❌ Error adding collaborator:", err);
      toast.error(err.message || "Failed to add collaborator");
    }
  };

  const updateCollaboratorPermission = async (collabId: string, newPermission: string) => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/api/collaborators/${docId}/${collabId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permission: newPermission }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update permission");
      }

      toast.success("Permission updated ✅");
      fetchCollaborators();
    } catch (err: any) {
      toast.error(err.message || "Failed to update permission");
      console.error("❌ Error updating permission:", err);
    }
  };

  const removeCollaborator = async (collabId: string) => {
    if (!window.confirm("Remove this collaborator?")) return;

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`${API_URL}/api/collaborators/${docId}/${collabId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove collaborator");
      }

      toast.success("Collaborator removed ✅");
      await fetchCollaborators();
    } catch (err: any) {
      console.error("❌ Error removing collaborator:", err);
      toast.error(err.message || "Failed to remove collaborator");
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <Spinner animation="border" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <p>You must be logged in to view documents.</p>
      </div>
    );
  }

  const isOwner = currentDoc?.owner_id === userId;

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <ToastContainer position="top-right" />

      {/* Sidebar */}
      <div
        style={{
          width: "280px",
          borderRight: "1px solid #ddd",
          padding: "1rem",
          background: "#f9f9f9",
          overflowY: "auto",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5>Your Docs</h5>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-sm btn-primary"
          >
            +
          </button>
        </div>

        {documents.length === 0 ? (
          <p className="text-muted">No documents yet</p>
        ) : (
          <ul className="list-unstyled">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className={`d-flex justify-content-between align-items-center p-2 mb-1 rounded ${
                  docId === doc.id ? "bg-primary text-white" : "bg-light"
                }`}
                style={{ cursor: "pointer" }}
              >
                <span
                  style={{ cursor: "pointer", flex: 1 }}
                  onClick={() => setDocId(doc.id)}
                >
                  {doc.title || "Untitled"}
                  <br />
                  <small className={docId === doc.id ? "text-white-50" : "text-muted"}>
                    {doc.is_public ? "🌍 Public" : "🔒 Private"}
                  </small>
                </span>
                <Dropdown>
                  <Dropdown.Toggle variant="light" size="sm">
                    ⋮
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item
                      onClick={() => {
                        setRenameId(doc.id);
                        setRenameTitle(doc.title);
                      }}
                    >
                      Rename
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => toggleVisibility(doc.id, doc.is_public)}
                    >
                      {doc.is_public ? "Make Private" : "Make Public"}
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="text-danger"
                      onClick={() => deleteDoc(doc.id)}
                    >
                      Delete
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Main editor */}
      <div className="flex-grow-1 d-flex flex-column">
        {docId && currentDoc && (
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-light">
            <h5 className="mb-0">{currentDoc.title}</h5>
            {isOwner && (
              <Button variant="outline-primary" size="sm" onClick={openCollabModal}>
                👥 Share
              </Button>
            )}
          </div>
        )}
        <div className="flex-grow-1 p-3 overflow-auto">
          {docId ? (
            <DocEditor key={docId} docId={docId} />
          ) : (
            <div className="text-center mt-5">
              <p className="text-muted">Select or create a document to start editing.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Doc Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>New Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control
              placeholder="Enter title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description (optional)</Form.Label>
            <Form.Control
              as="textarea"
              placeholder="Optional description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </Form.Group>
          <Form.Check
            type="checkbox"
            label="Public document"
            checked={isPublic}
            onChange={() => setIsPublic(!isPublic)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={createDoc}>
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      {/* this is wroking version  */}

      {/* Rename Doc Modal */}
      <Modal show={!!renameId} onHide={() => setRenameId(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Rename Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setRenameId(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={renameDoc}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Collaborators Modal */}
      <Modal show={showCollabModal} onHide={() => setShowCollabModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Share "{currentDoc?.title}"</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-4 p-3 bg-light rounded">
            <h6>Add Collaborator</h6>
            <div className="d-flex gap-2">
              <Form.Control
                placeholder="Enter email address"
                value={newCollabEmail}
                onChange={(e) => setNewCollabEmail(e.target.value)}
                style={{ flex: 2 }}
              />
              <Form.Select
                value={newCollabPermission}
                onChange={(e) => setNewCollabPermission(e.target.value as any)}
                style={{ flex: 1 }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </Form.Select>
              <Button onClick={addCollaborator} disabled={!newCollabEmail.trim()}>
                Add
              </Button>
            </div>
          </div>

          <h6>Current Collaborators</h6>
          {loadingCollabs ? (
            <div className="text-center p-4">
              <Spinner animation="border" size="sm" />
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-muted">No collaborators yet</p>
          ) : (
            <ul className="list-group">
              {collaborators.map((collab) => (
                <li key={collab.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{collab.user_email || "Unknown"}</strong>
                    <br />
                    <Badge bg={collab.permission === "editor" ? "primary" : "secondary"}>
                      {collab.permission}
                    </Badge>
                  </div>
                  <div className="d-flex gap-2">
                    <Form.Select
                      size="sm"
                      value={collab.permission}
                      onChange={(e) => updateCollaboratorPermission(collab.id, e.target.value)}
                      style={{ width: "120px" }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </Form.Select>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeCollaborator(collab.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCollabModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}