// src/components/whiteboard/ActiveUsers.tsx
import React from "react";
import { Users } from "lucide-react";

interface ActiveUser {
  userId: string;
  userName: string;
  socketId: string;
}

interface ActiveUsersProps {
  users: ActiveUser[];
  currentUserId: string;
}

export default function ActiveUsers({ users, currentUserId }: ActiveUsersProps) {
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];

  const getUserColor = (userId: string) => {
    const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200">
      <Users size={18} className="text-gray-600" />
      <span className="text-sm font-medium text-gray-700">
        {users.length} {users.length === 1 ? "user" : "users"} online
      </span>
      
      <div className="flex -space-x-2 ml-2">
        {users.slice(0, 5).map((user) => (
          <div
            key={user.socketId}
            className={`w-8 h-8 rounded-full ${getUserColor(user.userId)} flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm`}
            title={user.userId === currentUserId ? `${user.userName} (You)` : user.userName}
          >
            {getInitials(user.userName)}
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm">
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}