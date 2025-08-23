import React, { useEffect, useState } from "react";
import PresentationMode from "./components/PresentationMode";
import WorkInterface from "./components/WorkInterface";
import ParticipantInterface from "./components/ParticipantInterface";
import AnalysisMode from "./components/AnalysisMode";

// ---- Helpers ---------------------------------------------------------------

type View = "presentation" | "work" | "analysis" | "participant";

/** Détermine la vue depuis l’URL (compat avec l’ancien mode=participant). */
function resolveViewFromUrl(): View {
  const url = new URL(window.location.href);
  const v = (url.searchParams.get("v") || "").toLowerCase();
  const mode = (url.searchParams.get("mode") || "").toLowerCase();

  if (mode === "participant" || v === "participant") return "participant";
  if (v === "analysis") return "analysis";
  if (v === "drag2" || v === "work" || v === "collecte") return "work";
  // v=formation ou rien → slides
  return "presentation";
}

/** Récupère ou génère l’id de session, et le persiste. */
function resolveSessionId(): string {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("session");
  const fromStore = localStorage.getItem("sessionId");

  if (fromUrl) {
    localStorage.setItem("sessionId", fromUrl);
    return fromUrl;
  }
  if (fromStore) return fromStore;

  const gen =
    "SESSION-" +
    new Date().getFullYear() +
    "-" +
    String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  localStorage.setItem("sessionId", gen);
  return gen;
}

/** Met à jour l’URL (sans recharger) pour rester cohérent avec le bandeau. */
function pushUrl(next: Partial<{ v: string; session: string }>) {
  const url = new URL(window.location.href);
  if (next.v !== undefined) url.searchParams.set("v", next.v);
  if (next.session !== undefined) url.searchParams.set("session", next.session);
  window.history.replaceState(null, "", url.toString());
}

// ---- App -------------------------------------------------------------------

const App: React.FC = () => {
  const [view, setView] = useState<View>(() => resolveViewFromUrl());
  const [sessionId, setSessionId] = useState<string>(() => resolveSessionId());

  // Si l’utilisateur navigue (liens du bandeau), on relit l’URL au montage.
  // (Pour une SPA plus poussée on écouterait popstate, mais ici c’est suffisant.)
  useEffect(() => {
    setView(resolveViewFromUrl());
    setSessionId(resolveSessionId());
  }, []);

  // ----- Callbacks passés aux écrans -----

  const handleLaunchSession = (newSessionId: string) => {
    // depuis les slides → lancer la vue de travail avec la session donnée
    localStorage.setItem("sessionId", newSessionId);
    setSessionId(newSessionId);
    setView("work");
    pushUrl({ v: "drag2", session: newSessionId });
  };

  const handleBackToPresentation = () => {
    setView("presentation");
    pushUrl({ v: "formation" }); // cohérent avec tes liens
  };

  // ----- Rendu conditionnel -----

  let content: React.ReactNode = null;

  switch (view) {
    case "analysis":
      // Écran d’analyse (graphiques)
      content = <AnalysisMode />;
      break;

    case "work":
      // Cadran 2×2 + panier, avec session courante
      content = (
        <WorkInterface
          sessionId={sessionId}
          onBackToPresentation={handleBackToPresentation}
        />
      );
      break;

    case "participant":
      content = <ParticipantInterface sessionId={sessionId} />;
      break;

    case "presentation":
    default:
      // Slides de formation / démarrage d’atelier
      content = (
        <PresentationMode
          onLaunchSession={handleLaunchSession}
          initialSessionId={sessionId}
        />
      );
      break;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 font-sans">
      {content}
    </div>
  );
};

export default App;
