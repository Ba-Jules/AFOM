import React, { useEffect, useState } from "react";
import PresentationMode from "./components/PresentationMode";
import WorkInterface from "./components/WorkInterface";
import ParticipantInterface from "./components/ParticipantInterface";
import AnalysisMode from "./components/AnalysisMode";
import MatrixMode from "./components/MatrixMode";

// 🔥 on récupère les Post-its ici pour les passer à AnalysisMode
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./services/firebase";
import { PostIt } from "./types";

type View = "presentation" | "work" | "participant" | "analysis" | "matrix";

const App: React.FC = () => {
  const [view, setView] = useState<View>("presentation");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Post-its pour AnalysisMode
  const [analysisPostIts, setAnalysisPostIts] = useState<PostIt[]>([]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const v = (url.searchParams.get("v") || "").toLowerCase() as View;
    const mode = url.searchParams.get("mode");
    const s =
      url.searchParams.get("session") || localStorage.getItem("sessionId");

    if (mode === "participant" && s) {
      setSessionId(s);
      setView("participant");
      return;
    }

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

  // Rendu par vue
  switch (view) {
    case "presentation":
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans">
          <PresentationMode
            onLaunchSession={handleLaunchSession}
            initialSessionId={sessionId || ""}
          />
        </div>
      );

    case "work":
      return sessionId ? (
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 font-sans">
          <WorkInterface
            sessionId={sessionId}
            onBackToPresentation={handleBackToPresentation}
          />
        </div>
      ) : (
        <div>Loading…</div>
      );

    case "analysis":
      // ✅ AnalysisMode veut des postIts (et non pas sessionId)
      return (
        <div className="min-h-screen bg-gray-50">
          <AnalysisMode postIts={analysisPostIts} />
        </div>
      );

    case "matrix":
      return sessionId ? (
        <div className="min-h-screen bg-gray-50">
          <MatrixMode sessionId={sessionId} />
        </div>
      ) : (
        <div>Loading…</div>
      );

    case "participant":
      return sessionId ? (
        <div className="min-h-screen bg-white">
          <ParticipantInterface sessionId={sessionId} />
        </div>
      ) : (
        <div>Invalid session ID.</div>
      );
  }
};

export default App;
