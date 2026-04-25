// Service multi-providers IA — appels REST vers Gemini, OpenAI, Anthropic, OpenRouter, Mistral.
// La clé active est lue depuis localStorage à chaque appel.

export const STORAGE_PROVIDER_KEY = 'afom_ai_provider';
export const STORAGE_API_KEY_KEY  = 'afom_ai_key';

export function getStoredAIConfig(): { provider: string; key: string } | null {
  try {
    const provider = localStorage.getItem(STORAGE_PROVIDER_KEY);
    const key      = localStorage.getItem(STORAGE_API_KEY_KEY);
    if (provider && key && key.length > 4) return { provider, key };
    return null;
  } catch {
    return null;
  }
}

export function setStoredAIConfig(provider: string, key: string): void {
  localStorage.setItem(STORAGE_PROVIDER_KEY, provider);
  localStorage.setItem(STORAGE_API_KEY_KEY, key);
}

export function clearStoredAIConfig(): void {
  localStorage.removeItem(STORAGE_PROVIDER_KEY);
  localStorage.removeItem(STORAGE_API_KEY_KEY);
}

export function isAIAvailable(): boolean {
  if (getStoredAIConfig()) return true;
  return !!(import.meta.env.VITE_GEMINI_API_KEY);
}

/** Appel générique : délègue au provider configuré, fallback sur la clé Gemini native. */
export async function callAI(prompt: string): Promise<string> {
  const config = getStoredAIConfig();

  if (config) {
    const { provider, key } = config;
    if (provider === 'gemini')      return callGeminiRest(prompt, key);
    if (provider === 'openai')      return callOpenAICompat(prompt, key, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini');
    if (provider === 'anthropic')   return callAnthropic(prompt, key);
    if (provider === 'openrouter')  return callOpenAICompat(prompt, key, 'https://openrouter.ai/api/v1/chat/completions', 'google/gemini-flash-1.5');
    if (provider === 'mistral')     return callOpenAICompat(prompt, key, 'https://api.mistral.ai/v1/chat/completions', 'mistral-small-latest');
  }

  // Fallback : clé Gemini de l'environnement
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (envKey) return callGeminiRest(prompt, envKey);

  throw new Error('no-ai-configured');
}

// ─────────── implémentations REST ───────────

async function callGeminiRest(prompt: string, key: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
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
  // response_format JSON supporté par OpenAI et Mistral, pas toujours par OpenRouter
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

async function callAnthropic(prompt: string, key: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
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
