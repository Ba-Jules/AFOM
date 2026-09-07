import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export const makeSessionId = () =>
  `AFOM-${new Date().getFullYear()}-${randomHex(8).toUpperCase()}`;

export async function createWorkshop(title: string) {
  return addDoc(collection(db, "workshops"), {
    title: title.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createGroup(
  workshopId: string,
  values: { number: string; name?: string; theme: string; order: number },
) {
  const sessionId = makeSessionId();
  const groupRef = await addDoc(collection(db, "workshops", workshopId, "groups"), {
    number: values.number.trim(),
    name: (values.name || values.number).trim(),
    theme: values.theme.trim(),
    sessionId,
    order: values.order,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "boards", sessionId), {
    projectName: values.number.trim(),
    themeName: values.theme.trim(),
    workshopId,
    groupId: groupRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { groupId: groupRef.id, sessionId };
}

export async function deleteGroup(workshopId: string, groupId: string, sessionId: string) {
  const postits = await getDocs(query(collection(db, "postits"), where("sessionId", "==", sessionId)));
  const batch = writeBatch(db);
  postits.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "boards", sessionId));
  batch.delete(doc(db, "workshops", workshopId, "groups", groupId));
  await batch.commit();
}

export function participantLink(sessionId: string, workshopId?: string, groupId?: string) {
  const params = new URLSearchParams({ session: sessionId, mode: "participant" });
  if (workshopId) params.set("workshop", workshopId);
  if (groupId) params.set("group", groupId);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
