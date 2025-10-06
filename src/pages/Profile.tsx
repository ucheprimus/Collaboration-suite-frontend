import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Profile() {
  const [user, setUser] = useState<{ email: string; role: string; name?: string; avatar?: string } | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;

      // Set dummy data for now
      const u = {
        email: data.session.user.email!,
        role: "member",
        name: "Your Name",
        avatar: "https://i.pravatar.cc/100",
      };
      setUser(u);
      setName(u.name);
      setAvatar(u.avatar);
    };

    fetchUser();
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      setUser((prev) => prev && { ...prev, name, avatar });
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    window.location.href = "/login"; // safer for dashboard redirect
  };

  if (!user)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <h3>Loading profile...</h3>
      </div>
    );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "40px",
        paddingBottom: "40px",
      }}
    >
      <div className="card shadow-sm p-4" style={{ width: "100%", maxWidth: "600px" }}>
        <h2 className="mb-4 text-center">Profile</h2>

        <div className="text-center mb-4">
          <img
            src={avatar}
            alt="Avatar"
            className="rounded-circle"
            width={100}
            height={100}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input className="form-control" value={user.email} disabled />
        </div>

        <div className="mb-3">
          <label className="form-label">Role</label>
          <input className="form-control" value={user.role} disabled />
        </div>

        <div className="mb-3">
          <label className="form-label">Avatar URL</label>
          <input
            className="form-control"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />
        </div>

        <button
          className="btn btn-success w-100 mb-2"
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Profile"}
        </button>

        <button className="btn btn-danger w-100" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
