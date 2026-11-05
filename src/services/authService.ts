import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  User,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
  return firebaseSignOut(auth);
}

export function watchAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function changePassword(newPassword: string) {
  if (!auth.currentUser) throw new Error("Aucun utilisateur connecté.");
  await updatePassword(auth.currentUser, newPassword);
  await updateDoc(doc(db, "users", auth.currentUser.uid), { mustChangePassword: false });
}
