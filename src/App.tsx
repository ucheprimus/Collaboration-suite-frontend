import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ChatPage from "./pages/ChatPage";
import Profile from "./pages/Profile";
import VideoCall from "./pages/VideoCall";
import KanbanPage from "./pages/KanbanPage";
import DocPage from "./pages/DocPage";

import ProtectedRoute from "./components/ProtectedRoute"; // ✅ use the component version

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <div style={{ padding: "30px" }}>
                <h2>Welcome to your dashboard</h2>
                <p>Select an option from the sidebar to get started.</p>
              </div>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="video" element={<VideoCall />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="document" element={<DocPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toastify */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </Router>
  );
}
