import { Type } from "@google/genai";

export type QuadrantKey = "acquis" | "faiblesses" | "opportunites" | "menaces";
export type PostItStatus = "active" | "bin";

export interface PostIt {
  id: string;
  sessionId: string;               // (= boardId / QR)
  quadrant: QuadrantKey;           // quadrant courant (quand actif)
  originQuadrant?: QuadrantKey;    // quadrant d’origine (couleur figée)
  sortIndex?: number;              // ordre dans son quadrant
  status?: PostItStatus;           // "active" (défaut) ou "bin" (panier)

  // pour restauration depuis le panier
  lastQuadrant?: QuadrantKey;
  lastSortIndex?: number;
  deletedAt?: any;                 // Date ou Firestore Timestamp

  content: string;
  author: string;
  timestamp: { seconds: number; nanoseconds: number } | Date;
}

export interface QuadrantData {
  key: QuadrantKey;
  title: string;
  subtitle: string;
  color: string;
  gradient: string;
  postIts: PostIt[];
}

export interface ContextDocument {
  name: string;
  problematique: string;
  acteurs: string;
  zone: string;
  enjeux: string;
}

export interface BoardContext {
  // Champ libre optionnel : quelques mots de contexte laissés par le modérateur.
  elementsContexte?: string;
  perimetre?: string;
  // Documents de contexte (TDR, cahier du participant...) — éléments extraits uniquement,
  // jamais le document brut envoyé à l'IA finale.
  documents?: ContextDocument[];
  // Champs legacy (sessions créées avant la fusion en un champ libre / avant le support
  // multi-documents) : conservés en lecture pour compatibilité, plus jamais écrits.
  situationActuelle?: string;
  symptomesObservables?: string;
  problematique?: string;
  acteurs?: string;
  zone?: string;
  enjeux?: string;
}

export interface BoardMeta {
  projectName: string;
  themeName: string;
  context?: BoardContext;
  createdAt?: any;
  updatedAt?: any;
}

export interface Workshop {
  id: string;
  title: string;
  deletedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface WorkshopGroup {
  id: string;
  workshopId: string;
  number: string;
  name: string;
  theme: string;
  sessionId: string;
  order: number;
  active: boolean;
  deletedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export type UserRole = "admin" | "moderator";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface Insight { title: string; content: string; }
export type RecommendationPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

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
export interface Contributor { name: string; count: number; totalWords: number; }
export interface QuadrantAnalysis { count: number; wordCount: number; }

export interface AnalysisData {
  metrics: AnalysisMetrics;
  quadrants: Record<QuadrantKey, QuadrantAnalysis>;
  timeline: { time: string; acquis: number; faiblesses: number; opportunites: number; menaces: number }[];
  contributors: Contributor[];
  insights: Insight[];
  recommendations: Recommendation[];
}

export const RecommendationSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A concise title for the recommendation." },
    content: { type: Type.STRING, description: "A detailed explanation of the strategic recommendation." },
    priority: { type: Type.STRING, enum: ["URGENT", "HIGH", "MEDIUM", "LOW"], description: "The priority level of the recommendation." },
  },
  required: ["title", "content", "priority"],
};

export const InsightSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A concise title for the insight." },
    content: { type: Type.STRING, description: "A detailed explanation of the strategic insight discovered from the data." },
  },
  required: ["title", "content"],
};
