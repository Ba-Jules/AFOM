import React, { useRef, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc as fsDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import PostItComponent from "./PostIt";
import { PostIt, QuadrantKey } from "../types";

interface QuadrantProps {
  info: {
    title: string;
  subtitle: string;
    textColor: string;
    borderColor: string;
    bgColor: string;
  };
  postIts: PostIt[];
  quadrantKey: QuadrantKey;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/* -------- helpers drag-sort -------- */

function computeTargetIndex(container: HTMLElement, clientY: number) {
  const items = Array.from(
    container.querySelectorAll<HTMLElement>("[data-note-id]")
  );
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (clientY < mid) return i;
  }
  return items.length;
}

/** Déplacement/reorder persistant en Firestore */
async function moveOrReorderInFirestore(
  postItId: string,
  targetQuadrant: QuadrantKey,
  targetIndex: number
) {
  // 1) lire le doc courant (session + quadrant source)
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;
  const cur = curSnap.data() as any;
  const sessionId = cur.sessionId as string;
  const sourceQuadrant = cur.quadrant as QuadrantKey;

  const colRef = collection(db, "postits");

  // 2) récupérer listes source + (si besoin) cible
  const srcSnap = await getDocs(
    query(
      colRef,
      where("sessionId", "==", sessionId),
      where("quadrant", "==", sourceQuadrant)
    )
  );
  const srcList = srcSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const sameQuadrant = sourceQuadrant === targetQuadrant;

  const dstSnap = sameQuadrant
    ? srcSnap
    : await getDocs(
        query(
          colRef,
          where("sessionId", "==", sessionId),
          where("quadrant", "==", targetQuadrant)
        )
      );

  const dstList = sameQuadrant
    ? [...srcList]
    : dstSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  // 3) retirer de la source
  const idxSrc = srcList.findIndex((x) => x.id === postItId);
  if (idxSrc < 0) return;
  const [moving] = srcList.splice(idxSrc, 1);

  // 4) insérer dans la cible
  const clamped = Math.max(0, Math.min(dstList.length, targetIndex));
  dstList.splice(clamped, 0, { ...moving, quadrant: targetQuadrant });

  // 5) réécrire en batch
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

const Quadrant: React.FC<QuadrantProps> = ({
  info,
  postIts,
  quadrantKey,
  isExpanded,
  onToggleExpand,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // on rend toujours trié par sortIndex (si manquant => 0)
  const ordered = useMemo(
    () => [...postIts].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
    [postIts]
  );

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    // compatible avec l’existant et nos ajouts
    const postItId =
      e.dataTransfer.getData("postItId") ||
      e.dataTransfer.getData("postitId") ||
      e.dataTransfer.getData("text/plain");
    if (!postItId) return;

    const target = quadrantKey;
    const idx = containerRef.current
      ? computeTargetIndex(containerRef.current, e.clientY)
      : Number.MAX_SAFE_INTEGER;

    try {
      await moveOrReorderInFirestore(postItId, target, idx);
    } catch (err) {
      console.error("Move/reorder error:", err);
    }
  };

  return (
    <div
      data-quadrant={quadrantKey}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      className={`p-4 transition-all duration-300 ${
        isDragOver ? "bg-indigo-100" : ""
      } ${
        isExpanded
          ? "bg-white rounded-xl shadow-2xl min-h-[calc(100vh-160px)]"
          : "min-h-[40vh]"
      }`}
    >
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
          <i className={`fas fa-lg ${isExpanded ? "fa-compress-alt" : "fa-expand-alt"}`}></i>
        </button>
      </div>

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
              // on pose plusieurs clés pour compatibilité
              e.dataTransfer.setData("postItId", postit.id);
              e.dataTransfer.setData("postitId", postit.id);
              e.dataTransfer.setData("text/plain", postit.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <PostItComponent data={postit} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Quadrant;
