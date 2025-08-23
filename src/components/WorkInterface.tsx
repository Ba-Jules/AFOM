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

/** Récupère un sessionId depuis l’URL ou le localStorage */
function resolveSessionId(): string | null {
  const url = new URL(window.location.href);
  const s = url.searchParams.get("session") || url.searchParams.get("board");
  return s || localStorage.getItem("sessionId") || localStorage.getItem("boardId") || null;
}

/** Props optionnelles pour compatibilité avec App.tsx */
type WorkInterfaceProps = {
  sessionId?: string;
  onBackToPresentation?: () => void;
};

const WorkInterface: React.FC<WorkInterfaceProps> = ({
  sessionId: sessionFromProps,
  onBackToPresentation,
}) => {
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);

  // Meta Projet/Thème
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  // QR modal
  const [showQR, setShowQR] = useState(false);

  // sessionId effectif : priorité à la prop si fournie, sinon URL/LS
  const sessionId = useMemo(() => {
    if (sessionFromProps && sessionFromProps.trim()) return sessionFromProps;
    return resolveSessionId();
  }, [sessionFromProps]);

  // Écoute des post-its de la session
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

  // Répartition par quadrant (on exclut ce qui est "au panier")
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

  // Actions d’en-tête
  const handleNewSession = async () => {
    const base = (meta?.projectName || "SESSION").replace(/\s+/g, "-").slice(0, 16).toUpperCase();
    const newId = `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    localStorage.setItem("sessionId", newId);

    if (meta) {
      await setDoc(
        fsDoc(db, "boards", newId),
        {
          projectName: meta.projectName,
          themeName: meta.themeName,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Partial<BoardMeta>,
        { merge: true }
      );
    }
    const url = new URL(window.location.href);
    url.searchParams.set("session", newId);
    window.location.href = url.toString();
  };

  const handleClearSession = async () => {
    if (!sessionId) return;
    if (!confirm("Supprimer toutes les étiquettes de cette session ?")) return;

    const snap = await getDocs(
      query(collection(db, "postits"), where("sessionId", "==", sessionId))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  if (!sessionId) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Session introuvable</h2>
        <p>
          Ouvrez l’atelier via un lien ou un QR contenant <code>?session=...</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ===================== Bandeau principal (restauré) ===================== */}
      <div className="bg-gradient-to-r from-orange-400 to-pink-400 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Titre + modes */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-extrabold tracking-wide">🚀 AFOM Ultimate</div>
              <div className="text-[13px] opacity-90">
                Interface de Travail • Analyse Acquis • Faiblesses • Opportunités • Menaces
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-2">
              <a
                href="?v=drag2"
                className="px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-sm"
                title="Mode Collecte"
              >
                Collecte
              </a>
              <a
                href="?v=analysis"
                className="px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-sm"
                title="Mode Analyse"
              >
                Analyse
              </a>
              {onBackToPresentation && (
                <button
                  onClick={onBackToPresentation}
                  className="px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-sm"
                  title="Retour Présentation"
                >
                  ↩︎ Présentation
                </button>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewSession}
              className="px-3 py-2 rounded-md bg-white text-gray-800 hover:bg-gray-50 text-sm shadow"
              title="Démarrer une nouvelle session"
            >
              Nouvelle
            </button>
            <button
              onClick={handleClearSession}
              className="px-3 py-2 rounded-md bg-white/20 hover:bg-white/25 text-sm"
              title="Supprimer toutes les étiquettes"
            >
              Supprimer
            </button>
            <button
              onClick={() => setShowQR(true)}
              className="px-3 py-2 rounded-md bg-white/20 hover:bg-white/25 text-sm"
              title="Afficher le QR Code de participation"
            >
              QR Code
            </button>
            <a
              href="?v=formation"
              className="px-3 py-2 rounded-md bg-white/20 hover:bg-white/25 text-sm"
              title="Démonstration & Formation"
            >
              Formation
            </a>
          </div>
        </div>
      </div>

      {/* ===================== Rubrique Projet / Thème ===================== */}
      <div className="max-w-6xl mx-auto px-4 mt-3 mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-700">
          <div>
            <span className="font-semibold">Projet :</span> {meta?.projectName || "—"}
          </div>
        </div>
        <div className="text-sm text-gray-700">
          <div>
            <span className="font-semibold">Thème :</span> {meta?.themeName || "—"}
          </div>
        </div>
        <div>
          <button
            onClick={() => setShowMetaModal(true)}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-sm"
          >
            {meta ? "Modifier Projet/Thème" : "Définir Projet/Thème"}
          </button>
        </div>
      </div>

      {/* ===================== Grand cadran 2×2 (restauré) ===================== */}
      <div className="max-w-6xl mx-auto px-4">
        {/* Quand un quadrant est agrandi : on n’affiche que lui, sur toute la surface */}
        {expanded ? (
          <div className="relative rounded-2xl border-4 border-slate-800 bg-white/40 backdrop-blur p-3 min-h-[70vh]">
            <Quadrant
              info={{
                title: QUADRANTS[expanded].title,
                subtitle: QUADRANTS[expanded].subtitle,
                textColor: QUADRANTS[expanded].textColor,
                borderColor: QUADRANTS[expanded].borderColor,
                bgColor: QUADRANTS[expanded].bgColor,
              }}
              postIts={byQuadrant[expanded]}
              quadrantKey={expanded}
              isExpanded={true}
              onToggleExpand={() => setExpanded(null)}
            />
          </div>
        ) : (
          <div className="relative rounded-2xl border-4 border-slate-800 bg-white/40 backdrop-blur p-3 min-h-[70vh]">
            {/* Croix centrale */}
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[3px] h-full bg-slate-800/80" />
            <div className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 h-[3px] w-full bg-slate-800/80" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
              {(
                [
                  ["acquis", QUADRANTS.acquis],
                  ["faiblesses", QUADRANTS.faiblesses],
                  ["opportunites", QUADRANTS.opportunites],
                  ["menaces", QUADRANTS.menaces],
                ] as [QuadrantKey, any][]
              ).map(([key, info]) => (
                <div key={key} className="min-h-[32vh]">
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
                    isExpanded={false}
                    onToggleExpand={() => setExpanded(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===================== 5e cadran : Panier / À discuter ===================== */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <BinPanel />
      </div>

      {/* ===================== Modal Projet/Thème ===================== */}
      {!showMetaModal ? null : (
        <div className="fixed inset-0 bg-black/30 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="font-bold">Définir Projet & Thème</h4>
              <button
                onClick={() => setShowMetaModal(false)}
                className="w-8 h-8 rounded-md border hover:bg-gray-100"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-600">Nom du projet</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Ex : Transformation 2025"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Thème de la session</label>
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
                    const now = new Date();
                    await setDoc(
                      fsDoc(db, "boards", sessionId),
                      {
                        projectName: projectName.trim(),
                        themeName: themeName.trim(),
                        updatedAt: now,
                        createdAt: meta?.createdAt || now,
                      } as Partial<BoardMeta>,
                      { merge: true }
                    );
                    setMeta({
                      ...(meta || {}),
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

      {/* ===================== Modal QR Code ===================== */}
      {!showQR ? null : (
        <QRCodeModal
          isOpen={showQR}
          sessionId={sessionId}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
};

export default WorkInterface;
