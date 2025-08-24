// src/components/WorkInterface.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc as fsDoc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
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
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Meta Projet/Thème
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  // Écoute de la session
  useEffect(() => {
    if (!sessionId) return;
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

  // Charger/Créer meta Projet/Thème
  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      const ref = fsDoc(db, "boards", sessionId);
      const s = await getDoc(ref);
      if (s.exists()) {
        setMeta(s.data() as BoardMeta);
      } else {
        setShowMetaModal(true);
      }
    })();
  }, [sessionId]);

  const byQuadrant = useMemo(() => {
    const res: Record<QuadrantKey, PostIt[]> = {
      acquis: [],
      faiblesses: [],
      opportunites: [],
      menaces: [],
    };
    for (const p of postIts) {
      if ((p as any).status === "bin") continue;
      res[p.quadrant].push(p);
    }
    return res;
  }, [postIts]);

  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(
      sessionId
    )}`;
  }, [sessionId]);

  // Navigation rapide en conservant la session
  const go = (view: "analysis" | "matrix" | "drag2") => {
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=${view}&session=${encodeURIComponent(
      sessionId
    )}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100">
      {/* Bandeau principal */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-white/60 shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            <div>
              <span className="font-semibold">Projet :</span> {meta?.projectName || "—"}
            </div>
            <div>
              <span className="font-semibold">Thème :</span> {meta?.themeName || "—"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBackToPresentation}
              className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            >
              ↩︎ Présentation
            </button>
            <button
              onClick={() => setShowMetaModal(true)}
              className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            >
              Modifier Projet/Thème
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="max-w-7xl mx-auto px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => go("drag2")}
              className="px-3 py-1.5 rounded-md bg-white text-gray-700 border hover:bg-gray-50 text-sm"
              title="Mode collecte"
            >
              🧩 Collecte
            </button>

            <button
              onClick={() => go("analysis")}
              className="px-3 py-1.5 rounded-md bg-white text-gray-700 border hover:bg-gray-50 text-sm"
              title="Analyse & graphiques"
            >
              📊 Analyse
            </button>

            <button
              onClick={() => setShowQr(true)}
              className="px-3 py-1.5 rounded-md bg-white text-gray-700 border hover:bg-gray-50 text-sm"
              title="Montrer le QR pour les participants"
            >
              🔗 QR Code
            </button>

            {/* Nouveau bouton */}
            <button
              onClick={() => go("matrix")}
              className="px-3 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-sm shadow"
              title="Ouvrir la matrice de confrontation"
            >
              🧮 Matrice de Confrontation
            </button>
          </div>
        </div>
      </div>

      {/* Board 2×2 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              ["acquis", QUADRANTS.acquis],
              ["faiblesses", QUADRANTS.faiblesses],
              ["opportunites", QUADRANTS.opportunites],
              ["menaces", QUADRANTS.menaces],
            ] as [QuadrantKey, any][]
          ).map(([key, info]) => (
            <div key={key} className="min-h-[40vh]">
              <Quadrant
                info={{
                  title: info.title,
                  subtitle: info.subtitle,
                  textColor: info.textColor,
                  borderColor: info.borderColor,
                  bgColor: info.bgColor,
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
        <div className="mt-6">
          <BinPanel />
        </div>
      </div>

      {/* QR modal – prop 'url' uniquement */}
      {showQr && (
        <QRCodeModal
          onClose={() => setShowQr(false)}
          url={participantUrl}
        />
      )}

      {/* Modal Projet/Thème */}
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
                        createdAt: meta?.createdAt || new Date(),
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
