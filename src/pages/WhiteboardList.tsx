// src/pages/WhiteboardList.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Plus, Trash2, Share2, Eye, Edit3, Clock, Users } from "lucide-react";

export default function WhiteboardList() {
  const navigate = useNavigate();
  const [whiteboards, setWhiteboards] = useState<any[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchWhiteboards();
    }
  }, [user]);

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
  };

  const fetchWhiteboards = async () => {
    try {
      setLoading(true);

      // Fetch whiteboards owned by user
      const { data: ownedData, error: ownedError } = await supabase
        .from("whiteboards")
        .select(`
          *,
          whiteboard_collaborators(
            id,
            user_id,
            role
          )
        `)
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });

      if (ownedError) throw ownedError;

      // Fetch whiteboards shared with user
      const { data: sharedData, error: sharedError } = await supabase
        .from("whiteboard_collaborators")
        .select(`
          id,
          role,
          whiteboards(
            id,
            title,
            owner_id,
            updated_at,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .neq("role", "owner");

      if (sharedError) throw sharedError;

      setWhiteboards(ownedData || []);
      setSharedWithMe(sharedData || []);
    } catch (error) {
      console.error("Error fetching whiteboards:", error);
    } finally {
      setLoading(false);
    }
  };

  const createWhiteboard = async () => {
    try {
      const { data, error } = await supabase
        .from("whiteboards")
        .insert([
          {
            title: `Whiteboard ${new Date().toLocaleDateString()}`,
            owner_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      navigate(`/dashboard/whiteboard/${data.id}`);
    } catch (error) {
      console.error("Error creating whiteboard:", error);
      alert("Failed to create whiteboard");
    }
  };

  const deleteWhiteboard = async (id: string) => {
    if (!confirm("Are you sure you want to delete this whiteboard?")) return;

    try {
      const { error } = await supabase
        .from("whiteboards")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setWhiteboards(whiteboards.filter((wb) => wb.id !== id));
    } catch (error) {
      console.error("Error deleting whiteboard:", error);
      alert("Failed to delete whiteboard");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const WhiteboardCard = ({ whiteboard, isShared = false, role = "owner" }: any) => {
    const wb = isShared ? whiteboard.whiteboards : whiteboard;
    const collaboratorCount = isShared ? 0 : (whiteboard.whiteboard_collaborators?.length || 1);

    return (
      <div
        onClick={() => navigate(`/dashboard/whiteboard/${wb.id}`)}
        className="group relative bg-white rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-500"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
              {wb.title}
            </h3>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock size={14} />
                {formatDate(wb.updated_at)}
              </div>
              <div className="flex items-center gap-1">
                <Users size={14} />
                {collaboratorCount}
              </div>
            </div>
          </div>

          {role === "owner" ? (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/dashboard/whiteboard/${wb.id}/share`);
                }}
                className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                title="Share"
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteWhiteboard(wb.id);
                }}
                className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
              {role === "editor" ? (
                <>
                  <Edit3 size={14} />
                  Editor
                </>
              ) : (
                <>
                  <Eye size={14} />
                  Viewer
                </>
              )}
            </div>
          )}
        </div>

        <div className="h-32 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
          <div className="text-4xl opacity-20">🎨</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading whiteboards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Whiteboards</h1>
            <p className="text-gray-600 mt-1">Create and manage your collaborative whiteboards</p>
          </div>
          <button
            onClick={createWhiteboard}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            <Plus size={20} />
            New Whiteboard
          </button>
        </div>

        {whiteboards.length === 0 && sharedWithMe.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">No whiteboards yet</h2>
            <p className="text-gray-500 mb-6">Create your first collaborative whiteboard to get started</p>
            <button
              onClick={createWhiteboard}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Whiteboard
            </button>
          </div>
        ) : (
          <>
            {whiteboards.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">My Whiteboards</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {whiteboards.map((wb) => (
                    <WhiteboardCard key={wb.id} whiteboard={wb} />
                  ))}
                </div>
              </div>
            )}

            {sharedWithMe.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Shared With Me</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sharedWithMe.map((item) => (
                    <WhiteboardCard
                      key={item.id}
                      whiteboard={item}
                      isShared={true}
                      role={item.role}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}