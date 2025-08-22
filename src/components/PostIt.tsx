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

/* Couleurs figées par quadrant d’ORIGINE */
const ORIGIN_BG: Record<QuadrantKey, string> = {
  acquis: "bg-green-100 border-green-400",
  faiblesses: "bg-red-100 border-red-400",
  opportunites: "bg-emerald-100 border-emerald-400",
  menaces: "bg-rose-100 border-rose-400",
};

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
  const newIdx = Math.max(0, Math.min(list.length - 1, idx + delta));
  if (newIdx === idx) return;

  const [moving] = list.splice(idx, 1);
  list.splice(newIdx, 0, moving);

  const batch = writeBatch(db);
  list.forEach((it, i) => batch.update(fsDoc(db, "postits", it.id), { sortIndex: i }));
  await batch.commit();
}

const PostItComponent: React.FC<{ data: PostIt }> = ({ data }) => {
  // 1) Initialiser originQuadrant en base si manquant (pour figer la couleur)
  useEffect(() => {
    if (!data.originQuadrant) {
      updateDoc(fsDoc(db, "postits", data.id), {
        originQuadrant: data.quadrant,
      }).catch(() => {});
    }
  }, [data.id, data.originQuadrant, data.quadrant]);

  const origin = (data.originQuadrant ?? data.quadrant) as QuadrantKey;
  const color = ORIGIN_BG[origin] ?? "bg-gray-100 border-gray-300";

  return (
    <div
      className={`group relative rounded-lg p-3 shadow-sm border ${color} select-none`}
      title={`Origine: ${origin}`}
    >
      {/* 2) Flèches visibles au survol grâce à `group` */}
      <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
        <button
          className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-sm font-bold"
          title="Monter (↑)"
          onClick={() => bumpOrder(data.id, -1)}
        >
          ↑
        </button>
        <button
          className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-sm font-bold"
          title="Descendre (↓)"
          onClick={() => bumpOrder(data.id, +1)}
        >
          ↓
        </button>
      </div>

      <div className="text-xs text-gray-500 mb-1">par {data.author}</div>
      <div className="text-sm whitespace-pre-wrap">{data.content}</div>
    </div>
  );
};

export default PostItComponent;
