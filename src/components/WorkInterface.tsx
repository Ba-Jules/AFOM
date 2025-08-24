import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc as fsDoc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
  getDocs,
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
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);

  // Meta Projet / Thème
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  // QR modal
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Écoute des post-its
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
      if (s.exists()) setMeta(s.data() as BoardMeta);
      else setShowMetaModal(true);
    })();
  }, [sessionId]);

  // Groupement par quadrant (hors poubelle)
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

  // Navigation header
  const gotoAnalysis = () => {
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=analysis&session=${encodeURIComponent(
      sessionId
    )}`;
  };
  const gotoMatrix = () => {
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=matrix&session=${encodeURIComponent(
      sessionId
    )}`;
  };

  const clearSession = async () => {
    if (!confirm("Vider totalement ce tableau ?")) return;
    const snap = await getDocs(
      query(collection(db, "postits"), where("sessionId", "==", sessionId))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  return (
    <div className="min-h-screen">
      {/* Bandeau principal AFOM */}
      <div className="bg-gradient-to-r from-orange-400 via-pink-400 to-purple-400">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <div>
              <div className="text-2xl md:text-3xl font-black leading-tight">
                AFOM Ultimate
              </div>
              <div className="text-sm opacity-90 -mt-0.5">
                Interface de Travail
              </div>
            </div>
          </div>

          {/* Barre d’actions */}
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-md bg-white/20 hover:bg-white/25 font-semibold">
              Collecte
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50"
              onClick={gotoAnalysis}
            >
              Analyse
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50"
              onClick={gotoMatrix}
            >
              Matrice
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50"
              onClick={() => setIsQrOpen(true)}
            >
              QR Code
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50"
              onClick={() => setShowMetaModal(true)}
            >
              Modifier Projet/Thème
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50"
              onClick={clearSession}
            >
              Supprimer
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50"
              onClick={onBackToPresentation}
            >
              Présentation
            </button>
          </div>
        </div>
      </div>

      {/* Infos projet/thème sous le bandeau */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-700">
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

{/* Grille 2×2 habituelle */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
  {(
    [
      ["acquis", QUADRANTS.acquis],
      ["faiblesses", QUADRANTS.faiblesses],
      ["opportunites", QUADRANTS.opportunites],
      ["menaces", QUADRANTS.menaces],
    ] as [QuadrantKey, any][]
  ).map(([key, info]) => (
    <div key={key} className="min-h-[38vh]"> {/* ← garde le cadran haut */}
      <Quadrant
        info={info}                         {/* on passe l’objet complet */}
        postIts={byQuadrant[key]}
        quadrantKey={key}
        isExpanded={expanded === key}
        onToggleExpand={() => setExpanded(expanded === key ? null : key)}
      />
    </div>
  ))}
</div>


        {/* Panier */}
        <div className="mt-8">
          <BinPanel />
        </div>
      </div>

      {/* Modale Projet/Thème */}
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

      {/* Modale QR */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        sessionId={sessionId}
      />
    </div>
  );
};

export default WorkInterface;
