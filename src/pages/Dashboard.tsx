// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient"; // ✅ REAL SUPABASE
import { 
  MessageSquare, 
  Video, 
  LayoutDashboard, 
  FileText, 
  Palette,
  LogOut,
  User,
  Menu,
  X
} from "lucide-react";

interface UserData {
  email: string;
  role?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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
    <div style={{ display: "flex", height: "100vh", background: "#f5f5f5", position: "relative" }}>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 998,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: "250px",
        background: "white",
        boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        height: "100vh",
        left: sidebarOpen ? 0 : "-250px",
        top: 0,
        transition: "left 0.3s ease",
        zIndex: 999,
      }}>
        {/* Close button for mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "absolute",
            top: "20px",
            right: "15px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "5px",
            display: "none",
          }}
          className="mobile-close-btn"
        >
          <X size={24} color="#374151" />
        </button>

        <div style={{ padding: "20px", borderBottom: "1px solid #eee" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>Menu</h1>
          <p style={{ margin: "5px 0 0", fontSize: "14px", color: "#666" }}>
            {user.email}
          </p>
        </div>

        <nav style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
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
      <main style={{ 
        flex: 1, 
        overflow: "auto",
        marginLeft: 0,
        width: "100%",
      }}
      className="main-content">
        {/* Top bar with hamburger menu */}
        <div style={{
          position: "sticky",
          top: 0,
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "15px 20px",
          display: "flex",
          alignItems: "center",
          gap: "15px",
          zIndex: 100,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="hamburger-btn"
          >
            <Menu size={24} color="#374151" />
          </button>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#111827" }}>
            Dashboard
          </h2>
        </div>

        {/* Page content */}
        <div style={{ padding: "20px" }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        /* Desktop styles */
        @media (min-width: 769px) {
          aside {
            left: 0 !important;
            position: relative !important;
          }
          
          .hamburger-btn {
            display: none !important;
          }
          
          .main-content {
            margin-left: 0 !important;
          }
        }
        
        /* Mobile styles */
        @media (max-width: 768px) {
          .mobile-close-btn {
            display: block !important;
          }
          
          aside {
            position: fixed !important;
          }
        }
      `}</style>
    </div>
  );
}