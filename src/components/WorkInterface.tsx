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

  // Métadonnées Projet / Thème
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  // Modale QR
  const [isQrOpen, setIsQrOpen] = useState(false);

  // --- Écoute des Post-its de la session ---
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

  // --- Charger/Créer les métadonnées Projet / Thème ---
  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      const ref = fsDoc(db, "boards", sessionId);
      const s = await getDoc(ref);
      if (s.exists()) {
        const m = s.data() as BoardMeta;
        setMeta(m);
      } else {
        // Première fois : on propose la saisie
        setShowMetaModal(true);
      }
    })();
  }, [sessionId]);

  // Répartition par quadrant (hors éléments du Panier)
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

  // --- Actions Header ---
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

  // Vider la session courante (sans changer d’URL / QR)
  const clearSession = async () => {
    if (!confirm("Vider totalement ce tableau ?")) return;
    const snap = await getDocs(
      query(collection(db, "postits"), where("sessionId", "==", sessionId))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  // --- Rendu ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100">
      {/* Bandeau supérieur */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-white/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-md bg-indigo-600 text-white font-semibold shadow-sm"
              onClick={() => {/* Collecte = vue actuelle */}}
              title="Collecte (vue actuelle)"
            >
              Collecte
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50"
              onClick={gotoAnalysis}
              title="Analyse (graphiques, IA)"
            >
              Analyse
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50"
              onClick={gotoMatrix}
              title="Matrice de confrontation"
            >
              Matrice
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50"
              onClick={() => setIsQrOpen(true)}
            >
              QR Code
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50"
              onClick={() => setShowMetaModal(true)}
            >
              Modifier Projet/Thème
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50"
              onClick={clearSession}
            >
              Supprimer
            </button>
            <button
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50"
              onClick={onBackToPresentation}
            >
              Présentation
            </button>
          </div>
        </div>
      </div>

      {/* Infos Projet/Thème */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
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

      {/* Grille 2×2 classique */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(
            [
              ["acquis", QUADRANTS.acquis],
              ["faiblesses", QUADRANTS.faiblesses],
              ["opportunites", QUADRANTS.opportunites],
              ["menaces", QUADRANTS.menaces],
            ] as [QuadrantKey, { title: string; subtitle: string }][]
          ).map(([key, info]) => (
            <div key={key} className="min-h-[40vh]">
              <Quadrant
                info={{ title: info.title, subtitle: info.subtitle }}
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

        {/* 5e cadran : Panier */}
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
                        // createdAt : gardé si déjà présent
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

      {/* Modale QR Code (props corrigés) */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        sessionId={sessionId}
      />
    </div>
  );
};

export default WorkInterface;
