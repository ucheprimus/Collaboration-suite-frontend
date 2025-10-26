// src/App.tsx - MINIMAL CHANGE
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ChatPage from "./pages/ChatPage";
import Profile from "./pages/Profile";
import VideoCall from "./pages/VideoPage";
import KanbanPage from "./pages/KanbanPage";
import DocPage from "./pages/DocPage";
import WhiteboardPage from "./pages/WhiteboardPage"; // YOUR EXISTING ONE

import ProtectedRoute from "./components/ProtectedRoute";
import { SocketProvider } from "./context/SocketProvider";

export default function App() {
  return (
    <Router>
      <SocketProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <h1>Welcome to your dashboard</h1>
                  <p>Select an option from the sidebar to get started.</p>
                </div>
              }
            />
            <Route path="profile" element={<Profile />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="video" element={<VideoCall />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route path="docs" element={<DocPage />} />
            
            {/* YOUR EXISTING WHITEBOARD - NO CHANGES */}
            <Route path="whiteboard" element={<WhiteboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </SocketProvider>
    </Router>
  );
}
