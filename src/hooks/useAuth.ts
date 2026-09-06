import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { AppUser, UserRole } from "../types";
import { watchAuthState } from "../services/authService";

export function useAuth() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopProfile: (() => void) | null = null;

    const unsubAuth = watchAuthState((user) => {
      if (stopProfile) {
        stopProfile();
        stopProfile = null;
      }
      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }
      stopProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (!snap.exists()) {
            setAppUser(null);
            setLoading(false);
            return;
          }
          const data = snap.data() as { email?: string; displayName?: string; role?: UserRole; mustChangePassword?: boolean };
          setAppUser({
            uid: user.uid,
            email: data.email || user.email || "",
            displayName: data.displayName || user.email || "",
            role: data.role || "moderator",
            mustChangePassword: !!data.mustChangePassword,
          });
          setLoading(false);
        },
        (e) => {
          console.error("Unable to load user profile", e);
          setAppUser(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (stopProfile) stopProfile();
    };
  }, []);

  return { appUser, loading, isAuthenticated: !!appUser };
}
