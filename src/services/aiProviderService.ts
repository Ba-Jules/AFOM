// Service multi-providers IA — appels REST vers Gemini, OpenAI, Anthropic, OpenRouter, Mistral, xAI.
// La clé active est lue depuis localStorage (format unifié afom_ai_config) à chaque appel.

const STORAGE_KEY = 'afom_ai_config';

// Modèles retirés → remplacements automatiques (synchronisé avec useAIConfig.ts)
const DEPRECATED_MODELS: Record<string, string> = {
  'google/gemini-flash-1.5': 'openai/gpt-4o-mini',
};

export function getStoredAIConfig(): { provider: string; key: string; model?: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.provider && cfg.apiKey && cfg.apiKey.length > 4) {
        const model = cfg.model && DEPRECATED_MODELS[cfg.model]
          ? DEPRECATED_MODELS[cfg.model]
          : (cfg.model || undefined);
        return { provider: cfg.provider, key: cfg.apiKey, model };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function isAIAvailable(): boolean {
  if (getStoredAIConfig()) return true;
  return !!(import.meta.env.VITE_GEMINI_API_KEY);
}

/** Appel générique : délègue au provider configuré, fallback sur la clé Gemini native. */
export async function callAI(prompt: string): Promise<string> {
  const config = getStoredAIConfig();

  if (config) {
    const { provider, key, model } = config;
    if (provider === 'gemini') {
      const m = model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
      return callGeminiRest(prompt, key, url);
    }
    if (provider === 'openai')
      return callOpenAICompat(prompt, key, 'https://api.openai.com/v1/chat/completions', model || 'gpt-4o-mini');
    if (provider === 'anthropic')
      return callAnthropic(prompt, key, model || 'claude-haiku-4-5-20251001');
    if (provider === 'openrouter')
      return callOpenAICompat(prompt, key, 'https://openrouter.ai/api/v1/chat/completions', model || 'openai/gpt-4o-mini');
    if (provider === 'mistral')
      return callOpenAICompat(prompt, key, 'https://api.mistral.ai/v1/chat/completions', model || 'mistral-small-latest');
    if (provider === 'xai')
      return callOpenAICompat(prompt, key, 'https://api.x.ai/v1/chat/completions', model || 'grok-3-mini-fast');
  }

  // Fallback : clé Gemini de l'environnement (GitHub Actions secret)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (envKey) return callGeminiRest(prompt, envKey);

  throw new Error('no-ai-configured');
}

// ─────────── implémentations REST ───────────

async function callGeminiRest(prompt: string, key: string, url?: string): Promise<string> {
  const endpoint = url ?? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAICompat(prompt: string, key: string, url: string, model: string): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
  };
  if (url.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'AFOM Ultimate';
  }
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };
  if (!url.includes('openrouter.ai')) {
    body['response_format'] = { type: 'json_object' };
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(prompt: string, key: string, model = 'claude-haiku-4-5-20251001'): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text ?? '';
}
