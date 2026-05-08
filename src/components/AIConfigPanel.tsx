import React, { useState } from 'react';
import { useAIConfig, PROVIDER_DEFAULTS } from '../hooks/useAIConfig';

// ─── SVG icons inline (pas de dépendance lucide) ────────────────────────────
const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const KeyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const ZapIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const RotateCcwIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
  </svg>
);
const AlertCircleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ─── Providers ───────────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    sub: 'Gemini 1.5 Flash',
    hint: 'AIzaSy…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    steps: [
      'Ouvrez Google AI Studio (aistudio.google.com)',
      "Cliquez « Obtenir une clé API »",
      'Créez ou sélectionnez un projet Google Cloud',
      "Copiez la clé — elle commence par « AIzaSy… »",
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    sub: 'GPT-4o-mini',
    hint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    steps: [
      'Connectez-vous sur platform.openai.com',
      'Menu gauche → API keys',
      "Cliquez « Create new secret key »",
      "⚠️ Copiez-la immédiatement — non visible ensuite",
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    sub: 'Claude Haiku',
    hint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    steps: [
      'Connectez-vous sur console.anthropic.com',
      'Settings → API Keys',
      "Cliquez « Create Key »",
      "Copiez la clé — elle commence par « sk-ant-… »",
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    sub: 'Multi-modèles',
    hint: 'sk-or-v1-…',
    keyUrl: 'https://openrouter.ai/keys',
    steps: [
      'Créez un compte sur openrouter.ai',
      'Allez dans Keys',
      "Cliquez « Create Key »",
      '💡 Accès à des dizaines de modèles, dont des gratuits',
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    sub: 'mistral-small',
    hint: '…',
    keyUrl: 'https://console.mistral.ai/api-keys',
    steps: [
      'Connectez-vous sur console.mistral.ai',
      "Cliquez « Create new key »",
      'Donnez un nom et confirmez',
      'Mistral offre un accès gratuit limité pour les nouveaux comptes',
    ],
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]['id'];

// ─── Composant ───────────────────────────────────────────────────────────────

interface AIConfigPanelProps {
  onConfigured?: (cfg: { configured: boolean } | null) => void;
}

const AIConfigPanel: React.FC<AIConfigPanelProps> = ({ onConfigured }) => {
  const { config, save, clear } = useAIConfig();
  const [provider, setProvider]   = useState<ProviderId | ''>(config.provider as ProviderId | '');
  const [apiKey, setApiKey]       = useState(config.apiKey || '');
  const [showKey, setShowKey]     = useState(false);
  const [showHelp, setShowHelp]   = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMsg, setTestMsg]     = useState('');

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const hint = currentProvider?.hint ?? PROVIDER_DEFAULTS[provider]?.hint ?? 'Votre clé API…';

  const handleProviderChange = (val: string) => {
    setProvider(val as ProviderId | '');
    setShowHelp(false);
    setTestState('idle');
    setTestMsg('');
  };

  const handleSave = () => {
    if (!provider || !apiKey.trim()) return;
    const next = save(provider, apiKey);
    onConfigured?.(next);
    setTestState('idle');
    setTestMsg('');
  };

  const handleTest = async () => {
    if (!provider || !apiKey.trim()) return;
    setTestState('testing');
    setTestMsg('');
    await new Promise((r) => setTimeout(r, 1000));
    const formats: Record<string, RegExp> = {
      openai: /^sk-/,
      anthropic: /^sk-ant-/,
      gemini: /^AIza/,
      openrouter: /^sk-or-v1-/,
    };
    const re = formats[provider];
    if (!re || re.test(apiKey.trim())) {
      setTestState('ok');
      setTestMsg('Format de clé valide ✓');
    } else {
      setTestState('error');
      setTestMsg('Format de clé inattendu — vérifiez la syntaxe.');
    }
  };

  const handleClear = () => {
    clear();
    setProvider('');
    setApiKey('');
    setTestState('idle');
    setTestMsg('');
    setShowHelp(false);
    onConfigured?.(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Sélecteur provider ── */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Fournisseur IA
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 focus:bg-white pl-3.5 pr-8 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition cursor-pointer"
            >
              <option value="">Choisir un fournisseur…</option>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.sub}</option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <ChevronDownIcon />
            </span>
          </div>
          {provider && currentProvider?.steps && (
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className={[
                'p-2.5 rounded-xl border transition-colors',
                showHelp
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                  : 'border-gray-200 text-gray-400 hover:text-indigo-500 hover:border-indigo-200 bg-gray-50',
              ].join(' ')}
              title="Comment obtenir cette clé API"
            >
              <SearchIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── Popover aide clé API ── */}
      {showHelp && currentProvider?.steps && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
            <SearchIcon />
            Comment obtenir votre clé {currentProvider.name}
          </p>
          <ol className="space-y-1.5">
            {currentProvider.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          {currentProvider.keyUrl && (
            <a
              href={currentProvider.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ExternalLinkIcon />
              Accéder directement à la console {currentProvider.name}
            </a>
          )}
        </div>
      )}

      {/* ── Clé API ── */}
      {provider && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Clé API
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <KeyIcon />
            </span>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={hint}
              className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono transition"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title={showKey ? 'Masquer' : 'Afficher'}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            Stockée localement dans votre navigateur — non transmise à nos serveurs.
          </p>
        </div>
      )}

      {/* ── Message de test ── */}
      {testMsg && (
        <p className={`text-xs flex items-center gap-1.5 ${testState === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
          {testState === 'ok' ? <CheckIcon /> : <AlertCircleIcon />}
          {testMsg}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!provider || !apiKey.trim()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <CheckIcon /> Enregistrer
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={!provider || !apiKey.trim() || testState === 'testing'}
          className="inline-flex items-center gap-1.5 py-2.5 px-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testState === 'testing'
            ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            : <ZapIcon />
          }
          Tester
        </button>
        {config.configured && (
          <button
            type="button"
            onClick={handleClear}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200 transition"
            title="Supprimer la configuration"
          >
            <RotateCcwIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export default AIConfigPanel;
