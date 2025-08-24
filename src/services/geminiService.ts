import { GoogleGenAI, Type } from "@google/genai";
import {
  PostIt,
  Insight,
  Recommendation,
  InsightSchema,
  RecommendationSchema,
} from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!API_KEY) {
  console.error(
    "[Gemini] VITE_GEMINI_API_KEY manquante. Ajoute le secret GEMINI_API_KEY et exporte-le au build en VITE_GEMINI_API_KEY."
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// On tente plusieurs modèles, du plus récent au plus compatible
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];

export async function getAIAnalysis(
  postIts: PostIt[]
): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> {
  if (!API_KEY) {
    return {
      insights: [
        {
          title: "Configuration manquante",
          content:
            "La clé VITE_GEMINI_API_KEY n’est pas injectée au build. Vérifie le secret GEMINI_API_KEY et le workflow.",
        },
      ],
      recommendations: [],
    };
  }

  if (!Array.isArray(postIts) || postIts.length < 5) {
    return { insights: [], recommendations: [] };
  }

  const formatted = postIts.map((p) => ({
    quadrant: p.quadrant,
    author: p.author,
    content: p.content,
  }));

  const prompt = `
Analyse AFOM (SWOT) issue d'un atelier collaboratif.
Retourne STRICTEMENT 3 "insights" (title, content) et 3 "recommendations" (title, content, priority parmi URGENT/HIGH/MEDIUM/LOW).

Données:
${JSON.stringify(formatted, null, 2)}
`.trim();

  async function tryModel(model: string) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        generationConfig: {
          // JSON structuré
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["insights", "recommendations"],
            properties: {
              insights: {
                type: Type.ARRAY,
                items: InsightSchema,
                description:
                  "3 insights stratégiques (chaque item: {title, content}).",
              },
              recommendations: {
                type: Type.ARRAY,
                items: RecommendationSchema,
                description:
                  "3 recommandations actionnables (chaque item: {title, content, priority}).",
              },
            },
          },
          temperature: 0.4,
          maxOutputTokens: 800,
        },
      });

      const text = (res.text ?? "").trim();
      const parsed = JSON.parse(text);
      const insights: Insight[] = Array.isArray(parsed?.insights)
        ? parsed.insights
        : [];
      const recommendations: Recommendation[] = Array.isArray(
        parsed?.recommendations
      )
        ? parsed.recommendations
        : [];

      if (insights.length && recommendations.length) {
        return { ok: true as const, insights, recommendations };
      }
      return { ok: false as const, error: "Réponse vide ou incomplète" };
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const body = err?.response?.data ?? err?.message ?? String(err);
      console.error(`[Gemini] Échec sur ${model}`, { status, body });
      return { ok: false as const, error: body };
    }
  }

  for (const model of MODEL_CANDIDATES) {
    const r = await tryModel(model);
    if (r.ok) {
      return { insights: r.insights, recommendations: r.recommendations };
    }
  }

  return {
    insights: [
      {
        title: "AI Analysis Error",
        content:
          "Impossible de générer l’analyse (clé/domaine/quota/modèle). Ouvre la console : les logs [Gemini] donnent le détail.",
      },
    ],
    recommendations: [],
  };
}
