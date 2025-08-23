import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc as fsDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { PostIt, QuadrantKey } from "../types";

/** Couleurs figées par quadrant d’ORIGINE
 *  - Premier (Acquis / Faiblesses) = plus clair
 *  - Second (Opportunités / Menaces) = plus foncé
 */
const ORIGIN_BG: Record<QuadrantKey, string> = {
  acquis:       "bg-green-100  border-green-500",
  opportunites: "bg-emerald-200 border-emerald-700",
  faiblesses:   "bg-red-100    border-red-500",
  menaces:      "bg-red-200    border-red-700",
};

// Fallback si aucun handler de réordonnancement fourni
async function bumpOrder(postItId: string, delta: number) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;
  const cur = curSnap.data() as any;
  const sessionId = cur.sessionId as string;
  const quadrant = cur.quadrant as QuadrantKey;

  const snap = await getDocs(
    query(collection(db, "postits"), where("sessionId", "==", sessionId), where("quadrant", "==", quadrant))
  );
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const from = list.findIndex((x) => x.id === postItId);
  if (from < 0) return;
  const to = Math.max(0, Math.min(list.length - 1, from + delta));
  if (to === from) return;

  const [moving] = list.splice(from, 1);
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
  const [isEditing, setIsEditing] = useState(false);
  const [author, setAuthor] = useState(data.author || "");
  const [content, setContent] = useState(data.content || "");

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

  const onDelete = async () => {
    if (!confirm("Supprimer définitivement cette étiquette ?")) return;
    try {
      await deleteDoc(fsDoc(db, "postits", data.id));
    } catch (e) {
      console.error("Delete failed", e);
      alert("Suppression impossible (réseau ? permissions ?).");
    }
  };

  const onEditOpen = () => {
    setAuthor(data.author || "");
    setContent(data.content || "");
    setIsEditing(true);
  };

  const onEditSave = async () => {
    const a = author.trim() || "Anonyme";
    const c = content.trim();
    if (!c) { alert("Le contenu ne peut pas être vide."); return; }
    try {
      await updateDoc(fsDoc(db, "postits", data.id), { author: a, content: c });
      setIsEditing(false);
    } catch (e) {
      console.error("Update failed", e);
      alert("Échec de la mise à jour.");
    }
  };

  return (
    <>
      <div
        className={`group relative rounded-lg p-3 md:p-3.5 shadow-sm border ${color} select-none`}
        title={`Origine: ${origin}`}
      >
        {/* Flèches (↑ ↓ ← →) au survol, en haut à droite */}
        <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity grid grid-cols-2 gap-1">
          <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Monter (↑)"   onClick={moveUp}>↑</button>
          <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Droite (→)"  onClick={moveRight}>→</button>
          <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Gauche (←)"  onClick={moveLeft}>←</button>
          <button className="w-7 h-7 rounded-md bg-white/90 hover:bg-gray-100 border shadow text-xs font-bold" title="Descendre (↓)" onClick={moveDown}>↓</button>
        </div>

        {/* Actions visibles : éditer / supprimer (bas droite) */}
        <div className="absolute right-1 bottom-1 flex gap-1">
          <button
            title="Éditer"
            onClick={onEditOpen}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            aria-label="Éditer"
          >
            ✎
          </button>
          <button
            title="Supprimer"
            onClick={onDelete}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            aria-label="Supprimer"
          >
            🗑
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-1">par {data.author}</div>
        <div className="text-[15px] sm:text-base md:text-lg leading-snug font-semibold tracking-[0.005em] whitespace-pre-wrap">
          {data.content}
        </div>
      </div>

      {/* Modal Éditer */}
      {!isEditing ? null : (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="font-bold">Modifier l’étiquette</h4>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 rounded hover:bg-gray-100"
                title="Fermer"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-600">Auteur</label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Auteur"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Contenu</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 h-32 resize-y outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Saisir l'idée…"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-md border hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={onEditSave}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PostItComponent;
