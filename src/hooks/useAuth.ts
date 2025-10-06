// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import axios from "axios";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "member";
  avatar_url?: string;
}

export function useAuth() {
  const [user, setUser] = useState<string | null>(null); // store user id
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get("http://localhost:4000/profile/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setUser(res.data.id);
        setProfile(res.data);
      })
      .catch(() => {
        localStorage.removeItem("token"); // bad token → log out
        setUser(null);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, profile, loading };
}
