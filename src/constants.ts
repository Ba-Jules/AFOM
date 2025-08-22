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
    color: "#66bb6a", // Lighter green
    textColor: "text-green-800",
    borderColor: "border-green-500",
    bgColor: "bg-green-50",
    gradient: "from-green-400 to-green-300",
    description: "Potentialités • Ressources exploitables • Atouts • Ce qu'on peut valoriser",
  },
  menaces: {
    title: "Menaces",
    subtitle: "Risques • Obstacles • Craintes",
    color: "#ef5350", // Lighter red
    textColor: "text-red-800",
    borderColor: "border-red-500",
    bgColor: "bg-red-50",
    gradient: "from-red-400 to-red-300",
    description: "Risques • Obstacles • Craintes • Suppositions pouvant influencer négativement",
  },
};

export const PRIORITY_STYLES: Record<RecommendationPriority, { icon: string; color: string; bg: string; borderColor: string; }> = {
    URGENT: { icon: '🚨', color: 'text-red-600', bg: 'bg-red-100', borderColor: 'border-red-500' },
    HIGH: { icon: '⚡', color: 'text-orange-600', bg: 'bg-orange-100', borderColor: 'border-orange-500' },
    MEDIUM: { icon: '📋', color: 'text-blue-600', bg: 'bg-blue-100', borderColor: 'border-blue-500' },
    LOW: { icon: '💡', color: 'text-green-600', bg: 'bg-green-100', borderColor: 'border-green-500' },
};
