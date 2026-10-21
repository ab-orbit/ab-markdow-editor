import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

// Real scene previews, canvas gestures, editing, download files and save/reopen.
const manual = await fs.readFile(new URL('../docs/Scriba-Diagramas.md', import.meta.url), 'utf8');
const examples = [...manual.matchAll(/<!-- excalidraw-example: ([\w-]+) capabilities=([^>]+) -->\n```excalidraw\n([\s\S]*?)\n```/g)].map(match => ({ id: match[1], capability: match[2].trim(), source: match[3] }));
assert.equal(examples.length, 29);
const fence = '`'.repeat(3), name = 'Desenhos.md', prefix = '\uFEFF# Caderno visual\r\n\r\n<!-- Anotação original preservada. -->\r\n\r\n', suffix = '\r\n\r\nFim do caderno.\r\n';
const fixture = prefix + examples.map((item, index) => `## ${index + 1} · ${item.id}\n\n${index === 0 ? '~~~' : fence}excalidraw\n${item.source}\n${index === 0 ? '~~~' : fence}`).join('\n\n').replace(/\n/g, '\r\n') + suffix;
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-excalidraw-')), evidence = new URL('../docs/evidence/excalidraw/', import.meta.url);
const exec = promisify(execFile), git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
let browser, server, page, root, origin = process.env.SCRIBA_URL;
try {
  if (!origin) {
    root = path.join(directory, 'notes'); const state = path.join(directory, 'state'); await fs.mkdir(root); await fs.mkdir(state); root = await fs.realpath(root);
    await git(root, 'init', '-b', 'main'); for (const [key, value] of [['user.name', 'Canvas Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
    await fs.writeFile(path.join(root, name), fixture); await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Canvas fixture');
    const remote = path.join(directory, 'remote.git'); await git(directory, 'init', '--bare', '-b', 'main', remote); await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
    await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { autoSave: false, askCommitNote: false, intervalMinutes: 1 } }));
    await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: [name], welcomeImageVersion: 1, diagramManualVersion: 1 } }));
    const runtime = path.join(directory, 'runtime.json'); server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
    for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  }
  assert.ok(origin); browser = safari ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }); page = await context.newPage();
  const errors = [], outside = [], csp = [], infrastructure = []; let acceptDiscard = true, handledDialogs = 0, probes = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/document-version') probes++; });
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', async dialog => { await (acceptDiscard ? dialog.accept() : dialog.dismiss()); handledDialogs++; });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => { (window.__cspViolations ||= []).push({ uri: event.blockedURI, directive: event.violatedDirective }); }));
  const cloudflare = url => !!process.env.SCRIBA_URL && url.hostname === 'static.cloudflareinsights.com' && url.pathname.startsWith('/beacon.min.js');
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (cloudflare(url)) { infrastructure.push(url.origin + url.pathname); return route.abort(); } if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) { outside.push(url.origin + url.pathname); return route.abort(); } return route.continue(); });
  await page.goto(origin); await page.getByLabel('Bancada Markdown').waitFor();
  if (root) { await page.getByRole('button', { name, exact: true }).click(); await expect(page.locator('article h1')).toHaveText('Caderno visual'); }
  const input = page.getByLabel('Arquivo Markdown', { exact: true }); await expect(input).toBeEnabled(); await input.setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(fixture) });
  const figures = page.locator('article figure[data-excalidraw-state]'), first = figures.first(), workbench = page.getByLabel('Bancada Markdown');
  const save = () => page.getByRole('button', { name: root ? 'Salvar no repositório' : 'Salvar nota', exact: true }).click();
  await expect(figures).toHaveCount(29); await expect(workbench).toHaveAttribute('data-mode', 'read');
  for (let index = 0; index < examples.length; index++) {
    const figure = figures.nth(index); await figure.scrollIntoViewIfNeeded(); await expect(figure).toHaveAttribute('data-excalidraw-state', 'ready', { timeout: 30000 });
    assert.ok(await figure.locator('[data-diagram-drawing] > svg').evaluate(svg => { const box = svg.viewBox.baseVal; return box.width > 0 && box.height > 0 && svg.querySelectorAll('path,text,rect,image').length > 0; }));
    if (examples[index].id === 'image-review') assert.ok(await figure.locator('svg image').count() >= 1, 'Embedded raster survives safe preview rendering.');
  }
  async function downloadNote() { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar .md', exact: true }).click(); return fs.readFile(await (await pending).path(), 'utf8'); }
  assert.equal(await downloadNote(), fixture, 'Rendering every example preserves all original source bytes.');
  await first.scrollIntoViewIfNeeded(); const viewport = first.getByRole('group', { name: 'Zoom do diagrama', exact: true });
  await viewport.hover(); await page.mouse.wheel(0, -250); await expect.poll(() => viewport.getAttribute('data-diagram-zoom')).not.toBe('1.000');
  await first.getByRole('button', { name: 'Ajustar diagrama à largura', exact: true }).click(); await expect(viewport).toHaveAttribute('data-diagram-zoom', '1.000');
  await first.getByRole('button', { name: 'Ver código do desenho', exact: true }).click(); await expect(first.getByLabel('Código Excalidraw', { exact: true }).locator('.shiki')).toBeVisible();
  await first.getByRole('button', { name: 'Copiar código do diagrama', exact: true }).click(); await expect(first.getByRole('button', { name: 'Código copiado', exact: true })).toBeVisible();
  await fs.mkdir(evidence, { recursive: true }); await page.screenshot({ path: new URL(`code-desktop-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
  await first.getByRole('button', { name: 'Ocultar código do desenho', exact: true }).click();
  for (const format of ['SVG vetorial', 'PNG transparente', 'Excalidraw editável']) {
    await first.getByLabel('Baixar desenho', { exact: true }).click(); const pending = page.waitForEvent('download'); await first.getByRole('button', { name: format, exact: true }).click();
    const file = await pending, bytes = await fs.readFile(await file.path()); await fs.writeFile(path.join(directory, file.suggestedFilename()), bytes);
    if (format === 'SVG vetorial') { const svg = bytes.toString(); assert.ok(svg.includes('@font-face') && svg.includes('data:font/woff2;base64,')); assert.ok(!svg.includes('https://esm.sh')); assert.ok(!svg.includes('<foreignObject')); }
    else if (format === 'PNG transparente') {
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG'); const bitmap = await page.evaluate(async data => { const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return { width: image.width, height: image.height, alpha: context.getImageData(0, 0, 1, 1).data[3] }; }, bytes.toString('base64')); assert.equal(bitmap.alpha, 0); assert.ok(bitmap.width > 600 && bitmap.height > 100);
    } else { const scene = JSON.parse(bytes); assert.equal(scene.type, 'excalidraw'); assert.ok(scene.elements.some(element => element.type === 'diamond')); }
  }
  async function openCanvas(figure = first) { await figure.scrollIntoViewIfNeeded(); await figure.getByRole('button', { name: 'Editar desenho Excalidraw', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Editor Excalidraw', exact: true }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await expect(dialog.getByRole('radio', { name: 'Texto', exact: true })).toBeAttached(); return dialog; }
  let dialog = await openCanvas(); await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(dialog).toHaveCount(0); assert.equal(await downloadNote(), fixture, 'Applying an untouched canvas does not serialize the note.');
  dialog = await openCanvas();
  await dialog.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click(); const canvas = dialog.locator('canvas.interactive'); const bounds = await canvas.boundingBox();
  await page.mouse.click(bounds.x + bounds.width * .55, bounds.y + bounds.height * .78); const textarea = dialog.locator('textarea.excalidraw-wysiwyg'); await expect(textarea).toBeVisible(); await textarea.fill('Revisão contextual'); await page.keyboard.press('Escape');
  await expect(dialog.getByRole('status')).toContainText('Rascunho'); await page.screenshot({ path: new URL(`editor-desktop-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
  acceptDiscard = false; const beforeDiscard = handledDialogs; await dialog.getByRole('button', { name: 'Fechar editor Excalidraw', exact: true }).click(); await expect.poll(() => handledDialogs).toBe(beforeDiscard + 1); await expect(dialog).toBeVisible(); acceptDiscard = true;
  await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(first).toContainText('Revisão contextual');
  let edited = await downloadNote(); assert.ok(edited.startsWith(prefix) && edited.endsWith(suffix)); assert.ok(edited.includes('~~~excalidraw\r\n')); assert.equal(edited.replace(/\r\n/g, '').includes('\n'), false); assert.ok(edited.includes('Revisão contextual'));
  await save();
  if (root) await expect.poll(async () => fs.readFile(path.join(root, name), 'utf8')).toBe(edited);
  else await expect(page.getByRole('status').filter({ hasText: 'Nota salva neste navegador.' }).first()).toBeVisible();
  // Natural editing and CodeMirror live preview keep the same visual drawing editor.
  await page.getByRole('button', { name: 'Escrever', exact: true }).click(); await expect(page.locator('[data-visual-editor]')).toBeVisible();
  const visualFigure = page.locator('[data-visual-editor] figure[data-excalidraw-state]').first(); dialog = await openCanvas(visualFigure); await dialog.getByRole('button', { name: 'Fechar editor Excalidraw', exact: true }).click(); await expect(dialog).toHaveCount(0); assert.equal(await downloadNote(), edited);
  dialog = await openCanvas(visualFigure); const naturalScene = JSON.parse(examples[0].source); for (const element of naturalScene.elements) if (element.type === 'text') { element.text = element.text.replace('Capturar', 'Pesquisar'); element.originalText = element.originalText.replace('Capturar', 'Pesquisar'); }
  await dialog.getByLabel('Arquivo Excalidraw', { exact: true }).setInputFiles({ name: 'natural.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(naturalScene)) }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(visualFigure).toContainText('Pesquisar'); edited = await downloadNote(); assert.ok(edited.startsWith(prefix) && edited.endsWith(suffix)); assert.equal(edited.replace(/\r\n/g, '').includes('\n'), false);
  await page.getByRole('button', { name: 'Editar blocos Markdown', exact: true }).click(); const widget = page.locator('.md-live-diagram figure[data-excalidraw-state]').first(); dialog = await openCanvas(widget); await dialog.getByRole('button', { name: 'Fechar editor Excalidraw', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Ler', exact: true }).click();
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: theme === 'light' ? 'Usar tema claro' : 'Usar tema escuro', exact: true }); if (await toggle.isVisible()) await toggle.click();
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(size); const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true }); if (await closeNotes.isVisible()) await closeNotes.click();
      await first.scrollIntoViewIfNeeded(); await expect(first).toHaveAttribute('data-excalidraw-state', 'ready'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: new URL(`preview-${theme}-${size.width}x${size.height}-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
      dialog = await openCanvas(); assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth));
      const apply = await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).boundingBox(); assert.ok(apply.height >= 44 && apply.width >= 44 && apply.x >= 0 && apply.x + apply.width <= size.width);
      await page.screenshot({ path: new URL(`editor-${theme}-${size.width}x${size.height}-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
      await dialog.getByRole('button', { name: 'Fechar editor Excalidraw', exact: true }).click(); await expect(dialog).toHaveCount(0);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  if (root) { dialog = await openCanvas(); const before = probes; await page.waitForTimeout(5500); assert.equal(probes, before, 'Background disk probes pause while a canvas draft owns the document.'); await dialog.getByRole('button', { name: 'Fechar editor Excalidraw', exact: true }).click(); await expect(dialog).toHaveCount(0); }
  // Import rejects active embeds/resources, and a valid import is an undoable canvas edit.
  dialog = await openCanvas(); const sceneInput = dialog.getByLabel('Arquivo Excalidraw', { exact: true });
  await sceneInput.setInputFiles({ name: 'unsafe.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'excalidraw', elements: [{ id: 'external', type: 'iframe', x: 0, y: 0, link: 'https://example.invalid/private' }] })) });
  await expect(dialog.getByRole('alert')).toContainText('não suportado');
  const imported = JSON.parse(examples[0].source); for (const element of imported.elements) if (element.type === 'text') { element.text = element.text.replace('Capturar', 'Importar'); element.originalText = element.originalText.replace('Capturar', 'Importar'); }
  await sceneInput.setInputFiles({ name: 'safe.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await page.keyboard.press('Meta+s'); await expect(dialog).toHaveCount(0); await expect(first).toContainText('Importar');
  // A crash/reload keeps a private canvas draft; reopening recovers it without changing the saved note.
  await save();
  dialog = await openCanvas(); await dialog.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click(); const recoveryCanvas = await dialog.locator('canvas.interactive').boundingBox(); await page.mouse.click(recoveryCanvas.x + recoveryCanvas.width * .55, recoveryCanvas.y + recoveryCanvas.height * .82); await dialog.locator('textarea.excalidraw-wysiwyg').fill('Rascunho recuperável'); await page.keyboard.press('Escape');
  await expect(dialog.getByRole('status')).toContainText('Rascunho protegido');
  await page.reload(); await expect(figures).toHaveCount(29); dialog = await openCanvas(); await expect(dialog.getByRole('status')).toContainText('Rascunho recuperado'); await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(first).toContainText('Rascunho recuperável');
  // Creating a drawing is explicit: cancellation leaves the note untouched, import/apply appends one fence.
  edited = await downloadNote(); const formatting = page.getByRole('button', { name: 'Mostrar formatação', exact: true }).filter({ visible: true }); if (await formatting.count()) await formatting.click();
  await page.getByRole('button', { name: 'Inserir desenho Excalidraw', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Editor Excalidraw', exact: true }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'Fechar editor Excalidraw', exact: true }).click(); await expect(dialog).toHaveCount(0); assert.equal(await downloadNote(), edited);
  await page.getByRole('button', { name: 'Inserir desenho Excalidraw', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Editor Excalidraw', exact: true }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await dialog.getByLabel('Arquivo Excalidraw', { exact: true }).setInputFiles({ name: 'image.excalidraw', mimeType: 'application/json', buffer: Buffer.from(examples.find(item => item.id === 'image-review').source) }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(figures).toHaveCount(30); await figures.last().scrollIntoViewIfNeeded(); await expect(figures.last()).toHaveAttribute('data-excalidraw-state', 'ready'); assert.ok((await downloadNote()).startsWith(edited));
  await input.setInputFiles({ name: 'Invalid.md', mimeType: 'text/markdown', buffer: Buffer.from('# Cena para reparar\n\n```excalidraw\n{broken\n```\n') }); await expect(figures).toHaveCount(1); await expect(first).toHaveAttribute('data-excalidraw-state', 'error'); dialog = await openCanvas(); await expect(dialog.getByRole('alert')).toContainText('JSON inválido'); await dialog.getByLabel('Arquivo Excalidraw', { exact: true }).setInputFiles({ name: 'repair.excalidraw', mimeType: 'application/json', buffer: Buffer.from(examples[0].source) }); await expect(dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true })).toBeEnabled(); await dialog.getByRole('button', { name: 'Aplicar desenho à nota', exact: true }).click(); await expect(first).toHaveAttribute('data-excalidraw-state', 'ready');
  csp.push(...await page.evaluate(() => window.__cspViolations || [])); const drawingCsp = csp.filter(item => { try { return !cloudflare(new URL(item.uri)); } catch { return true; } }); assert.deepEqual(drawingCsp, []); assert.deepEqual(outside, []); assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chrome'}, ${root ? 'native' : 'browser'}): all 29 scenes, lazy preview, wheel zoom, JSON highlighting/copy, SVG fonts, transparent PNG, editable JSON, untouched source preservation, canvas editing/apply/cancel/save, natural editing/live preview and both themes across phone/tablet orientations. No external resources or CSP violations.`);
} catch (error) { if (page) { console.log('ALERTS', await page.getByRole('alert').allTextContents().catch(() => [])); await page.screenshot({ path: '/tmp/scriba-excalidraw-test-failure.png' }).catch(() => {}); } throw error; }
finally { await browser?.close(); server?.kill(); if (server && server.exitCode === null) await new Promise(resolve => server.once('exit', resolve)); await fs.rm(directory, { recursive: true, force: true }); }
