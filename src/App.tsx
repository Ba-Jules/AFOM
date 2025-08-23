// src/App.tsx
import React, { useEffect, useState } from "react";
import PresentationMode from "./components/PresentationMode";
import WorkInterface from "./components/WorkInterface";
import ParticipantInterface from "./components/ParticipantInterface";
import AnalysisMode from "./components/AnalysisMode";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./services/firebase";
import type { PostIt } from "./types";

type View = "presentation" | "work" | "analysis" | "participant";

/** Lit la vue depuis l’URL (compat avec l’ancien mode=participant). */
function resolveViewFromUrl(): View {
  const url = new URL(window.location.href);
  const v = (url.searchParams.get("v") || "").toLowerCase();
  const mode = (url.searchParams.get("mode") || "").toLowerCase();

  if (mode === "participant" || v === "participant") return "participant";
  if (v === "analysis") return "analysis";
  if (v === "drag2" || v === "work" || v === "collecte") return "work";
  // v=formation ou rien -> slides
  return "presentation";
}

/** Récupère ou crée un sessionId, et le persiste. */
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

/** Met à jour l’URL (sans reload) pour rester en phase avec la vue courante. */
function pushUrl(next: Partial<{ v: string; session: string }>) {
  const url = new URL(window.location.href);
  if (next.v !== undefined) url.searchParams.set("v", next.v);
  if (next.session !== undefined) url.searchParams.set("session", next.session);
  window.history.replaceState(null, "", url.toString());
}

const App: React.FC = () => {
  const [view, setView] = useState<View>(() => resolveViewFromUrl());
  const [sessionId, setSessionId] = useState<string>(() => resolveSessionId());

  // Flux de post-its pour l'AnalysisMode
  const [analysisPostIts, setAnalysisPostIts] = useState<PostIt[]>([]);

  // (Ré)initialise vue + session au montage
  useEffect(() => {
    setView(resolveViewFromUrl());
    setSessionId(resolveSessionId());
  }, []);

  // Abonnement Firestore sur la session courante (sert à AnalysisMode)
  useEffect(() => {
    if (!sessionId) return;
    const q = query(
      collection(db, "postits"),
      where("sessionId", "==", sessionId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PostIt[];
      setAnalysisPostIts(arr);
    });
    return () => unsub();
  }, [sessionId]);

  // Callbacks
  const handleLaunchSession = (newSessionId: string) => {
    localStorage.setItem("sessionId", newSessionId);
    setSessionId(newSessionId);
    setView("work");
    pushUrl({ v: "drag2", session: newSessionId });
  };

  const handleBackToPresentation = () => {
    setView("presentation");
    pushUrl({ v: "formation" });
  };

  // Rendu
  let content: React.ReactNode = null;

  switch (view) {
    case "analysis":
      content = <AnalysisMode postIts={analysisPostIts} />;
      break;

    case "work":
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
