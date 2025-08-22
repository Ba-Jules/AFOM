import { Type } from "@google/genai";

export type QuadrantKey = 'acquis' | 'faiblesses' | 'opportunites' | 'menaces';

export interface PostIt {
  id: string;
  sessionId: string;
  quadrant: QuadrantKey;
  content: string;
  author: string;
  timestamp:
    | {
        seconds: number;
        nanoseconds: number;
      }
    | Date;

  /** Ordre d’affichage persistant dans le cadran (facultatif si non encore initialisé) */
  sortIndex?: number;

  /** Quadrant d’origine pour figer la couleur, même après déplacement */
  originQuadrant?: QuadrantKey;
}

export interface QuadrantData {
  key: QuadrantKey;
  title: string;
  subtitle: string;
  color: string;
  gradient: string;
  postIts: PostIt[];
}

export interface Insight {
  title: string;
  content: string;
}

export type RecommendationPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Recommendation {
  title: string;
  content: string;
  priority: RecommendationPriority;
}

export interface AnalysisMetrics {
  totalContributions: number;
  uniqueParticipants: number;
  sessionDuration: number;
  engagementScore: number;
}

export interface Contributor {
  name: string;
  count: number;
  totalWords: number;
}

export interface QuadrantAnalysis {
  count: number;
  wordCount: number;
}

export interface AnalysisData {
  metrics: AnalysisMetrics;
  quadrants: Record<QuadrantKey, QuadrantAnalysis>;
  timeline: {
    time: string;
    acquis: number;
    faiblesses: number;
    opportunites: number;
    menaces: number;
  }[];
  contributors: Contributor[];
  insights: Insight[];
  recommendations: Recommendation[];
}

export const RecommendationSchema = {
  type: Type.OBJECT,
  properties: {
    ti
