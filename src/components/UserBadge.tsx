import React from "react";
import { logout } from "../services/authService";
import { AppUser } from "../types";

const UserBadge: React.FC<{ user: AppUser; className?: string }> = ({ user, className }) => (
  <div className={`flex items-center gap-2 text-sm ${className || ""}`}>
    <span className="opacity-90">{user.displayName}</span>
    <button onClick={() => logout()} className="underline opacity-75 hover:opacity-100">
      Se déconnecter
    </button>
  </div>
);

export default UserBadge;
