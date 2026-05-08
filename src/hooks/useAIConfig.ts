import { useState, useCallback, useEffect } from 'react';

export const AFOM_AI_STORAGE_KEY = 'afom_ai_config';
const SYNC_EVENT = 'afom_ai_config_changed';

export interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
  configured: boolean;
}

const DEFAULT_CONFIG: AIConfig = { provider: '', apiKey: '', model: '', configured: false };

export const PROVIDER_DEFAULTS: Record<string, { model: string; label: string; hint: string }> = {
  gemini:     { model: 'gemini-1.5-flash',          label: 'Gemini (Google)', hint: 'AIzaSy…' },
  openai:     { model: 'gpt-4o-mini',               label: 'OpenAI',          hint: 'sk-…' },
  anthropic:  { model: 'claude-haiku-4-5-20251001', label: 'Anthropic',       hint: 'sk-ant-…' },
  openrouter: { model: 'google/gemini-flash-1.5',   label: 'OpenRouter',      hint: 'sk-or-v1-…' },
  mistral:    { model: 'mistral-small-latest',       label: 'Mistral AI',      hint: '…' },
};

function readFromStorage(): AIConfig {
  try {
    const raw = localStorage.getItem(AFOM_AI_STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  // Migration depuis l'ancien format à deux clés séparées
  try {
    const oldProvider = localStorage.getItem('afom_ai_provider');
    const oldKey = localStorage.getItem('afom_ai_key');
    if (oldProvider && oldKey && oldKey.length > 4) {
      const migrated: AIConfig = {
        provider: oldProvider,
        apiKey: oldKey,
        model: PROVIDER_DEFAULTS[oldProvider]?.model || '',
        configured: true,
      };
      localStorage.setItem(AFOM_AI_STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem('afom_ai_provider');
      localStorage.removeItem('afom_ai_key');
      return migrated;
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig>(readFromStorage);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AIConfig>).detail;
      setConfig(detail ?? DEFAULT_CONFIG);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const save = useCallback((provider: string, apiKey: string): AIConfig => {
    const defaults = PROVIDER_DEFAULTS[provider];
    const next: AIConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: defaults?.model || '',
      configured: !!(provider && apiKey.trim()),
    };
    try { localStorage.setItem(AFOM_AI_STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }));
    setConfig(next);
    return next;
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(AFOM_AI_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: DEFAULT_CONFIG }));
    setConfig(DEFAULT_CONFIG);
  }, []);

  return { config, save, clear, PROVIDER_DEFAULTS };
}
