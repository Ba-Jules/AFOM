import React, { useEffect, useState } from "react";
import PresentationMode from "./components/PresentationMode";
import WorkInterface from "./components/WorkInterface";
import ParticipantInterface from "./components/ParticipantInterface";
import AnalysisMode from "./components/AnalysisMode";
import MatrixMode from "./components/MatrixMode"; // <- nouveau

type View = "presentation" | "work" | "participant" | "analysis" | "matrix";

const App: React.FC = () => {
  const [view, setView] = useState<View>("presentation");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Lis l’URL au démarrage
  useEffect(() => {
    const url = new URL(window.location.href);
    const v = (url.searchParams.get("v") || "").toLowerCase() as View;
    const mode = url.searchParams.get("mode");
    const s =
      url.searchParams.get("session") ||
      localStorage.getItem("sessionId") ||
      null;

    // Mode participant prioritaire si demandé explicitement
    if (mode === "participant" && s) {
      setSessionId(s);
      setView("participant");
      return;
    }

    // Route directe par ?v=
    if (v === "work" || v === "analysis" || v === "matrix") {
      if (s) {
        setSessionId(s);
        setView(v);
        return;
      }
    }

    // Sinon, on prépare une session par défaut et on affiche la présentation
    const gen =
      "SESSION-" +
      new Date().getFullYear() +
      "-" +
      String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    setSessionId(s || gen);
    setView("presentation");
  }, []);

  const handleLaunchSession = (newSessionId: string) => {
    setSessionId(newSessionId);
    // on “passe” en mode work
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

  // Affichage
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
      return sessionId ? (
        <div className="min-h-screen bg-gray-50">
          <AnalysisMode sessionId={sessionId} />
        </div>
      ) : (
        <div>Loading…</div>
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
