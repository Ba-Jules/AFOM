import { addDoc, collection, deleteDoc, deleteField, doc, DocumentReference, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export const TRASH_RETENTION_DAYS = 30;

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

// Envoie le groupe à la corbeille : rien n'est effacé, il devient juste invisible
// des vues actives. Récupérable via restoreGroup() jusqu'à sa purge (voir purgeExpiredGroups).
export async function trashGroup(workshopId: string, groupId: string) {
  await updateDoc(doc(db, "workshops", workshopId, "groups", groupId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreGroup(workshopId: string, groupId: string) {
  await updateDoc(doc(db, "workshops", workshopId, "groups", groupId), {
    deletedAt: deleteField(),
    active: true,
    updatedAt: serverTimestamp(),
  });
}

// Suppression définitive et irréversible (postits + board + groupe). N'est appelée
// que depuis la corbeille (action manuelle) ou par la purge automatique après le
// délai de rétention.
export async function deleteGroup(workshopId: string, groupId: string, sessionId: string) {
  const postits = await getDocs(query(collection(db, "postits"), where("sessionId", "==", sessionId)));
  const batch = writeBatch(db);
  postits.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "boards", sessionId));
  batch.delete(doc(db, "workshops", workshopId, "groups", groupId));
  await batch.commit();
}

// ---- Corbeille au niveau atelier (même logique que pour les groupes) ----

export async function trashWorkshop(workshopId: string) {
  await updateDoc(doc(db, "workshops", workshopId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function restoreWorkshop(workshopId: string) {
  await updateDoc(doc(db, "workshops", workshopId), {
    deletedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

async function deleteRefsInChunks(refs: DocumentReference[]) {
  const CHUNK = 400; // marge sous la limite de 500 opérations par batch Firestore
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// Suppression définitive et irréversible d'un atelier entier : tous ses groupes,
// boards et postits. N'est appelée que depuis la corbeille des ateliers (action
// manuelle) ou par la purge automatique après le délai de rétention.
export async function deleteWorkshopCascade(workshopId: string) {
  const groupsSnap = await getDocs(collection(db, "workshops", workshopId, "groups"));
  const refsToDelete: DocumentReference[] = [];
  for (const groupDoc of groupsSnap.docs) {
    const sessionId = (groupDoc.data() as any).sessionId as string | undefined;
    if (sessionId) {
      const postits = await getDocs(query(collection(db, "postits"), where("sessionId", "==", sessionId)));
      postits.docs.forEach((d) => refsToDelete.push(d.ref));
      refsToDelete.push(doc(db, "boards", sessionId));
    }
    refsToDelete.push(groupDoc.ref);
  }
  refsToDelete.push(doc(db, "workshops", workshopId));
  await deleteRefsInChunks(refsToDelete);
}

export function participantLink(sessionId: string, workshopId?: string, groupId?: string) {
  const params = new URLSearchParams({ session: sessionId, mode: "participant" });
  if (workshopId) params.set("workshop", workshopId);
  if (groupId) params.set("group", groupId);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
