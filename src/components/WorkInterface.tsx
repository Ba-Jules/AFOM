import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../services/firebase";

import Quadrant from "./Quadrant";
import BinPanel from "./BinPanel";
import QRCodeModal from "./QRCodeModal";

import { PostIt, QuadrantKey, BoardMeta } from "../types";
import { QUADRANTS } from "../constants";

type Props = {
  sessionId: string;
  onBackToPresentation: () => void;
};

const WorkInterface: React.FC<Props> = ({ sessionId, onBackToPresentation }) => {
  // --- Données temps réel ---
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);

  // --- Projet / Thème ---
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  // --- QR ---
  const [qrOpen, setQrOpen] = useState(false);
  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(
      sessionId
    )}`;
  }, [sessionId]);

  // === Effects ===
  // Abonnement aux post-its
  useEffect(() => {
    localStorage.setItem("sessionId", sessionId);
    const unsub = onSnapshot(
      query(collection(db, "postits"), where("sessionId", "==", sessionId)),
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PostIt[];
        setPostIts(arr);
      }
    );
    return () => unsub();
  }, [sessionId]);

  // Chargement meta Projet/Thème
  useEffect(() => {
    (async () => {
      const ref = fsDoc(db, "boards", sessionId);
      const s = await getDoc(ref);
      if (s.exists()) {
        const m = s.data() as BoardMeta;
        setMeta(m);
      } else {
        setShowMetaModal(true);
      }
    })();
  }, [sessionId]);

  // Groupement par quadrant (on exclut le panier)
  const byQuadrant = useMemo(() => {
    const res: Record<QuadrantKey, PostIt[]> = {
      acquis: [],
      faiblesses: [],
      opportunites: [],
      menaces: [],
    };
    for (const p of postIts) {
      // @ts-ignore : certains post-its « panier » ont p.status === "bin"
      if (p.status === "bin") continue;
      res[p.quadrant]?.push(p);
    }
    return res;
  }, [postIts]);

  // === Navigation header ===
  const goto = (v: "work" | "analysis" | "matrix" | "presentation") => {
    const { origin, pathname } = window.location;
    if (v === "presentation") {
      window.history.replaceState({}, "", `${origin}${pathname}`);
      onBackToPresentation();
      return;
    }
    const url = `${origin}${pathname}?v=${v}&session=${encodeURIComponent(sessionId)}`;
    window.location.href = url;
  };

  // === Suppression session (post-its uniquement) ===
  const wipeSession = async () => {
    if (!confirm("Supprimer toutes les étiquettes de cette session ?")) return;
    const snap = await getDocs(query(collection(db, "postits"), where("sessionId", "==", sessionId)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    alert("Étiquettes supprimées.");
  };

  // === UI ===
  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER — AFOM Ultimate */}
      <header className="sticky top-0 z-40 shadow-sm">
        <div className="bg-gradient-to-r from-rose-300 via-orange-200 to-fuchsia-300">
          <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <span className="text-xl">🚀</span>
              <div className="leading-tight">
                <div className="text-[18px] font-extrabold text-gray-900">AFOM Ultimate</div>
                <div className="text-[11px] text-gray-700">Interface de Travail</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => goto("work")}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-gray-900 text-sm font-semibold border"
              >
                Collecte
              </button>
              <button
                onClick={() => goto("analysis")}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-gray-900 text-sm font-semibold border"
              >
                Analyse
              </button>
              <button
                onClick={() => goto("matrix")}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-gray-900 text-sm font-semibold border"
              >
                Matrice
              </button>
              <button
                onClick={() => setQrOpen(true)}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-gray-900 text-sm font-semibold border"
              >
                QR Code
              </button>
              <button
                onClick={() => setShowMetaModal(true)}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-gray-900 text-sm font-semibold border"
              >
                Modifier Projet/Thème
              </button>
              <button
                onClick={wipeSession}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-red-600 text-sm font-semibold border"
              >
                Supprimer
              </button>
              <button
                onClick={() => goto("presentation")}
                className="px-3 py-1.5 rounded-md bg-white/90 hover:bg-white text-gray-900 text-sm font-semibold border"
              >
                Présentation
              </button>
            </div>
          </div>
        </div>

        {/* Liseré d’infos Projet/Thème */}
        <div className="bg-white/80 backdrop-blur border-b">
          <div className="max-w-[1200px] mx-auto px-4 py-2 text-[12px] text-gray-700 flex items-center gap-6">
            <div>
              <span className="font-semibold">Projet :</span>{" "}
              {meta?.projectName || "—"}
            </div>
            <div>
              <span className="font-semibold">Thème :</span>{" "}
              {meta?.themeName || "—"}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU */}
      <main className="flex-1">
        <div className="max-w-[1200px] mx-auto px-4 py-6">
          {/* Cadran 2×2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(
              [
                ["acquis", QUADRANTS.acquis],
                ["faiblesses", QUADRANTS.faiblesses],
                ["opportunites", QUADRANTS.opportunites],
                ["menaces", QUADRANTS.menaces],
              ] as [QuadrantKey, any][]
            ).map(([key, info]) => (
              <div key={key} className="min-h-[42vh]">
                <Quadrant
                  info={{
                    title: info.title,
                    subtitle: info.subtitle,
                  }}
                  postIts={byQuadrant[key]}
                  quadrantKey={key}
                  isExpanded={expanded === key}
                  onToggleExpand={() =>
                    setExpanded(expanded === key ? null : key)
                  }
                />
              </div>
            ))}
          </div>

          {/* Panier */}
          <div className="mt-10">
            <BinPanel />
          </div>
        </div>
      </main>

      {/* MODALS */}
      {/* QR Code */}
      <QRCodeModal
        isOpen={qrOpen}
        onClose={() => setQrOpen(false)}
        sessionId={sessionId}
      />

      {/* Projet / Thème */}
      {!showMetaModal ? null : (
        <div className="fixed inset-0 bg-black/30 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="font-bold">Définir Projet & Thème</h4>
              <button
                onClick={() => setShowMetaModal(false)}
                className="w-8 h-8 rounded-md border hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-600">
                  Nom du projet
                </label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Ex : Transformation 2025"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">
                  Thème de la session
                </label>
                <input
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Ex : Offre digitale PME"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setShowMetaModal(false)}
                className="px-4 py-2 rounded-md border hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!projectName.trim() || !themeName.trim()) {
                    alert("Merci de renseigner Projet et Thème.");
                    return;
                  }
                  try {
                    await setDoc(
                      fsDoc(db, "boards", sessionId),
                      {
                        projectName: projectName.trim(),
                        themeName: themeName.trim(),
                        updatedAt: new Date(),
                      } as BoardMeta,
                      { merge: true }
                    );
                    setMeta({
                      projectName: projectName.trim(),
                      themeName: themeName.trim(),
                    } as BoardMeta);
                    setShowMetaModal(false);
                  } catch (e) {
                    console.error(e);
                    alert("Impossible d’enregistrer le Projet/Thème.");
                  }
                }}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkInterface;
