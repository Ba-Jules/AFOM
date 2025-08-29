// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/genai";

/**
 * Respect strict: responseMimeType = "application/json"
 */

type QuadrantKey = "acquis" | "faiblesses" | "opportunites" | "menaces";
type Selection = Record<QuadrantKey, string[]>;

export async function proposeMatrixSelection(lists: Selection): Promise<{ selection: Selection }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // Fallback robuste si pas de clé : on renvoie les 4 premiers par quadrant
  const fallback = {
    selection: {
      acquis: lists.acquis.slice(0, 4),
      faiblesses: lists.faiblesses.slice(0, 4),
      opportunites: lists.opportunites.slice(0, 4),
      menaces: lists.menaces.slice(0, 4),
    },
  };

  if (!apiKey) return fallback;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { responseMimeType: "application/json" },
    });

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
    const text = result.response?.text?.();
    if (!text) return fallback;

    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    const s = parsed?.selection;
    if (!s) return fallback;

    const ensureArray = (v: any) => Array.isArray(v) ? v.slice(0, 4).map(String) : [];
    return {
      selection: {
        acquis: ensureArray(s.acquis),
        faiblesses: ensureArray(s.faiblesses),
        opportunites: ensureArray(s.opportunites),
        menaces: ensureArray(s.menaces),
      },
    };
  } catch (e) {
    console.error("Gemini selection error:", e);
    return fallback;
  }
}

/** IA pour proposer des orientations stratégiques depuis la matrice */
export async function proposeOrientations(args: {
  acquis: string[];
  faiblesses: string[];
  opportunites: string[];
  menaces: string[];
  /** Liste de marks "r,c" sur la matrice (croisements cochés) */
  marks: string[];
}): Promise<{ orientations: string[] }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return { orientations: [] }; // on laisse le front faire l'auto-fallback

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { responseMimeType: "application/json" },
    });

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
    const text = result.response?.text?.();
    if (!text) return { orientations: [] };

    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed?.orientations) ? parsed.orientations.map(String) : [];
    return { orientations: arr.slice(0, 12) };
  } catch (e) {
    console.error("Gemini orientations error:", e);
    return { orientations: [] };
  }
}
