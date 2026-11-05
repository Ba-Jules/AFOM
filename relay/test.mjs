// Local checks without any real key: unauthenticated and forged tokens must be refused.
process.env.ALLOWED_EMAILS = 'test@example.org';
const { server } = await import('./server.mjs');
await new Promise(r => server.listen(18080, r));
const post = (h, b) => fetch('http://127.0.0.1:18080/AFOM/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) }).then(async r => [r.status, await r.json()]);
const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const forged = enc({ alg: 'RS256', kid: 'x' }) + '.' + enc({ aud: 'afom-e475f', iss: 'https://securetoken.google.com/afom-e475f', sub: 'u', email: 'test@example.org', exp: 9e9, iat: 1 }) + '.' + 'AAAA';
const none = enc({ alg: 'none' }) + '.' + enc({ aud: 'afom-e475f', sub: 'u', email: 'test@example.org', exp: 9e9 }) + '.';
console.log('health', await fetch('http://127.0.0.1:18080/AFOM/api/health').then(r => r.json()));
console.log('no token', await post({}, { prompt: 'x' }));
console.log('forged', await post({ Authorization: 'Bearer ' + forged }, { prompt: 'x' }));
console.log('alg none', await post({ Authorization: 'Bearer ' + none }, { prompt: 'x' }));
console.log('GET ai', await fetch('http://127.0.0.1:18080/AFOM/api/ai').then(r => r.status));
server.close();
