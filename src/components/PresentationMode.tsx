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
import { BoardMeta, BoardContext } from "../types";
import { extractContextFromDocument } from "../services/geminiService";
import AIConfigPanel from "./AIConfigPanel";
import { useAIConfig } from "../hooks/useAIConfig";

/** Extrait le texte brut d'un fichier TXT, PDF ou DOCX (côté navigateur) */
async function extractTextFromFile(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();

  if (ext === "txt") {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Lecture échouée"));
      reader.readAsText(file, "UTF-8");
    });
  }

  if (ext === "pdf") {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).href;
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it: any) => it.str ?? "").join(" "));
    }
    return pages.join("\n");
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const ab = await file.arrayBuffer();
    const result = await (mammoth as any).extractRawText({ arrayBuffer: ab });
    return result.value as string;
  }

  throw new Error(`Format ".${ext}" non supporté. Utilisez TXT, PDF ou DOCX.`);
}

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
  topReserve = 0,
}: {
  children: React.ReactNode;
  bottomReserve?: number;
  topReserve?: number;
}) {
  const [scale, setScale] = useState(1);

  const compute = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - bottomReserve - topReserve;
    const s = Math.min((vw - 24) / BASE_W, (vh - 24) / BASE_H);
    setScale(Math.max(0.6, Math.min(1.15, s)));
  }, [bottomReserve, topReserve]);

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
    <div
      className="w-full flex items-center justify-center"
      style={{ minHeight: `calc(100vh - ${bottomReserve}px - ${topReserve}px)` }}
    >
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

function MatrixSlide({ topReserve = 0 }: { topReserve?: number }) {
  return (
    <FitToScreen topReserve={topReserve}>
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

  const { config: aiCfg } = useAIConfig();
  const [aiConfigured, setAiConfigured] = useState(aiCfg.configured);
  const [showVideo, setShowVideo] = useState(false);
  const videoUrl = import.meta.env.BASE_URL + "afom-presentation.mp4";

  // Meta (Projet/Thème) – formulaire sur slide 1
  const [projectName, setProjectName] = useState("");
  const [themeName, setThemeName] = useState("");

  // Contexte de session
  const [situationActuelle, setSituationActuelle] = useState("");
  const [symptomesObservables, setSymptomesObservables] = useState("");
  const [perimetre, setPerimetre] = useState("");
  const [docExtracted, setDocExtracted] = useState<{
    problematique: string; acteurs: string; zone: string; enjeux: string;
  } | null>(null);
  const [showContextModal, setShowContextModal] = useState(false);
  const [extractingDoc, setExtractingDoc] = useState(false);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        const snap = await getDoc(fsDoc(db, "boards", sessionId));
        if (snap.exists()) {
          const m = snap.data() as BoardMeta;
          setProjectName(m.projectName || "");
          setThemeName(m.themeName || "");
          if (m.context) {
            setSituationActuelle(m.context.situationActuelle || "");
            setSymptomesObservables(m.context.symptomesObservables || "");
            setPerimetre(m.context.perimetre || "");
            if (m.context.problematique || m.context.acteurs || m.context.zone || m.context.enjeux) {
              setDocExtracted({
                problematique: m.context.problematique || "",
                acteurs: m.context.acteurs || "",
                zone: m.context.zone || "",
                enjeux: m.context.enjeux || "",
              });
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [sessionId]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractingDoc(true);
    try {
      const rawText = await extractTextFromFile(file);
      if (!rawText.trim()) { alert("Impossible d’extraire le texte du document."); return; }
      // Tronquer à 8000 caractères max — jamais le document brut en analyse finale
      const truncated = rawText.slice(0, 8000);
      const extracted = await extractContextFromDocument(truncated);
      setDocExtracted(extracted);
    } catch (err: any) {
      alert(err?.message || "Erreur lors de l’extraction du document.");
    } finally {
      setExtractingDoc(false);
      e.target.value = "";
    }
  }, []);

  const saveMeta = useCallback(async () => {
    if (!sessionId) {
      alert("Définis d’abord un ID de session (slide Lancement).");
      return;
    }
    if (!projectName.trim() || !themeName.trim()) {
      alert("Renseigne le Projet et le Thème.");
      return;
    }
    const context: BoardContext = {
      situationActuelle: situationActuelle.trim(),
      symptomesObservables: symptomesObservables.trim(),
      perimetre: perimetre.trim(),
      ...(docExtracted ?? {}),
    };
    try {
      await setDoc(
        fsDoc(db, "boards", sessionId),
        { projectName: projectName.trim(), themeName: themeName.trim(), context, updatedAt: new Date() } as BoardMeta,
        { merge: true }
      );
      setShowContextModal(false);
      alert("Session enregistrée.");
    } catch (e) {
      console.error(e);
      alert("Impossible d’enregistrer.");
    }
  }, [sessionId, projectName, themeName, situationActuelle, symptomesObservables, perimetre, docExtracted]);

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
          <FitToScreen topReserve={0}>
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

                {/* Bouton vidéo de présentation */}
                <div className="mt-6">
                  <button
                    onClick={() => setShowVideo(true)}
                    className="group inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/70 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-white/20"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    Voir la vidéo de présentation AFOM
                    <svg viewBox="0 0 24 24" className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>

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
                  <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                    <button
                      onClick={() => setShowContextModal(true)}
                      className={`px-4 py-2 rounded-md border text-sm font-medium ${
                        (situationActuelle || perimetre || docExtracted)
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      {(situationActuelle || perimetre || docExtracted)
                        ? "Contexte ✓"
                        : "+ Ajouter le contexte"}
                    </button>
                    <div className="flex items-center gap-2">
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
        render: () => <MatrixSlide topReserve={0} />,
      },
      {
        id: "launch",
        render: () => (
          <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-indigo-50 flex items-start justify-center px-4 pt-6 pb-28">
            <div className="w-full max-w-5xl space-y-5">

              {/* ── Bandeau Assistance IA (clone arbre_problèmes slide 4) ── */}
              <div className="rounded-2xl overflow-hidden shadow-lg ring-1 ring-indigo-200">
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
                    <span className="text-2xl leading-none">🤖</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-extrabold text-white leading-tight tracking-tight">
                      Assistance IA
                    </p>
                    <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                      Analyse du contexte · Formulation des acquis/faiblesses · Recommandations stratégiques
                    </p>
                  </div>
                  {aiConfigured ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-400/30 text-white border border-emerald-300/50 backdrop-blur-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                      Prête
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-indigo-100 border border-white/25">
                      <span className="w-2 h-2 rounded-full bg-amber-300" />
                      Non configurée
                    </span>
                  )}
                </div>
                <div className="bg-white px-6 py-5">
                  <AIConfigPanel onConfigured={(next) => setAiConfigured(!!next?.configured)} />
                </div>
              </div>

              {/* ── Ligne 2 : QR + Config session ── */}
              <div className="grid lg:grid-cols-2 gap-5">

                {/* QR code participants */}
                <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">📱</span>
                    <h4 className="text-base font-bold text-gray-900">Connexion des participants</h4>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 p-3 rounded-xl bg-gray-50 border">
                      <QRCodeCanvas value={participantUrl} size={140} />
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed space-y-2 min-w-0">
                      <p>
                        Demandez aux participants de <strong>scanner</strong> ce QR code pour rejoindre la session en mode <em>participant</em>.
                      </p>
                      {(participantUrl.includes("localhost") || participantUrl.includes("127.0.0.1")) && (
                        <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700">
                          <span className="shrink-0 font-bold">⚠</span>
                          <span>URL locale — les participants doivent être sur le même réseau.</span>
                        </div>
                      )}
                      <p className="break-all font-mono text-gray-400 text-[10px]">{participantUrl}</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => window.open(participantUrl, "_blank")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors text-xs font-medium"
                        >
                          🌐 Ouvrir
                        </button>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(participantUrl);
                            alert("Lien copié !");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors text-xs font-medium"
                        >
                          📋 Copier
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration session */}
                <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="text-base font-bold text-gray-900 mb-4">⚙️ Configuration de la session</h4>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700">ID de session</span>
                      <input
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
                        placeholder="SESSION-2025-XXX"
                      />
                    </label>
                    <p className="text-xs text-gray-400">
                      Projet et thème définis sur la première diapositive. Modifiables à tout moment depuis l'en-tête de l'atelier.
                    </p>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={() => onLaunchSession(sessionId || "")}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-bold transition-all shadow-sm hover:shadow-md"
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
                      className="px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium transition"
                      title="Générer un nouvel ID"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ),
      },
    ],
    [participantUrl, sessionId, onLaunchSession, saveMeta, goModerator, projectName, themeName, situationActuelle, perimetre, docExtracted, setShowContextModal, aiConfigured, setAiConfigured]
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

      {/* ---- Modal contexte ---- */}
      {showContextModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Contexte de la session</h2>
              <button
                onClick={() => setShowContextModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Situation actuelle */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Situation actuelle
              </label>
              <textarea
                value={situationActuelle}
                onChange={(e) => setSituationActuelle(e.target.value)}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                placeholder="Ex : Le programme est en phase d'exécution depuis 2 ans, les résultats restent en deçà des objectifs initiaux..."
              />
            </div>

            {/* Symptômes observables */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Symptômes observables
              </label>
              <textarea
                value={symptomesObservables}
                onChange={(e) => setSymptomesObservables(e.target.value)}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                placeholder="Ex : Faible taux de participation, retards fréquents, conflits entre parties prenantes, budget non consommé..."
              />
            </div>

            {/* Périmètre */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Périmètre (zone / population concernée)
              </label>
              <input
                value={perimetre}
                onChange={(e) => setPerimetre(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Ex : Région Nord, 12 communes, 50 000 bénéficiaires"
              />
            </div>

            {/* Upload document */}
            <div className="mb-4 border-t pt-5">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Document de référence
                <span className="text-xs font-normal text-gray-500 ml-1">(TDR, rapport… PDF, DOCX, TXT)</span>
              </label>
              <div className="flex items-center gap-3">
                <label className={`cursor-pointer px-4 py-2 rounded-lg border text-sm font-medium ${extractingDoc ? "opacity-60 pointer-events-none" : "bg-gray-50 hover:bg-gray-100"}`}>
                  {extractingDoc ? "Extraction en cours…" : "Choisir un fichier"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    disabled={extractingDoc}
                    onChange={handleFileUpload}
                  />
                </label>
                {extractingDoc && (
                  <span className="text-xs text-indigo-600 animate-pulse">
                    L'IA analyse le document…
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Seuls les éléments extraits (problématique, acteurs, zone, enjeux) seront utilisés par l'IA — jamais le document brut.
              </p>
            </div>

            {/* Bloc extrait éditable */}
            {docExtracted && (
              <div className="mb-5 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-indigo-800">Éléments extraits du document</h3>
                  <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                    Vérifiez et corrigez si nécessaire
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-indigo-700">Problématique</label>
                    <textarea
                      value={docExtracted.problematique}
                      onChange={(e) => setDocExtracted({ ...docExtracted, problematique: e.target.value })}
                      rows={2}
                      className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-indigo-700">Acteurs</label>
                    <input
                      value={docExtracted.acteurs}
                      onChange={(e) => setDocExtracted({ ...docExtracted, acteurs: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-indigo-700">Zone / Population</label>
                    <input
                      value={docExtracted.zone}
                      onChange={(e) => setDocExtracted({ ...docExtracted, zone: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-indigo-700">Enjeux</label>
                    <textarea
                      value={docExtracted.enjeux}
                      onChange={(e) => setDocExtracted({ ...docExtracted, enjeux: e.target.value })}
                      rows={2}
                      className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => setShowContextModal(false)}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={saveMeta}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale vidéo */}
      {showVideo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowVideo(false)}
        >
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-4xl relative shadow-2xl">
            <button
              type="button"
              className="absolute top-4 right-4 z-[60] p-2 bg-white/90 rounded-full hover:bg-gray-100 shadow-sm transition"
              onClick={() => setShowVideo(false)}
              aria-label="Fermer la vidéo"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-600 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="p-5 md:p-7">
              <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
                <video className="w-full h-full" controls playsInline preload="metadata">
                  <source src={videoUrl} type="video/mp4" />
                </video>
              </div>
              <div className="mt-3 text-sm text-gray-500 text-center">
                <a href={videoUrl} target="_blank" rel="noreferrer" className="underline hover:text-gray-700">
                  Ouvrir dans un nouvel onglet
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

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
