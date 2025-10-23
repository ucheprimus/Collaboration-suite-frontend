// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      console.log("🟡 [ProtectedRoute] Checking session...");
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("❌ [ProtectedRoute] Session error:", error.message);
      }

      if (mounted) {
        const session = data?.session;
        console.log("📦 [ProtectedRoute] Session:", session ? "✅ Found" : "❌ None");
        setIsAuth(!!session);
        setLoading(false);
      }
    };

    // Initial check
    checkSession();

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔄 [ProtectedRoute] Auth event:", _event);
      setIsAuth(!!session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}
