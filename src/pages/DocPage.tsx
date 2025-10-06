// src/pages/DocPage.tsx
import React, { useState, useEffect } from "react";
import DocEditor from "../components/DocEditor";
import { Dropdown } from "react-bootstrap";
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

export default function DocPage() {
  const [docId, setDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // modal states
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // rename modal
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // ✅ Get user & token from localStorage

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getSession();

      const session = data.session;
      if (!session) {
        setUserId(null);
        setToken(null);
        setLoading(false);
        toast.error("You must be logged in.");
        return;
      }

      setUserId(session.user.id);
      setToken(session.access_token);
      fetchDocs(session); // pass the whole session
    };

    fetchUser();
  }, []);

  // ✅ Fetch documents

const fetchDocs = async (session: any) => {
  setLoading(true);

  try {
    const token = session.access_token;

    const res = await fetch(`http://localhost:4000/docs/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Check if response is JSON
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server did not return JSON. Response: " + text);
    }

    if (!res.ok) throw new Error(data.error || "Failed to fetch documents");

    setDocuments(data || []);
  } catch (err: any) {
    console.error("❌ Error fetching docs:", err.message);
    toast.error("Failed to fetch documents");
  } finally {
    setLoading(false);
  }
};


  // ✅ Create new document
  const createDoc = async () => {
    if (!token || !userId) {
      toast.error("You must be logged in.");
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/docs", {
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create doc");

      setDocuments((prev) => [data, ...prev]);
      setDocId(data.id);
      toast.success("Document created ✅");

      setNewTitle("");
      setNewDescription("");
      setIsPublic(true);
      setShowModal(false);
    } catch (err: any) {
      toast.error("Failed to create document");
      console.error("❌ Error creating doc:", err.message);
    }
  };

  // ✅ Rename doc
  const renameDoc = async () => {
    if (!renameId || !token) return;

    try {
      const res = await fetch(`http://localhost:4000/docs/${renameId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: renameTitle }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed");

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === renameId ? { ...doc, title: data.title } : doc
        )
      );
      setRenameId(null);
      setRenameTitle("");
      toast.success("Document renamed ✅");
    } catch (err: any) {
      toast.error("Rename failed");
      console.error("❌ Error renaming doc:", err.message);
    }
  };

  // ✅ Delete doc
  const deleteDoc = async (id: string) => {
    if (!window.confirm("Delete this document?") || !token) return;

    try {
      const res = await fetch(`http://localhost:4000/docs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete");

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      if (docId === id) setDocId(null);
      toast.success("Document deleted 🗑️");
    } catch (err: any) {
      toast.error("Failed to delete document");
      console.error("❌ Error deleting doc:", err.message);
    }
  };

  // ✅ Toggle visibility
  const toggleVisibility = async (id: string, current: boolean) => {
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:4000/docs/${id}/visibility`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public: !current }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update visibility");

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, is_public: data.is_public } : doc
        )
      );
      toast.success(data.is_public ? "Made Public 🌍" : "Made Private 🔒");
    } catch (err: any) {
      toast.error("Failed to update visibility");
      console.error("❌ Error updating visibility:", err.message);
    }
  };

  if (loading) return <p>Loading documents...</p>;
  if (!userId) return <p>You must be logged in to view documents.</p>;

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
          <p>No documents yet</p>
        ) : (
          <ul className="list-unstyled">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className={`d-flex justify-content-between align-items-center p-2 mb-1 rounded ${
                  docId === doc.id ? "bg-primary text-white" : "bg-light"
                }`}
              >
                <span
                  style={{ cursor: "pointer" }}
                  onClick={() => setDocId(doc.id)}
                >
                  {doc.title || "Untitled"}
                  <br />
                  <small className="text-muted">
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
      <div className="flex-grow-1 p-3">
        <h4>Collaborative Document</h4>
        {docId ? (
          <DocEditor docId={docId} />
        ) : (
          <p>Select or create a document to start editing.</p>
        )}
      </div>

      {/* Create Doc Modal */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">New Document</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                />
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="Enter title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <textarea
                  className="form-control mb-2"
                  placeholder="Optional description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={isPublic}
                    onChange={() => setIsPublic(!isPublic)}
                    id="publicCheck"
                  />
                  <label className="form-check-label" htmlFor="publicCheck">
                    Public document
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={createDoc}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Doc Modal */}
      {renameId && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Rename Document</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setRenameId(null)}
                />
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setRenameId(null)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={renameDoc}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
