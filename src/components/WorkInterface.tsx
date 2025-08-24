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
import { QUADRANTS } from "../constants"; // mapping { acquis, faiblesses, opportunites, menaces }

/** Props attendues par App.tsx */
interface WorkInterfaceProps {
  sessionId: string;
  onBackToPresentation: () => void;
}

const WorkInterface: React.FC<WorkInterfaceProps> = ({
  sessionId,
  onBackToPresentation,
}) => {
  /** UI state */
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  /** Meta Projet/Thème */
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  /** Données post-its */
  const [postIts, setPostIts] = useState<PostIt[]>([]);

  /** --------- Firestore: écoute de la session --------- */
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem("sessionId", sessionId);

    const unsub = onSnapshot(
      query(collection(db, "postits"), where("sessionId", "==", sessionId)),
      (snap) => {
        const arr = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as PostIt[];
        setPostIts(arr);
      }
    );
    return () => unsub();
  }, [sessionId]);

  /** --------- Charger/Créer meta Projet/Thème --------- */
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

  /** Regrouper par quadrant (hors panier/bin) */
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

  /** --------- Actions header --------- */
  const navigate = (v: "work" | "analysis" | "matrix") => {
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}?v=${v}&session=${encodeURIComponent(
      sessionId
    )}`;
    window.location.assign(url);
  };

  const handleDeleteSession = async () => {
    if (
      !window.confirm(
        "Supprimer toutes les étiquettes de cette session ? (irréversible)"
      )
    )
      return;

    const snap = await getDocs(
      query(collection(db, "postits"), where("sessionId", "==", sessionId))
    );
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    alert("Session vidée.");
  };

  /** --------- Rendu --------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-rose-400 via-orange-300 to-purple-300/60 backdrop-blur border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🚀</div>
            <div>
              <div className="text-lg font-extrabold leading-none">
                AFOM Ultimate
              </div>
              <div className="text-[11px] text-white/80 -mt-0.5">
                Interface de Travail
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={() => navigate("work")}
            >
              Collecte
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={() => navigate("analysis")}
            >
              Analyse
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={() => navigate("matrix")}
            >
              Matrice
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={() => setIsQrOpen(true)}
            >
              QR Code
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={() => setShowMetaModal(true)}
            >
              Modifier Projet/Thème
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={handleDeleteSession}
            >
              Supprimer
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white/90 hover:bg-white shadow"
              onClick={onBackToPresentation}
            >
              Présentation
            </button>
          </nav>
        </div>
      </header>

      {/* Sous-entête : projet / thème */}
      <div className="max-w-6xl mx-auto px-4 mt-3 text-[13px] text-gray-700">
        <div>
          <span className="font-semibold">Projet :</span>{" "}
          {meta?.projectName || "—"}
        </div>
        <div>
          <span className="font-semibold">Thème :</span>{" "}
          {meta?.themeName || "—"}
        </div>
      </div>

      {/* Grille 2×2 */}
      <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {(
          [
            ["acquis", QUADRANTS.acquis],
            ["faiblesses", QUADRANTS.faiblesses],
            ["opportunites", QUADRANTS.opportunites],
            ["menaces", QUADRANTS.menaces],
          ] as [QuadrantKey, any][]
        ).map(([key, info]) => (
          <div key={key} className="min-h-[36vh]">
            <Quadrant
              info={info as any /* passe l'objet tel quel */}
              postIts={byQuadrant[key]}
              quadrantKey={key}
              isExpanded={expanded === key}
              onToggleExpand={() =>
                setExpanded((cur) => (cur === key ? null : key))
              }
            />
          </div>
        ))}
      </div>

      {/* 5e panneau : Panier */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <BinPanel />
      </div>

      {/* Modal QR Code */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        sessionId={sessionId}
      />

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
                    });
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
