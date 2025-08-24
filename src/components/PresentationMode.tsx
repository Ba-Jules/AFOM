import React, { useEffect, useMemo, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Slide = { id: string; component: React.ReactNode };

interface Props {
  onLaunchSession: (sessionId: string) => void;
  initialSessionId: string;
}

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

  // SLIDES
  const slides: Slide[] = useMemo<Slide[]>(
    () => [
      {
        id: "hero",
        component: (
          <div className="relative min-h-[70vh] flex items-center justify-center">
            {/* Gradient de fond simple (fiable au build) */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 opacity-10" />
            <div className="relative z-10 text-center space-y-8 px-8">
              <div className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-sm tracking-wider shadow-2xl animate-pulse">
                🚀 RÉVOLUTION ANALYTIQUE
              </div>

              <h1 className="text-7xl md:text-8xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
                AFOM
              </h1>

              <div className="text-2xl md:text-3xl font-bold text-gray-700 max-w-4xl mx-auto leading-relaxed">
                L'outil qui transforme vos <span className="text-indigo-600 font-black">ateliers stratégiques</span> en
                <span className="text-purple-600 font-black"> décisions concrètes</span>
              </div>

              <div className="text-lg text-gray-600 max-w-3xl mx-auto">
                Acquis • Faiblesses • Opportunités • Menaces
                <br />
                <span className="font-semibold text-indigo-600">Collaboration temps réel + IA stratégique intégrée</span>
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
                {[
                  {
                    icon: "🧠",
                    title: "Intelligence Collective",
                    desc: "Un langage commun, structuré et sans ambiguïté pour tous vos projets",
                  },
                  {
                    icon: "⚡",
                    title: "Collaboration Temps Réel",
                    desc: "Synchronisation instantanée de tous les participants avec IA intégrée",
                  },
                  {
                    icon: "🎯",
                    title: "Décisions Actionables",
                    desc: "Des insights automatiques et des recommandations stratégiques précises",
                  },
                ].map((item, i) => (
                  <div key={i} className="group">
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/50 hover:scale-105 transform transition-all duration-300">
                      <div className="text-4xl mb-3">{item.icon}</div>
                      <div className="text-xl font-black text-gray-800 mb-2">{item.title}</div>
                      <div className="text-sm text-gray-600 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },

      {
        id: "framework",
        component: (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-100 text-indigo-800 font-bold text-sm">
                🏗️ CADRE CONCEPTUEL
              </div>
              <h2 className="text-5xl font-black text-gray-800">
                La Logique des <span className="text-indigo-600">Deux Axes</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Temps (Passé ↔ Futur) × Jugement (Positif ↔ Négatif) = Vision stratégique complète
              </p>
            </div>

            <div className="relative max-w-5xl mx-auto">
              {/* Étiquettes Axes */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2 rounded-full font-black shadow-lg">
                  ↑ SOUHAITÉ (POSITIF)
                </div>
              </div>
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-2 rounded-full font-black shadow-lg">
                  ↓ NON SOUHAITÉ (NÉGATIF)
                </div>
              </div>
              <div className="absolute top-1/2 -left-20 -translate-y-1/2 -rotate-90">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-2 rounded-full font-black shadow-lg whitespace-nowrap">
                  ← PASSÉ (INTERNE)
                </div>
              </div>
              <div className="absolute top-1/2 -right-20 -translate-y-1/2 rotate-90">
                <div className="bg-gradient-to-r from-purple-500 to-violet-500 text-white px-6 py-2 rounded-full font-black shadow-lg whitespace-nowrap">
                  FUTUR (EXTERNE) →
                </div>
              </div>

              {/* Matrice */}
              <div className="relative bg-white rounded-3xl shadow-2xl border-4 border-gray-800 overflow-hidden">
                <div className="grid grid-cols-2 aspect-square">
                  {/* A */}
                  <div className="relative bg-gradient-to-br from-emerald-400 to-green-500 p-8 flex flex-col justify-center border-r-4 border-b-4 border-gray-800">
                    <div className="absolute top-4 left-4 w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                      <span className="text-white font-black text-lg">A</span>
                    </div>
                    <div className="text-white space-y-3">
                      <h3 className="text-3xl font-black">ACQUIS</h3>
                      <p className="text-lg font-semibold opacity-90">Passé • Positif • Interne</p>
                      <div className="text-sm opacity-80 space-y-1">
                        <div>• Succès réalisés</div>
                        <div>• Forces démontrées</div>
                        <div>• Réalisations valorisées</div>
                      </div>
                    </div>
                  </div>
                  {/* O */}
                  <div className="relative bg-gradient-to-br from-emerald-300 to-teal-400 p-8 flex flex-col justify-center border-b-4 border-gray-800">
                    <div className="absolute top-4 left-4 w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                      <span className="text-white font-black text-lg">O</span>
                    </div>
                    <div className="text-white space-y-3">
                      <h3 className="text-3xl font-black">OPPORTUNITÉS</h3>
                      <p className="text-lg font-semibold opacity-90">Futur • Positif • Externe</p>
                      <div className="text-sm opacity-80 space-y-1">
                        <div>• Potentialités externes</div>
                        <div>• Ressources exploitables</div>
                        <div>• Leviers de croissance</div>
                      </div>
                    </div>
                  </div>
                  {/* F */}
                  <div className="relative bg-gradient-to-br from-red-500 to-rose-600 p-8 flex flex-col justify-center border-r-4 border-gray-800">
                    <div className="absolute top-4 left-4 w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                      <span className="text-white font-black text-lg">F</span>
                    </div>
                    <div className="text-white space-y-3">
                      <h3 className="text-3xl font-black">FAIBLESSES</h3>
                      <p className="text-lg font-semibold opacity-90">Passé • Négatif • Interne</p>
                      <div className="text-sm opacity-80 space-y-1">
                        <div>• Échecs identifiés</div>
                        <div>• Lacunes internes</div>
                        <div>• Points d'amélioration</div>
                      </div>
                    </div>
                  </div>
                  {/* M */}
                  <div className="relative bg-gradient-to-br from-red-400 to-orange-500 p-8 flex flex-col justify-center">
                    <div className="absolute top-4 left-4 w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                      <span className="text-white font-black text-lg">M</span>
                    </div>
                    <div className="text-white space-y-3">
                      <h3 className="text-3xl font-black">MENACES</h3>
                      <p className="text-lg font-semibold opacity-90">Futur • Négatif • Externe</p>
                      <div className="text-sm opacity-80 space-y-1">
                        <div>• Risques environnementaux</div>
                        <div>• Obstacles potentiels</div>
                        <div>• Contraintes externes</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Croisillons */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -translate-y-0.5" />
                  <div className="absolute left-1/2 top-0 h-full w-1 bg-gray-800 -translate-x-0.5" />
                </div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-8 border-amber-400 rounded-r-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">💡</div>
                  <div>
                    <div className="text-lg font-black text-amber-800">Clé de réussite</div>
                    <div className="text-amber-700">
                      <strong>Interne vs Externe :</strong> Acquis/Faiblesses relèvent de votre responsabilité directe. Opportunités/Menaces
                      sont dans l'environnement externe — à exploiter ou contrer.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      },

      {
        id: "methodology",
        component: (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-purple-100 text-purple-800 font-bold text-sm">
                ⚡ MÉTHODOLOGIE
              </div>
              <h2 className="text-5xl font-black text-gray-800">
                Workflow <span className="text-purple-600">Révolutionnaire</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                De la collecte collaborative à l'analyse IA — en temps réel et sans friction
              </p>
            </div>

            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
              {/* Processus */}
              <div className="space-y-6">
                <h3 className="text-2xl font-black text-gray-800 mb-6">🎯 Processus Guidé</h3>
                {[
                  { step: "01", title: "Lancement Session", desc: "Le modérateur démarre et partage le QR code", color: "from-blue-500 to-indigo-600" },
                  { step: "02", title: "Connexion Participants", desc: "Scan QR → Interface mobile optimisée", color: "from-indigo-500 to-purple-600" },
                  { step: "03", title: "Collecte Temps Réel", desc: "Post-its colorés synchronisés instantanément", color: "from-purple-500 to-pink-600" },
                  { step: "04", title: "Organisation Dynamique", desc: "Drag & drop + hiérarchisation collaborative", color: "from-pink-500 to-red-600" },
                  { step: "05", title: "Analyse IA Automatique", desc: "Insights stratégiques + recommandations", color: "from-green-500 to-emerald-600" },
                  { step: "06", title: "Export Professionnel", desc: "Rapport exécutif PDF + données Excel", color: "from-amber-500 to-orange-600" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:scale-110 transition-all`}>
                      {item.step}
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-black text-gray-800">{item.title}</div>
                      <div className="text-gray-600">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fonctionnalités */}
              <div className="space-y-6">
                <h3 className="text-2xl font-black text-gray-800 mb-6">🔥 Fonctionnalités Uniques</h3>
                {[
                  { icon: "🧠", title: "IA Stratégique Intégrée", desc: "Détection des déséquilibres, insights prédictifs, recommandations adaptatives" },
                  { icon: "⚡", title: "Collaboration Temps Réel", desc: "Firebase synchronisé, modifications instantanées, participation globale" },
                  { icon: "🎨", title: "Post-its Intelligents", desc: "Couleurs automatiques, hiérarchisation, traçabilité des déplacements" },
                  { icon: "📊", title: "Analytics Avancées", desc: "Métriques d'engagement, timeline interactive, scores qualité" },
                  { icon: "📱", title: "Multi-Device Natif", desc: "Interface responsive, expérience optimisée mobile/desktop" },
                  { icon: "🔄", title: "Dual-Mode Révolutionnaire", desc: "Basculement instantané Collecte ↔ Analyse sans perdre de données" },
                ].map((feature, i) => (
                  <div key={i} className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{feature.icon}</div>
                      <div>
                        <div className="font-black text-gray-800">{feature.title}</div>
                        <div className="text-sm text-gray-600">{feature.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-400 rounded-r-xl p-4 mt-2">
                  <div className="text-sm font-black text-emerald-800 mb-2">📋 Règles d'Or</div>
                  <ul className="text-sm text-emerald-700 space-y-1">
                    <li>• <strong>Une idée = un post-it</strong> (concision et clarté)</li>
                    <li>• <strong>Placement précis</strong> selon les axes Temps/Jugement</li>
                    <li>• <strong>Challenge constructif</strong> des idées, pas des personnes</li>
                    <li>• <strong>Conclusion actionable</strong> avec responsables désignés</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ),
      },

      {
        id: "launch",
        component: (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm">
                🚀 PRÊT AU DÉCOLLAGE
              </div>
              <h2 className="text-5xl font-black text-gray-800">
                Lancer Votre <span className="text-emerald-600">Session AFOM</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Connectez vos participants et transformez vos ateliers en expériences inoubliables
              </p>
            </div>

            <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
              {/* QR Code */}
              <div className="order-2 md:order-1">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
                  <div className="text-center space-y-6">
                    <h3 className="text-2xl font-black text-gray-800">📱 Connexion Instantanée</h3>
                    <div className="inline-block p-4 bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-inner border-4 border-gray-100">
                      <QRCodeCanvas value={participantUrl} size={192} includeMargin />
                    </div>
                    <div className="space-y-3">
                      <div className="text-xs text-gray-500 font-mono break-all bg-gray-100 p-2 rounded-lg">{participantUrl}</div>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => window.open(participantUrl, "_blank")}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-md transition-all hover:scale-105"
                        >
                          🌐 Ouvrir
                        </button>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(participantUrl);
                            alert("Lien copié !");
                          }}
                          className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold shadow-md transition-all hover:scale-105"
                        >
                          📋 Copier
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Config session */}
              <div className="order-1 md:order-2 space-y-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
                  <h3 className="text-2xl font-black text-gray-800 mb-6">⚙️ Configuration Session</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-black text-gray-700 mb-2">🔑 ID de Session</label>
                      <input
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-mono"
                        placeholder="SESSION-2025-XXX"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        💡 L'ID reste actif durant tout l'atelier — les participants peuvent rejoindre à tout moment
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-r-xl p-4">
                      <div className="text-sm">
                        <div className="font-black text-blue-800 mb-1">🎯 Session Active</div>
                        <div className="text-blue-700">Les participants restent connectés même lors du changement de sessions thématiques</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => onLaunchSession(sessionId || "")}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xl font-black rounded-xl shadow-2xl hover:scale-105 transition-all hover:shadow-emerald-500/25"
                  >
                    🚀 LANCER LA SESSION AFOM
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      className="flex-1 py-3 border-2 border-gray-200 bg-white text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all hover:scale-105"
                    >
                      📖 Revoir Formation
                    </button>
                    <button
                      onClick={() => {
                        const newSession = "SESSION-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 1000)).padStart(3, "0");
                        setSessionId(newSession);
                      }}
                      className="flex-1 py-3 border-2 border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-semibold transition-all hover:scale-105"
                    >
                      🔄 Nouveau ID
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: "< 2min", label: "Setup time", icon: "⚡" },
                  { value: "∞", label: "Participants", icon: "👥" },
                  { value: "100%", label: "Temps réel", icon: "🔄" },
                  { value: "🧠", label: "IA intégrée", icon: "🤖" },
                ].map((stat, i) => (
                  <div key={i} className="text-center p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50">
                    <div className="text-2xl mb-1">{stat.icon}</div>
                    <div className="text-2xl font-black text-gray-800">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
    ],
    [participantUrl, sessionId, onLaunchSession]
  );

  // NAV
  const [index, setIndex] = useState(0);
  const clamp = useCallback((i: number) => Math.max(0, Math.min(slides.length - 1, i)), [slides.length]);
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Enter") { e.preventDefault(); onLaunchSession(sessionId || ""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onLaunchSession, sessionId]);

  const currentSlide = slides[index];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Barre du haut */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-white/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Mode Formation</span>
            <span className="mx-2">•</span>
            <span>Flèches ← →, Espace, Entrée (lancer)</span>
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
        {/* Progression */}
        <div className="h-1 bg-indigo-200">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
        </div>
      </div>

      {/* Slide */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-xl p-6 md:p-10">
          {currentSlide.component}

          {/* Nav bas */}
          <div className="mt-8 flex items-center justify-between">
            <button onClick={prev} disabled={index === 0} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50">
              ← Précédent
            </button>
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Aller au slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${i === index ? "bg-indigo-600 w-6" : "bg-gray-300 hover:bg-gray-400"}`}
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
