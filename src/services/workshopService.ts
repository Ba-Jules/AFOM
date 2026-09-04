import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const makeSessionId = () =>
  `AFOM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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

export function participantLink(sessionId: string, workshopId?: string, groupId?: string) {
  const params = new URLSearchParams({ session: sessionId, mode: "participant" });
  if (workshopId) params.set("workshop", workshopId);
  if (groupId) params.set("group", groupId);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
