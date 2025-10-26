// src/pages/ShareWhiteboard.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { ArrowLeft, UserPlus, X, Eye, Edit3, Mail, Copy, Check, Crown } from "lucide-react";

export default function ShareWhiteboard() {
  const { id } = useParams();
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  const [whiteboard, setWhiteboard] = useState<any>(null);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      fetchWhiteboard();
      fetchCollaborators();
    }
  }, [id]);

  const fetchWhiteboard = async () => {
    const { data, error } = await supabase
      .from("whiteboards")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching whiteboard:", error);
      return;
    }

    // Check if user is owner
    if (data.owner_id !== user?.id) {
      alert("Only the owner can manage sharing");
      navigate(`/dashboard/whiteboard/${id}`);
      return;
    }

    setWhiteboard(data);
  };

  const fetchCollaborators = async () => {
    const { data, error } = await supabase
      .from("whiteboard_collaborators")
      .select(`
        *,
        users:user_id (
          email
        )
      `)
      .eq("whiteboard_id", id);

    if (error) {
      console.error("Error fetching collaborators:", error);
      return;
    }

    setCollaborators(data || []);
  };

  const addCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      alert("Please enter an email address");
      return;
    }

    setLoading(true);
    try {
      // Find user by email in auth.users
      const { data: userData, error: userError } = await supabase.rpc(
        'get_user_id_by_email',
        { email_input: email.toLowerCase() }
      );

      if (userError || !userData) {
        alert("User not found. Please make sure they have an account.");
        setLoading(false);
        return;
      }

      // Check if already a collaborator
      const existing = collaborators.find(c => c.user_id === userData);
      if (existing) {
        alert("This user is already a collaborator");
        setLoading(false);
        return;
      }

      // Add collaborator
      const { error: insertError } = await supabase
        .from("whiteboard_collaborators")
        .insert([
          {
            whiteboard_id: id,
            user_id: userData,
            role: role,
            invited_by: user!.id,
          },
        ]);

      if (insertError) throw insertError;

      setEmail("");
      fetchCollaborators();
      alert("Collaborator added successfully!");
    } catch (error) {
      console.error("Error adding collaborator:", error);
      alert("Failed to add collaborator");
    } finally {
      setLoading(false);
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!confirm("Remove this collaborator?")) return;

    try {
      const { error } = await supabase
        .from("whiteboard_collaborators")
        .delete()
        .eq("id", collaboratorId);

      if (error) throw error;

      fetchCollaborators();
    } catch (error) {
      console.error("Error removing collaborator:", error);
      alert("Failed to remove collaborator");
    }
  };

  const updateRole = async (collaboratorId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("whiteboard_collaborators")
        .update({ role: newRole })
        .eq("id", collaboratorId);

      if (error) throw error;

      fetchCollaborators();
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update role");
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/dashboard/whiteboard/${id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown size={16} className="text-yellow-600" />;
      case "editor":
        return <Edit3 size={16} className="text-blue-600" />;
      case "viewer":
        return <Eye size={16} className="text-gray-600" />;
      default:
        return null;
    }
  };

  if (!whiteboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/dashboard/whiteboard/${id}`)}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Share Whiteboard</h1>
            <p className="text-gray-600 mt-1">{whiteboard.title}</p>
          </div>
        </div>

        {/* Add Collaborator Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Invite Collaborators</h2>
          <form onSubmit={addCollaborator} className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus size={20} />
                  Add
                </>
              )}
            </button>
          </form>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 mb-2 font-medium">Share Link</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${window.location.origin}/dashboard/whiteboard/${id}`}
                readOnly
                className="flex-1 px-4 py-2 bg-white border border-blue-200 rounded-lg text-sm"
              />
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Anyone with this link and an account can request access
            </p>
          </div>
        </div>

        {/* Collaborators List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Collaborators ({collaborators.length})
          </h2>

          {collaborators.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No collaborators yet. Invite people to collaborate!
            </p>
          ) : (
            <div className="space-y-3">
              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {collab.users?.email?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {collab.users?.email || "Unknown User"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getRoleIcon(collab.role)}
                        <span className="text-sm text-gray-600 capitalize">
                          {collab.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {collab.role !== "owner" && (
                      <>
                        <select
                          value={collab.role}
                          onChange={(e) => updateRole(collab.id, e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => removeCollaborator(collab.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove collaborator"
                        >
                          <X size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Descriptions */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Role Permissions</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Crown size={16} className="text-yellow-600 mt-0.5" />
              <div>
                <span className="font-medium">Owner:</span>
                <span className="text-gray-600"> Full control, can manage sharing and delete whiteboard</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Edit3 size={16} className="text-blue-600 mt-0.5" />
              <div>
                <span className="font-medium">Editor:</span>
                <span className="text-gray-600"> Can view and edit the whiteboard</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Eye size={16} className="text-gray-600 mt-0.5" />
              <div>
                <span className="font-medium">Viewer:</span>
                <span className="text-gray-600"> Can only view the whiteboard (read-only)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
