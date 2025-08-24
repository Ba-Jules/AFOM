import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QRCodeCanvas } from "qrcode.react"; // ✅ named export

type Slide = { id: string; render: () => React.ReactNode };

interface Props {
  onLaunchSession: (sessionId: string) => void;
  initialSessionId: string;
}

/** Frame that scales its content to fit the viewport (no scroll/zoom needed) */
const SlideFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const host = hostRef.current;
      const inner = innerRef.current;
      if (!host || !inner) return;
      // measure
      inner.style.transform = "scale(1)";
      const R = inner.getBoundingClientRect();
      const sw = Math.min(host.clientWidth / R.width, 1);
      const sh = Math.min(host.clientHeight / R.height, 1);
      const s = Math.min(sw, sh);
      setScale(s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (hostRef.current) ro.observe(hostRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  // Fixed design width gives a stable composition; we scale down to fit.
  return (
    <div
      ref={hostRef}
      className="relative w-full h-[calc(100vh-84px)] overflow-hidden flex items-start justify-center"
    >
      <div
        ref={innerRef}
        style={{
          width: 1200,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          transition: "transform .2s ease",
        }}
        className="px-8 pt-6 pb-10"
      >
        {children}
      </div>
    </div>
  );
};

const Badge: React.FC<{ children: React.ReactNode; color: string }> = ({
  children,
  color,
}) => (
  <span
    className={`inline-flex items-center px-3 py-1 rounded-full text-white text-[12px] font-black shadow ${color}`}
  >
    {children}
  </span>
);

const PresentationMode: React.FC<Props> = ({
  onLaunchSession,
  initialSessionId,
}) => {
  /* ---------------- Session ---------------- */
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

  /* ---------------- Slides ---------------- */
  const slides: Slide[] = useMemo(
    () => [
      // 1) HERO
      {
        id: "hero",
        render: () => (
          <SlideFrame>
            <div className="relative">
              <div className="text-center space-y-6">
                <Badge color="bg-gradient-to-r from-amber-500 to-orange-600">
                  🚀 RÉVOLUTION ANALYTIQUE
                </Badge>

                <h1
                  className="font-black leading-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
                  style={{ fontSize: "clamp(44px, 7vw, 96px)" }}
                >
                  AFOM
                </h1>

                <p
                  className="mx-auto max-w-3xl font-bold text-gray-700"
                  style={{ fontSize: "clamp(18px, 2.2vw, 28px)" }}
                >
                  L’outil qui transforme vos{" "}
                  <span className="text-indigo-600 font-extrabold">
                    ateliers stratégiques
                  </span>{" "}
                  en
                  <span className="text-purple-600 font-extrabold">
                    {" "}
                    décisions concrètes
                  </span>
                </p>

                <p className="text-gray-600">
                  Acquis • Faiblesses • Opportunités • Menaces —&nbsp;
                  <span className="font-semibold text-indigo-600">
                    Collaboration temps réel + IA
                  </span>
                </p>

                <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto mt-10">
                  {[
                    {
                      icon: "🧠",
                      title: "Intelligence Collective",
                      desc: "Un langage commun, structuré et sans ambiguïté",
                    },
                    {
                      icon: "⚡",
                      title: "Temps Réel",
                      desc: "Synchronisation instantanée des contributions",
                    },
                    {
                      icon: "🎯",
                      title: "Actionnable",
                      desc: "Insights et recommandations prêts à décider",
                    },
                  ].map((it) => (
                    <div
                      key={it.title}
                      className="bg-white/85 rounded-2xl p-6 shadow-xl border"
                    >
                      <div className="text-3xl">{it.icon}</div>
                      <div className="font-black text-gray-800 mt-2">
                        {it.title}
                      </div>
                      <div className="text-sm text-gray-600">{it.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SlideFrame>
        ),
      },

      // 2) FRAMEWORK — enriched & fully responsive, badges outside the matrix
      {
        id: "framework",
        render: () => (
          <SlideFrame>
            <div className="relative">
              <div className="text-center space-y-2 mb-4">
                <Badge color="bg-indigo-600">🏗️ CADRE CONCEPTUEL</Badge>
                <h2
                  className="font-black text-gray-800"
                  style={{ fontSize: "clamp(28px, 4.2vw, 56px)" }}
                >
                  La Logique des <span className="text-indigo-600">Deux Axes</span>
                </h2>
                <p className="text-gray-600">
                  Temps (Passé ↔ Futur) × Jugement (Positif ↔ Négatif) = Vision
                  stratégique complète
                </p>
              </div>

              {/* Positive/Negative badges OUTSIDE matrix → no overlap */}
              <div className="flex items-center justify-center gap-10 mb-3">
                <Badge color="bg-gradient-to-r from-emerald-500 to-teal-500">
                  ↑ SOUHAITÉ (POSITIF)
                </Badge>
                <Badge color="bg-gradient-to-r from-rose-500 to-red-600">
                  ↓ NON SOUHAITÉ (NÉGATIF)
                </Badge>
              </div>

              {/* Matrix */}
              <div className="relative mx-auto rounded-3xl shadow-2xl border-4 border-gray-800 overflow-hidden w-[1000px] max-w-full">
                <div className="grid grid-cols-2">
                  {/* A */}
                  <div className="relative p-8 bg-gradient-to-br from-emerald-400 to-green-500 border-r-4 border-b-4 border-gray-800 text-white">
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center font-black">
                      A
                    </div>
                    <h3 className="text-[clamp(20px,2.2vw,28px)] font-black">
                      ACQUIS
                    </h3>
                    <p className="opacity-90 font-semibold">
                      Passé • Positif • Interne
                    </p>
                    <ul className="mt-3 text-sm opacity-90 space-y-1">
                      <li>• Succès réalisés</li>
                      <li>• Forces démontrées</li>
                      <li>• Réalisations valorisées</li>
                    </ul>
                  </div>

                  {/* O */}
                  <div className="relative p-8 bg-gradient-to-br from-emerald-300 to-teal-400 border-b-4 border-gray-800 text-white">
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center font-black">
                      O
                    </div>
                    <h3 className="text-[clamp(20px,2.2vw,28px)] font-black">
                      OPPORTUNITÉS
                    </h3>
                    <p className="opacity-90 font-semibold">
                      Futur • Positif • Externe
                    </p>
                    <ul className="mt-3 text-sm opacity-90 space-y-1">
                      <li>• Potentialités externes</li>
                      <li>• Ressources exploitables</li>
                      <li>• Leviers de croissance</li>
                    </ul>
                  </div>

                  {/* F */}
                  <div className="relative p-8 bg-gradient-to-br from-red-500 to-rose-600 border-r-4 border-gray-800 text-white">
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center font-black">
                      F
                    </div>
                    <h3 className="text-[clamp(20px,2.2vw,28px)] font-black">
                      FAIBLESSES
                    </h3>
                    <p className="opacity-90 font-semibold">
                      Passé • Négatif • Interne
                    </p>
                    <ul className="mt-3 text-sm opacity-90 space-y-1">
                      <li>• Échecs identifiés</li>
                      <li>• Lacunes internes</li>
                      <li>• Points d’amélioration</li>
                    </ul>
                  </div>

                  {/* M */}
                  <div className="relative p-8 bg-gradient-to-br from-red-400 to-orange-500 text-white">
                    <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center font-black">
                      M
                    </div>
                    <h3 className="text-[clamp(20px,2.2vw,28px)] font-black">
                      MENACES
                    </h3>
                    <p className="opacity-90 font-semibold">
                      Futur • Négatif • Externe
                    </p>
                    <ul className="mt-3 text-sm opacity-90 space-y-1">
                      <li>• Risques environnementaux</li>
                      <li>• Obstacles potentiels</li>
                      <li>• Contraintes externes</li>
                    </ul>
                  </div>
                </div>

                {/* Cross-lines + axis labels */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800" />
                  <div className="absolute left-1/2 top-0 h-full w-1 bg-gray-800" />
                  {/* Axe du temps */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-black text-gray-700">
                    AXE DU TEMPS
                  </div>
                  {/* Axe du jugement */}
                  <div className="absolute top-1/2 -left-10 -translate-y-1/2 -rotate-90 text-xs font-black text-gray-700">
                    AXE DU JUGEMENT
                  </div>
                </div>
              </div>

              {/* Key insight */}
              <div className="mt-6 max-w-4xl mx-auto">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-8 border-amber-400 rounded-r-2xl p-5">
                  <div className="flex gap-3">
                    <div className="text-2xl">💡</div>
                    <div className="text-amber-800">
                      <div className="font-black mb-0.5">Clé de réussite</div>
                      <div className="text-sm">
                        <strong>Interne vs Externe : </strong>Acquis/Faiblesses
                        relèvent de votre responsabilité directe. Opportunités/
                        Menaces sont dans l’environnement — à exploiter ou
                        contrer.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SlideFrame>
        ),
      },

      // 3) LAUNCH
      {
        id: "launch",
        render: () => (
          <SlideFrame>
            <div className="grid grid-cols-2 gap-10 items-start">
              {/* Session setup */}
              <div className="bg-white/80 rounded-3xl p-8 shadow-2xl border">
                <h3 className="text-2xl font-black text-gray-800 mb-6">
                  ⚙️ Configuration Session
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-gray-700 mb-2">
                      🔑 ID de Session
                    </label>
                    <input
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-300 font-mono"
                      placeholder="SESSION-2025-XXX"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 L’ID reste actif durant tout l’atelier ; les
                      participants peuvent rejoindre à tout moment.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => onLaunchSession(sessionId || "")}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black rounded-xl shadow-2xl hover:scale-[1.02] transition"
                  >
                    🚀 LANCER LA SESSION AFOM
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        setSessionId(
                          "SESSION-" +
                            new Date().getFullYear() +
                            "-" +
                            String(Math.floor(Math.random() * 1000)).padStart(
                              3,
                              "0"
                            )
                        )
                      }
                      className="flex-1 py-3 border-2 border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-semibold transition"
                    >
                      🔄 Nouveau ID
                    </button>
                    <button
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      className="flex-1 py-3 border-2 border-gray-200 bg-white text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition"
                    >
                      📖 Revoir Formation
                    </button>
                  </div>
                </div>
              </div>

              {/* QR */}
              <div className="bg-white/80 rounded-3xl p-8 shadow-2xl border">
                <h3 className="text-2xl font-black text-gray-800 mb-6">
                  📱 Connexion Participants
                </h3>
                <div className="flex flex-col items-center gap-5">
                  <QRCodeCanvas
                    value={participantUrl}
                    size={220}
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                  <div className="text-xs font-mono bg-gray-100 text-gray-700 px-3 py-2 rounded w-full text-center break-all">
                    {participantUrl}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(participantUrl, "_blank")}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow"
                    >
                      🌐 Ouvrir
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(participantUrl);
                        alert("Lien copié !");
                      }}
                      className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold shadow"
                    >
                      📋 Copier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </SlideFrame>
        ),
      },
    ],
    [onLaunchSession, sessionId, participantUrl]
  );

  /* ---------------- Navigation ---------------- */
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
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onLaunchSession(sessionId || "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onLaunchSession, sessionId]);

  /* ---------------- Render ---------------- */
  const slide = slides[index];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* top bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-black text-gray-800">AFOM Ultimate</div>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={index === 0}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              ← Précédent
            </button>
            <div className="flex items-center gap-1">
              {slides.map((s, i) => (
                <span
                  key={s.id}
                  className={`w-2 h-2 rounded-full ${
                    i === index ? "bg-indigo-600" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              disabled={index === slides.length - 1}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>

      {/* current slide (auto-fit) */}
      {slide.render()}
    </div>
  );
};

export default PresentationMode;
