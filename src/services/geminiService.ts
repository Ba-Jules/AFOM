// src/services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import {
  PostIt,
  Insight,
  Recommendation,
  InsightSchema,
  RecommendationSchema,
} from "../types";

// ⚠️ En front, Vite expose uniquement les variables qui commencent par VITE_
// Dans GitHub Actions, définis le secret GEMINI_API_KEY et exporte-le en
// VITE_GEMINI_API_KEY pour le build (voir workflow).
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!API_KEY) {
  // On logge explicitement pour faciliter le debug.
  // (On laisse l'app lever une erreur au premier appel.)
  console.error(
    "VITE_GEMINI_API_KEY manquante. Ajoute GEMINI_API_KEY (Secret GitHub) et exporte-la au build en VITE_GEMINI_API_KEY."
  );
}

// Instanciation SDK
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function getAIAnalysis(
  postIts: PostIt[]
): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> {
  if (!API_KEY) {
    throw new Error(
      "Clé API absente. Configure GEMINI_API_KEY (Secret GitHub) et exporte-la au build via VITE_GEMINI_API_KEY."
    );
  }

  // Petit garde-fou : on exige un minimum d’inputs pour éviter du bruit
  if (!Array.isArray(postIts) || postIts.length < 5) {
    return { insights: [], recommendations: [] };
  }

  const formattedData = postIts.map((p) => ({
    quadrant: p.quadrant,
    author: p.author,
    content: p.content,
  }));

  const prompt = `
Analyse les données AFOM (SWOT) issues d'un atelier collaboratif.
Chaque élément est un post-it avec : quadrant ('acquis', 'faiblesses', 'opportunites', 'menaces'), author et content.

Exige exactement 3 insights (titre + contenu) et 3 recommendations (titre + contenu + priorité parmi URGENT/HIGH/MEDIUM/LOW).
Sois concis, actionnable et pertinent.

Données:
${JSON.stringify(formattedData, null, 2)}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "Tu es un stratège d'entreprise de haut niveau. Donne des réponses concises, concrètes et actionnables. Retourne exactement 3 insights et 3 recommendations.",
        // ✅ Contraint la sortie au JSON correspondant à tes schémas
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["insights", "recommendations"],
          properties: {
            insights: {
              type: Type.ARRAY,
              description:
                "3 insights stratégiques dérivés des données AFOM. Chaque item: {title, content}.",
              items: InsightSchema,
            },
            recommendations: {
              type: Type.ARRAY,
              description:
                "3 recommandations actionnables avec niveau de priorité. Chaque item: {title, content, priority}.",
              items: RecommendationSchema,
            },
          },
        },
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    });

    const jsonText = (response.text ?? "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      // Remonte une erreur claire si la réponse n’est pas du JSON
      throw new Error(
        "Réponse non-JSON du modèle (response.text). Extrait: " +
          jsonText.slice(0, 200)
      );
    }

    return {
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Fallback non bloquant pour l'app
    return {
      insights: [
        {
          title: "AI Analysis Error",
          content:
            "Impossible de générer l'analyse (clé API/config/quota ?). Vérifie la console et la configuration.",
        },
      ],
      recommendations: [],
    };
  }
}
