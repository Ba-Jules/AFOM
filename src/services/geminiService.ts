// src/services/geminiService.ts
// SDK historique Google Gemini (on ne casse rien côté UI)
import { GoogleGenerativeAI } from "@google/generative-ai";

/** Types simples internes */
type QuadrantKey = "acquis" | "faiblesses" | "opportunites" | "menaces";
type Selection = Record<QuadrantKey, string[]>;

function getApiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
}

function getModel() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: { responseMimeType: "application/json" },
  });
}

/* -------------------- 1) Sélection 4×4 pour la Matrice -------------------- */
export async function proposeMatrixSelection(
  lists: Selection
): Promise<{ selection: Selection }> {
  const fallback = {
    selection: {
      acquis: lists.acquis.slice(0, 4),
      faiblesses: lists.faiblesses.slice(0, 4),
      opportunites: lists.opportunites.slice(0, 4),
      menaces: lists.menaces.slice(0, 4),
    },
  };

  const model = getModel();
  if (!model) return fallback;

  try {
    const prompt = [
      "Tu es un expert AFOM (SWOT).",
      "À partir des listes ci-dessous, choisis STRICTEMENT 4 étiquettes par quadrant (ou moins si indisponible).",
      "Renvoie uniquement un JSON: { \"selection\": { \"acquis\":[], \"faiblesses\":[], \"opportunites\":[], \"menaces\":[] } }",
      "",
      `ACQUIS: ${JSON.stringify(lists.acquis)}`,
      `FAIBLESSES: ${JSON.stringify(lists.faiblesses)}`,
      `OPPORTUNITES: ${JSON.stringify(lists.opportunites)}`,
      `MENACES: ${JSON.stringify(lists.menaces)}`,
      "",
      "Contraintes:",
      "- Choisir dans les listes fournies uniquement (pas de nouveaux libellés).",
      "- Critères: représentativité, impact stratégique, non-redondance, clarté.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    const s = parsed?.selection;

    const ensureArray = (v: any) =>
      Array.isArray(v) ? v.slice(0, 4).map(String) : [];

    return s
      ? {
          selection: {
            acquis: ensureArray(s.acquis),
            faiblesses: ensureArray(s.faiblesses),
            opportunites: ensureArray(s.opportunites),
            menaces: ensureArray(s.menaces),
          },
        }
      : fallback;
  } catch (e) {
    console.error("Gemini selection error:", e);
    return fallback;
  }
}

/* -------------------- 2) Orientations stratégiques depuis la Matrice -------------------- */
export async function proposeOrientations(args: {
  acquis: string[];
  faiblesses: string[];
  opportunites: string[];
  menaces: string[];
  marks: string[]; // "r,c"
}): Promise<{ orientations: string[] }> {
  const model = getModel();
  if (!model) return { orientations: [] }; // le front gère le fallback auto

  try {
    const prompt = [
      "Tu es un expert en stratégie utilisant une matrice AFOM (SWOT) et une matrice de confrontation.",
      "Les sélections 4×4 par quadrant sont données ci-dessous, ainsi que la liste des croisements cochés (marks) sous forme d’indices (r,c).",
      "Rédige 6 à 10 orientations stratégiques concises, chacune sur une ligne (impératif, concret).",
      "Exemples:",
      "- Capitaliser «A» pour saisir «O».",
      "- Corriger «F» pour exploiter «O».",
      "- Mobiliser «A» pour contrer «M».",
      "- Réduire «F» pour se prémunir de «M».",
      "Utilise STRICTEMENT les libellés fournis.",
      "Réponds UNIQUEMENT en JSON: { \"orientations\": string[] }",
      "",
      `ACQUIS: ${JSON.stringify(args.acquis)}`,
      `FAIBLESSES: ${JSON.stringify(args.faiblesses)}`,
      `OPPORTUNITES: ${JSON.stringify(args.opportunites)}`,
      `MENACES: ${JSON.stringify(args.menaces)}`,
      `MARKS (r,c): ${JSON.stringify(args.marks)}`,
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed?.orientations)
      ? parsed.orientations.map(String)
      : [];
    return { orientations: arr.slice(0, 12) };
  } catch (e) {
    console.error("Gemini orientations error:", e);
    return { orientations: [] };
  }
}

/* -------------------- 3) Analyse IA (compat AnalysisMode) -------------------- */
/**
 * Surcharges compatibles :
 * - getAIAnalysis({ acquis, faiblesses, opportunites, menaces })
 * - getAIAnalysis(postIts: PostItLike[])  // ← pour AnalysisMode existant
 *
 * Retourne des objets au bon format pour AnalysisMode :
 *   insights: { title, content }[]
 *   recommendations: { title, content, priority }[]
 */
type AFOMLists = {
  acquis: string[];
  faiblesses: string[];
  opportunites: string[];
  menaces: string[];
};

type PostItLike = { quadrant: string; content?: string; status?: string };

export function getAIAnalysis(input: AFOMLists): Promise<{ insights: any[]; recommendations: any[] }>;
export function getAIAnalysis(input: PostItLike[]): Promise<{ insights: any[]; recommendations: any[] }>;
export async function getAIAnalysis(
  input: AFOMLists | PostItLike[]
): Promise<{ insights: any[]; recommendations: any[] }> {
  const lists: AFOMLists = Array.isArray(input)
    ? groupFromPostIts(input as PostItLike[])
    : (input as AFOMLists);

  const model = getModel();
  if (!model) {
    return {
      insights: [],
      recommendations: [],
    };
  }

  try {
    const prompt = [
      "Analyse AFOM (SWOT) — produis des insights synthétiques et des recommandations actionnables.",
      "Réponds UNIQUEMENT en JSON: { \"insights\": string[], \"recommendations\": string[] }",
      "",
      `ACQUIS: ${JSON.stringify(lists.acquis)}`,
      `FAIBLESSES: ${JSON.stringify(lists.faiblesses)}`,
      `OPPORTUNITES: ${JSON.stringify(lists.opportunites)}`,
      `MENACES: ${JSON.stringify(lists.menaces)}`,
      "",
      "Consignes:",
      "- Insights: constats transverses (max 8, une phrase chacun).",
      "- Recommandations: actions concrètes (max 8, impératif, mesurables).",
      "- Ne pas inventer de nouveaux sigles; rester clair et court.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);

    const strArr = (v: any) => (Array.isArray(v) ? v.map((x) => String(x)) : []);

    // Normalisation → objets attendus par AnalysisMode
    const insightsText = strArr(parsed?.insights).slice(0, 12);
    const recsText = strArr(parsed?.recommendations).slice(0, 12);

    const insights = insightsText.map((t: string, i: number) => ({
      title: `Insight ${i + 1}`,
      content: t,
    }));

    const recommendations = recsText.map((t: string) => ({
      title: t.replace(/^[\[\(]?(haute|élevée|moyenne|basse|high|medium|low)[\]\)]?\s*:/i, "").trim().slice(0, 80) || "Recommandation",
      content: t,
      // Heuristique simple : on infère la priorité à partir de mots-clés, sinon "Moyenne".
      priority: inferPriority(t),
    }));

    return { insights, recommendations };
  } catch (e) {
    console.error("Gemini analysis error:", e);
    return { insights: [], recommendations: [] };
  }
}

/* -------------------- Helpers -------------------- */
function groupFromPostIts(items: PostItLike[]): AFOMLists {
  const A: string[] = [], F: string[] = [], O: string[] = [], M: string[] = [];
  for (const it of items) {
    if (it.status === "bin") continue;
    const txt = (it.content || "").trim();
    if (!txt) continue;
    if (it.quadrant === "acquis") A.push(txt);
    else if (it.quadrant === "faiblesses") F.push(txt);
    else if (it.quadrant === "opportunites") O.push(txt);
    else if (it.quadrant === "menaces") M.push(txt);
  }
  return { acquis: A, faiblesses: F, opportunites: O, menaces: M };
}

function inferPriority(text: string): string {
  const t = text.toLowerCase();
  if (/\b(urgent|critique|immédiat|immediate|critical|urgent|prioritaire|high)\b/.test(t)) return "High";
  if (/\b(moyen|medium|normal|planifier|next)\b/.test(t)) return "Medium";
  if (/\b(faible|low|optionnel|later)\b/.test(t)) return "Low";
  // fallback
  return "Medium";
}
