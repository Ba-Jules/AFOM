import React, { useEffect, useState, useMemo } from "react";
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

/** Couleurs figées par quadrant d’ORIGINE */
const ORIGIN_BG: Record<QuadrantKey, string> = {
  acquis:       "bg-green-100  border-green-500",
  opportunites: "bg-emerald-200 border-emerald-700",
  faiblesses:   "bg-red-100    border-red-500",
  menaces:      "bg-red-200    border-red-700",
};

const MAX_LEN = 50;

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

  const charsLeft = useMemo(() => Math.max(0, MAX_LEN - (content?.length || 0)), [content]);

  const onEditSave = async () => {
    const a = author.trim() || "Anonyme";
    const c = (content || "").trim().slice(0, MAX_LEN);
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
        className={`group relative overflow-visible rounded-lg p-3 md:p-3.5 shadow-sm border ${color} select-none`}
        title={`Origine: ${origin}`}
      >
        {/* Mini chevrons edge */}
        <button
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 border text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-gray-100"
          title="Gauche (←)"
          onClick={moveLeft}
        >
          ‹
        </button>
        <button
          className="absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 border text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-gray-100"
          title="Droite (→)"
          onClick={moveRight}
        >
          ›
        </button>
        <button
          className="absolute left-1/2 -top-2 -translate-x-1/2 w-6 h-6 rounded-full bg-white/95 border text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-gray-100"
          title="Monter (↑)"
          onClick={moveUp}
        >
          ▲
        </button>
        <button
          className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-6 h-6 rounded-full bg-white/95 border text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-gray-100"
          title="Descendre (↓)"
          onClick={moveDown}
        >
          ▼
        </button>

        {/* Conteneur homogène (mobile) */}
        <div className="min-h-[84px] sm:min-h-[92px] md:min-h-[100px] flex flex-col">
          {/* Actions visibles : éditer / supprimer */}
          <div className="absolute right-1 bottom-1 flex gap-1 z-10">
            <button
              title="Éditer"
              onClick={onEditOpen}
              className="w-6 h-6 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-[12px]"
              aria-label="Éditer"
            >
              ✎
            </button>
            <button
              title="Supprimer"
              onClick={onDelete}
              className="w-6 h-6 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-[12px]"
              aria-label="Supprimer"
            >
              🗑
            </button>
          </div>

          {/* Contenu */}
          <div className="text-[12px] text-gray-600 mb-1">par {data.author}</div>
          <div className="text-[15px] sm:text-base md:text-lg leading-snug font-semibold tracking-[0.005em] whitespace-pre-wrap break-words">
            {data.content}
          </div>
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
                <label className="text-sm font-semibold text-gray-600">
                  Contenu <span className="text-gray-400">(max {MAX_LEN} caractères)</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
                  maxLength={MAX_LEN}
                  className="mt-1 w-full rounded-lg border px-3 py-2 h-32 resize-y outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Saisir l'idée…"
                />
                <div className={`mt-1 text-xs ${charsLeft === 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {MAX_LEN - (content?.length || 0)}/{MAX_LEN} caractères utilisés
                </div>
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
