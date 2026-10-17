import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Repository } from './repository.mjs';
import { pickFolder } from './folder-picker.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const stateDir = process.env.MARKDOWN_STATE_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'AB Markdown');
const repository = new Repository(stateDir);
await repository.initialize();
const token = randomBytes(32).toString('hex');
let origin;
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };

const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== new URL(origin).host) return send(res, 403, { error: 'Host inválido.' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    const url = new URL(req.url, origin);
    if (url.pathname === '/health') return send(res, 200, { app: 'ab-markdown-editor', pid: process.pid });
    if (url.pathname === '/api/session' && req.method === 'GET') {
      if (req.headers['x-ab-markdown-client'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== origin)) return send(res, 403, { error: 'Origem inválida.' });
      return send(res, 200, { token });
    }
    if (url.pathname.startsWith('/api/')) {
      const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || '');
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) return send(res, 403, { error: 'Sessão inválida. Reabra o aplicativo.' });
      if (req.headers.origin && req.headers.origin !== origin) return send(res, 403, { error: 'Origem inválida.' });
      if (req.method === 'GET') {
        if (url.pathname === '/api/preferences') return send(res, 200, repository.preferences);
        if (url.pathname === '/api/repository') return send(res, 200, await repository.info());
        if (url.pathname === '/api/files') return send(res, 200, await repository.list());
        if (url.pathname === '/api/document') return send(res, 200, await repository.read(url.searchParams.get('name')));
      }
      if (req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) return send(res, 405, { error: 'Método inválido.' });
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 65 * 1024 * 1024) throw new Error('Envio maior que 65 MB.'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const actions = {
        '/api/pick-folder': () => pickFolder(),
        '/api/connect': () => repository.connect(body.directory),
        '/api/clone': () => repository.clone(body.url, body.destination),
        '/api/preferences': () => repository.updatePreferences(body),
        '/api/save-sync': () => repository.saveAndSync(body),
        '/api/save': () => repository.save(body),
        '/api/commit': () => repository.commit(body),
        '/api/push': () => repository.push(),
      };
      if (!actions[url.pathname]) return send(res, 404, { error: 'Ação desconhecida.' });
      return send(res, 200, await repository.mutate(actions[url.pathname]));
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Método inválido.' });
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = (await fs.readFile(path.join(dist, 'index.html'), 'utf8')).replace('<head>', `<head><script>window.__MARKDOWN_TOKEN__=${JSON.stringify(token)}</script>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); return;
    }
    const relative = decodeURIComponent(url.pathname).slice(1);
    if (relative.split('/').some(part => part === '..' || part.startsWith('.')) || relative.includes('\\')) return send(res, 404, { error: 'Arquivo inválido.' });
    const file = await fs.readFile(path.join(dist, relative));
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8' }[path.extname(relative)] || 'application/octet-stream';
    if (relative === 'sw.js') { res.setHeader('Service-Worker-Allowed', '/'); res.setHeader('Cache-Control', 'no-cache'); }
    res.writeHead(200, { 'Content-Type': mime }); res.end(file);
  } catch (error) { send(res, error.code === 'DOCUMENT_CONFLICT' ? 409 : 400, { error: error.code === 'ENOENT' ? 'Arquivo ou pasta não encontrado.' : error.message, ...(error.conflict ? { code: error.code, conflict: error.conflict } : {}) }); }
});
server.requestTimeout = 660000;
server.listen(Number(process.env.PORT || 43127), '127.0.0.1', async () => {
  origin = `http://127.0.0.1:${server.address().port}`;
  if (process.env.MARKDOWN_RUNTIME_FILE) await fs.writeFile(process.env.MARKDOWN_RUNTIME_FILE, JSON.stringify({ url: origin, pid: process.pid }), { mode: 0o600 });
  console.log(`AB Markdown: ${origin}`);
});
server.on('error', error => { console.error(error.message); process.exit(1); });
