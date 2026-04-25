import React, { useState } from "react";
import {
  getStoredAIConfig,
  setStoredAIConfig,
  clearStoredAIConfig,
} from "../services/aiProviderService";

// ─── Providers ───────────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: "gemini",
    name: "Gemini (Google)",
    short: "Gemini",
    placeholder: "AIza…",
    guide: {
      url: "https://aistudio.google.com/apikey",
      steps: [
        "Ouvrez aistudio.google.com/apikey dans votre navigateur",
        "Connectez-vous avec votre compte Google",
        "Cliquez sur « Créer une clé API »",
        "Sélectionnez un projet Google Cloud (ou créez-en un nouveau)",
        "Copiez la clé affichée — elle commence par « AIza… »",
        "Collez-la dans le champ Clé API, puis cliquez Sauvegarder",
      ],
    },
  },
  {
    id: "openai",
    name: "OpenAI (GPT-4)",
    short: "OpenAI",
    placeholder: "sk-…",
    guide: {
      url: "https://platform.openai.com/api-keys",
      steps: [
        "Ouvrez platform.openai.com/api-keys",
        "Connectez-vous ou créez un compte OpenAI",
        "Cliquez sur « Create new secret key »",
        "Donnez un nom à la clé et confirmez",
        "⚠️ Copiez-la immédiatement — elle ne sera plus visible",
        "Collez-la dans le champ ci-dessus (commence par « sk-… »)",
        "Un solde de crédit est nécessaire sur votre compte",
      ],
    },
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    short: "Claude",
    placeholder: "sk-ant-…",
    guide: {
      url: "https://console.anthropic.com/settings/keys",
      steps: [
        "Ouvrez console.anthropic.com/settings/keys",
        "Connectez-vous ou créez un compte Anthropic",
        "Cliquez sur « Create Key »",
        "Donnez un nom et confirmez",
        "Copiez la clé — elle commence par « sk-ant-… »",
        "Collez-la dans le champ ci-dessus et sauvegardez",
      ],
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter (multi-modèles)",
    short: "OpenRouter",
    placeholder: "sk-or-…",
    guide: {
      url: "https://openrouter.ai/keys",
      steps: [
        "Ouvrez openrouter.ai/keys dans votre navigateur",
        "Créez un compte gratuit ou connectez-vous",
        "Cliquez sur « Create Key »",
        "Donnez un nom, copiez la clé (commence par « sk-or-… »)",
        "Collez-la dans le champ ci-dessus",
        "💡 OpenRouter donne accès à des dizaines de modèles, dont des gratuits !",
        "Modèle par défaut ici : google/gemini-flash-1.5",
      ],
    },
  },
  {
    id: "mistral",
    name: "Mistral AI",
    short: "Mistral",
    placeholder: "…",
    guide: {
      url: "https://console.mistral.ai/api-keys",
      steps: [
        "Ouvrez console.mistral.ai/api-keys",
        "Connectez-vous ou créez un compte Mistral AI",
        "Cliquez sur « Create new key »",
        "Donnez un nom et confirmez",
        "Copiez la clé et collez-la dans le champ ci-dessus",
        "Mistral offre un accès gratuit limité pour les nouveaux comptes",
      ],
    },
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

// ─── Composant ───────────────────────────────────────────────────────────────

const AIProviderPanel: React.FC = () => {
  const stored = getStoredAIConfig();
  const hasEnvGemini = !!(import.meta.env.VITE_GEMINI_API_KEY);

  const [provider, setProvider] = useState<ProviderId>(
    (stored?.provider as ProviderId) ?? "gemini"
  );
  const [apiKey, setApiKey] = useState(stored?.key ?? "");
  const [saved, setSaved] = useState(false);
  const [isConfigured, setIsConfigured] = useState(!!stored);
  const [showGuide, setShowGuide] = useState(false);

  const currentProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const handleSave = () => {
    if (!apiKey.trim()) {
      alert("Veuillez entrer une clé API avant de sauvegarder.");
      return;
    }
    setStoredAIConfig(provider, apiKey.trim());
    setIsConfigured(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    if (!confirm("Supprimer la configuration IA enregistrée ?")) return;
    clearStoredAIConfig();
    setApiKey("");
    setProvider("gemini");
    setIsConfigured(false);
  };

  const statusDot = isConfigured
    ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]"
    : hasEnvGemini
    ? "bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)]"
    : "bg-gray-500";

  const statusLabel = isConfigured
    ? `${PROVIDERS.find((p) => p.id === (stored?.provider ?? provider))?.short ?? provider} configuré`
    : hasEnvGemini
    ? "Gemini natif actif"
    : "Aucune IA";

  return (
    <>
      {/* ─── Bandeau élégant ────────────────────────────────────────────── */}
      <div
        className="w-full"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
          boxShadow: "0 4px 24px rgba(79,70,229,0.25), 0 1px 0 rgba(139,92,246,0.3) inset",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

            {/* Icône + label */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(167,139,250,0.35)" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-300 fill-current">
                  <path d="M12 2a6 6 0 00-1 11.9V17h2v-3.1A6 6 0 0012 2zm-1 14h2v1h-2zm0 2h2v1h-2z" opacity=".3"/>
                  <path d="M11.5 2C8.47 2 6 4.47 6 7.5c0 2.47 1.49 4.58 3.63 5.47L10 17h4l.38-4.03C16.51 12.08 18 9.97 18 7.5 18 4.47 15.53 2 12.5 2h-1zm1 13h-1v-1h1v1zm.37-3.07l-.37.04-.37-.04C10.08 11.59 8 9.7 8 7.5 8 5.57 9.57 4 11.5 4h1C14.43 4 16 5.57 16 7.5c0 2.2-2.08 4.09-3.63 4.43z"/>
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/70">
                  Intelligence Artificielle
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
                  <span className="text-[11px] text-white/60">{statusLabel}</span>
                </div>
              </div>
            </div>

            {/* Séparateur vertical */}
            <div className="hidden sm:block h-7 w-px bg-white/10" />

            {/* Provider select + guide */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderId)}
                className="text-sm rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400/60 cursor-pointer transition-colors"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#312e81", color: "white" }}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowGuide(true)}
                title={`Guide : comment obtenir une clé ${currentProvider.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all hover:scale-105 flex-shrink-0"
                style={{
                  background: "rgba(167,139,250,0.2)",
                  border: "1px solid rgba(167,139,250,0.35)",
                  color: "rgba(216,180,254,1)",
                }}
                aria-label="Guide pour obtenir la clé API"
              >
                🔍
              </button>
            </div>

            {/* Champ clé */}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={`Clé API — ex. ${currentProvider.placeholder}`}
              className="flex-1 min-w-[180px] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400/60 transition-all placeholder-white/25"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.13)",
                color: "rgba(255,255,255,0.9)",
              }}
            />

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSave}
                className="text-sm px-3.5 py-1.5 rounded-lg font-semibold transition-all hover:scale-[1.03] active:scale-95"
                style={
                  saved
                    ? { background: "rgba(52,211,153,0.25)", border: "1px solid rgba(52,211,153,0.5)", color: "#6ee7b7" }
                    : { background: "rgba(139,92,246,0.4)", border: "1px solid rgba(167,139,250,0.5)", color: "white" }
                }
              >
                {saved ? "✓ Sauvegardé" : "Sauvegarder"}
              </button>

              {isConfigured && (
                <button
                  onClick={handleClear}
                  className="text-sm px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "rgba(252,165,165,0.9)",
                  }}
                  title="Supprimer la clé enregistrée"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal guide ────────────────────────────────────────────────── */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => e.target === e.currentTarget && setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "#1e1b4b", border: "1px solid rgba(139,92,246,0.3)" }}
          >
            {/* En-tête */}
            <div
              className="px-5 py-4 flex items-start justify-between gap-3"
              style={{ borderBottom: "1px solid rgba(139,92,246,0.2)" }}
            >
              <div>
                <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-0.5">
                  Guide pas à pas
                </div>
                <h4 className="font-bold text-white text-base leading-snug">
                  Obtenir une clé API
                </h4>
                <p className="text-sm text-violet-300 font-medium mt-0.5">
                  {currentProvider.name}
                </p>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 transition-colors hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {/* Étapes */}
            <div className="p-5">
              <ol className="space-y-3">
                {currentProvider.guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                      style={{
                        background: "rgba(139,92,246,0.25)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        color: "#c4b5fd",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <div
                className="mt-5 pt-4 flex items-center justify-between gap-3"
                style={{ borderTop: "1px solid rgba(139,92,246,0.2)" }}
              >
                <a
                  href={currentProvider.guide.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline transition-colors"
                  style={{ color: "#a78bfa" }}
                >
                  → Ouvrir la page directement
                </a>
                <button
                  onClick={() => setShowGuide(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.03]"
                  style={{ background: "rgba(139,92,246,0.4)", border: "1px solid rgba(167,139,250,0.5)", color: "white" }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIProviderPanel;
