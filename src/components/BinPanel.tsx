import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { PostIt, QuadrantKey } from "../types";

function resolveSessionId(): string | null {
  const url = new URL(window.location.href);
  const s = url.searchParams.get("session") || url.searchParams.get("board");
  return s || localStorage.getItem("sessionId") || localStorage.getItem("boardId") || null;
}

const BinPanel: React.FC = () => {
  const [items, setItems] = useState<PostIt[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionId = useMemo(resolveSessionId, []);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(
      query(collection(db, "postits"), where("sessionId", "==", sessionId), where("status", "==", "bin")),
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PostIt[];
        const ordered = arr.sort((a, b) => {
          const da = (a as any).deletedAt?.toMillis?.() ?? new Date((a as any).deletedAt || 0).getTime();
          const dbb = (b as any).deletedAt?.toMillis?.() ?? new Date((b as any).deletedAt || 0).getTime();
          return dbb - da;
        });
        setItems(ordered);
      }
    );
    return () => unsub();
  }, [sessionId]);

  // Drop ici = passer au panier
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const postItId = e.dataTransfer.getData("postItId") || e.dataTransfer.getData("text/plain");
    if (!postItId) return;

    const snap = await getDoc(fsDoc(db, "postits", postItId));
    if (!snap.exists()) return;
    const cur = snap.data() as any;
    if (cur.status === "bin") return; // déjà au panier

    // mémoriser position actuelle pour une éventuelle restauration ultérieure
    const q = query(
      collection(db, "postits"),
      where("sessionId", "==", cur.sessionId),
      where("quadrant", "==", cur.quadrant)
    );
    const list = (await getDocs(q)).docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((x) => x.status !== "bin")
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    const idx = list.findIndex((x) => x.id === postItId);

    await updateDoc(fsDoc(db, "postits", postItId), {
      status: "bin",
      lastQuadrant: cur.quadrant as QuadrantKey,
      lastSortIndex: idx >= 0 ? idx : (cur.sortIndex ?? 0),
      deletedAt: new Date(),
    });
  };

  return (
    <section
      className={`mt-6 p-4 border-t-4 border-amber-500 bg-amber-50 rounded-lg transition-colors ${isDragOver ? "ring-2 ring-amber-400" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xl font-black text-amber-700">À discuter (Panier)</h3>
          <p className="text-xs text-amber-900/80 font-semibold">Idées mises de côté pour traitement en fin de session</p>
        </div>
        <div className="text-sm text-amber-800">{items.length} élément(s)</div>
      </div>

      <div ref={containerRef} className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <div
            key={p.id}
            data-note-id={p.id}
            draggable
            // Permettre le drag OUT (vers un quadrant) — le Quadrant décidera de la restauration
            onDragStart={(e) => {
              e.dataTransfer.setData("postItId", p.id);
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="rounded-lg border border-amber-300 bg-white p-3 shadow-sm"
            title="Glissez vers un quadrant pour réintégrer l'idée"
          >
            <div className="text-xs text-gray-600 mb-1">par {p.author}</div>
            <div className="text-[15px] sm:text-base md:text-lg leading-snug font-semibold whitespace-pre-wrap">
              {p.content}
            </div>
            <div className="mt-2 text-[11px] text-amber-800/80">
              Origine : <strong>{p.originQuadrant || p.lastQuadrant || p.quadrant}</strong>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-amber-800/70">Déposez ici des étiquettes pour les traiter plus tard.</div>
        )}
      </div>
    </section>
  );
};

export default BinPanel;
