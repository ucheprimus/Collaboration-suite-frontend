import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Dashboard() {
  const [user, setUser] = useState<{ email: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        navigate("/login", { replace: true });
        return;
      }

      // Supabase user object
      const currentUser = data.session.user;
      setUser({
        email: currentUser.email ?? "No email",
        role: (currentUser.user_metadata?.role as string) || "member", // if you store role in metadata
      });

      setLoading(false);
    };

    restoreSession();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading) return <h3 className="text-center mt-5">Loading dashboard...</h3>;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "system-ui, Avenir, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "280px",
          backgroundColor: "#ffffff",
          color: "#212529",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #dee2e6",
        }}
      >
        <h4 style={{ marginBottom: "20px" }}>Menu</h4>
        <p className="small text-muted" style={{ marginBottom: "20px" }}>
          {user?.email}
        </p>
        <Link
          style={{ color: "#212529", marginBottom: "10px", textDecoration: "none" }}
          to="/dashboard/profile"
        >
          Profile
        </Link>
        <Link
          style={{ color: "#212529", marginBottom: "10px", textDecoration: "none" }}
          to="/dashboard/chat"
        >
          Chat
        </Link>
        <Link
          style={{ color: "#212529", marginBottom: "10px", textDecoration: "none" }}
          to="/dashboard/video"
        >
          Video Call
        </Link>
        <Link
          style={{ color: "#212529", marginBottom: "10px", textDecoration: "none" }}
          to="/dashboard/kanban"
        >
          Kanban Board
        </Link>
        <Link
          to="/dashboard/document"
          style={{ color: "#212529", marginBottom: "10px", textDecoration: "none" }}
        >
          Collab Doc.
        </Link>

        <button className="btn btn-danger mt-auto" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Main content */}
      <div
        style={{
          flexGrow: 1,
          backgroundColor: "#f8f9fa",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}
