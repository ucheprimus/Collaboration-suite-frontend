// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { 
  MessageSquare, 
  Video, 
  LayoutDashboard, 
  FileText, 
  Palette,
  LogOut,
  User
} from "lucide-react";

interface UserData {
  email: string;
  role?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const restoreSession = async () => {
      console.log("🟡 Checking Supabase session...");

      try {
        const { data, error } = await supabase.auth.getSession();
        console.log("🔍 Supabase session result:", { data, error });

        if (error) {
          console.error("❌ Error fetching session:", error);
          return;
        }

        const session = data?.session;
        if (!session) {
          console.warn("⚠️ No session found. Redirecting to /login...");
          navigate("/login", { replace: true });
          return;
        }

        const currentUser = session.user;
        console.log("👤 Logged-in user:", currentUser);

        setUser({
          email: currentUser.email ?? "No email",
          role: (currentUser.user_metadata?.role as string) || "member",
        });
      } catch (err) {
        console.error("🔥 Unexpected error in restoreSession:", err);
      } finally {
        setLoading(false);
        console.log("✅ Finished checking session");
      }
    };

    restoreSession();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("❌ Error during logout:", err);
    }
  };

  const menuItems = [
    { icon: User, label: "Profile", path: "/dashboard/profile" },
    { icon: MessageSquare, label: "Chat", path: "/dashboard/chat" },
    { icon: Video, label: "Video Call", path: "/dashboard/video" },
    { icon: LayoutDashboard, label: "Kanban Board", path: "/dashboard/kanban" },
    { icon: FileText, label: "Collab Doc.", path: "/dashboard/docs" },
    { icon: Palette, label: "Whiteboard", path: "/dashboard/whiteboard" },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        Loading dashboard...
      </div>
    );
  }

  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f5f5f5" }}>
      {/* Sidebar */}
      <aside style={{
        width: "250px",
        background: "white",
        boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #eee" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>Menu</h1>
          <p style={{ margin: "5px 0 0", fontSize: "14px", color: "#666" }}>
            {user.email}
          </p>
        </div>

        <nav style={{ flex: 1, padding: "10px" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 15px",
                  marginBottom: "5px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: active ? "#2563eb" : "#374151",
                  background: active ? "#eff6ff" : "transparent",
                  fontWeight: active ? "600" : "normal",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "10px" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "12px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#dc2626"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#ef4444"}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}