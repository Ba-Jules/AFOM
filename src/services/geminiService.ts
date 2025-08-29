// Service Gemini — compat ancien SDK (@google/generative-ai) et nouveau (@google/genai).
// Fournit: getAIAnalysis, proposeCentralProblem, proposeMatrixSelection, proposeOrientations.
// Tous renvoient du JSON, avec fallback heuristique quand l'API n'est pas dispo.

import type { PostIt, QuadrantKey } from "../types";

type Insight = { title: string; content: string };
type Recommendation = { title: string; content: string; priority?: "HIGH" | "MEDIUM" | "LOW" };

const API_KEY: string | undefined = import.meta.env.VITE_GEMINI_API_KEY as any;

/** Charge dynamiquement le constructeur GoogleGenerativeAI depuis l'un des SDKs */
let _CtorCache: any | undefined;
async function loadGoogleCtor(): Promise<any | null> {
  if (_CtorCache !== undefined) return _CtorCache;
  // Try legacy @google/generative-ai
  try {
    const mod: any = await import(/* @vite-ignore */ "@google/generative-ai");
    if (mod && (mod as any).GoogleGenerativeAI) {
      _CtorCache = (mod as any).GoogleGenerativeAI;
      return _CtorCache;
    }
  } catch (e) {
    // ignore
  }
  // Try new @google/genai
  try {
    const mod: any = await import(/* @vite-ignore */ "@google/genai");
    const ctor = (mod as any).GoogleGenerativeAI || (mod as any).GoogleAI || null;
    _CtorCache = ctor;
    return _CtorCache;
  } catch (e) {
    _CtorCache = null;
    return null;
  }
}

async function getModel(modelName = "gemini-1.5-flash"): Promise<any | null> {
  if (!API_KEY) return null;
  const Ctor = await loadGoogleCtor();
  if (!Ctor) return null;
  try {
    const genAI = new (Ctor as any)(API_KEY);
    const model = (genAI as any).getGenerativeModel
      ? (genAI as any).getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        })
      : null;
    return model;
  } catch {
    return null;
  }
}

/** -------- Fallbacks locaux (sans IA) -------- */
function localAnalysisFallback(postIts: PostIt[]): { insights: Insight[]; recommendations: Recommendation[] } {
  const counts: Record<string, number> = { acquis: 0, faiblesses: 0, opportunites: 0, menaces: 0 };
  for (const p of postIts) counts[p.quadrant] = (counts[p.quadrant] || 0) + 1;

  const insights: Insight[] = [
    { title: "Répartition AFOM", content: `A:${counts.acquis} • F:${counts.faiblesses} • O:${counts.opportunites} • M:${counts.menaces}` },
  ];
  const recommendations: Recommendation[] = [];
  if (counts.faiblesses + counts.menaces > counts.acquis + counts.opportunites) {
    recommendations.push({ title: "Réduire les risques", content: "Prioriser la correction des faiblesses et l'atténuation des menaces.", priority: "HIGH" });
  } else {
    recommendations.push({ title: "Capitaliser sur les acquis", content: "Accélérer les initiatives qui exploitent les acquis et opportunités.", priority: "MEDIUM" });
  }
  return { insights, recommendations };
}

function localCentralFallback(mode: "full" | "fm"): { problem: string; rationale: string } {
  return mode === "fm"
    ? { problem: "Réduire l'impact des menaces en corrigeant les faiblesses prioritaires.", rationale: "Synthèse heuristique F+M (fallback sans IA)." }
    : { problem: "Focaliser les efforts sur un levier unique de transformation à fort impact.", rationale: "Synthèse heuristique AFOM complet (fallback sans IA)." };
}

function pickTopPerQuadrant(postIts: PostIt[], n = 4): Record<QuadrantKey, string[]> {
  const result: Record<QuadrantKey, string[]> = {
    acquis: [], faiblesses: [], opportunites: [], menaces: []
  };
  const byQ: Record<QuadrantKey, PostIt[]> = { acquis: [], faiblesses: [], opportunites: [], menaces: [] };
  for (const p of postIts) {
    if ((p as any).status === "bin") continue;
    byQ[p.quadrant].push(p);
  }
  (Object.keys(byQ) as QuadrantKey[]).forEach((k) => {
    const arr = byQ[k].slice().sort((a: any, b: any) => {
      // Favori d'abord si flag présent, sinon par sortIndex croissant puis timestamp
      const fa = (a as any).favorite ? 1 : 0;
      const fb = (b as any).favorite ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const sa = (a as any).sortIndex ?? 0;
      const sb = (b as any).sortIndex ?? 0;
      if (sa !== sb) return sa - sb;
      const ta = (a as any).timestamp?.seconds ?? 0;
      const tb = (b as any).timestamp?.seconds ?? 0;
      return ta - tb;
    });
    result[k] = arr.slice(0, n).map((x) => x.id);
  });
  return result;
}

/** -------- Fonctions exportées -------- */

/** getAIAnalysis — JSON { insights[], recommendations[] } */
export async function getAIAnalysis(postIts: PostIt[]): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> {
  const model = await getModel();
  if (!model) return localAnalysisFallback(postIts);

  const sys = `
Tu es un assistant d'analyse stratégique AFOM. 
Retourne STRICTEMENT du JSON de la forme:
{
  "insights": [{"title": "...","content":"..."}],
  "recommendations":[{"title":"...","content":"...","priority":"HIGH|MEDIUM|LOW"}]
}
Ne mets AUCUN autre texte hors JSON.
`.trim();

  const data = postIts.map((p) => ({ quadrant: p.quadrant, text: p.content }));
  const prompt = `${sys}\nDONNÉES:\n${JSON.stringify(data, null, 2)}\nConsidère concision et actionnabilité.`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    const insights: Insight[] = Array.isArray(json.insights) ? json.insights : [];
    const recommendations: Recommendation[] = Array.isArray(json.recommendations) ? json.recommendations : [];
    return { insights, recommendations };
  } catch (e) {
    console.error("Gemini getAIAnalysis failed:", e);
    return localAnalysisFallback(postIts);
  }
}

/** proposeCentralProblem — JSON { problem, rationale } ; options.mode : 'full' | 'fm' */
export async function proposeCentralProblem(
  postIts: PostIt[],
  options: { mode?: "full" | "fm" } = {}
): Promise<{ problem: string; rationale?: string }> {
  const { mode = "full" } = options;
  const model = await getModel();
  if (!model) {
    const fb = localCentralFallback(mode);
    return { problem: fb.problem, rationale: fb.rationale };
  }

  const filtered = mode === "fm"
    ? postIts.filter((p) => p.quadrant === "faiblesses" || p.quadrant === "menaces")
    : postIts;

  const sys = `
Tu es un stratège. À partir d'idées AFOM, propose UN SEUL problème central, court (<= 240 caractères), clair, actionnable.
Retourne STRICTEMENT du JSON:
{
  "problem": "…",
  "rationale": "…"
}
`.trim();

  const data = filtered.map((p) => ({ quadrant: p.quadrant, text: p.content }));
  const prompt = `${sys}\nMODE: ${mode}\nDONNÉES:\n${JSON.stringify(data, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    return {
      problem: String(json.problem || "").slice(0, 400),
      rationale: typeof json.rationale === "string" ? json.rationale : undefined,
    };
  } catch (e) {
    console.error("Gemini proposeCentralProblem failed:", e);
    const fb = localCentralFallback(mode);
    return { problem: fb.problem, rationale: fb.rationale };
  }
}

/** proposeMatrixSelection — choisit N étiquettes par quadrant (par défaut 4) ; renvoie { selection } */
export async function proposeMatrixSelection(
  postIts: PostIt[],
  options: { perQuadrant?: number } = {}
): Promise<{ selection: Record<QuadrantKey, string[]>; rationale?: string }> {
  const n = options.perQuadrant ?? 4;

  // Si IA indisponible, heuristique locale
  const model = await getModel();
  if (!model) {
    const selection = pickTopPerQuadrant(postIts, n);
    return { selection, rationale: "Sélection heuristique locale (favoris, ordre, timestamp)." };
  }

  // Prompt IA — renvoyer uniquement des IDs
  const byQ: Record<QuadrantKey, Array<{ id: string; text: string }>> = {
    acquis: [], faiblesses: [], opportunites: [], menaces: []
  };
  for (const p of postIts) {
    if ((p as any).status === "bin") continue;
    byQ[p.quadrant].push({ id: p.id, text: p.content });
  }

  const sys = `
Tu aides à préparer une Matrice de confrontation AFOM.
Pour chaque quadrant, choisis jusqu'à ${n} étiquettes les PLUS représentatives (équilibre, diversité, impact).
Retourne STRICTEMENT du JSON:
{
  "selection": {
    "acquis": ["id1","id2","id3","id4"],
    "faiblesses": ["..."],
    "opportunites": ["..."],
    "menaces": ["..."]
  },
  "rationale": "..."
}
Uniquement des IDs dans "selection". Pas de texte libre hors JSON.
`.trim();

  const prompt = `${sys}\nDONNÉES:\n${JSON.stringify(byQ, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    const selection = json.selection && typeof json.selection === "object"
      ? json.selection
      : pickTopPerQuadrant(postIts, n);
    return { selection, rationale: typeof json.rationale === "string" ? json.rationale : undefined };
  } catch (e) {
    console.error("Gemini proposeMatrixSelection failed:", e);
    const selection = pickTopPerQuadrant(postIts, n);
    return { selection, rationale: "Erreur IA, sélection heuristique locale." };
  }
}

/** proposeOrientations — à partir d'une matrice (ou des paires O×A / O×F / M×A / M×F), génère 4–8 orientations synthétiques */
export async function proposeOrientations(
  input: any
): Promise<{ orientations: string[]; rationale?: string }> {
  const model = await getModel();
  if (!model) {
    // Fallback simple
    return {
      orientations: [
        "Déployer un plan de réduction des risques critiques (M×F).",
        "Capitaliser des acquis pour saisir 1–2 opportunités rapides (O×A).",
        "Renforcer les capacités internes sur les faiblesses majeures (M×F).",
        "Expérimenter un pilote à fort levier aligné sur l'opportunité #1 (O×A).",
      ],
      rationale: "Généré localement (fallback), basé sur des combinaisons classiques de la matrice."
    };
  }

  const sys = `
À partir de la matrice de confrontation AFOM (paires O×A, O×F, M×A, M×F, avec notes/scores éventuels),
propose 4 à 8 **orientations stratégiques** concrètes, formulées en une phrase chacune (style actionnable).
Retourne STRICTEMENT du JSON:
{
  "orientations": ["...","..."],
  "rationale": "..."
}
Pas d'autre texte hors JSON.
`.trim();

  const prompt = `${sys}\nDONNÉES:\n${JSON.stringify(input ?? {}, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    const orientations: string[] = Array.isArray(json.orientations) ? json.orientations : [];
    return {
      orientations: orientations.length ? orientations : [
        "Prioriser 2 actions défensives pour réduire les menaces majeures.",
        "Accélérer 1 initiative offensive s’appuyant sur les acquis pour saisir une opportunité clé."
      ],
      rationale: typeof json.rationale === "string" ? json.rationale : undefined
    };
  } catch (e) {
    console.error("Gemini proposeOrientations failed:", e);
    return {
      orientations: [
        "Structurer un plan d'atténuation des risques critiques (M×F).",
        "Mobiliser les forces existantes pour capter une opportunité prioritaire (O×A).",
      ],
      rationale: "Erreur IA, orientations de repli."
    };
  }
}
