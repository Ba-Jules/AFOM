import React, { useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  query,
  updateDoc,
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
    textColor: string;
    borderColor: string;
    bgColor: string; // utilisé désormais pour teinter le fond
  };
  postIts: PostIt[];
  quadrantKey: QuadrantKey;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/* utils */
function getColumnCount(el: HTMLElement | null): number {
  if (!el) return 2;
  const tpl = getComputedStyle(el).gridTemplateColumns || "";
  const cols = tpl.split(" ").filter(Boolean).length;
  return cols || 2;
}
function computeTargetIndex(container: HTMLElement, _x: number, y: number) {
  const items = Array.from(container.querySelectorAll<HTMLElement>("[data-note-id]"));
  if (items.length === 0) return 0;
  const positions = items
    .map((el, i) => ({ i, rect: el.getBoundingClientRect() }))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  for (let k = 0; k < positions.length; k++) {
    const r = positions[k].rect;
    if (y < r.top + r.height / 2) return positions[k].i;
  }
  return positions.length;
}

/* Firestore ops */
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
    .filter((x) => x.status !== "bin")
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

  const srcSnap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", sourceQuadrant)
    )
  );
  const srcList = srcSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((x) => x.status !== "bin")
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const idxSrc = srcList.findIndex((x) => x.id === postItId);
  if (idxSrc < 0) return;
  const [moving] = srcList.splice(idxSrc, 1);

  const dstSnap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", targetQuadrant)
    )
  );
  const dstList = dstSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((x) => x.status !== "bin")
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const clamped = Math.max(0, Math.min(dstList.length, targetIndex));
  dstList.splice(clamped, 0, { ...moving, quadrant: targetQuadrant });

  const batch = writeBatch(db);
  srcList.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), { sortIndex: i })
  );
  dstList.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), { sortIndex: i, quadrant: targetQuadrant })
  );
  await batch.commit();
}

async function restoreFromBinIntoQuadrant(
  postItId: string,
  targetQuadrant: QuadrantKey,
  targetIndex: number
) {
  const curSnap = await getDoc(fsDoc(db, "postits", postItId));
  if (!curSnap.exists()) return;
  const cur = curSnap.data() as any;
  const sessionId = cur.sessionId as string;

  const dstSnap = await getDocs(
    query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId),
      where("quadrant", "==", targetQuadrant)
    )
  );
  const dstList = dstSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((x) => x.status !== "bin")
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  const clamped = Math.max(0, Math.min(dstList.length, targetIndex));
  dstList.splice(clamped, 0, { id: postItId });

  const batch = writeBatch(db);
  dstList.forEach((it, i) =>
    batch.update(fsDoc(db, "postits", it.id), { sortIndex: i })
  );
  batch.update(fsDoc(db, "postits", postItId), {
    status: "active",
    quadrant: targetQuadrant,
    deletedAt: null,
  });
  await batch.commit();
}

async function moveOrReorder(
  postItId: string,
  targetQuadrant: QuadrantKey,
  targetIndex: number
) {
  const snap = await getDoc(fsDoc(db, "postits", postItId));
  if (!snap.exists()) return;
  const cur = snap.data() as any;
  const srcStatus = cur.status || "active";
  const srcQuadrant = cur.quadrant as QuadrantKey;

  if (srcStatus === "bin") {
    await restoreFromBinIntoQuadrant(postItId, targetQuadrant, targetIndex);
    return;
  }
  if (srcQuadrant === targetQuadrant) {
    await reorderWithinSameQuadrant(postItId, targetIndex);
  } else {
    await moveAcrossQuadrants(postItId, targetQuadrant, targetIndex);
  }
}

/* composant */
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
    () =>
      [...postIts]
        .filter((p) => p.status !== "bin")
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
    [postIts]
  );

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const postItId =
      e.dataTransfer.getData("postItId") ||
      e.dataTransfer.getData("text/plain");
    if (!postItId) return;

    const idx = containerRef.current
      ? computeTargetIndex(containerRef.current, e.clientX, e.clientY)
      : Number.MAX_SAFE_INTEGER;
    try {
      await moveOrReorder(postItId, quadrantKey, idx);
    } catch (err) {
      console.error(err);
    }
  };

  /* ---------- HEADER du quadrant ---------- */
  const Header = (
    <div
      className={`sticky top-[76px] z-10 bg-white/80 backdrop-blur-sm border-b ${info.borderColor} px-3 py-2 rounded-t-2xl flex items-center justify-between`}
    >
      <div className="flex items-baseline gap-3">
        <h3 className={`text-xl font-black ${info.textColor}`}>{info.title}</h3>
        <p className="text-xs text-gray-600 font-semibold">{info.subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {/* Ajouter */}
        <button
          onClick={() => setShowAdd(true)}
          title="Ajouter une étiquette"
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        >
          +
        </button>
        {/* Agrandir/Réduire */}
        <button
          onClick={onToggleExpand}
          title={isExpanded ? "Réduire" : "Agrandir"}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        >
          {isExpanded ? "⤡" : "⤢"}
        </button>
      </div>
    </div>
  );

  /* ---------- Modal d’ajout (animateur) ---------- */
  const [showAdd, setShowAdd] = useState(false);
  const [author, setAuthor] = useState<string>(
    () => localStorage.getItem("lastAuthor") || "Animateur"
  );
  const [content, setContent] = useState("");

  async function createFacilitatorNote(authorName: string, text: string) {
    if (!text.trim()) return alert("Le contenu ne peut pas être vide.");
    const sid =
      ordered[0]?.sessionId ||
      localStorage.getItem("sessionId") ||
      new URL(window.location.href).searchParams.get("session");
    if (!sid) return alert("Session introuvable.");

    const list = [...ordered];
    const nextIdx =
      list.length === 0 ? 0 : Math.max(...list.map((x) => x.sortIndex ?? 0)) + 1;

    await addDoc(collection(db, "postits"), {
      sessionId: sid,
      quadrant: quadrantKey,
      originQuadrant: quadrantKey,
      sortIndex: nextIdx,
      author: authorName || "Animateur",
      content: text.trim(),
      status: "active",
      timestamp: new Date(),
    });
  }

  const AddModal = !showAdd ? null : (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h4 className="font-bold">Nouvelle étiquette — {info.title}</h4>
          <button
            onClick={() => setShowAdd(false)}
            className="w-8 h-8 rounded-md border hover:bg-gray-100"
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
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Contenu</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 h-32 resize-y outline-none focus:ring-2 focus:ring-indigo-400"
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
              try {
                await createFacilitatorNote(author.trim() || "Animateur", content);
                localStorage.setItem(
                  "lastAuthor",
                  author.trim() || "Animateur"
                );
                setContent("");
                setShowAdd(false);
              } catch (e) {
                console.error(e);
                alert("Impossible de créer l'étiquette.");
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

  /* ---------- Carte standard (cadran 1/4) ---------- */
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
      className={`rounded-2xl border-2 ${info.borderColor} shadow-sm ${info.bgColor} bg-opacity-60 transition-colors duration-200`}
    >
      {Header}
      <div
        ref={containerRef}
        className={`p-4 pt-4 grid gap-3 ${
          isDragOver ? "bg-white/50 rounded-b-2xl" : ""
        } grid-cols-1 sm:grid-cols-2`}
      >
        {ordered.map((p) => (
          <div
            key={p.id}
            data-note-id={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("postItId", p.id);
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <PostItComponent
              data={p}
              onMoveStep={(d) =>
                reorderWithinSameQuadrant(p.id, (p.sortIndex ?? 0) + d)
              }
              onMoveRow={async (r) => {
                const cols = getColumnCount(containerRef.current);
                await reorderWithinSameQuadrant(
                  p.id,
                  (p.sortIndex ?? 0) + r * cols
                );
              }}
            />
          </div>
        ))}
      </div>
      {AddModal}
    </div>
  );

  /* ---------- Plein écran (overlay) ---------- */
  const Overlay = (
    <div className="fixed inset-0 z-50 bg-neutral-50">
      <div
        className={`px-3 py-2 border-b-2 ${info.borderColor} flex items-center justify-between sticky top-0 bg-white`}
      >
        <div>
          <h3 className={`text-2xl md:text-3xl font-black ${info.textColor}`}>
            {info.title}
          </h3>
          <p className="text-sm text-gray-600 font-semibold">{info.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            title="Ajouter une étiquette"
          >
            +
          </button>
          <button
            onClick={onToggleExpand}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            title="Réduire"
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
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <PostItComponent
              data={p}
              onMoveStep={(d) =>
                reorderWithinSameQuadrant(p.id, (p.sortIndex ?? 0) + d)
              }
              onMoveRow={async (r) => {
                const cols = getColumnCount(containerRef.current);
                await reorderWithinSameQuadrant(
                  p.id,
                  (p.sortIndex ?? 0) + r * cols
                );
              }}
            />
          </div>
        ))}
      </div>
      {AddModal}
    </div>
  );

  return isExpanded ? Overlay : StandardCard;
};

export default Quadrant;
