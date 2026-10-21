import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Use private browser storage and synthetic documents; never touch an account or user checkout.
const dist = process.env.SCRIBA_DIST || fileURLToPath(new URL('../dist/', import.meta.url));
let server, origin = process.env.SCRIBA_URL;
if (!origin) {
  server = http.createServer(async (request, response) => {
    if (request.url.startsWith('/github/')) { response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ configured: false, connected: false })); return; }
    try {
      const url = new URL(request.url, 'http://localhost'), file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      const bytes = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
}
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
const browser = await (safari ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
try {
  const context = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  const workbench = page.getByLabel('Bancada Markdown'), editor = page.locator('.cm-content'), confirmation = page.getByRole('dialog', { name: 'Salvar antes de criar uma nova nota?', exact: true });
  const shortcut = (modifier = 'Meta') => page.keyboard.press(`${modifier}+Shift+Enter`);
  async function open(name, source) {
    const input = page.getByLabel('Arquivo Markdown', { exact: true }); await expect(input).toBeEnabled();
    await input.setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(source) });
    await expect(page.getByRole('article')).toContainText(source.replace(/^# /, '')); await expect(input).toBeEnabled();
  }
  async function savedValue(name) {
    return page.evaluate(async name => {
      const db = await new Promise(resolve => { const request = indexedDB.open('scriba-private-notes'); request.onsuccess = () => resolve(request.result); });
      try { return await new Promise(resolve => { const request = db.transaction('library').objectStore('library').get('state'); request.onsuccess = () => resolve(request.result?.notes?.[name]?.value); }); } finally { db.close(); }
    }, name);
  }
  await open('Atalho-novo.md', '# Nota original'); await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await editor.fill('# Edição protegida');
  await shortcut(); await expect(confirmation).toBeVisible();
  await shortcut(); await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(editor).toHaveText('# Edição protegida');
  await shortcut('Control'); await confirmation.getByRole('button', { name: 'Descartar e criar', exact: true }).click();
  await expect(workbench).toHaveAttribute('data-mode', 'live'); await expect(editor).toHaveText(''); await expect(editor).toBeFocused();
  const previousBlank = await editor.elementHandle(); await shortcut();
  await expect.poll(() => previousBlank.evaluate(element => element.isConnected)).toBe(false);
  await expect(confirmation).toHaveCount(0); await expect(editor).toBeFocused();
  await open('Atalho-salvar.md', '# Antes de salvar'); await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await editor.fill('# Salva antes de criar');
  await shortcut(); await confirmation.getByRole('button', { name: 'Salvar e criar', exact: true }).click();
  await expect.poll(() => savedValue('Atalho-salvar.md')).toBe('# Salva antes de criar');
  await expect(workbench).toHaveAttribute('data-mode', 'live'); await expect(editor).toHaveText(''); await expect(editor).toBeFocused();
  // The capture handler must run before the rich editor interprets the same Enter combination.
  await page.getByRole('button', { name: 'Escrever', exact: true }).click(); const natural = page.locator('[data-visual-editor] .tiptap');
  await natural.fill('Edição natural protegida'); await shortcut(); await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(natural).toHaveText('Edição natural protegida');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click(); await shortcut(); await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible(); await expect(confirmation).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await shortcut(); await confirmation.getByRole('button', { name: 'Descartar e criar', exact: true }).click(); await expect(editor).toBeFocused();
  await open('Atalho-quadro.md', '# Quadro com atalho');
  await page.getByRole('group', { name: 'Formato do documento', exact: true }).getByRole('button', { name: 'Whiteboard', exact: true }).click();
  const board = page.getByRole('region', { name: 'Whiteboard Excalidraw', exact: true }); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 30000 });
  await board.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click(); const bounds = await board.locator('canvas.interactive').boundingBox();
  await page.mouse.click(bounds.x + bounds.width * .6, bounds.y + bounds.height * .6); await board.locator('textarea.excalidraw-wysiwyg').fill('Texto ativo antes da nova nota');
  await shortcut(); await expect(confirmation).toBeVisible(); await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(board).toBeVisible();
  await board.locator('canvas.interactive').focus(); await shortcut(); await confirmation.getByRole('button', { name: 'Salvar e criar', exact: true }).click();
  await expect.poll(() => savedValue('Atalho-quadro.md')).toContain('Texto ativo antes da nova nota'); await expect(editor).toHaveText(''); await expect(editor).toBeFocused();
  const newButton = page.getByRole('button', { name: 'Nova nota', exact: true }).first(); await expect(newButton).toHaveAttribute('aria-keyshortcuts', 'Meta+Shift+Enter Control+Shift+Enter'); await expect(newButton).toHaveAttribute('title', /⇧Enter/);
  await editor.fill('# Alteração pelo botão'); await newButton.click(); await expect(confirmation).toBeVisible();
  const evidence = new URL('../docs/evidence/new-note/', import.meta.url); await fs.mkdir(evidence, { recursive: true });
  for (const [width, height] of [[1440, 900], [390, 844]]) { await page.setViewportSize({ width, height }); await page.screenshot({ path: new URL(`new-note-confirmation-${width}-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname }); }
  await confirmation.getByRole('button', { name: 'Descartar e criar', exact: true }).click(); await expect(editor).toHaveText(''); await expect(editor).toBeFocused();
  await context.close(); assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chromium'}): Meta/Control+Shift+Enter, cancellation, discard, successful private save before creating, focused blank note, natural/source/canvas input, settings guard and shared button confirmation.`);
} finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
