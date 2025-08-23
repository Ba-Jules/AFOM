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
import { PostIt, QuadrantKey, BoardMeta } from "../types";
import { QUADRANTS } from "../constants";

/** Récupère un sessionId depuis l’URL ou le localStorage */
function resolveSessionId(): string | null {
  const url = new URL(window.location.href);
  const s = url.searchParams.get("session") || url.searchParams.get("board");
  return s || localStorage.getItem("sessionId") || localStorage.getItem("boardId") || null;
}

/** Props que App.tsx peut passer (facultatives) */
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
        const arr = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as PostIt[];
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
        const m = s.data() as BoardMeta;
        setMeta(m);
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
      if ((p as any).status === "bin") continue; // pas dans les 4 cadrans
      res[p.quadrant].push(p);
    }
    return res;
  }, [postIts]);

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
    <div className="p-4">
      {/* Barre haute projet/thème + éventuel retour présentation */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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

        <div className="flex items-center gap-2">
          {onBackToPresentation && (
            <button
              onClick={onBackToPresentation}
              className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-sm"
              title="Retour à la présentation"
            >
              ↩︎ Présentation
            </button>
          )}
          <button
            onClick={() => setShowMetaModal(true)}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-sm"
          >
            {meta ? "Modifier Projet/Thème" : "Définir Projet/Thème"}
          </button>
        </div>
      </div>

      {/* Grille 2×2 habituelle */}
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

      {/* 5e cadran : Panier / À discuter */}
      <BinPanel />

      {/* Modal Projet/Thème */}
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
                    const now = new Date();
                    await setDoc(
                      fsDoc(db, "boards", sessionId),
                      {
                        projectName: projectName.trim(),
                        themeName: themeName.trim(),
                        updatedAt: now,
                        // si pas de createdAt en base, on le définit au premier enregistrement
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
    </div>
  );
};

export default WorkInterface;
