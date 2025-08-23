import React, { useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../services/firebase";
import PostItComponent from "./PostIt";
import { PostIt, QuadrantKey } from "../types";

interface QuadrantProps {
  info: {
    title: string;
    subtitle: string;
    textColor: string;   // ex: "text-green-700"
    borderColor: string; // ex: "border-green-500"
    bgColor: string;     // non utilisé ici mais laissé pour compat
  };
  postIts: PostIt[];
  quadrantKey: QuadrantKey;
  isExpanded: boolean;        // fourni par le parent (WorkInterface)
  onToggleExpand: () => void; // idem
}

/* ---------- helpers grille & DnD ---------- */

function getColumnCount(el: HTMLElement | null): number {
  if (!el) return 2;
  const tpl = getComputedStyle(el).gridTemplateColumns || "";
  const cols = tpl.split(" ").filter(Boolean).length;
  return cols || 2;
}

function computeTargetIndex(
  container: HTMLElement,
  _clientX: number,
  clientY: number
) {
  const items = Array.from(
    container.querySelectorAll<HTMLElement>("[data-note-id]")
  );
  if (items.length === 0) return 0;

  const positions = items
    .map((el, i) => ({ i, rect: el.getBoundingClientRect() }))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  for (let k = 0; k < positions.length; k++) {
    const r = positions[k].rect;
    if (clientY < r.top + r.height / 2) return positions[k].i;
  }
  return positions.length;
}

/* ---------- Firestore ops ---------- */

async function reorderWithinSameQuadrant(postItId: string, targetIndex: number) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;

  const cur = curSnap.data() as any;
  const sessionId = cur.sessionId as string;
  const quadrant = cur.quadrant as QuadrantKey;

  const snap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", quadrant)
    )
  );
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const fromIdx = list.findIndex((x) => x.id === postItId);
  if (fromIdx < 0) return;

  const [moving] = list.splice(fromIdx, 1);
  const clamped = Math.max(0, Math.min(list.length, targetIndex));
  list.splice(clamped, 0, moving);

  const batch = writeBatch(db);
  list.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), { sortIndex: i })
  );
  await batch.commit();
}

async function moveAcrossQuadrants(
  postItId: string,
  targetQuadrant: QuadrantKey,
  targetIndex: number
) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;

  const cur = curSnap.data() as any;
  const sessionId = cur.sessionId as string;
  const sourceQuadrant = cur.quadrant as QuadrantKey;

  // source
  const srcSnap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", sourceQuadrant)
    )
  );
  const srcList = srcSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const idxSrc = srcList.findIndex((x) => x.id === postItId);
  if (idxSrc < 0) return;
  const [moving] = srcList.splice(idxSrc, 1);

  // cible
  const dstSnap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", targetQuadrant)
    )
  );
  const dstList = dstSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const clamped = Math.max(0, Math.min(dstList.length, targetIndex));
  dstList.splice(clamped, 0, { ...moving, quadrant: targetQuadrant });

  const batch = writeBatch(db);
  srcList.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), { sortIndex: i })
  );
  dstList.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), {
      sortIndex: i,
      quadrant: targetQuadrant,
    })
  );
  await batch.commit();
}

async function moveOrReorder(
  postItId: string,
  targetQuadrant: QuadrantKey,
  targetIndex: number
) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;
  const sourceQuadrant = (curSnap.data() as any)
    .quadrant as QuadrantKey;

  if (sourceQuadrant === targetQuadrant) {
    await reorderWithinSameQuadrant(postItId, targetIndex);
  } else {
    await moveAcrossQuadrants(postItId, targetQuadrant, targetIndex);
  }
}

/* ---------- helpers: création animateur ---------- */

// Essaie de retrouver le boardId (sessionId) même si le cadran est vide
function resolveBoardIdFromContext(postIts: PostIt[]): string | null {
  if (postIts.length > 0) return postIts[0].sessionId;
  const url = new URL(window.location.href);
  const s = url.searchParams.get("session") || url.searchParams.get("board");
  if (s) return s;
  return (
    localStorage.getItem("sessionId") ||
    localStorage.getItem("boardId") ||
    null
  );
}

async function createFacilitatorNote(
  quadrant: QuadrantKey,
  sessionId: string,
  author: string,
  content: string
) {
  const snap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", quadrant)
    )
  );
  const list = snap.docs
    .map((d) => d.data() as any)
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const nextIndex =
    list.length === 0
      ? 0
      : Math.max(...list.map((x) => x.sortIndex ?? 0)) + 1;

  await addDoc(collection(db, "postits"), {
    sessionId,
    quadrant,
    originQuadrant: quadrant,  // couleur figée
    sortIndex: nextIndex,
    author: author || "Animateur",
    content,
    status: "active",
    timestamp: new Date(),
  });
}

/* ---------- Composant ---------- */

const Quadrant: React.FC<QuadrantProps> = ({
  info,
  postIts,
  quadrantKey,
  isExpanded,
  onToggleExpand,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // UI ajout animateur
  const [showAdd, setShowAdd] = useState(false);
  const [author, setAuthor] = useState<string>(() => localStorage.getItem("lastAuthor") || "Animateur");
  const [content, setContent] = useState("");

  const ordered = useMemo(
    () => [...postIts].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
    [postIts]
  );

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const postItId =
      e.dataTransfer.getData("postItId") ||
      e.dataTransfer.getData("postitId") ||
      e.dataTransfer.getData("text/plain");
    if (!postItId) return;

    const idx = containerRef.current
      ? computeTargetIndex(containerRef.current, e.clientX, e.clientY)
      : Number.MAX_SAFE_INTEGER;

    try {
      await moveOrReorder(postItId, quadrantKey, idx);
    } catch (err) {
      console.error("move/reorder error:", err);
    }
  };

  const reorderByDelta = async (postItId: string, delta: number) => {
    const curSnap = await getDoc(fsDoc(db, "postits", postItId));
    if (!curSnap.exists()) return;
    const cur = curSnap.data() as any;
    const sessionId = cur.sessionId as string;
    const quadrant = cur.quadrant as QuadrantKey;

    const snap = await getDocs(
      query(
        collection(db, "postits"),
        where("sessionId", "==", sessionId),
        where("quadrant", "==", quadrant)
      )
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
    list.forEach((it, i) =>
      batch.update(fsDoc(db, "postits", it.id), { sortIndex: i })
    );
    await batch.commit();
  };

  const reorderByRows = async (postItId: string, rowDelta: number) => {
    const cols = getColumnCount(containerRef.current);
    await reorderByDelta(postItId, rowDelta * cols);
  };

  /* ----- En-tête : boutons petit carré visibles ----- */
  const Header = (
    <div
      className={`p-2 sticky top-[76px] bg-white/80 backdrop-blur-sm z-10 border-b-4 ${info.borderColor} flex items-center justify-between`}
    >
      <div className="flex items-baseline gap-3">
        <h3 className={`text-xl font-black ${info.textColor}`}>{info.title}</h3>
        <p className="text-xs text-gray-600 font-semibold">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Bouton ajouter : petit carré + */}
        <button
          onClick={() => setShowAdd(true)}
          title="Ajouter une étiquette dans ce cadran"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          aria-label="Ajouter une étiquette"
        >
          +
        </button>

        {/* Pictogramme agrandir/réduire : petit carré ⤢ / ⤡ */}
        <button
          onClick={onToggleExpand}
          title={isExpanded ? "Réduire" : "Agrandir"}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          aria-label={isExpanded ? "Réduire ce cadran" : "Agrandir ce cadran"}
        >
          {isExpanded ? "⤡" : "⤢"}
        </button>
      </div>
    </div>
  );

  /* ----- Vue standard (comme avant) ----- */
  const StandardCard = (
    <div
      data-quadrant={quadrantKey}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      className={`p-4 transition-all duration-300 ${isDragOver ? "bg-indigo-100" : ""} min-h-[40vh]`}
    >
      {Header}
      <div ref={containerRef} className="pt-4 grid gap-3 grid-cols-2">
        {ordered.map((p) => (
          <div
            key={p.id}
            data-note-id={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("postItId", p.id);
              e.dataTransfer.setData("postitId", p.id);
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <PostItComponent
              data={p}
              onMoveStep={(d) => reorderByDelta(p.id, d)} // ← / →
              onMoveRow={(r) => reorderByRows(p.id, r)}   // ↑ / ↓
            />
          </div>
        ))}
      </div>
    </div>
  );

  /* ----- Plein écran (overlay) ----- */
  const Overlay = (
    <div className="fixed inset-0 z-50 bg-white">
      <div
        className={`p-3 border-b-4 ${info.borderColor} flex items-center justify-between sticky top-0 bg-white`}
      >
        <div>
          <h3 className={`text-2xl md:text-3xl font-black ${info.textColor}`}>{info.title}</h3>
          <p className="text-sm text-gray-600 font-semibold">{info.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            title="Ajouter une étiquette dans ce cadran"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            aria-label="Ajouter une étiquette"
          >
            +
          </button>
          <button
            onClick={onToggleExpand}
            title="Réduire"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            aria-label="Réduire ce cadran"
          >
            ⤡
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="p-4 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
      >
        {ordered.map((p) => (
          <div
            key={p.id}
            data-note-id={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("postItId", p.id);
              e.dataTransfer.setData("postitId", p.id);
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <PostItComponent
              data={p}
              onMoveStep={(d) => reorderByDelta(p.id, d)}
              onMoveRow={(r) => reorderByRows(p.id, r)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  /* ----- Modal "Ajouter" (Animateur) ----- */
  const AddModal = !showAdd ? null : (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h4 className="font-bold">Nouvelle étiquette — {info.title}</h4>
          <button
            onClick={() => setShowAdd(false)}
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
              placeholder="Animateur"
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
          <button
            onClick={() => setShowAdd(false)}
            className="px-4 py-2 rounded-md border hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={async () => {
              const boardId = resolveBoardIdFromContext(postIts);
              if (!boardId) {
                alert("Session introuvable. Ouvrez l'atelier via le QR ou un lien de session.");
                return;
              }
              if (!content.trim()) {
                alert("Le contenu ne peut pas être vide.");
                return;
              }
              try {
                await createFacilitatorNote(quadrantKey, boardId, author.trim() || "Animateur", content.trim());
                localStorage.setItem("lastAuthor", author.trim() || "Animateur");
                setContent("");
                setShowAdd(false);
              } catch (e) {
                console.error("Create note failed", e);
                alert("Impossible de créer l'étiquette (réseau ? permissions ?).");
              }
            }}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isExpanded ? Overlay : StandardCard}
      {AddModal}
    </>
  );
};

export default Quadrant;
