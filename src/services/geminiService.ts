// src/services/geminiService.ts
// SDK historique Google Gemini
import { GoogleGenerativeAI } from "@google/generative-ai";

/** Types */
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
  // Fallback robuste si pas de clé : on renvoie les 4 premiers par quadrant
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

/* -------------------- 2) Orientations stratégiques -------------------- */
export async function proposeOrientations(args: {
  acquis: string[];
  faiblesses: string[];
  opportunites: string[];
  menaces: string[];
  /** Liste des marks "r,c" cochés dans la matrice */
  marks: string[];
}): Promise<{ orientations: string[] }> {
  const model = getModel();
  if (!model) return { orientations: [] }; // le front fera le fallback "auto"

  try {
    const prompt = [
      "Tu es un expert en stratégie utilisant une matrice AFOM (SWOT) et une matrice de confrontation.",
      "Les sélections 4×4 par quadrant sont données ci-dessous, ainsi que la liste des croisements cochés (marks) sous forme d’indices (r,c).",
      "Rédige 6 à 10 orientations stratégiques concises, chacune sur une ligne (impératif, concret).",
      "Exemples de formulations:",
      "- Capitaliser «A» pour saisir «O».",
      "- Corriger «F» pour exploiter «O».",
      "- Mobiliser «A» pour contrer «M».",
      "- Réduire «F» pour se prémunir de «M».",
      "Utiliser STRICTEMENT les libellés fournis, ne pas inventer de nouveaux termes.",
      "Répondre UNIQUEMENT en JSON: { \"orientations\": string[] }",
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

/* -------------------- 3) Analyse IA (compatibilité AnalysisMode) -------------------- */
/**
 * Renvoie { insights[], recommendations[] } à partir des 4 listes AFOM complètes.
 * - Conserve responseMimeType: "application/json"
 * - Fallback gracieux si absence de clé → tableaux vides
 */
export async function getAIAnalysis(input: {
  acquis: string[];
  faiblesses: string[];
  opportunites: string[];
  menaces: string[];
}): Promise<{ insights: string[]; recommendations: string[] }> {
  const model = getModel();
  if (!model) return { insights: [], recommendations: [] };

  try {
    const prompt = [
      "Analyse AFOM (SWOT) — produis des insights synthétiques et des recommandations actionnables.",
      "Réponds UNIQUEMENT en JSON: { \"insights\": string[], \"recommendations\": string[] }",
      "",
      `ACQUIS: ${JSON.stringify(input.acquis)}`,
      `FAIBLESSES: ${JSON.stringify(input.faiblesses)}`,
      `OPPORTUNITES: ${JSON.stringify(input.opportunites)}`,
      `MENACES: ${JSON.stringify(input.menaces)}`,
      "",
      "Consignes:",
      "- Insights: constats transverses (max 8, une phrase chacun).",
      "- Recommandations: actions concrètes (max 8, impératif, mesurables).",
      "- Ne pas créer de nouveaux intitulés techniques, rester simple.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);

    const ensureArr = (v: any) => (Array.isArray(v) ? v.map(String) : []);
    return {
      insights: ensureArr(parsed?.insights).slice(0, 12),
      recommendations: ensureArr(parsed?.recommendations).slice(0, 12),
    };
  } catch (e) {
    console.error("Gemini analysis error:", e);
    return { insights: [], recommendations: [] };
  }
}
