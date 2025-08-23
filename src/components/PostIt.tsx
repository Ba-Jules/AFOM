import React, { useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc as fsDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { PostIt, QuadrantKey } from "../types";

/** Couleur figée par quadrant d’ORIGINE
 *  - Premier de la paire (Acquis / Faiblesses) = plus CLAIR
 *  - Second (Opportunités / Menaces) = plus FONCÉ
 */
const ORIGIN_BG: Record<QuadrantKey, string> = {
  acquis:        "bg-green-100  border-green-500",
  opportunites:  "bg-emerald-200 border-emerald-700",
  faiblesses:    "bg-red-100    border-red-500",
  menaces:       "bg-red-200    border-red-700",
};

// Fallback de déplacement d’un pas si on ne reçoit pas de handlers (compat)
async function bumpOrder(postItId: string, delta: number) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;
  const cur = curSnap.data() as any;
  const sessionId = cur.sessionId as string;
  const quadrant = cur.quadrant as QuadrantKey;

  const colRef = collection(db, "postits");
  const snap = await getDocs(
    query(colRef, where("sessionId", "==", sessionId), where("quadrant", "==", quadrant))
  );
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const idx = list.findIndex((x) => x.id === postItId);
  if (idx < 0) return;
  const to = Math.max(0, Math.min(list.length - 1, idx + delta));
  if (to === idx) return;

  const [moving] = list.splice(idx, 1);
  list.splice(to, 0, moving);

  const batch = writeBatch(db);
  list.forEach((it, i) => batch.update(fsDoc(db, "postits", it.id), { sortIndex: i }));
  await batch.commit();
}

type PostItProps = {
  data: PostIt;
  onMoveStep?: (delta: number) => void; // ← / →
  onMoveRow?: (rows: number) => void;   // ↑ / ↓
};

const PostItComponent: React.FC<PostItProps> = ({ data, onMoveStep, onMoveRow }) => {
  // Figer la couleur à la première apparition
  useEffect(() => {
    if (!data.originQuadrant) {
      updateDoc(fsDoc(db, "postits", data.id), { originQuadrant: data.quadrant }).catch(() => {});
    }
  }, [data.id, data.originQuadrant, data.quadrant]);

  const origin = (data.originQuadrant ?? data.quadrant) as QuadrantKey;
  const color  = ORIGIN_BG[origin] ?? "bg-gray-100 border-gray-300";

  const moveLeft  = () => (onMoveStep ? onMoveStep(-1) : bumpOrder(data.id, -1));
  const moveRight = () => (onMoveStep ? onMoveStep(+1) : bumpOrder(data.id, +1));
  const moveUp    = () => (onMoveRow  ? onMoveRow(-1) : bumpOrder(data.id, -2));
  const moveDown  = () => (onMoveRow  ? onMoveRow(+1) : bumpOrder(data.id, +2));

  return (
    <div
      className={`group relative rounded-lg p-3 md:p-3.5 shadow-sm border ${color} select-none`}
      title={`Origine: ${origin}`}
    >
      {/* Flèches (↑ ↓ ← →) visibles au survol */}
      <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity grid grid-cols-2 gap-1">
        <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Monter (↑)"   onClick={moveUp}>↑</button>
        <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Droite (→)"  onClick={moveRight}>→</button>
        <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Gauche (←)"  onClick={moveLeft}>←</button>
        <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Descendre (↓)" onClick={moveDown}>↓</button>
      </div>

      {/* Typo plus lisible (50+), contenu en gras */}
      <div className="text-sm text-gray-600 mb-1">par {data.author}</div>
      <div className="text-[15px] sm:text-base md:text-lg leading-snug font-semibold tracking-[0.005em]">
        {data.content}
      </div>
    </div>
  );
};

export default PostItComponent;
