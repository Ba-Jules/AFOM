import React, { useEffect, useMemo, useState } from "react";
import { collection, doc as fsDoc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db } from "../services/firebase";
import Quadrant from "./Quadrant";
import BinPanel from "./BinPanel";
import { PostIt, QuadrantKey, BoardMeta } from "../types";
import { QUADRANTS } from "../constants"; // suppose {acquis:{...},...} existe comme avant

function resolveSessionId(): string | null {
  const url = new URL(window.location.href);
  const s = url.searchParams.get("session") || url.searchParams.get("board");
  return s || localStorage.getItem("sessionId") || localStorage.getItem("boardId") || null;
}

const WorkInterface: React.FC = () => {
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);

  // Meta Projet/Thème
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  const sessionId = useMemo(resolveSessionId, []);

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
        const m = s.data() as BoardMeta;
        setMeta(m);
      } else {
        setShowMetaModal(true);
      }
    })();
  }, [sessionId]);

  const byQuadrant = useMemo(() => {
    const res: Record<QuadrantKey, PostIt[]> = {
      acquis: [], faiblesses: [], opportunites: [], menaces: [],
    };
    for (const p of postIts) {
      if (p.status === "bin") continue; // pas dans les 4 cadrans
      res[p.quadrant].push(p);
    }
    return res;
  }, [postIts]);

  if (!sessionId) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Session introuvable</h2>
        <p>Ouvrez l’atelier via un lien ou un QR contenant <code>?session=...</code>.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Barre haute projet/thème */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <div><span className="font-semibold">Projet :</span> {meta?.projectName || "—"}</div>
          <div><span className="font-semibold">Thème :</span> {meta?.themeName || "—"}</div>
        </div>
        <button
          onClick={() => setShowMetaModal(true)}
          className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-sm"
        >
          {meta ? "Modifier Projet/Thème" : "Définir Projet/Thème"}
        </button>
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
              onToggleExpand={() => setExpanded(expanded === key ? null : key)}
            />
          </div>
        ))}
      </div>

      {/* 5e cadran : Panier */}
      <BinPanel />

      {/* Modal Projet/Thème */}
      {!showMetaModal ? null : (
        <div className="fixed inset-0 bg-black/30 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="font-bold">Définir Projet & Thème</h4>
              <button onClick={() => setShowMetaModal(false)} className="w-8 h-8 rounded-md border hover:bg-gray-100">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-600">Nom du projet</label>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Ex : Transformation 2025" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Thème de la session</label>
                <input value={themeName} onChange={(e) => setThemeName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Ex : Offre digitale PME" />
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button onClick={() => setShowMetaModal(false)} className="px-4 py-2 rounded-md border hover:bg-gray-50">Annuler</button>
              <button
                onClick={async () => {
                  if (!projectName.trim() || !themeName.trim()) { alert("Merci de renseigner Projet et Thème."); return; }
                  try {
                    await setDoc(fsDoc(db, "boards", sessionId), {
                      projectName: projectName.trim(),
                      themeName: themeName.trim(),
                      updatedAt: new Date(),
                      createdAt: meta?.createdAt || new Date(),
                    } as BoardMeta, { merge: true });
                    setMeta({ projectName: projectName.trim(), themeName: themeName.trim() });
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
