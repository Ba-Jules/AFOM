// Service Gemini — compatible “ancien SDK” @google/generative-ai
// Garde responseMimeType: "application/json" et renvoie des objets stricts.
// Fallback gracieux si VITE_GEMINI_API_KEY est absente.

import type { PostIt } from "../types";

type Insight = { title: string; content: string };
type Recommendation = { title: string; content: string; priority?: "HIGH" | "MEDIUM" | "LOW" };

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// On type-narrow dynamiquement pour éviter un hard-crash si la lib n'est pas disponible
let GoogleGenerativeAICtor: any = null;
try {
  // Ancien SDK
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GoogleGenerativeAICtor = (await import(/* @vite-ignore */ "@google/generative-ai")).GoogleGenerativeAI;
} catch {
  try {
    // Au cas où @google/genai serait présent
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    GoogleGenerativeAICtor = (await import(/* @vite-ignore */ "@google/genai")).GoogleGenerativeAI;
  } catch {
    GoogleGenerativeAICtor = null;
  }
}

function buildModel(modelName = "gemini-1.5-flash") {
  if (!API_KEY || !GoogleGenerativeAICtor) return null;
  const genAI = new GoogleGenerativeAICtor(API_KEY);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });
}

/** Fallback local “best effort” (aucune dépendance IA) */
function localAnalysisFallback(postIts: PostIt[]): { insights: Insight[]; recommendations: Recommendation[] } {
  const counts = { acquis: 0, faiblesses: 0, opportunites: 0, menaces: 0 } as Record<string, number>;
  postIts.forEach((p) => counts[p.quadrant] = (counts[p.quadrant] || 0) + 1);

  const insights: Insight[] = [
    { title: "Répartition AFOM", content: `A:${counts.acquis} • F:${counts.faiblesses} • O:${counts.opportunites} • M:${counts.menaces}` },
  ];

  const recommendations: Recommendation[] = [];
  if (counts.faiblesses + counts.menaces > counts.acquis + counts.opportunites) {
    recommendations.push({
      title: "Rééquilibrer les risques",
      content: "Prioriser des actions rapides pour réduire les faiblesses et atténuer les menaces.",
      priority: "HIGH",
    });
  } else {
    recommendations.push({
      title: "Capitaliser sur les points forts",
      content: "Accélérer les initiatives tirant parti des acquis et opportunités.",
      priority: "MEDIUM",
    });
  }

  return { insights, recommendations };
}

/** getAIAnalysis — garde le contrat JSON { insights[], recommendations[] } */
export async function getAIAnalysis(postIts: PostIt[]): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> {
  if (!API_KEY || !GoogleGenerativeAICtor) {
    return localAnalysisFallback(postIts);
  }
  const model = buildModel();
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

  const data = postIts.map((p) => ({
    quadrant: p.quadrant,
    text: p.content,
  }));

  const prompt = `${sys}\nDONNÉES:\n${JSON.stringify(data, null, 2)}\nConsidère concision et actionnabilité.`;

  try {
    const res = await model.generateContent(prompt as any);
    const text = (res?.response as any)?.text?.() ?? "";
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

  if (!API_KEY || !GoogleGenerativeAICtor) {
    // Fallback minimal local
    const text =
      mode === "fm"
        ? "Problème central (heuristique) : réduire l'impact des menaces en corrigeant les faiblesses prioritaires."
        : "Problème central (heuristique) : focaliser l'organisation sur un levier unique de transformation à fort impact.";
    return { problem: text, rationale: "Généré hors-ligne (fallback) sur une base heuristique." };
  }
  const model = buildModel();
  if (!model) {
    return { problem: "Problème central (fallback) : prioriser un levier d'impact élevé.", rationale: "SDK indisponible." };
  }

  const filtered =
    mode === "fm"
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

  const data = filtered.map((p) => ({
    quadrant: p.quadrant,
    text: p.content,
  }));

  const prompt = `${sys}\nMODE: ${mode}\nDONNÉES:\n${JSON.stringify(data, null, 2)}`;

  try {
    const res = await model.generateContent(prompt as any);
    const text = (res?.response as any)?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    return {
      problem: String(json.problem || "").slice(0, 400),
      rationale: typeof json.rationale === "string" ? json.rationale : undefined,
    };
  } catch (e) {
    console.error("Gemini proposeCentralProblem failed:", e);
    return {
      problem:
        mode === "fm"
          ? "Problème central (fallback) : maîtriser les risques prioritaires en corrigeant les faiblesses critiques."
          : "Problème central (fallback) : concentrer les efforts sur un objectif unificateur à fort effet levier.",
      rationale: "Erreur IA, texte de repli.",
    };
  }
}
