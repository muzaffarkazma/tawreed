// Stand-in for api.moyasar.com used only by automated tests (the real API is not reachable from CI).
import http from 'node:http';

const payments = new Map();
const server = http.createServer((req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
  if (req.method === 'POST' && req.url === '/__set') {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { const p = JSON.parse(b); payments.set(p.id, p); send(200, { ok: true }); });
    return;
  }
  const m = req.url?.match(/^\/v1\/payments\/([^/?]+)/);
  if (req.method === 'GET' && m) {
    const auth = req.headers.authorization ?? '';
    const user = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString();
    if (!user.startsWith('sk_test_')) return send(401, { type: 'authentication_error', message: 'Invalid authorization credentials' });
    const p = payments.get(decodeURIComponent(m[1]));
    return p ? send(200, p) : send(404, { type: 'record_not_found', message: 'Object not found' });
  }
  send(404, {});
});
server.listen(Number(process.env.PORT ?? 4010), () => console.log('mock moyasar up'));
