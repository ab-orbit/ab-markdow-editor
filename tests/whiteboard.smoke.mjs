import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';

// The public bundle and real private browser storage are exercised without user notes or accounts.
let server;
let origin = process.env.SCRIBA_URL;
if (!origin) {
  server = http.createServer(async (request, response) => {
    if (request.url.startsWith('/github/')) { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ configured: false, connected: false, user: null, selection: null })); return; }
    try {
      const url = new URL(request.url, 'http://localhost');
      const file = new URL(`../dist/${url.pathname === '/' ? 'index.html' : url.pathname.slice(1)}`, import.meta.url);
      const bytes = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': file.pathname.endsWith('.js') ? 'text/javascript' : file.pathname.endsWith('.css') ? 'text/css' : file.pathname.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
const browser = await (safari ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const evidence = new URL('../docs/evidence/whiteboard/', import.meta.url);
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  const prefix = '\uFEFF<!-- Keep comments, references and line endings. -->\r\n\r\n# Projeto Aurora\r\n\r\nEsta nota permanece com **Markdown original** e [sua referência][origem].\r\n\r\n[origem]: https://example.invalid/context "Original"\r\n';
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Whiteboard.md', mimeType: 'text/markdown', buffer: Buffer.from(prefix) });
  await expect(page.getByRole('article')).toContainText('Projeto Aurora'); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  const workbench = page.getByLabel('Bancada Markdown'), formats = page.getByRole('group', { name: 'Formato do documento', exact: true });
  await formats.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await expect(workbench).toHaveAttribute('data-mode', 'whiteboard');
  const board = page.getByRole('region', { name: 'Whiteboard Excalidraw', exact: true });
  await expect(board).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 30000 });
  await expect(page.getByRole('dialog', { name: 'Editor Excalidraw', exact: true })).toHaveCount(0);
  const canvas = board.locator('canvas.interactive'); const bounds = await canvas.boundingBox();
  assert.ok(bounds.width > 800 && bounds.height > 500, 'The drawing occupies the workspace rather than an inline note preview.');
  await board.getByRole('radio', { name: 'Retângulo', exact: true }).locator('..').click();
  await page.mouse.move(bounds.x + bounds.width * .45, bounds.y + bounds.height * .3); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .5, { steps: 8 }); await page.mouse.up();
  await board.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click();
  await page.mouse.click(bounds.x + bounds.width * .5, bounds.y + bounds.height * .7);
  const textarea = board.locator('textarea.excalidraw-wysiwyg'); await expect(textarea).toBeVisible(); await textarea.fill('Planejamento no quadro');
  // Saving with an active text box must include the latest text, without requiring Escape first.
  await page.keyboard.press('Meta+s'); await expect(page.getByRole('status').filter({ hasText: 'Nota salva neste navegador.' })).toBeVisible();
  async function downloadNote() {
    const more = page.getByRole('button', { name: 'Mais opções da nota', exact: true });
    if (await more.isVisible() && !await page.getByRole('button', { name: 'Baixar .md', exact: true }).isVisible()) await more.click();
    const menu = page.getByRole('button', { name: 'Exportar nota', exact: true }); if (await menu.isVisible()) await menu.click();
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar .md', exact: true }).click();
    return fs.readFile(await (await pending).path(), 'utf8');
  }
  let markdown = await downloadNote(); assert.ok(markdown.startsWith(prefix)); assert.ok(markdown.includes('```excalidraw\r\n')); assert.ok(markdown.includes('Planejamento no quadro'));
  const scene = JSON.parse(/```excalidraw\r?\n([\s\S]*?)\r?\n```/.exec(markdown)[1]);
  assert.ok(scene.elements.some(element => element.type === 'rectangle')); assert.ok(scene.elements.some(element => element.type === 'text' && element.text.includes('Planejamento no quadro')));
  const firstFence = /```excalidraw\r?\n[\s\S]*?\r?\n```/.exec(markdown)[0];
  await board.getByRole('button', { name: 'Novo quadro', exact: true }).click(); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  await expect(board.getByRole('combobox', { name: 'Quadro da nota', exact: true })).toHaveValue('1');
  const secondBounds = await canvas.boundingBox(); await board.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click(); await page.mouse.click(secondBounds.x + secondBounds.width * .55, secondBounds.y + secondBounds.height * .5);
  await expect(textarea).toBeVisible(); await textarea.fill('Segundo quadro salvo pelo botão');
  await page.getByRole('button', { name: 'Salvar nota', exact: true }).click();
  async function savedMarkdown() {
    return page.evaluate(async () => { const db = await new Promise(resolve => { const request = indexedDB.open('scriba-private-notes'); request.onsuccess = () => resolve(request.result); }); try { return await new Promise(resolve => { const request = db.transaction('library').objectStore('library').get('state'); request.onsuccess = () => resolve(request.result?.notes?.['Whiteboard.md']?.value || ''); }); } finally { db.close(); } });
  }
  await expect.poll(savedMarkdown).toContain('Segundo quadro salvo pelo botão');
  markdown = await downloadNote(); assert.ok(markdown.startsWith(prefix)); assert.equal(markdown.match(/```excalidraw/g).length, 2); assert.equal(/```excalidraw\r?\n[\s\S]*?\r?\n```/.exec(markdown)[0], firstFence, 'Editing another board retains the first fence byte-for-byte.');
  await board.getByRole('combobox', { name: 'Quadro da nota', exact: true }).selectOption('0'); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  await formats.getByRole('button', { name: 'Nota', exact: true }).click(); await expect(workbench).toHaveAttribute('data-mode', 'read'); await expect(page.getByRole('article')).toContainText('Projeto Aurora');
  assert.equal(await downloadNote(), markdown, 'Switching to Note preserves the complete source.');
  await formats.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  assert.equal(await downloadNote(), markdown, 'Opening a saved drawing does not serialize or modify it.');
  // Panning and zooming are presentation changes, not document edits.
  const canvasBeforePan = await canvas.boundingBox(); await page.keyboard.down('Space'); await page.mouse.move(canvasBeforePan.x + 300, canvasBeforePan.y + 300); await page.mouse.down(); await page.mouse.move(canvasBeforePan.x + 380, canvasBeforePan.y + 350, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Space');
  assert.equal(await downloadNote(), markdown);
  await board.getByRole('combobox', { name: 'Quadro da nota', exact: true }).selectOption('1');
  // Scene navigation flushes active input asynchronously; await the actual selection before reloading.
  await expect(board.getByRole('combobox', { name: 'Quadro da nota', exact: true })).toHaveValue('1');
  await expect.poll(() => page.evaluate(() => Object.entries(localStorage).some(([key, value]) => key.startsWith('scriba-whiteboard-scene:') && value === '1'))).toBe(true);
  await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  await page.reload(); await expect(workbench).toHaveAttribute('data-mode', 'whiteboard'); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 30000 });
  await expect(board.getByRole('combobox', { name: 'Quadro da nota', exact: true })).toHaveValue('1');
  await board.getByRole('combobox', { name: 'Quadro da nota', exact: true }).selectOption('0'); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  assert.equal(await downloadNote(), markdown, 'Reload restores the selected format and saved drawing.');
  for (const format of ['SVG vetorial', 'PNG transparente', 'Excalidraw editável']) {
    await board.getByLabel('Exportar whiteboard', { exact: true }).click(); const pending = page.waitForEvent('download');
    await board.getByRole('button', { name: format, exact: true }).click(); const bytes = await fs.readFile(await (await pending).path());
    if (format === 'SVG vetorial') assert.ok(bytes.toString().includes('<svg'));
    else if (format === 'PNG transparente') assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    else assert.ok(JSON.parse(bytes.toString()).elements.some(element => element.type === 'rectangle'));
  }
  await fs.mkdir(evidence, { recursive: true });
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: theme === 'light' ? 'Usar tema claro' : 'Usar tema escuro', exact: true }); if (await toggle.isVisible()) await toggle.click();
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [820, 1180], [1180, 820]]) {
      await page.setViewportSize({ width, height });
      const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true }); if (await close.isVisible()) await close.click();
      await expect(board).toBeVisible(); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await expect.poll(async () => { const area = await canvas.boundingBox(); return area.width >= width - 240 && area.height > height * .45; }, { message: `Canvas resizes to the ${width}×${height} workspace.` }).toBe(true);
      if (width < 900) { const picker = page.getByRole('combobox', { name: 'Formato do documento', exact: true }); await picker.selectOption('note'); await expect(workbench).toHaveAttribute('data-mode', 'read'); await picker.selectOption('whiteboard'); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready'); }
      await page.screenshot({ path: new URL(`whiteboard-${theme}-${width}x${height}-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Delay only File.text scheduling. A late import must never write into another open note.
  await page.evaluate(() => { const original = File.prototype.text; window.scribaOriginalFileText = original; File.prototype.text = async function () { if (this.name === 'delayed.excalidraw') { await new Promise(resolve => { window.scribaReleaseFileRead = resolve; }); const value = await original.call(this); window.scribaFileReadCompleted = true; return value; } return original.call(this); }; });
  await board.getByLabel('Arquivo do whiteboard', { exact: true }).setInputFiles({ name: 'delayed.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await expect.poll(() => page.evaluate(() => typeof window.scribaReleaseFileRead)).toBe('function');
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Outra-nota.md', mimeType: 'text/markdown', buffer: Buffer.from('# Outra nota\n\nImportação anterior não pode alterar este arquivo.') });
  await expect(page.getByRole('article')).toContainText('Outra nota');
  await page.evaluate(() => { File.prototype.text = window.scribaOriginalFileText; window.scribaReleaseFileRead(); });
  await expect.poll(() => page.evaluate(() => window.scribaFileReadCompleted)).toBe(true);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await downloadNote(), '# Outra nota\n\nImportação anterior não pode alterar este arquivo.');
  if (!await page.getByRole('button', { name: 'Nova nota', exact: true }).isVisible()) await page.getByRole('button', { name: 'Mostrar notas recentes', exact: true }).click();
  await page.getByRole('button', { name: 'Nova nota', exact: true }).click();
  await formats.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  await page.getByRole('button', { name: 'Salvar nota', exact: true }).click(); await expect(page.getByLabel('Documento alterado')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'documento.md', exact: true })).toContainText('Whiteboard · quadro editável');
  await formats.getByRole('button', { name: 'Nota', exact: true }).click(); await expect(page.getByRole('article')).toContainText('Quadro vazio'); await expect(page.getByRole('article').getByRole('alert')).toHaveCount(0);
  await formats.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  await board.getByRole('button', { name: 'Novo quadro', exact: true }).click(); await expect(board).toHaveAttribute('data-whiteboard-state', 'ready');
  const portable = await downloadNote();
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }); const imported = await fresh.newPage(); await imported.goto(origin);
  await expect(imported.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled(); await imported.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Quadros-portateis.md', mimeType: 'text/markdown', buffer: Buffer.from(portable) });
  await expect(imported.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode', 'whiteboard'); await expect(imported.getByRole('region', { name: 'Whiteboard Excalidraw', exact: true })).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 30000 });
  await expect(imported.getByRole('combobox', { name: 'Quadro da nota', exact: true }).locator('option')).toHaveCount(2); await fresh.close();
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }); const phone = await touch.newPage(); await phone.goto(origin);
  await expect(phone.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled(); await phone.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Toque.md', mimeType: 'text/markdown', buffer: Buffer.from(portable) });
  const phoneBoard = phone.getByRole('region', { name: 'Whiteboard Excalidraw', exact: true }); await expect(phoneBoard).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 30000 });
  await phoneBoard.getByRole('radio', { name: 'Texto', exact: true }).locator('..').tap(); const touchArea = await phoneBoard.locator('canvas.interactive').boundingBox(); await phone.touchscreen.tap(touchArea.x + touchArea.width * .6, touchArea.y + touchArea.height * .6);
  await phoneBoard.locator('textarea.excalidraw-wysiwyg').fill('Texto criado por toque'); await phone.getByRole('button', { name: 'Salvar whiteboard', exact: true }).tap();
  await expect.poll(() => phone.evaluate(async () => { const db = await new Promise(resolve => { const request = indexedDB.open('scriba-private-notes'); request.onsuccess = () => resolve(request.result); }); try { return await new Promise(resolve => { const request = db.transaction('library').objectStore('library').get('state'); request.onsuccess = () => resolve(request.result?.notes?.['Toque.md']?.value || ''); }); } finally { db.close(); } })).toContain('Texto criado por toque');
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chromium'}): workspace canvas, drawing/text input, active-text keyboard/button saves, multiple boards, exact source preservation, format switching, pan without writes, reload and phone/tablet/desktop in both themes/orientations.`);
} finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
