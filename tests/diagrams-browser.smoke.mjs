import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This test uses an isolated browser profile, never a user's local notes or Git.
const dist = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
let server, browser;
try {
  let origin = process.env.SCRIBA_URL;
  if (!origin) {
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm' };
    server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
        const bytes = await fs.readFile(file);
        response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(bytes);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [], api = [], remote = [], infrastructure = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) api.push(url.pathname);
    // Cloudflare adds its existing analytics script to production HTML. It is
    // not a drawing dependency; retain it separately rather than hiding traffic.
    if (process.env.SCRIBA_URL && url.hostname === 'static.cloudflareinsights.com' && url.pathname.startsWith('/beacon.min.js/')) infrastructure.push(url.origin + url.pathname);
    else if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) remote.push(url.origin + url.pathname);
  });
  await page.goto(origin);
  await page.getByLabel('Bancada Markdown').waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  // No renderer has been imported yet: the first load of all three must work offline.
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Bancada Markdown').waitFor();
  await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  const fence = String.fromCharCode(96).repeat(3);
  const er = 'erDiagram\n  NOTEBOOK ||--o{ NOTE : contains\n  NOTEBOOK {\n    string title\n  }\n  NOTE {\n    int id PK\n    string text\n  }';
  const source = `# Diagramas offline\n\nOs três motores carregados pela primeira vez sem rede.\n\n${fence}mermaid\n${er}\n${fence}\n\n~~~mermaid\nflowchart LR\n  A[Escrever] --> B[Guardar]\n~~~\n`;
  // CRLF input also exercises Markdown parsing independently from the drawing engine.
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Diagramas-offline.md', mimeType: 'text/markdown', buffer: Buffer.from(source.replace(/\n/g, '\r\n')) });
  await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode', 'read');
  const diagrams = page.locator('article figure[data-diagram-engine]');
  await expect(diagrams).toHaveCount(2);
  async function choose(figure, engine) {
    await figure.scrollIntoViewIfNeeded();
    await figure.getByRole('combobox', { name: 'Renderizador do diagrama' }).selectOption(engine);
    await expect(figure).toHaveAttribute('data-diagram-engine', engine);
    await expect(figure).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
    await expect(figure.locator('svg').last()).toBeVisible();
  }
  for (const engine of ['mermaid', 'pele', 'beautiful']) {
    await choose(diagrams.first(), engine); await expect(diagrams.first()).toContainText('NOTEBOOK');
    await choose(diagrams.nth(1), engine); await expect(diagrams.nth(1)).toContainText('Escrever');
  }
  await page.getByRole('button', { name: 'Salvar nota', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Nota salva neste navegador.' }).waitFor();
  await page.reload();
  await expect(diagrams).toHaveCount(2);
  await expect(diagrams.first()).toHaveAttribute('data-diagram-engine', 'beautiful');
  await expect(diagrams.first()).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).click();
  await choose(diagrams.first(), 'pele');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'docs/evidence/diagrams-offline-mobile.png' });
  await context.setOffline(false);
  const other = await browser.newContext();
  const empty = await other.newPage(); await empty.goto(origin); await empty.getByLabel('Bancada Markdown').waitFor();
  await expect(empty.getByText('Diagramas offline', { exact: true })).toHaveCount(0);
  await other.close();
  assert.deepEqual(errors, []); assert.deepEqual(api, []); assert.deepEqual(remote, []);
  console.log(`PASS (${origin}): three engines first imported offline, ER/flowchart/tilde/CRLF, save/reload, per-block choice, browser isolation, mobile layout, no local API or off-origin drawing assets.`);
  if (infrastructure.length) console.log('Existing deployment analytics (separate from diagram assets):', [...new Set(infrastructure)]);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
