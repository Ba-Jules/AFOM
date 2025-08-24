import React, { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Slide = { id: string; component: React.ReactNode };

interface Props {
  onLaunchSession: (sessionId: string) => void;
  initialSessionId: string;
}

const chip = (txt: React.ReactNode, className = "") => (
  <div
    className={
      "inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-wide shadow " +
      className
    }
  >
    {txt}
  </div>
);

const PresentationMode: React.FC<Props> = ({ onLaunchSession, initialSessionId }) => {
  /* Session */
  const [sessionId, setSessionId] = useState<string>(initialSessionId || "");
  useEffect(() => { if (initialSessionId) setSessionId(initialSessionId); }, [initialSessionId]);
  useEffect(() => { if (sessionId) localStorage.setItem("sessionId", sessionId); }, [sessionId]);

  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(sessionId || "")}`;
  }, [sessionId]);

  /* Slides */
  const slides: Slide[] = useMemo(() => [
    /* 0 – HERO */
    {
      id: "hero",
      component: (
        <div className="min-h-[calc(100vh-96px)] flex items-center justify-center">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 opacity-10" />
          </div>

          <div className="text-center space-y-10 px-6 max-w-5xl">
            {chip("🚀 RÉVOLUTION ANALYTIQUE", "bg-gradient-to-r from-amber-400 to-orange-500 text-white")}
            <h1 className="text-6xl sm:text-7xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
              AFOM Ultimate
            </h1>
            <p className="text-xl sm:text-2xl text-gray-700 font-semibold">
              L’outil qui transforme vos <span className="text-indigo-600 font-black">ateliers stratégiques</span> en
              <span className="text-purple-600 font-black"> décisions concrètes</span>
            </p>

            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { icon: "🧠", title: "Intelligence collective", desc: "Un langage clair et partagé pour agir vite" },
                { icon: "⚡", title: "Temps réel", desc: "Synchronisation instantanée + IA intégrée" },
                { icon: "🎯", title: "Actionnable", desc: "Insights et recommandations opérationnelles" },
              ].map((f, i) => (
                <div key={i} className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-white/60 shadow hover:shadow-lg transition">
                  <div className="text-3xl">{f.icon}</div>
                  <div className="mt-2 text-lg font-black">{f.title}</div>
                  <div className="text-sm text-gray-600">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    /* 1 – FRAMEWORK (schéma enrichi) */
    {
      id: "framework",
      component: (
        <div className="min-h-[calc(100vh-96px)] flex items-start justify-center">
          <div className="w-full max-w-6xl mx-auto px-4">
            <div className="text-center space-y-3 mb-6">
              {chip("🏗️ CADRE CONCEPTUEL", "bg-indigo-100 text-indigo-700")}
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900">
                La Logique des <span className="text-indigo-600">Deux Axes</span>
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                Temps (<b>Passé</b> ↔ <b>Futur</b>) × Jugement (<b>Positif</b> ↔ <b>Négatif</b>) = Vision stratégique complète
              </p>
            </div>

            {/* Matrice responsive : carré, jamais de scroll */}
            <div className="relative mx-auto aspect-square w-full max-w-4xl">
              {/* Etiquettes périphériques */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                {chip("↑ SOUHAITÉ (POSITIF)", "bg-emerald-500 text-white")}
              </div>
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                {chip("↓ NON SOUHAITÉ (NÉGATIF)", "bg-rose-500 text-white")}
              </div>
              <div className="absolute top-1/2 -left-16 -translate-y-1/2 -rotate-90 whitespace-nowrap">
                {chip("← INTERNE • V. RÉTROSPECTIVE", "bg-blue-600 text-white")}
              </div>
              <div className="absolute top-1/2 -right-16 -translate-y-1/2 rotate-90 whitespace-nowrap">
                {chip("V. PROSPECTIVE • EXTERNE →", "bg-violet-600 text-white")}
              </div>

              {/* Matrice */}
              <div className="absolute inset-0 bg-white rounded-3xl border-4 border-gray-900 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                  {/* ACQUIS */}
                  <div className="relative p-5 sm:p-7 bg-gradient-to-br from-emerald-400 to-green-500 border-r-4 border-b-4 border-gray-900">
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                      <span className="text-white font-black">A</span>
                    </div>
                    <div className="text-white">
                      <div className="text-2xl font-black">ACQUIS</div>
                      <div className="text-sm font-semibold opacity-90">Passé • Positif • Interne</div>
                      <ul className="mt-3 text-sm space-y-1 opacity-95 list-disc list-inside">
                        <li>Forces / Succès</li>
                        <li>Réalisations désirées</li>
                        <li>Aspects positifs</li>
                        <li>Ce qu’on a aimé</li>
                      </ul>
                    </div>
                  </div>

                  {/* OPPORTUNITÉS */}
                  <div className="relative p-5 sm:p-7 bg-gradient-to-br from-emerald-300 to-teal-400 border-b-4 border-gray-900">
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                      <span className="text-white font-black">O</span>
                    </div>
                    <div className="text-white">
                      <div className="text-2xl font-black">OPPORTUNITÉS</div>
                      <div className="text-sm font-semibold opacity-90">Futur • Positif • Externe</div>
                      <ul className="mt-3 text-sm space-y-1 opacity-95 list-disc list-inside">
                        <li>Potentialités</li>
                        <li>Ressources exploitables</li>
                        <li>Atouts</li>
                        <li>Ce qu’on peut valoriser</li>
                      </ul>
                    </div>
                  </div>

                  {/* FAIBLESSES */}
                  <div className="relative p-5 sm:p-7 bg-gradient-to-br from-rose-600 to-red-500 border-r-4 border-gray-900">
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                      <span className="text-white font-black">F</span>
                    </div>
                    <div className="text-white">
                      <div className="text-2xl font-black">FAIBLESSES</div>
                      <div className="text-sm font-semibold opacity-90">Passé • Négatif • Interne</div>
                      <ul className="mt-3 text-sm space-y-1 opacity-95 list-disc list-inside">
                        <li>Échecs</li>
                        <li>Aspects négatifs</li>
                        <li>Problèmes rencontrés</li>
                        <li>Ce qu’on n’a pas aimé</li>
                      </ul>
                    </div>
                  </div>

                  {/* MENACES */}
                  <div className="relative p-5 sm:p-7 bg-gradient-to-br from-orange-500 to-red-400">
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                      <span className="text-white font-black">M</span>
                    </div>
                    <div className="text-white">
                      <div className="text-2xl font-black">MENACES</div>
                      <div className="text-sm font-semibold opacity-90">Futur • Négatif • Externe</div>
                      <ul className="mt-3 text-sm space-y-1 opacity-95 list-disc list-inside">
                        <li>Risques</li>
                        <li>Obstacles</li>
                        <li>Craintes</li>
                        <li>Suppositions pouvant influencer négativement</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Axes (lignes) */}
                <div className="pointer-events-none absolute inset-0">
                  {/* Axe horizontal = temps */}
                  <div className="absolute top-1/2 left-0 w-full h-1 -translate-y-1/2 bg-gray-900" />
                  {/* Axe vertical = jugement */}
                  <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-red-600" />
                </div>

                {/* Libellés axes */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-8">
                  {chip("AXE DU TEMPS — Passé ↔ Futur", "bg-yellow-400 text-black")}
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 -left-10 -rotate-90">
                  {chip("AXE DU JUGEMENT", "bg-red-600 text-white")}
                </div>

                {/* + / - */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-4 w-8 h-8 rounded-full bg-white text-black font-black flex items-center justify-center shadow">
                  +
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 w-8 h-8 rounded-full bg-white text-black font-black flex items-center justify-center shadow">
                  –
                </div>
              </div>

              {/* Encadré clé */}
              <div className="max-w-3xl mx-auto mt-16">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-8 border-amber-400 rounded-r-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💡</div>
                    <div className="text-sm sm:text-base text-amber-800">
                      <span className="font-black">Clé de réussite :</span> <b>Interne vs Externe</b>.
                      Acquis/Faiblesses relèvent de votre responsabilité directe. Opportunités/Menaces sont
                      dans l’environnement externe — à exploiter ou à contrer.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    /* 2 – METHODOLOGY (inchangé dans l’esprit, condensé) */
    {
      id: "methodology",
      component: (
        <div className="min-h-[calc(100vh-96px)] px-6 flex items-start justify-center">
          <div className="w-full max-w-6xl">
            <div className="text-center space-y-3 mb-8">
              {chip("⚡ MÉTHODOLOGIE", "bg-purple-100 text-purple-700")}
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900">
                Workflow <span className="text-purple-600">Révolutionnaire</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <h3 className="text-xl font-black">🎯 Processus guidé</h3>
                {[
                  ["01", "Lancement session", "Le modérateur démarre et partage le QR code", "from-blue-500 to-indigo-600"],
                  ["02", "Connexion participants", "Scan QR → interface mobile optimisée", "from-indigo-500 to-purple-600"],
                  ["03", "Collecte temps réel", "Post-its colorés synchronisés instantanément", "from-purple-500 to-pink-600"],
                  ["04", "Organisation dynamique", "Drag & drop + hiérarchisation collaborative", "from-pink-500 to-rose-600"],
                  ["05", "Analyse IA automatique", "Insights + recommandations stratégiques", "from-green-500 to-emerald-600"],
                  ["06", "Export professionnel", "Rapport exécutif PDF + données Excel", "from-amber-500 to-orange-600"],
                ].map(([step, title, desc, grad]) => (
                  <div key={step} className="flex gap-4 items-start">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-r ${grad} text-white font-black flex items-center justify-center shadow`}>{step}</div>
                    <div>
                      <div className="font-black">{title}</div>
                      <div className="text-sm text-gray-600">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-black">🔥 Fonctionnalités uniques</h3>
                {[
                  ["🧠", "IA Stratégique intégrée", "Détection des déséquilibres, insights prédictifs, recommandations"],
                  ["⚡", "Collaboration temps réel", "Firebase synchronisé, modifications instantanées"],
                  ["🎨", "Post-its intelligents", "Couleurs d’origine, hiérarchisation, traçabilité"],
                  ["📊", "Analytics avancées", "Métriques d’engagement, timeline interactive"],
                  ["📱", "Multi-device natif", "Responsive mobile/desktop prêt salle de réunion"],
                  ["🔄", "Dual-mode", "Bascule instantanée Collecte ↔ Analyse"],
                ].map(([icon, title, desc]) => (
                  <div key={title as string} className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white/60">
                    <div className="flex gap-3">
                      <div className="text-2xl">{icon}</div>
                      <div>
                        <div className="font-black">{title}</div>
                        <div className="text-sm text-gray-600">{desc}</div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-400 rounded-r-xl p-4">
                  <div className="text-sm font-black text-emerald-800 mb-1">📋 Règles d’or</div>
                  <ul className="text-sm text-emerald-700 space-y-1">
                    <li>• <b>Une idée = un post-it</b></li>
                    <li>• <b>Placement précis</b> selon Temps/Jugement</li>
                    <li>• <b>Challenge des idées</b>, jamais des personnes</li>
                    <li>• <b>Conclusion actionable</b> avec responsables</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    /* 3 – LAUNCH */
    {
      id: "launch",
      component: (
        <div className="min-h-[calc(100vh-96px)] px-6 flex items-center">
          <div className="w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
            {/* QR */}
            <div className="order-2 md:order-1">
              <div className="bg-white/80 backdrop-blur rounded-3xl p-8 border border-white/60 shadow">
                <h3 className="text-2xl font-black mb-6 text-center">📱 Connexion instantanée</h3>
                <div className="flex justify-center">
                  <div className="p-4 rounded-2xl bg-gray-50 border">
                    <QRCodeCanvas value={participantUrl} size={196} includeMargin />
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <div className="text-xs font-mono bg-gray-100 p-2 rounded break-all">{participantUrl}</div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => window.open(participantUrl, "_blank")}
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      🌐 Ouvrir
                    </button>
                    <button
                      onClick={async () => { await navigator.clipboard.writeText(participantUrl); alert("Lien copié !"); }}
                      className="px-4 py-2 border border-gray-300 bg-white rounded text-sm hover:bg-gray-50"
                    >
                      📋 Copier
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Config */}
            <div className="order-1 md:order-2 space-y-6">
              <div className="bg-white/80 backdrop-blur rounded-3xl p-8 border border-white/60 shadow">
                <h3 className="text-2xl font-black mb-6">⚙️ Configuration session</h3>
                <label className="block text-sm font-black mb-2">🔑 ID de session</label>
                <input
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="SESSION-2025-XYZ"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 font-mono"
                />
                <p className="mt-2 text-xs text-gray-600">
                  💡 L’ID reste actif pendant tout l’atelier — le même QR code peut servir plusieurs séances.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => onLaunchSession(sessionId || "")}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black rounded-xl shadow hover:scale-[1.02] transition"
                >
                  🚀 LANCER LA SESSION AFOM
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIndex(0)}
                    className="flex-1 py-3 border-2 border-gray-200 bg-white rounded-xl hover:bg-gray-50 font-semibold"
                  >
                    📖 Revoir formation
                  </button>
                  <button
                    onClick={() => {
                      const newId = `SESSION-${new Date().getFullYear()}-${String(Math.floor(Math.random()*1000)).padStart(3,"0")}`;
                      setSessionId(newId);
                    }}
                    className="flex-1 py-3 border-2 border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-semibold"
                  >
                    🔄 Nouveau ID
                  </button>
                </div>
              </div>

              {/* Stats fun */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["⚡", "< 2 min", "Setup time"],
                  ["👥", "∞", "Participants"],
                  ["🔄", "100%", "Temps réel"],
                  ["🤖", "IA", "Intégrée"],
                ].map(([ic, v, l]) => (
                  <div key={l} className="text-center p-4 bg-white/70 backdrop-blur rounded-xl border">
                    <div className="text-2xl">{ic}</div>
                    <div className="text-xl font-black">{v}</div>
                    <div className="text-xs text-gray-600">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ], [participantUrl, sessionId]);

  /* Navigation */
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
      {/* Contenu du slide */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-8 pb-24">
        {currentSlide.component}
      </div>

      {/* NAV BAS CENTRÉE */}
      <div className="fixed bottom-4 left-0 right-0 z-50">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prev}
            disabled={index === 0}
            className="px-4 py-2 rounded-full border bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            ← Précédent
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                className={
                  "h-2 rounded-full transition-all " +
                  (i === index ? "w-6 bg-indigo-600" : "w-2 bg-gray-300 hover:bg-gray-400")
                }
                aria-label={`Aller au slide ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={index === slides.length - 1}
            className="px-4 py-2 rounded-full border bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
