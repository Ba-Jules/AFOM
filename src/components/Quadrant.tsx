import React, { useMemo, useRef, useState } from "react";
import {
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
    bgColor: string;     // inutilisé ici mais conservé pour compat
  };
  postIts: PostIt[];
  quadrantKey: QuadrantKey;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/* --------------------- helpers grille & DnD --------------------- */

function getColumnCount(el: HTMLElement | null): number {
  if (!el) return 2;
  const tpl = getComputedStyle(el).gridTemplateColumns || "";
  const cols = tpl.split(" ").filter(Boolean).length;
  return cols || 2;
}

function computeTargetIndex(container: HTMLElement, clientX: number, clientY: number) {
  const items = Array.from(container.querySelectorAll<HTMLElement>("[data-note-id]"));
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

/* --------------------- Firestore ops --------------------- */

async function reorderWithinSameQuadrant(postItId: string, targetIndex: number) {
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

  const fromIdx = list.findIndex((x) => x.id === postItId);
  if (fromIdx < 0) return;

  const [moving] = list.splice(fromIdx, 1);
  const clamped = Math.max(0, Math.min(list.length, targetIndex));
  list.splice(clamped, 0, moving);

  const batch = writeBatch(db);
  list.forEach((it, i) => batch.update(fsDoc(db, "postits", it.id), { sortIndex: i }));
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

  const colRef = collection(db, "postits");

  // source
  const srcSnap = await getDocs(
    query(colRef, where("sessionId", "==", sessionId), where("quadrant", "==", sourceQuadrant))
  );
  const srcList = srcSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const idxSrc = srcList.findIndex((x) => x.id === postItId);
  if (idxSrc < 0) return;
  const [moving] = srcList.splice(idxSrc, 1);

  // cible
  const dstSnap = await getDocs(
    query(colRef, where("sessionId", "==", sessionId), where("quadrant", "==", targetQuadrant))
  );
  const dstList = dstSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const clamped = Math.max(0, Math.min(dstList.length, targetIndex));
  dstList.splice(clamped, 0, { ...moving, quadrant: targetQuadrant });

  const batch = writeBatch(db);
  srcList.forEach((it, i) => batch.update(fsDoc(db, "postits", it.id), { sortIndex: i }));
  dstList.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), { sortIndex: i, quadrant: targetQuadrant })
  );
  await batch.commit();
}

async function moveOrReorder(postItId: string, targetQuadrant: QuadrantKey, targetIndex: number) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;
  const cur = curSnap.data() as any;
  const sourceQuadrant = cur.quadrant as QuadrantKey;

  if (sourceQuadrant === targetQuadrant) {
    await reorderWithinSameQuadrant(postItId, targetIndex);
  } else {
    await moveAcrossQuadrants(postItId, targetQuadrant, targetIndex);
  }
}

/* --------------------- Composant --------------------- */

const Quadrant: React.FC<QuadrantProps> = ({
  info,
  postIts,
  quadrantKey,
  isExpanded,
  onToggleExpand,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const ordered = useMemo(
    () => [...postIts].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
    [postIts]
  );

  // DnD handlers
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

    const colRef = collection(db, "postits");
    const snap = await getDocs(
      query(colRef, where("sessionId", "==", sessionId), where("quadrant", "==", quadrant))
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
  };

  const reorderByRows = async (postItId: string, rowDelta: number) => {
    const cols = getColumnCount(containerRef.current);
    await reorderByDelta(postItId, rowDelta * cols);
  };

  return (
    <div
      data-quadrant={quadrantKey}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      className={`p-4 transition-all duration-300 ${
        isDragOver ? "bg-indigo-100" : ""
      } ${isExpanded ? "bg-white rounded-xl shadow-2xl min-h-[calc(100vh-160px)]" : "min-h-[40vh]"}`}
    >
      {/* Header */}
      <div
        className={`p-2 sticky top-[76px] bg-white/80 backdrop-blur-sm z-10 border-b-4 ${info.borderColor} flex items-center justify-between`}
      >
        <div>
          <h3 className={`text-xl font-black ${info.textColor}`}>{info.title}</h3>
          <p className="text-xs text-gray-500 font-semibold">{info.subtitle}</p>
        </div>
        <button
          onClick={onToggleExpand}
          title={isExpanded ? "Réduire" : "Agrandir"}
          className="p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600"
        >
          <i className={`fas fa-lg ${isExpanded ? "fa-compress-alt" : "fa-expand-alt"}`} />
        </button>
      </div>

      {/* Grille */}
      <div
        ref={containerRef}
        className={`pt-4 grid gap-3 ${
          isExpanded
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            : "grid-cols-2"
        }`}
      >
        {ordered.map((postit) => (
          <div
            key={postit.id}
            data-note-id={postit.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("postItId", postit.id);
              e.dataTransfer.setData("postitId", postit.id);
              e.dataTransfer.setData("text/plain", postit.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <PostItComponent
              data={postit}
              onMoveStep={(d) => reorderByDelta(postit.id, d)}   // ← / →
              onMoveRow={(r) => reorderByRows(postit.id, r)}     // ↑ / ↓
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Quadrant;
