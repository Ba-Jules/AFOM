import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { QRCodeCanvas } from "qrcode.react";
import { doc as fsDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { BoardMeta } from "../types";

type Slide = { id: string; render: () => React.ReactNode };

interface Props {
  onLaunchSession: (sessionId: string) => void;
  initialSessionId: string;
}

/* ---------------- Helpers UI ---------------- */

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

/** Conteneur qui scale le contenu pour tenir dans l’écran */
function FitToScreen({
  children,
  bottomReserve = 96,
}: {
  children: React.ReactNode;
  bottomReserve?: number;
}) {
  const [scale, setScale] = useState(1);

  const compute = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - bottomReserve;
    const s = Math.min((vw - 24) / BASE_W, (vh - 24) / BASE_H);
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

function Pill({ sign }: { sign: "+" | "-" }) {
  return (
    <div className="w-14 h-14 rounded-full bg-white text-black shadow-xl border-2 border-black flex items-center justify-center">
      <span className="text-3xl font-black leading-none">{sign}</span>
    </div>
  );
}

/* ------------ Slide “logique des deux axes” ------------------ */

function MatrixSlide() {
  return (
    <FitToScreen>
      <div
        className="relative rounded-[24px] shadow-2xl overflow-hidden"
        style={{ width: BASE_W, height: BASE_H, background: "#0a0a0a" }}
      >
        {/* Titre */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[-1px] text-white text-[48px] font-extrabold tracking-tight whitespace-nowrap">
          Composantes de l'outil AFOM
        </div>

        {/* Interne / Externe */}
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

        {/* vision rétrospective / vision prospective */}
        <div className="absolute top-[110px] left-[200px]">
          <div className="px-4 py-1 rounded-xl bg-[#ffd54f] text-[#0a0a0a] font-extrabold text-lg border-4 border-[#ff8f00] whitespace-nowrap">
            vision rétrospective
          </div>
        </div>
        <div className="absolute top-[110px] right-[200px]">
          <div className="px-4 py-1 rounded-xl bg-[#ffd54f] text-[#0a0a0a] font-extrabold text-lg border-4 border-[#ff8f00] whitespace-nowrap">
            vision prospective
          </div>
        </div>

        {/* Pastilles + / - */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[98px]">
          <Pill sign="+" />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 top-[738px]">
          <Pill sign="-" />
        </div>

        {/* Axe du jugement (vertical) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[302px] -rotate-90 z-10">
          <div className="text-white font-black text-lg bg-[#d50000] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Axe du jugement
          </div>
        </div>

        {/* Axe du temps */}
        <div className="absolute left-[64px] right-[64px] top-[420px] h-[48px] bg-[#ffea00] border-6 border-black rounded-md" />
        <div className="absolute left-[90px] top-[444px] -translate-y-1/2 z-10">
          <div className="text-black font-black text-xl bg-[#ffea00] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Passé
          </div>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 top-[444px] -translate-y-1/2 z-10">
          <div className="text-black font-black text-lg bg-[#ffea00] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Axe du temps
          </div>
        </div>
        <div className="absolute right-[90px] top-[444px] -translate-y-1/2 z-10">
          <div className="text-black font-black text-xl bg-[#ffea00] px-3 py-1 border-2 border-black rounded whitespace-nowrap shadow-lg">
            Futur
          </div>
        </div>

        {/* Grille 2×2 */}
        <div className="absolute left-[64px] right-[64px] top-[180px] bottom-[100px] grid grid-cols-2 grid-rows-2">
          {/* A - Acquis */}
          <div className="relative border-[6px] border-[#1b5e20] bg-[#52b788] p-8">
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

          {/* O - Opportunités */}
          <div className="relative border-[6px] border-[#004d40] bg-[#2ec4b6] p-8">
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

          {/* F - Faiblesses */}
          <div className="relative border-[6px] border-[#b71c1c] bg-[#ef5350] p-8">
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

          {/* M - Menaces */}
          <div className="relative border-[6px] border-[#e65100] bg-[#ff8a65] p-8">
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

/* ---------------- Composant principal ---------------- */

const PresentationMode: React.FC<Props> = ({
  onLaunchSession,
  initialSessionId,
}) => {
  const [sessionId, setSessionId] = useState<string>(initialSessionId || "");
  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
  }, [initialSessionId]);
  useEffect(() => {
    if (sessionId) localStorage.setItem("sessionId", sessionId);
  }, [sessionId]);

  // Meta (Projet/Thème) – formulaire sur slide 1
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        const snap = await getDoc(fsDoc(db, "boards", sessionId));
        if (snap.exists()) {
          const m = snap.data() as BoardMeta;
          setProjectName(m.projectName || "");
          setThemeName(m.themeName || "");
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [sessionId]);

  const saveMeta = useCallback(async () => {
    if (!sessionId) {
      alert("Définis d’abord un ID de session (slide Lancement).");
      return;
    }
    if (!projectName.trim() || !themeName.trim()) {
      alert("Renseigne le Projet et le Thème.");
      return;
    }
    try {
      await setDoc(
        fsDoc(db, "boards", sessionId),
        { projectName: projectName.trim(), themeName: themeName.trim(), updatedAt: new Date() } as BoardMeta,
        { merge: true }
      );
      alert("Projet & Thème enregistrés.");
    } catch (e) {
      console.error(e);
      alert("Impossible d’enregistrer Projet/Thème.");
    }
  }, [sessionId, projectName, themeName]);

  const participantUrl = useMemo(() => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?mode=participant&session=${encodeURIComponent(
      sessionId || ""
    )}`;
  }, [sessionId]);

  const goModerator = useCallback(() => {
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=work&session=${encodeURIComponent(
      sessionId || ""
    )}`;
  }, [sessionId]);

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
                <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent leading-tight drop-shadow">
                  AFOM
                </h1>
                <p className="mt-6 text-2xl text-white/90 max-w-3xl font-semibold">
                  Outil de diagnostic rapide pouvant conduire à des décisions éclairées
                </p>

                {/* Formulaire Projet / Thème */}
                <div className="mt-10 w-full max-w-2xl bg-white/90 rounded-2xl border shadow p-4 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700">
                        Projet
                      </label>
                      <input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Ex : Transformation 2025"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">
                        Thème
                      </label>
                      <input
                        value={themeName}
                        onChange={(e) => setThemeName(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Ex : Offre digitale PME"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      onClick={saveMeta}
                      className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={goModerator}
                      className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50"
                      title="Aller à l’interface modérateur"
                    >
                      Aller au modérateur →
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    ID de session actuel : <span className="font-mono">{sessionId || "—"}</span>
                  </div>
                </div>
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
              </div>
            </div>
          </FitToScreen>
        ),
      },
    ],
    [participantUrl, sessionId, onLaunchSession, saveMeta, goModerator, projectName, themeName]
  );

  /* ---------- Navigation : flèches seulement (pas d'espace) ----------- */
  const [index, setIndex] = useState(0);
  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(slides.length - 1, i)),
    [slides.length]
  );
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);

  // Ignore les raccourcis si on tape dans un champ
  const isTypingTarget = (el: EventTarget | null) => {
    const t = el as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t as any).isContentEditable;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (index < slides.length - 1) next();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (index > 0) prev();
      }
      if (e.key === "Enter" && index === slides.length - 1) {
        e.preventDefault();
        onLaunchSession(sessionId || "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onLaunchSession, sessionId, index, slides.length]);

  const current = slides[index];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {current.render()}

      {/* Barre de nav bas (conditions demandées) */}
      <div className="fixed bottom-0 left-0 right-0 pb-4">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl border rounded-2xl shadow-lg px-4 py-2">
            {/* Précédent : caché sur la première slide */}
            <button
              onClick={prev}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40"
              disabled={index === 0}
              style={{ visibility: index === 0 ? "hidden" : "visible" }}
            >
              ← Précédent
            </button>

            <div className="flex items-center">
              {slides.map((s, i) => (
                <Dot key={s.id} active={i === index} />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Retour modérateur : caché sur la première slide */}
              <button
                onClick={goModerator}
                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                title="Retour à l’interface modérateur"
                style={{ visibility: index === 0 ? "hidden" : "visible" }}
              >
                ← Retour modérateur
              </button>
              {/* Suivant : caché sur la dernière slide */}
              <button
                onClick={next}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                disabled={index === slides.length - 1}
                style={{ visibility: index === slides.length - 1 ? "hidden" : "visible" }}
              >
                Suivant →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
