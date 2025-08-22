
import { GoogleGenAI, Type } from "@google/genai";
import { PostIt, Insight, Recommendation, InsightSchema, RecommendationSchema } from '../types';

if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const getAIAnalysis = async (postIts: PostIt[]): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> => {
    if (!process.env.API_KEY) {
        throw new Error("API key is not configured.");
    }

    if (postIts.length < 5) {
        return { insights: [], recommendations: [] };
    }

    const formattedData = postIts.map(p => ({
        quadrant: p.quadrant,
        author: p.author,
        content: p.content,
    }));

    const prompt = `
        Analyze the following AFOM (SWOT) data from a collaborative workshop.
        The data is an array of JSON objects, where each object is a post-it note with a quadrant ('acquis', 'faiblesses', 'opportunites', 'menaces'), an author, and content.
        
        Data:
        ${JSON.stringify(formattedData, null, 2)}
        
        Based on this data, generate strategic insights and actionable recommendations.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "You are a world-class business strategist and workshop facilitator. Your task is to provide sharp, insightful, and actionable feedback based on AFOM (Acquis, Faiblesses, Opportunités, Menaces) analysis data. Provide 3 insights and 3 recommendations.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        insights: {
                            type: Type.ARRAY,
                            description: "Generate 3 strategic insights derived from the provided AFOM data.",
                            items: InsightSchema,
                        },
                        recommendations: {
                            type: Type.ARRAY,
                            description: "Generate 3 actionable recommendations with clear priority levels.",
                            items: RecommendationSchema,
                        },
                    },
                },
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        return {
            insights: result.insights || [],
            recommendations: result.recommendations || [],
        };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Fallback to empty arrays in case of API error
        return {
            insights: [{title: "AI Analysis Error", content: "Could not generate insights due to an API error. Please check the console."}],
            recommendations: [],
        };
    }
};
