import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
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

/* Palette minimale pour Quadrant */
const PALETTE: Record<
  QuadrantKey,
  { textColor: string; borderColor: string; bgColor: string }
> = {
  acquis: {
    textColor: "text-green-700",
    borderColor: "border-green-400",
    bgColor: "bg-green-50",
  },
  opportunites: {
    textColor: "text-teal-700",
    borderColor: "border-teal-400",
    bgColor: "bg-emerald-50",
  },
  faiblesses: {
    textColor: "text-red-700",
    borderColor: "border-red-400",
    bgColor: "bg-red-50",
  },
  menaces: {
    textColor: "text-orange-700",
    borderColor: "border-orange-400",
    bgColor: "bg-orange-50",
  },
};

interface WorkInterfaceProps {
  sessionId: string;
  onBackToPresentation: () => void;
}

const WorkInterface: React.FC<WorkInterfaceProps> = ({
  sessionId,
  onBackToPresentation,
}) => {
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);

  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  const [showQR, setShowQR] = useState(false);

  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(
      sessionId
    )}`;
  }, [sessionId]);

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

  useEffect(() => {
    (async () => {
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
      res[p.quadrant]?.push(p);
    }
    return res;
  }, [postIts]);

  const goto = (v: "analysis" | "matrix" | "presentation") => {
    const { origin, pathname } = window.location;
    if (v === "presentation") {
      window.location.href = `${origin}${pathname}`;
    } else {
      window.location.href = `${origin}${pathname}?v=${v}&session=${encodeURIComponent(
        sessionId
      )}`;
    }
  };

  const clearSession = async () => {
    if (!confirm("Supprimer tous les post-its de cette session ?")) return;
    const q = query(collection(db, "postits"), where("sessionId", "==", sessionId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    alert("Session vidée.");
  };

  const addPostIt = async (quadrant: QuadrantKey) => {
    await addDoc(collection(db, "postits"), {
      sessionId,
      quadrant,
      originQuadrant: quadrant,
      content: "",
      author: "Animateur",
      timestamp: serverTimestamp(),
      sortIndex: Date.now(),
      status: "active",
    } as any);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-gradient-to-r from-rose-200 via-violet-200 to-fuchsia-200/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow">
              🚀
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-700">AFOM Ultimate</div>
              <div className="text-[11px] text-gray-600">Interface de Travail</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            {/* Bouton Collecte supprimé */}
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white shadow-sm border font-medium"
              onClick={() => goto("analysis")}
            >
              Analyse
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white shadow-sm border font-medium"
              onClick={() => goto("matrix")}
            >
              Matrice
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white shadow-sm border font-medium"
              onClick={() => setShowQR(true)}
            >
              QR Code
            </button>
            {/* Bouton "Modifier Projet/Thème" supprimé (il y a le bouton 'Modifier' dans le bloc) */}
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white shadow-sm border font-medium"
              onClick={clearSession}
            >
              Supprimer
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-sm bg-white shadow-sm border font-medium"
              onClick={() => goto("presentation")}
            >
              Présentation
            </button>
          </nav>
        </div>
      </header>

      {/* Sous-bandeau Projet/Thème */}
      <div className="mx-auto max-w-7xl px-4 pt-3">
        <div className="rounded-lg border bg-white shadow-sm px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
            <div className="text-[15px] md:text-lg">
              <span className="font-extrabold text-gray-800">Projet :</span>{" "}
              <span className="font-semibold text-gray-700">{meta?.projectName || "—"}</span>
            </div>
            <div className="text-[15px] md:text-lg">
              <span className="font-extrabold text-gray-800">Thème :</span>{" "}
              <span className="font-semibold text-gray-700">{meta?.themeName || "—"}</span>
            </div>
            <div className="ml-auto">
              <button
                className="text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50"
                onClick={() => setShowMetaModal(true)}
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grille 2×2 */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {(
            [
              ["acquis", QUADRANTS.acquis],
              ["faiblesses", QUADRANTS.faiblesses],
              ["opportunites", QUADRANTS.opportunites],
              ["menaces", QUADRANTS.menaces],
            ] as [QuadrantKey, any][]
          ).map(([key, info]) => (
            <section key={key} className="min-h-[36vh]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide" />
                <div className="flex items-center gap-2">
                  <button
                    title="Créer une étiquette"
                    onClick={() => addPostIt(key)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white hover:bg-gray-50 shadow text-base font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

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
                onToggleExpand={() => setExpanded(expanded === key ? null : key)}
              />
            </section>
          ))}
        </div>

        {/* Panier */}
        <div className="mt-8">
          <BinPanel />
        </div>
      </main>

      {/* Bouton flottant QR */}
      <button
        onClick={() => setShowQR(true)}
        title="Afficher le QR code participant"
        className="fixed bottom-6 right-6 z-[90] h-12 w-12 rounded-full shadow-lg border bg-white hover:bg-gray-50 text-[18px] font-bold"
        aria-label="QR code"
      >
        QR
      </button>

      {/* QR Modal */}
      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
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
