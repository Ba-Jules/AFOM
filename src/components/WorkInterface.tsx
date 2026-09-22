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
import UserBadge from "./UserBadge";

import { PostIt, QuadrantKey, BoardMeta, AppUser } from "../types";
import { QUADRANTS } from "../constants";
import { PreferenceControls, quadrantSubtitle, quadrantTitle, usePreferences } from "../i18n";

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
    textColor: "text-blue-700",
    borderColor: "border-blue-400",
    bgColor: "bg-blue-50",
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
  onNavigate?: (view: "analysis" | "matrix") => void;
  workshopId?: string;
  groupId?: string;
  user: AppUser;
}

const WorkInterface: React.FC<WorkInterfaceProps> = ({
  sessionId,
  onBackToPresentation,
  onNavigate,
  workshopId,
  groupId,
  user,
}) => {
  const { t, lang } = usePreferences();
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [expanded, setExpanded] = useState<QuadrantKey | null>(null);

  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");
  const [metaModalTouched, setMetaModalTouched] = useState(false);
  const [savingModalMeta, setSavingModalMeta] = useState(false);

  const [showQR, setShowQR] = useState(false);
  const [workshopTitle, setWorkshopTitle] = useState("");
  const [groupName, setGroupName] = useState("");

  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(
      sessionId
    )}`;
  }, [sessionId]);

  useEffect(() => {
    if (!workshopId || !groupId) return;
    Promise.all([
      getDoc(fsDoc(db, "workshops", workshopId)),
      getDoc(fsDoc(db, "workshops", workshopId, "groups", groupId)),
    ]).then(([workshopSnap, groupSnap]) => {
      if (workshopSnap.exists()) setWorkshopTitle(String(workshopSnap.data().title || ""));
      if (groupSnap.exists()) {
        const data = groupSnap.data();
        setGroupName(String(data.name || data.number || ""));
        setMeta(current => ({ ...current, projectName: String(data.name || data.number || current?.projectName || ""), themeName: String(data.theme || current?.themeName || "") }));
      }
    }).catch(error => console.error("Unable to load workshop/group", error));
  }, [workshopId, groupId]);

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
      onBackToPresentation();
      return;
    }
    if (onNavigate) {
      window.history.replaceState({}, "", `${origin}${pathname}?v=${v}&session=${encodeURIComponent(sessionId)}`);
      onNavigate(v);
    } else {
      window.location.href = `${origin}${pathname}?v=${v}&session=${encodeURIComponent(sessionId)}`;
    }
  };

  const clearSession = async () => {
    if (!confirm(t("workInterface.clearSessionConfirm"))) return;
    const q = query(collection(db, "postits"), where("sessionId", "==", sessionId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    alert(t("workInterface.clearSessionDone"));
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
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-white shadow text-base">
              🚀
            </span>
            <div className="leading-tight hidden xs:block sm:block">
              <div className="text-sm font-semibold text-gray-700">{t("workInterface.appName")}</div>
              <div className="text-[11px] text-gray-600 hidden sm:block">{t("workInterface.tagline")}</div>
            </div>
          </div>

          <PreferenceControls className="hidden sm:inline-flex" />
          <UserBadge user={user} className="hidden sm:flex text-gray-600 flex-shrink-0" />

          {/* Nav — scrollable horizontalement sur mobile */}
          <nav
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 justify-end"
            style={{ scrollbarWidth: "none" }}
          >
            {workshopId && <button className="px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm bg-indigo-700 text-white font-medium whitespace-nowrap" onClick={() => window.location.href = `${window.location.pathname}?v=workshop&workshop=${encodeURIComponent(workshopId)}`}>{t("workInterface.workshopNav")}</button>}
            <button
              className="px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm bg-white shadow-sm border font-medium whitespace-nowrap flex-shrink-0"
              onClick={() => goto("analysis")}
            >
              {t("workInterface.analysisNav")}
            </button>
            <button
              className="px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm bg-white shadow-sm border font-medium whitespace-nowrap flex-shrink-0"
              onClick={() => goto("matrix")}
            >
              {t("workInterface.matrixNav")}
            </button>
            <button
              className="px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm bg-white shadow-sm border font-medium whitespace-nowrap flex-shrink-0"
              onClick={() => setShowQR(true)}
            >
              <span className="sm:hidden">{t("workInterface.qrCodeShort")}</span>
              <span className="hidden sm:inline">{t("workInterface.qrCodeNav")}</span>
            </button>
            <button
              className="px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm bg-white shadow-sm border font-medium whitespace-nowrap flex-shrink-0 text-red-600 border-red-200 hover:bg-red-50"
              onClick={clearSession}
            >
              <span className="sm:hidden">{t("workInterface.deleteShort")}</span>
              <span className="hidden sm:inline">{t("workInterface.deleteNav")}</span>
            </button>
            <button
              className="px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm bg-white shadow-sm border font-medium whitespace-nowrap flex-shrink-0"
              onClick={() => goto("presentation")}
            >
              <span className="sm:hidden">{t("workInterface.homeShort")}</span>
              <span className="hidden sm:inline">{t("workInterface.homeNav")}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Sous-bandeau Projet/Thème */}
      <div className="mx-auto max-w-7xl px-4 pt-3">
        {workshopTitle && <div className="mb-2 text-sm font-bold uppercase tracking-wide text-indigo-700">{workshopTitle}{groupName ? ` — ${groupName}` : ""}</div>}
        <div className="rounded-lg border bg-white shadow-sm px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
            <div className="text-[15px] md:text-lg">
              <span className="font-extrabold text-gray-800">{t("workInterface.projectLabel")}</span>{" "}
              <span className="font-semibold text-gray-700">{meta?.projectName || "—"}</span>
            </div>
            <div className="text-[15px] md:text-lg">
              <span className="font-extrabold text-gray-800">{t("workInterface.themeLabel")}</span>{" "}
              <span className="font-semibold text-gray-700">{meta?.themeName || "—"}</span>
            </div>
            <div className="ml-auto">
              <button
                className="text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50"
                onClick={() => { setMetaModalTouched(false); setShowMetaModal(true); }}
              >
                {t("workInterface.edit")}
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
              // ✅ Ordre corrigé : Acquis (HG), Opportunités (HD), Faiblesses (BG), Menaces (BD)
              ["acquis",       QUADRANTS.acquis],
              ["opportunites", QUADRANTS.opportunites],
              ["faiblesses",   QUADRANTS.faiblesses],
              ["menaces",      QUADRANTS.menaces],
            ] as [QuadrantKey, any][]
          ).map(([key, info]) => (
            <section key={key} className="min-h-[36vh]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide" />
                <div className="flex items-center gap-2">
                  <button
                    title={t("workInterface.createLabelTitle")}
                    onClick={() => addPostIt(key)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white hover:bg-gray-50 shadow text-base font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <Quadrant
                info={{
                  title: quadrantTitle(lang, key),
                  subtitle: quadrantSubtitle(lang, key),
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
        title={t("workInterface.qrFabTitle")}
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
        workshopId={workshopId}
        groupId={groupId}
        workshopTitle={workshopTitle}
        groupName={groupName}
        groupTheme={meta?.themeName}
      />

      {/* Modal Projet/Thème */}
      {!showMetaModal ? null : (
        <div className="fixed inset-0 bg-black/30 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="font-bold">{t("workInterface.defineTitle")}</h4>
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
                  {t("workInterface.projectNameLabel")}
                </label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder={t("workInterface.projectNamePlaceholder")}
                />
                {metaModalTouched && !projectName.trim() && (
                  <p className="mt-1 text-xs text-red-600">{t("workInterface.projectRequired")}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">
                  {t("workInterface.sessionThemeLabel")}
                </label>
                <input
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder={t("workInterface.themePlaceholder")}
                />
                {metaModalTouched && !themeName.trim() && (
                  <p className="mt-1 text-xs text-red-600">{t("workInterface.themeRequired")}</p>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setShowMetaModal(false)}
                className="px-4 py-2 rounded-md border hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  setMetaModalTouched(true);
                  if (!projectName.trim() || !themeName.trim() || savingModalMeta) return;
                  setSavingModalMeta(true);
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
                    alert(t("workInterface.saveMetaFailed"));
                  } finally {
                    setSavingModalMeta(false);
                  }
                }}
                disabled={savingModalMeta}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingModalMeta ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkInterface;
