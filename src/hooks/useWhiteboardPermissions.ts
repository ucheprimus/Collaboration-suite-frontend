// src/hooks/useWhiteboardPermissions.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export function useWhiteboardPermissions(whiteboardId: string | undefined) {
  const [permission, setPermission] = useState<{
    role: "owner" | "editor" | "viewer" | null;
    canEdit: boolean;
    canShare: boolean;
    loading: boolean;
  }>({
    role: null,
    canEdit: false,
    canShare: false,
    loading: true,
  });

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (!whiteboardId || !user) {
      setPermission({
        role: null,
        canEdit: false,
        canShare: false,
        loading: false,
      });
      return;
    }

    fetchPermission();
  }, [whiteboardId, user]);

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    } else {
      setPermission({
        role: null,
        canEdit: false,
        canShare: false,
        loading: false,
      });
    }
  };

  const fetchPermission = async () => {
    try {
      // Check if user is owner
      const { data: whiteboardData, error: wbError } = await supabase
        .from("whiteboards")
        .select("owner_id")
        .eq("id", whiteboardId)
        .single();

      if (wbError) throw wbError;

      if (whiteboardData.owner_id === user.id) {
        setPermission({
          role: "owner",
          canEdit: true,
          canShare: true,
          loading: false,
        });
        return;
      }

      // Check collaborator role
      const { data: collabData, error: collabError } = await supabase
        .from("whiteboard_collaborators")
        .select("role")
        .eq("whiteboard_id", whiteboardId)
        .eq("user_id", user.id)
        .single();

      if (collabError) {
        setPermission({
          role: null,
          canEdit: false,
          canShare: false,
          loading: false,
        });
        return;
      }

      const role = collabData.role as "editor" | "viewer";
      setPermission({
        role,
        canEdit: role === "editor",
        canShare: false,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPermission({
        role: null,
        canEdit: false,
        canShare: false,
        loading: false,
      });
    }
  };

  return permission;
}