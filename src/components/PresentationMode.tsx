import React, { useEffect, useMemo, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react"; // ✅ v4: import nommé

type Slide = {
  id: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  color?: string; // accent (tailwind) pour la bordure/étiquette
  body?: React.ReactNode;
};

interface Props {
  onLaunchSession: (sessionId: string) => void;
  initialSessionId: string;
}

const accent = {
  acquis: "text-green-700 border-green-300",
  faiblesses: "text-red-700 border-red-300",
  opportunites: "text-emerald-700 border-emerald-300",
  menaces: "text-rose-700 border-rose-300",
};

const PresentationMode: React.FC<Props> = ({ onLaunchSession, initialSessionId }) => {
  // Session
  const [sessionId, setSessionId] = useState<string>(initialSessionId || "");
  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(() => {
    if (sessionId) localStorage.setItem("sessionId", sessionId);
  }, [sessionId]);

  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(sessionId || "")}`;
  }, [sessionId]);

  // Slides
  const slides: Slide[] = useMemo(
    () => [
      {
        id: "intro",
        kicker: "AFOM Ultimate",
        title: "L’outil qui transforme vos ateliers en décisions",
        subtitle:
          "Collecter, structurer, analyser et décider – en une seule expérience, fluide et collaborative.",
        body: (
          <div className="grid gap-6 md:grid-cols-3 mt-6">
            {[
              { emoji: "🧠", label: "Compréhension", text: "Un langage commun & sans ambiguïté." },
              { emoji: "🤝", label: "Collaboration", text: "Tous contributeurs, synchronisés & sereins." },
              { emoji: "🚀", label: "Décision", text: "Des priorités claires & des actions concrètes." },
            ].map((b, i) => (
              <div key={i} className="rounded-xl bg-white/70 backdrop-blur border border-gray-200 p-4 shadow-sm">
                <div className="text-3xl">{b.emoji}</div>
                <div className="mt-2 font-semibold">{b.label}</div>
                <div className="text-sm text-gray-600">{b.text}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "axes",
        kicker: "Le Cadre",
        title: "AFOM : axes & logique d’analyse",
        subtitle:
          "Deux axes structurants : Temps (passé ↔ futur) & Jugement (+ ↔ −). Interne vs Externe.",
        body: (
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <div className="rounded-xl bg-white/70 border p-4">
              <div className="text-sm text-gray-600">
                Interne (≃ responsabilité de l’équipe) : <b>Acquis</b> & <b>Faiblesses</b>. Externe (environnement) :
                <b> Opportunités</b> & <b>Menaces</b>. Axe vertical : <b>+ / −</b>. Axe horizontal : <b>passé / futur</b>.
              </div>
              <div className="mt-4 grid grid-cols-2 grid-rows-2 gap-3">
                <div className="rounded-lg border-2 border-green-300 p-3">
                  <div className="font-semibold text-green-700">A — Acquis</div>
                  <div className="text-xs text-gray-600">Passé positif • Interne</div>
                </div>
                <div className="rounded-lg border-2 border-emerald-300 p-3">
                  <div className="font-semibold text-emerald-700">O — Opportunités</div>
                  <div className="text-xs text-gray-600">Futur positif • Externe</div>
                </div>
                <div className="rounded-lg border-2 border-red-300 p-3">
                  <div className="font-semibold text-red-700">F — Faiblesses</div>
                  <div className="text-xs text-gray-600">Passé négatif • Interne</div>
                </div>
                <div className="rounded-lg border-2 border-rose-300 p-3">
                  <div className="font-semibold text-rose-700">M — Menaces</div>
                  <div className="text-xs text-gray-600">Futur négatif • Externe</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                (Rappel : ne pas confondre <b>Acquis</b> avec <b>Opportunités</b>, ni <b>Faiblesses</b> avec <b>Menaces</b>.)
              </div>
            </div>
            <div className="rounded-xl bg-white/70 border p-4">
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• <b>Passé (Interne)</b> : ce qui a fonctionné / n’a pas fonctionné dans le projet.</li>
                <li>• <b>Futur (Externe)</b> : ce qui nous attend dehors (leviers & obstacles).</li>
                <li>• Une grille simple pour <b>voir clair</b>, décider vite et mieux prioriser.</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: "acquis",
        title: "A — Acquis",
        subtitle: "Forces • Succès • Réalisations positives • Ce qu’on a aimé",
        color: accent.acquis,
      },
      {
        id: "faiblesses",
        title: "F — Faiblesses",
        subtitle: "Échecs • Aspects négatifs • Difficultés • Ce qu’on n’a pas aimé",
        color: accent.faiblesses,
      },
      {
        id: "opportunites",
        title: "O — Opportunités",
        subtitle: "Potentialités • Ressources exploitables • Atouts à valoriser",
        color: accent.opportunites,
      },
      {
        id: "menaces",
        title: "M — Menaces",
        subtitle: "Risques • Obstacles • Craintes • Suppositions influençant le projet",
        color: accent.menaces,
      },
      {
        id: "flow",
        kicker: "Méthode",
        title: "Déroulé d’un atelier AFOM",
        subtitle: "Rôles, étapes, consignes – simple et efficace.",
        body: (
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <div className="rounded-xl bg-white/70 border p-4">
              <div className="font-semibold mb-2">Rôles</div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• <b>Modérateur</b> — cadence, règles & arbitrage.</li>
                <li>• <b>Rapporteur</b> — synthèse & restitution.</li>
                <li>• <b>Participants</b> — contributions, échanges, priorisation.</li>
              </ul>
              <div className="font-semibold mt-4 mb-2">Étapes</div>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Réflexion individuelle (post-its numériques).</li>
                <li>Partage & clustering par cadran.</li>
                <li>Hiérarchisation (↑/↓ & glisser-déposer).</li>
                <li>Analyse & recommandations.</li>
              </ol>
            </div>
            <div className="rounded-xl bg-white/70 border p-4">
              <div className="font-semibold mb-2">Règles du jeu</div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Une idée par post-it. Formulation courte & claire.</li>
                <li>• Bien placer : Interne vs Externe, Passé vs Futur.</li>
                <li>• Respect & écoute. On challenge les idées, pas les personnes.</li>
                <li>• On conclut par des <b>actions concrètes</b> & responsables.</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: "qr",
        kicker: "Connexion",
        title: "Inviter les participants",
        subtitle: "Scannez ou partagez le lien pour contribuer en direct.",
        body: (
          <div className="grid md:grid-cols-2 gap-6 mt-6 items-center">
            <div className="rounded-xl bg-white/70 border p-4 flex flex-col items-center justify-center">
              <QRCodeCanvas value={participantUrl} size={184} includeMargin />{/* ✅ */}
              <div className="mt-3 text-xs text-gray-600 break-all text-center">{participantUrl}</div>
              <div className="mt-3 flex gap-2">
                <button
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                  onClick={() => window.open(participantUrl, "_blank")}
                >
                  Ouvrir le lien participant
                </button>
                <button
                  className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(participantUrl);
                    alert("Lien copié !");
                  }}
                >
                  Copier
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-white/70 border p-4">
              <div className="font-semibold">ID de session</div>
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="mt-2 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="SESSION-AAAA-XYZ"
              />
              <p className="text-xs text-gray-600 mt-2">
                L’ID s’affiche aussi en haut à droite de l’interface de travail.
                Il est gardé pour toute la durée de l’atelier.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "start",
        kicker: "Prêt",
        title: "Lancer la session",
        subtitle: "Passez à l’interface de travail en un clic.",
        body: (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onLaunchSession(sessionId || "")}
              className="px-5 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow"
            >
              🚀 Lancer la session
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="px-4 py-3 rounded-lg border bg-white hover:bg-gray-50"
            >
              Revoir les slides
            </button>
          </div>
        ),
      },
    ],
    [participantUrl, sessionId, onLaunchSession]
  );

  // Navigation
  const [index, setIndex] = useState(0);
  const clamp = useCallback((i: number) => Math.max(0, Math.min(slides.length - 1, i)), [slides.length]);
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const s = slides[index];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100">
      {/* Top bar */}
      <div className="sticky top-0 z-50 backdrop-blur bg-white/60 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Mode Formation</span>
            <span className="mx-2">•</span>
            <span>Utilisez ← / → pour naviguer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-xs text-gray-500">Session :</div>
            <input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-[210px] rounded-md border px-2 py-1 text-sm"
              title="ID de session"
            />
            <button
              className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              onClick={() => onLaunchSession(sessionId || "")}
              title="Aller à l’interface de travail"
            >
              Ouvrir le board
            </button>
          </div>
        </div>
        {/* Progress */}
        <div className="h-1 bg-indigo-200">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${((index + 1) / slides.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Slide */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-xl p-6 md:p-10">
          {s.kicker && <div className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">{s.kicker}</div>}
          <h1 className="mt-2 text-2xl md:text-4xl font-extrabold leading-tight">{s.title}</h1>
          {s.subtitle && <p className="mt-2 text-gray-600 text-base md:text-lg">{s.subtitle}</p>}

          {/* Quadrant slides accent */}
          {s.color && (
            <div className={`mt-6 rounded-xl border-2 p-5 ${s.color}`}>
              <ul className="text-sm text-gray-700 leading-6">
                <li>
                  <span className="text-gray-600">
                    Positionnement : <b>Voir le slide “Axes & logique”</b> — Interne/Externe & Passé/Futur.
                  </span>
                </li>
                <li className="text-gray-600">Conseil : une idée par post-it. Soyez concrets & factuels.</li>
              </ul>
            </div>
          )}

          {/* Corps */}
          {s.body && <div className="mt-6">{s.body}</div>}

          {/* Nav bottom */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={prev}
              disabled={index === 0}
              className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              ← Précédent
            </button>
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Aller au slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${
                    i === index ? "bg-indigo-600 w-6" : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              disabled={index === slides.length - 1}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
