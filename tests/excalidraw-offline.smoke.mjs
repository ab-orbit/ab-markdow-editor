import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url)), manual = await fs.readFile(new URL('../docs/Scriba-Diagramas.md', import.meta.url), 'utf8');
const scenes = [...manual.matchAll(/```excalidraw\n([\s\S]*?)\n```/g)].map(match => match[1]);
const fence = '`'.repeat(3), source = `# Prancheta offline\n\n${fence}excalidraw\n${scenes[0]}\n${fence}\n\n${fence}excalidraw\n${scenes.find(scene => JSON.parse(scene).files['aurora-synthetic-capture'])}\n${fence}\n`;
let server, browser, origin = process.env.SCRIBA_URL;
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
try {
  if (!origin) {
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm' };
    server = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/github/status') { response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ configured: false, connected: false })); return; }
      try {
        const file = path.resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!file.startsWith(path.resolve(dist) + path.sep)) return response.writeHead(403).end();
        response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'" }).end(await fs.readFile(file));
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  }
  browser = safari ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 } }), page = await context.newPage(), errors = [], api = [], remote = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) api.push(url.pathname); if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol) && url.hostname !== 'static.cloudflareinsights.com') remote.push(url.origin + url.pathname); });
  await page.goto(origin); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  assert.equal(await page.evaluate(() => window.EXCALIDRAW_ASSET_PATH), undefined, 'Plain Markdown does not initialize the drawing SDK.');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
  const cached = await page.evaluate(async () => { const output = []; for (const name of await caches.keys()) { const cache = await caches.open(name); output.push(...(await cache.keys()).map(request => new URL(request.url).pathname)); } return output; });
  assert.equal(cached.filter(url => url.startsWith('/excalidraw/0.18.1/fonts/')).length, 234);
  assert.ok(cached.every(url => !url.startsWith('/api/') && !url.startsWith('/github/')));
  await context.setOffline(true); await page.reload(); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Offline.excalidraw.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
  const drawings = page.locator('article figure[data-excalidraw-state]'); await expect(drawings).toHaveCount(2);
  for (const drawing of await drawings.all()) { await drawing.scrollIntoViewIfNeeded(); await expect(drawing).toHaveAttribute('data-excalidraw-state', 'ready', { timeout: 30000 }); }
  await drawings.first().scrollIntoViewIfNeeded(); await drawings.first().getByRole('button', { name: 'Editar desenho Excalidraw', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editor Excalidraw', exact: true }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled();
  await dialog.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click(); const bounds = await dialog.locator('canvas.interactive').boundingBox(); await page.mouse.click(bounds.x + bounds.width * .55, bounds.y + bounds.height * .84); await dialog.locator('textarea.excalidraw-wysiwyg').fill('Editado sem conexão'); await page.keyboard.press('Escape');
  await expect(dialog.getByRole('status')).toContainText('Rascunho protegido'); await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(drawings.first()).toContainText('Editado sem conexão');
  await page.keyboard.press('ControlOrMeta+s'); await expect(page.getByRole('status').filter({ hasText: 'Nota salva neste navegador.' })).toBeVisible();
  await page.reload(); await expect(drawings).toHaveCount(2); await drawings.first().scrollIntoViewIfNeeded(); await expect(drawings.first()).toContainText('Editado sem conexão');
  await drawings.first().getByLabel('Baixar desenho', { exact: true }).click(); const pending = page.waitForEvent('download'); await drawings.first().getByRole('button', { name: 'SVG vetorial', exact: true }).click(); const svg = await fs.readFile(await (await pending).path(), 'utf8'); assert.ok(svg.includes('@font-face') && svg.includes('data:font/woff2;base64,'));
  await drawings.nth(1).scrollIntoViewIfNeeded(); await expect(drawings.nth(1)).toHaveAttribute('data-excalidraw-state', 'ready'); assert.ok(await drawings.nth(1).locator('svg image').count() > 0);
  const evidence = new URL('../docs/evidence/excalidraw/', import.meta.url); await fs.mkdir(evidence, { recursive: true }); await page.setViewportSize({ width: 390, height: 844 }); const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true }); if (await closeNotes.isVisible()) await closeNotes.click(); await drawings.nth(1).scrollIntoViewIfNeeded(); await page.screenshot({ path: new URL(`offline-image-mobile-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
  assert.deepEqual(api, []); assert.deepEqual(remote, []); assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chrome'}): first SDK/font/canvas load offline, local image, editing, private save/reload, self-contained SVG export and mobile preview. No local filesystem API or external drawing resources.`);
} finally { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); }
