import { QuadrantKey, RecommendationPriority } from './types';

interface QuadrantInfo {
  title: string;
  subtitle: string;
  color: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  gradient: string;
  description: string;
}

export const QUADRANT_INFO: Record<QuadrantKey, QuadrantInfo> = {
  acquis: {
    title: "Acquis",
    subtitle: "Succès • Réalisations désirées",
    color: "#4caf50",
    textColor: "text-green-800",
    borderColor: "border-green-600",
    bgColor: "bg-green-50",
    gradient: "from-green-500 to-green-400",
    description: "Forces • Succès • Réalisations désirées • Ce qu'on a aimé",
  },
  faiblesses: {
    title: "Faiblesses",
    subtitle: "Échecs • Aspects négatifs",
    color: "#f44336",
    textColor: "text-red-800",
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    gradient: "from-red-500 to-red-400",
    description: "Échecs • Aspects négatifs • Problèmes rencontrés • Ce qu'on n'a pas aimé",
  },
  opportunites: {
    title: "Opportunités",
    subtitle: "Potentialités • Ressources exploitables",
    color: "#10b981",
    textColor: "text-emerald-800",
    borderColor: "border-emerald-500",
    bgColor: "bg-emerald-50",
    gradient: "from-emerald-500 to-emerald-400",
    description: "Potentialités • Ressources exploitables • Atouts • Ce qu'on peut valoriser",
  },
  menaces: {
    title: "Menaces",
    subtitle: "Risques • Obstacles • Craintes",
    color: "#f97316",
    textColor: "text-orange-800",
    borderColor: "border-orange-500",
    bgColor: "bg-orange-50",
    gradient: "from-orange-500 to-orange-400",
    description: "Risques • Obstacles • Craintes • Suppositions pouvant influencer négativement",
  },
};

export const PRIORITY_STYLES: Record<RecommendationPriority, { icon: string; color: string; bg: string; borderColor: string; }> = {
    URGENT: { icon: '🚨', color: 'text-red-600', bg: 'bg-red-100', borderColor: 'border-red-500' },
    HIGH: { icon: '⚡', color: 'text-orange-600', bg: 'bg-orange-100', borderColor: 'border-orange-500' },
    MEDIUM: { icon: '📋', color: 'text-blue-600', bg: 'bg-blue-100', borderColor: 'border-blue-500' },
    LOW: { icon: '💡', color: 'text-green-600', bg: 'bg-green-100', borderColor: 'border-green-500' },
};
// --- Quadrants config minimaliste pour l'UI ---
export const QUADRANTS = {
  acquis: {
    title: "Acquis",
    subtitle: "Forces • Réalisations positives",
    textColor: "text-green-700",
    borderColor: "border-green-400",
    bgColor: "bg-green-50",
  },
  faiblesses: {
    title: "Faiblesses",
    subtitle: "Échecs • Aspects négatifs",
    textColor: "text-red-700",
    borderColor: "border-red-400",
    bgColor: "bg-red-50",
  },
  opportunites: {
    title: "Opportunités",
    subtitle: "Potentialités • Ressources exploitables",
    textColor: "text-teal-700",
    borderColor: "border-teal-400",
    bgColor: "bg-emerald-50",
  },
  menaces: {
    title: "Menaces",
    subtitle: "Risques • Obstacles • Craintes",
    textColor: "text-orange-700",
    borderColor: "border-orange-400",
    bgColor: "bg-orange-50",
  },
} as const;
