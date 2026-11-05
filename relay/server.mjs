// AFOM AI relay: keeps the Gemini key on the server.
// Only signed-in moderators whose email is allow-listed can use it, with a daily quota.
// No dependencies: Node 20+ (fetch, crypto).
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const KEY = process.env.GEMINI_API_KEY || '';
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'afom-e475f';
const ALLOWED = new Set((process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const PER_USER_DAY = Number(process.env.PER_USER_DAILY_LIMIT || 300);
const GLOBAL_DAY = Number(process.env.GLOBAL_DAILY_LIMIT || 1500);
const MAX_PROMPT = Number(process.env.MAX_PROMPT_CHARS || 120000);
const CHAIN = (process.env.GEMINI_MODELS || 'gemini-flash-lite-latest,gemini-2.5-flash-lite,gemini-flash-latest').split(',');
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certs = { at: 0, keys: {} };
async function publicKey(kid) {
  if (Date.now() - certs.at > 3600e3 || !certs.keys[kid]) {
    const r = await fetch(CERTS_URL);
    if (!r.ok) throw new Error('certs ' + r.status);
    certs = { at: Date.now(), keys: await r.json() };
  }
  const pem = certs.keys[kid];
  if (!pem) throw new Error('unknown kid');
  return crypto.createPublicKey(pem);
}
const b64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Verifies a Firebase ID token (RS256, Google signing certs, audience = project).
export async function verifyIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const header = JSON.parse(b64(parts[0]).toString());
  const claims = JSON.parse(b64(parts[1]).toString());
  if (header.alg !== 'RS256') throw new Error('alg');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), await publicKey(header.kid), b64(parts[2]));
  if (!ok) throw new Error('signature');
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PROJECT || claims.iss !== 'https://securetoken.google.com/' + PROJECT) throw new Error('audience');
  if (!(claims.exp > now) || !(claims.iat <= now + 60) || !claims.sub) throw new Error('expired');
  return claims;
}

const usage = { day: '', users: new Map(), total: 0 };
function count(uid) {
  const day = new Date().toISOString().slice(0, 10);
  if (usage.day !== day) { usage.day = day; usage.users.clear(); usage.total = 0; }
  const n = (usage.users.get(uid) || 0) + 1;
  if (n > PER_USER_DAY || usage.total + 1 > GLOBAL_DAY) return false;
  usage.users.set(uid, n); usage.total++;
  return true;
}

async function gemini(prompt, model) {
  const chain = model && CHAIN.includes(model) ? [model, ...CHAIN.filter(m => m !== model)] : CHAIN;
  let last = 'unavailable';
  for (const m of chain) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, responseMimeType: 'application/json' } }),
    });
    if (r.ok) { const d = await r.json(); return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''; }
    last = 'gemini ' + r.status;
    if (r.status !== 429 && r.status !== 404) break;
  }
  throw Object.assign(new Error(last), { status: 502 });
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

export const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0].replace(/\/+$/, '');
  if (req.method === 'GET' && path.endsWith('/health')) return send(res, 200, { ok: true, key: !!KEY, allowed: ALLOWED.size });
  if (req.method !== 'POST' || !path.endsWith('/ai')) return send(res, 404, { error: 'not-found' });
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let claims;
    try { claims = await verifyIdToken(token); } catch { return send(res, 401, { error: 'not-signed-in' }); }
    if (!ALLOWED.has(String(claims.email || '').toLowerCase())) return send(res, 403, { error: 'not-allowed' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > MAX_PROMPT * 2) return send(res, 413, { error: 'too-large' }); }
    const { prompt, model } = JSON.parse(body || '{}');
    if (typeof prompt !== 'string' || !prompt || prompt.length > MAX_PROMPT) return send(res, 400, { error: 'bad-prompt' });
    if (!count(claims.sub)) return send(res, 429, { error: 'daily-limit' });
    if (!KEY) return send(res, 503, { error: 'no-server-key' });
    return send(res, 200, { text: await gemini(prompt, model) });
  } catch (e) {
    return send(res, e.status || 500, { error: String(e.message || 'error').slice(0, 80) });
  }
});

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) server.listen(PORT, () => console.log('afom-ai-relay on ' + PORT));
