import React, { useEffect, useState } from "react";
import PresentationMode from "./components/PresentationMode";
import WorkInterface from "./components/WorkInterface";
import ParticipantInterface from "./components/ParticipantInterface";
import AnalysisMode from "./components/AnalysisMode";
import MatrixMode from "./components/MatrixMode";
import WorkshopDashboard from "./components/WorkshopDashboard";
import ConsolidatedAFOM from "./components/ConsolidatedAFOM";
import LoginScreen from "./components/LoginScreen";

// 🔥 on récupère les Post-its ici pour les passer à AnalysisMode
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./services/firebase";
import { useAuth } from "./hooks/useAuth";
import { PostIt, WorkshopGroup } from "./types";

type View = "presentation" | "work" | "participant" | "analysis" | "matrix" | "workshop" | "consolidation";

const PROTECTED_VIEWS: View[] = ["work", "analysis", "matrix", "workshop", "consolidation"];

const App: React.FC = () => {
  const [view, setView] = useState<View>("presentation");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const { appUser, loading: authLoading } = useAuth();

  // Post-its pour AnalysisMode
  const [analysisPostIts, setAnalysisPostIts] = useState<PostIt[]>([]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const v = (url.searchParams.get("v") || "").toLowerCase() as View;
    const mode = url.searchParams.get("mode");
    const workshop = url.searchParams.get("workshop");
    const group = url.searchParams.get("group");
    setWorkshopId(workshop);
    setGroupId(group);
    const s =
      url.searchParams.get("session") || localStorage.getItem("sessionId");

    if (mode === "participant" && s) {
      setSessionId(s);
      setView("participant");
      return;
    }

    if (v === "workshop" && workshop) { setView("workshop"); return; }
    if (v === "workshop") { setView("workshop"); return; }
    if (v === "consolidation" && workshop) { setView("consolidation"); return; }

    if ((v === "work" || v === "analysis" || v === "matrix") && s) {
      setSessionId(s);
      setView(v);
      return;
    }

    const gen =
      "SESSION-" +
      new Date().getFullYear() +
      "-" +
      String(Math.floor(Math.random() * 1000)).padStart(3, "0");

    setSessionId(s || gen);
    setView("presentation");
  }, []);

  // 🔗 Abonnement Firestore pour alimenter AnalysisMode
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem("sessionId", sessionId);

    const unsub = onSnapshot(
      query(collection(db, "postits"), where("sessionId", "==", sessionId)),
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PostIt[];
        setAnalysisPostIts(arr);
      }
    );
    return () => unsub();
  }, [sessionId]);

  const handleLaunchSession = (newSessionId: string) => {
    setSessionId(newSessionId);
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}?v=work&session=${encodeURIComponent(
      newSessionId
    )}`;
    window.history.replaceState({}, "", url);
    setView("work");
  };

  const handleBackToPresentation = () => {
    const { origin, pathname } = window.location;
    window.history.replaceState({}, "", `${origin}${pathname}`);
    setView("presentation");
  };

  const returnToActiveGroup = () => {
    if (!sessionId || !workshopId || !groupId) return;
    const { origin, pathname } = window.location;
    window.history.replaceState(
      {},
      "",
      `${origin}${pathname}?v=work&session=${encodeURIComponent(sessionId)}&workshop=${encodeURIComponent(workshopId)}&group=${encodeURIComponent(groupId)}`
    );
    setView("work");
  };

  const openWorkshop = () => {
    window.history.replaceState({}, "", `${window.location.pathname}?v=workshop`);
    setWorkshopId(null);
    setView("workshop");
  };

  const selectWorkshop = (id: string) => {
    setWorkshopId(id);
    window.history.replaceState({}, "", `${window.location.pathname}?v=workshop&workshop=${encodeURIComponent(id)}`);
  };

  const openGroup = (group: WorkshopGroup) => {
    setSessionId(group.sessionId); setWorkshopId(group.workshopId); setGroupId(group.id);
    window.history.replaceState({}, "", `${window.location.pathname}?v=work&session=${encodeURIComponent(group.sessionId)}&workshop=${encodeURIComponent(group.workshopId)}&group=${encodeURIComponent(group.id)}`);
    setView("work");
  };

  // Protection des écrans de gestion : une URL directe ne doit pas contourner la connexion
  if (PROTECTED_VIEWS.includes(view)) {
    if (authLoading) {
      return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Chargement…</div>;
    }
    if (!appUser) {
      return <LoginScreen onCancel={handleBackToPresentation} />;
    }
  }

  // Rendu par vue
  switch (view) {
    case "presentation":
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans">
          <PresentationMode
            onLaunchSession={handleLaunchSession}
            onPrepareWorkshop={openWorkshop}
            initialSessionId={sessionId || ""}
            onBackToWork={sessionId && workshopId && groupId ? returnToActiveGroup : undefined}
          />
        </div>
      );

    case "work":
      return sessionId ? (
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 font-sans">
          <WorkInterface
            sessionId={sessionId}
            onBackToPresentation={handleBackToPresentation}
            onNavigate={(v) => setView(v)}
            workshopId={workshopId || undefined}
            groupId={groupId || undefined}
            user={appUser!}
          />
        </div>
      ) : (
        <div>Loading…</div>
      );

    case "analysis":
      return (
        <div className="min-h-screen bg-gray-50">
          <AnalysisMode postIts={analysisPostIts} onBack={() => setView("work")} />
        </div>
      );

    case "matrix":
      return sessionId ? (
        <div className="min-h-screen bg-gray-50">
          <MatrixMode sessionId={sessionId} onBack={() => setView("work")} />
        </div>
      ) : (
        <div>Loading…</div>
      );

    case "participant":
      return sessionId ? (
        <div className="min-h-screen bg-white">
          <ParticipantInterface sessionId={sessionId} workshopId={workshopId || undefined} groupId={groupId || undefined} />
        </div>
      ) : (
        <div>Invalid session ID.</div>
      );

    case "workshop":
      return <WorkshopDashboard workshopId={workshopId || undefined} onOpenSession={openGroup} onSelectWorkshop={selectWorkshop} onConsolidate={(id) => { setWorkshopId(id); window.history.replaceState({}, "", `${window.location.pathname}?v=consolidation&workshop=${encodeURIComponent(id)}`); setView("consolidation"); }} onBack={handleBackToPresentation} user={appUser!} />;

    case "consolidation":
      return workshopId ? <ConsolidatedAFOM workshopId={workshopId} onBack={() => { window.history.replaceState({}, "", `${window.location.pathname}?v=workshop&workshop=${encodeURIComponent(workshopId)}`); setView("workshop"); }} user={appUser!} /> : <div>Atelier introuvable.</div>;
  }
};

export default App;
