import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QRCodeCanvas } from "qrcode.react";

type Slide = { id: string; render: () => React.ReactNode };

interface Props {
  onLaunchSession: (sessionId: string) => void;
  initialSessionId: string;
}

/** ---- Helpers UI ------------------------------------------------------- */
function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-block w-2.5 h-2.5 rounded-full mx-1",
        active ? "bg-indigo-600" : "bg-gray-300",
      ].join(" ")}
    />
  );
}

const BASE_W = 1280;
const BASE_H = 820;

/** Un conteneur “scalable” qui fait tenir le contenu dans l’écran sans scroll */
function FitToScreen({
  children,
  bottomReserve = 96, // réserve pour la barre de navigation
}: {
  children: React.ReactNode;
  bottomReserve?: number;
}) {
  const [scale, setScale] = useState(1);

  const compute = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - bottomReserve;
    const s = Math.min((vw - 24) / BASE_W, (vh - 24) / BASE_H);
    // bornes “safe” : pas minuscule, pas trop gros
    setScale(Math.max(0.6, Math.min(1.15, s)));
  }, [bottomReserve]);

  useLayoutEffect(() => {
    compute();
    const on = () => compute();
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, [compute]);

  return (
    <div className="w-full min-h-[calc(100vh-96px)] flex items-center justify-center">
      <div
        className="origin-center"
        style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** Pastille + ou – bien visible */
function Pill({ sign }: { sign: "+" | "-" }) {
  return (
    <div className="w-14 h-14 rounded-full bg-white text-black shadow-xl border-2 border-black flex items-center justify-center">
      <span className="text-3xl font-black leading-none">{sign}</span>
    </div>
  );
}

/** ---- Slide 2 : “La logique des deux axes” (fidèle au schéma) --------- */
function MatrixSlide() {
  return (
    <FitToScreen>
      <div
        className="relative rounded-[24px] shadow-2xl overflow-hidden"
        style={{ width: BASE_W, height: BASE_H, background: "#0a0a0a" }}
      >
        {/* Titre - descendu de 0.5cm */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[-1px] text-white text-[48px] font-extrabold tracking-tight whitespace-nowrap">
          Composantes de l'outil AFOM
        </div>

        {/* Étiquettes Interne / Externe - repositionnées plus haut */}
        <div className="absolute top-[70px] left-[120px]">
          <div className="px-6 py-2 rounded-xl bg-[#c6ff7f] text-[#0a0a0a] font-extrabold text-xl border-4 border-[#2e7d32]">
            Interne
          </div>
        </div>
        <div className="absolute top-[70px] right-[120px]">
          <div className="px-6 py-2 rounded-xl bg-[#c6ff7f] text-[#0a0a0a] font-extrabold text-xl border-4 border-[#2e7d32]">
            Externe
          </div>
        </div>

        {/* Étiquettes V. rétrospective / V. prospective - repositionnées plus bas */}
        <div className="absolute top-[110px] left-[200px]">
          <div className="px-4 py-1 rounded-xl bg-[#ffd54f] text-[#0a0a0a] font-extrabold text-lg border-4 border-[#ff8f00] whitespace-nowrap">
            V. rétrospective
          </div>
        </div>
        <div className="absolute top-[110px] right-[200px]">
          <div className="px-4 py-1 rounded-xl bg-[#ffd54f] text-[#0a0a0a] font-extrabold text-lg border-4 border-[#ff8f00] whitespace-nowrap">
            V. prospective
          </div>
        </div>

        {/* Axe du jugement (rouge vertical) - plus épais */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[160px] h-[520px] w-[48px] bg-[#d50000] border-6 border-black rounded-md" />
        
        {/* Flèche verticale vers le haut intégrée */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[156px]">
          <div className="w-0 h-0 border-b-[20px] border-b-[#d50000] border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-4 border-black"></div>
        </div>
        
        {/* Pastille + en haut - remonté d'1cm */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[98px]">
          <Pill sign="+" />
        </div>
        
        {/* Pastille - en bas - descendu d'1cm */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[738px]">
          <Pill sign="-" />
        </div>
        
        {/* Label "Axe du jugement" - remonté d'1cm sur l'axe vertical */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[302px] -rotate-90 z-10">
          <div className="text-white font-black text-lg bg-[#d50000] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Axe du jugement
          </div>
        </div>

        {/* Axe du temps (jaune horizontal) - plus épais et visible */}
        <div className="absolute left-[64px] right-[64px] top-[420px] h-[48px] bg-[#ffea00] border-6 border-black rounded-md" />
        
        {/* Flèche horizontale intégrée dans l'axe */}
        <div className="absolute right-[60px] top-[444px] -translate-y-1/2">
          <div className="w-0 h-0 border-l-[20px] border-l-[#ffea00] border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-4 border-black"></div>
        </div>
        
        {/* Label "Passé" - VISIBLE sur l'axe */}
        <div className="absolute left-[90px] top-[444px] -translate-y-1/2 z-10">
          <div className="text-black font-black text-xl bg-[#ffea00] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Passé
          </div>
        </div>
        
        {/* Label "Axe du temps" - positionné pile au milieu entre Passé et Futur */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[444px] -translate-y-1/2 z-10">
          <div className="text-black font-black text-lg bg-[#ffea00] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Axe du temps
          </div>
        </div>
        
        {/* Label "Futur" - VISIBLE sur l'axe */}
        <div className="absolute right-[90px] top-[444px] -translate-y-1/2 z-10">
          <div className="text-black font-black text-xl bg-[#ffea00] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Futur
          </div>
        </div>

        {/* Grille 2×2 des quadrants AFOM - ajustée */}
        <div className="absolute left-[64px] right-[64px] top-[180px] bottom-[100px] grid grid-cols-2 grid-rows-2">
          {/* A - Acquis (haut gauche) */}
          <div className="relative border-[6px] border-[#1b5e20] bg-[#52b788] p-8">
            <div className="absolute -top-4 -left-4 w-11 h-11 rounded-full bg-white text-black border-2 border-black flex items-center justify-center font-black text-2xl">
              A
            </div>
            <div className="text-white">
              <div className="text-3xl font-extrabold mb-2">A pour Acquis</div>
              <div className="text-lg font-semibold opacity-90 mb-3">
                Passé • Positif • Interne
              </div>
              <ul className="text-lg space-y-1">
                <li>• Forces / Succès</li>
                <li>• Réalisations désirées</li>
                <li>• Aspects positifs</li>
                <li>• Ce qu'on a aimé</li>
              </ul>
            </div>
          </div>

          {/* O - Opportunités (haut droit) */}
          <div className="relative border-[6px] border-[#004d40] bg-[#2ec4b6] p-8">
            <div className="absolute -top-4 -left-4 w-11 h-11 rounded-full bg-white text-black border-2 border-black flex items-center justify-center font-black text-2xl">
              O
            </div>
            <div className="text-white">
              <div className="text-3xl font-extrabold mb-2">O pour Opportunités</div>
              <div className="text-lg font-semibold opacity-90 mb-3">
                Futur • Positif • Externe
              </div>
              <ul className="text-lg space-y-1">
                <li>• Potentialités</li>
                <li>• Ressources exploitables</li>
                <li>• Atouts</li>
                <li>• Ce qu'on peut valoriser</li>
              </ul>
            </div>
          </div>

          {/* F - Faiblesses (bas gauche) */}
          <div className="relative border-[6px] border-[#b71c1c] bg-[#ef5350] p-8">
            <div className="absolute -top-4 -left-4 w-11 h-11 rounded-full bg-white text-black border-2 border-black flex items-center justify-center font-black text-2xl">
              F
            </div>
            <div className="text-white">
              <div className="text-3xl font-extrabold mb-2">F pour Faiblesses</div>
              <div className="text-lg font-semibold opacity-90 mb-3">
                Passé • Négatif • Interne
              </div>
              <ul className="text-lg space-y-1">
                <li>• Échecs</li>
                <li>• Aspects négatifs</li>
                <li>• Problèmes rencontrés</li>
                <li>• Ce qu'on n'a pas aimé</li>
              </ul>
            </div>
          </div>

          {/* M - Menaces (bas droit) */}
          <div className="relative border-[6px] border-[#e65100] bg-[#ff8a65] p-8">
            <div className="absolute -top-4 -left-4 w-11 h-11 rounded-full bg-white text-black border-2 border-black flex items-center justify-center font-black text-2xl">
              M
            </div>
            <div className="text-white">
              <div className="text-3xl font-extrabold mb-2">M pour Menaces</div>
              <div className="text-lg font-semibold opacity-90 mb-3">
                Futur • Négatif • Externe
              </div>
              <ul className="text-lg space-y-1">
                <li>• Risques</li>
                <li>• Obstacles</li>
                <li>• Craintes</li>
                <li>• Suppositions pouvant influencer négativement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </FitToScreen>
  );
}
/** ---- Composant principal ---------------------------------------------- */
const PresentationMode: React.FC<Props> = ({
  onLaunchSession,
  initialSessionId,
}) => {
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
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(
      sessionId || ""
    )}`;
  }, [sessionId]);

  /** Slides */
  const slides: Slide[] = useMemo(
    () => [
      {
        id: "hero",
        render: () => (
          <FitToScreen>
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900" />
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_20%_20%,#ffffff33_0,transparent_35%),radial-gradient(circle_at_80%_30%,#ffffff22_0,transparent_40%)]" />
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-8">
                <div className="inline-flex px-5 py-2 rounded-full bg-amber-500 text-white font-black shadow-2xl mb-6">
                  🚀 RÉVOLUTION ANALYTIQUE
                </div>
                <h1 className="text-7xl font-black bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent leading-tight drop-shadow">
                  AFOM
                </h1>
                <p className="mt-6 text-2xl text-white/90 max-w-3xl">
                  L’outil qui transforme vos{" "}
                  <span className="font-black">ateliers stratégiques</span> en{" "}
                  <span className="font-black">décisions concrètes</span>.
                </p>
                <p className="text-white/80 mt-2">
                  Acquis • Faiblesses • Opportunités • Menaces — Collaboration
                  temps réel + IA intégrée
                </p>
              </div>
            </div>
          </FitToScreen>
        ),
      },
      {
        id: "framework",
        render: () => <MatrixSlide />,
      },
      {
        id: "methodology",
        render: () => (
          <FitToScreen>
            <div className="w-full h-full px-10 py-8">
              <h2 className="text-5xl font-black text-gray-800 text-center mb-6">
                Workflow <span className="text-purple-600">révolutionnaire</span>
              </h2>
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-4">
                  {[
                    ["01", "Lancement Session", "Le modérateur partage le QR code"],
                    ["02", "Connexion Participants", "Scan → interface mobile optimisée"],
                    ["03", "Collecte Temps Réel", "Post-its synchronisés instantanément"],
                    ["04", "Organisation Dynamique", "Drag & drop + hiérarchisation"],
                    ["05", "Analyse IA", "Insights + recommandations actionnables"],
                    ["06", "Export", "Rapport PDF + données Excel"],
                  ].map(([step, title, desc]) => (
                    <div key={step} className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black flex items-center justify-center shadow">
                        {step}
                      </div>
                      <div>
                        <div className="font-black text-gray-900">{title}</div>
                        <div className="text-gray-600 text-sm">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="bg-white/60 rounded-xl p-4 border shadow-sm">
                    <div className="font-black">🧠 IA Stratégique</div>
                    <div className="text-sm text-gray-600">
                      Détection des déséquilibres, insights prédictifs, recommandations.
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4 border shadow-sm">
                    <div className="font-black">⚡ Temps réel</div>
                    <div className="text-sm text-gray-600">
                      Firebase : modifications instantanées, participation globale.
                    </div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4 border shadow-sm">
                    <div className="font-black">📊 Analytics</div>
                    <div className="text-sm text-gray-600">
                      Métriques d’engagement, timeline, scores.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FitToScreen>
        ),
      },
      {
        id: "launch",
        render: () => (
          <FitToScreen>
            <div className="w-full h-full px-10 py-8 grid grid-cols-2 gap-10 items-center">
              {/* QR */}
              <div className="order-2 md:order-1 bg-white/80 rounded-3xl p-8 shadow-xl border">
                <div className="text-2xl font-black mb-6">📱 Connexion instantanée</div>
                <div className="flex items-center justify-center mb-6">
                  <div className="p-4 rounded-2xl bg-gray-50 border">
                    <QRCodeCanvas value={participantUrl} size={220} />
                  </div>
                </div>
                <div className="text-xs font-mono break-all bg-gray-100 p-2 rounded mb-3">
                  {participantUrl}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(participantUrl, "_blank")}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    🌐 Ouvrir
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(participantUrl);
                      alert("Lien copié !");
                    }}
                    className="px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
                  >
                    📋 Copier
                  </button>
                </div>
              </div>

              {/* Config */}
              <div className="order-1 md:order-2 bg-white/80 rounded-3xl p-8 shadow-xl border">
                <div className="text-2xl font-black mb-6">⚙️ Configuration Session</div>
                <label className="block text-sm font-black text-gray-700 mb-2">
                  🔑 ID de Session
                </label>
                <input
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300 font-mono"
                  placeholder="SESSION-2025-XXX"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => onLaunchSession(sessionId || "")}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black rounded-xl shadow hover:scale-[1.02] transition"
                  >
                    🚀 Lancer la session
                  </button>
                  <button
                    onClick={() => {
                      const ns =
                        "SESSION-" +
                        new Date().getFullYear() +
                        "-" +
                        String(Math.floor(Math.random() * 1000)).padStart(3, "0");
                      setSessionId(ns);
                    }}
                    className="px-4 py-3 border-2 border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-semibold"
                  >
                    🔄 Nouveau ID
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                    className="w-full py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50"
                  >
                    📖 Revoir formation (remonter en haut)
                  </button>
                </div>
              </div>
            </div>
          </FitToScreen>
        ),
      },
    ],
    [participantUrl, sessionId, onLaunchSession]
  );

  /** Navigation (bottom-centered) */
  const [index, setIndex] = useState(0);
  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(slides.length - 1, i)),
    [slides.length]
  );
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onLaunchSession(sessionId || "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onLaunchSession, sessionId]);

  const current = slides[index];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* SLIDE */}
      {current.render()}

      {/* NAVIGATION BAS */}
      <div className="fixed bottom-0 left-0 right-0 pb-4">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl border rounded-2xl shadow-lg px-4 py-2">
            <button
              onClick={prev}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
              disabled={index === 0}
            >
              ← Précédent
            </button>

            <div className="flex items-center">
              {slides.map((s, i) => (
                <Dot key={s.id} active={i === index} />
              ))}
            </div>

            <button
              onClick={next}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={index === slides.length - 1}
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
