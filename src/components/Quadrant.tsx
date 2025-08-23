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
  clientX: number,
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

  /* ----- Rendu standard (comme avant) ----- */
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
      className={`p-4 transition-all duration-300 ${
        isDragOver ? "bg-indigo-100" : ""
      } min-h-[40vh]`}
    >
      <div
        className={`p-2 sticky top-[76px] bg-white/80 backdrop-blur-sm z-10 border-b-4 ${info.borderColor} flex items-center justify-between`}
      >
        <div>
          <h3 className={`text-xl font-black ${info.textColor}`}>{info.title}</h3>
          <p className="text-xs text-gray-600 font-semibold">{info.subtitle}</p>
        </div>
        {/* Pictogramme agrandir (par quadrant) */}
        <button
          onClick={onToggleExpand}
          title="Agrandir"
          className="p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600"
        >
          <i className="fas fa-lg fa-expand-alt" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="pt-4 grid gap-3 grid-cols-2"
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
              onMoveStep={(d) => reorderByDelta(p.id, d)} // ← / →
              onMoveRow={(r) => reorderByRows(p.id, r)}   // ↑ / ↓
            />
          </div>
        ))}
      </div>
    </div>
  );

  /* ----- Rendu plein écran (overlay), ce quadrant seul est visible ----- */
  const Overlay = (
    <div className="fixed inset-0 z-50 bg-white">
      <div className={`p-3 border-b-4 ${info.borderColor} flex items-center justify-between sticky top-0 bg-white`}>
        <div>
          <h3 className={`text-2xl md:text-3xl font-black ${info.textColor}`}>{info.title}</h3>
          <p className="text-sm text-gray-600 font-semibold">{info.subtitle}</p>
        </div>
        <button
          onClick={onToggleExpand}
          title="Réduire"
          className="p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600"
        >
          <i className="fas fa-lg fa-compress-alt" />
        </button>
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

  return isExpanded ? Overlay : StandardCard;
};

export default Quadrant;
