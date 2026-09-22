import React from "react";
import { logout } from "../services/authService";
import { AppUser } from "../types";
import { PreferenceControls, usePreferences } from "../i18n";

const UserBadge: React.FC<{ user: AppUser; className?: string }> = ({ user, className }) => {
  const { t } = usePreferences();
  return (
    <div className={`flex items-center gap-2 text-sm ${className || ""}`}>
      <PreferenceControls />
      <span className="opacity-90">{user.displayName}</span>
      <button onClick={() => logout()} className="underline opacity-75 hover:opacity-100">
        {t("userBadge.logout")}
      </button>
    </div>
  );
};

export default UserBadge;
