import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-selection-'));
const source = '# Seleção de texto\n\nA seleção tem **negrito** e espaços.\n\nOutra linha com café e ação.\n\n😀 Um símbolo na nota.\n\n' + Array.from({ length: 160 }, (_, index) => `Linha ${index + 1}: conteúdo além da área visível.\n`).join('');
const otherSource = '# Outra nota\n\nUma seleção começa vazia em um documento diferente.\n';
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
let server, browser, page, root, originalHead;
try {
  let origin = process.env.SCRIBA_URL;
  if (!origin) {
    const state = path.join(directory, 'state'), checkout = path.join(directory, 'notes'), remote = path.join(directory, 'remote.git');
    await fs.mkdir(state); await fs.mkdir(checkout); await fs.mkdir(remote);
    root = await fs.realpath(checkout);
    await git(remote, 'init', '--bare', '-b', 'main'); await git(root, 'init', '-b', 'main');
    for (const [key, value] of [['user.name', 'Scriba Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
    await fs.writeFile(path.join(root, 'Selecao.md'), source); await fs.writeFile(path.join(root, 'Outra.md'), otherSource);
    await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Initial');
    await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
    originalHead = await git(root, 'rev-parse', 'HEAD');
    await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { autoSave: false, askCommitNote: false, intervalMinutes: 1 } }));
    await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: ['Selecao.md'], welcomeImageVersion: 1 } }));
    const runtime = path.join(directory, 'runtime.json');
    server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
    for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
    assert.ok(origin);
  }
  browser = safari ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  page = await context.newPage(); const errors = [], api = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()); });
  await page.goto(origin);
  await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Selecao.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
  const workbench = page.getByLabel('Bancada Markdown'), footer = page.getByLabel('Estatísticas do documento', { exact: true });
  const selected = footer.locator('[data-selected-characters]');
  const editor = page.locator('.cm-content[contenteditable=true]');
  const reading = page.getByRole('article');
  await expect(workbench).toHaveAttribute('data-mode', 'read');
  await expect(selected).toHaveCount(0);
  await expect(footer).toContainText(`${source.length} caracteres`);

  async function expectCount(count) {
    if (count) { await expect(selected).toHaveAttribute('data-selected-characters', String(count)); await expect(selected).toBeVisible(); }
    else await expect(selected).toHaveCount(0);
  }
  async function selectNative(locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
  }
  // Real mouse drag, followed by native keyboard extension, reproduces the user's case.
  const paragraph = reading.locator('p').filter({ hasText: 'Outra linha com café' });
  async function dragCafe(backward = false) {
    await paragraph.scrollIntoViewIfNeeded();
    const box = await paragraph.evaluate(node => {
      const text = node.firstChild, offset = text.textContent.indexOf('café');
      const range = document.createRange(); range.setStart(text, offset); range.setEnd(text, offset + 4);
      const rect = range.getBoundingClientRect(); return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(backward ? box.right - 0.2 : box.left + 0.2, box.y);
    await page.mouse.down();
    await page.mouse.move(backward ? box.left + 0.2 : box.right - 0.2, box.y, { steps: 10 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => getSelection().toString()), 'café');
    await expectCount(4);
  }
  const originalParagraph = await paragraph.elementHandle();
  await dragCafe();
  await page.keyboard.press('Shift+ArrowRight'); await expectCount(5);
  assert.equal(await originalParagraph.evaluate(node => node.isConnected), true, 'statistics do not replace the reading DOM');
  // Native reading arrows do not necessarily collapse selection when caret
  // browsing is disabled; a plain click is the user's unambiguous deselect action.
  await paragraph.click(); await expectCount(0);
  await dragCafe(true);
  if (!safari && !process.env.SCRIBA_URL) await page.screenshot({ path: 'docs/evidence/selection-reading-desktop.png' });
  const formatted = reading.locator('p').filter({ hasText: 'A seleção tem negrito' });
  await selectNative(formatted); await expectCount('A seleção tem negrito e espaços.'.length);
  const heading = page.getByRole('heading', { name: 'Seleção de texto', exact: true });
  await selectNative(heading); await expectCount('Seleção de texto'.length);
  await selectNative(page.locator('.notes-heading')); await expectCount(0);

  // CodeMirror's complete source selection includes Markdown and non-rendered lines.
  await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await expectCount(0);
  await editor.click(); await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('Shift+ArrowRight'); await expectCount(1); await expect(selected).toHaveText('1 selecionado');
  for (let index = 0; index < 4; index++) await page.keyboard.press('Shift+ArrowRight');
  await expectCount(5);
  await page.keyboard.press('ControlOrMeta+a'); await expectCount(source.length);
  if (!safari && !process.env.SCRIBA_URL) await page.screenshot({ path: 'docs/evidence/selection-source-desktop.png' });
  await page.keyboard.press('ArrowRight'); await expectCount(0);
  await page.getByRole('button', { name: 'Escrever', exact: true }).click();
  await editor.click(); await page.keyboard.press('ControlOrMeta+a'); await expectCount(source.length);
  await page.getByRole('button', { name: 'Visão', exact: true }).click(); await expectCount(0);
  await selectNative(formatted.locator('strong')); await expectCount(7);
  await editor.click(); await page.keyboard.press('ControlOrMeta+Home'); await page.keyboard.press('Shift+ArrowRight'); await expectCount(1);
  await selectNative(heading); await expectCount('Seleção de texto'.length);

  await page.getByRole('button', { name: 'Ler', exact: true }).click(); await expectCount(0);
  for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    if (await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).click();
    await selectNative(formatted); await expectCount('A seleção tem negrito e espaços.'.length);
    await expect(footer).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await footer.boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= size.height + 1);
    if (!safari && !process.env.SCRIBA_URL && size.width === 390) await page.screenshot({ path: 'docs/evidence/selection-reading-mobile.png' });
    await page.evaluate(() => getSelection().removeAllRanges()); await expectCount(0);
    if (size.width < 900) await expect(footer).toBeHidden();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectNative(formatted); await expectCount('A seleção tem negrito e espaços.'.length);
  await page.getByRole('button', { name: 'Usar tema claro', exact: true }).click();
  await selectNative(formatted); await expectCount('A seleção tem negrito e espaços.'.length);
  if (!safari && !process.env.SCRIBA_URL) await page.screenshot({ path: 'docs/evidence/selection-reading-light.png' });
  await expect(workbench.getByLabel('Documento alterado', { exact: true })).toHaveCount(0);
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar .md', exact: true }).click();
  assert.equal(await fs.readFile(await (await downloading).path(), 'utf8'), source);
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Outra.md', mimeType: 'text/markdown', buffer: Buffer.from(otherSource) });
  await expect(page.getByRole('heading', { name: 'Outra nota', exact: true })).toBeVisible();
  await expectCount(0); await expect(footer).toContainText(`${otherSource.length} caracteres`);
  if (root) {
    assert.equal(await fs.readFile(path.join(root, 'Selecao.md'), 'utf8'), source);
    assert.equal(await git(root, 'status', '--porcelain'), '');
    assert.equal(await git(root, 'rev-parse', 'HEAD'), originalHead);
  }
  if (process.env.SCRIBA_URL || process.env.SCRIBA_EXPECT_BROWSER_STORAGE) assert.deepEqual(api, []);
  assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chromium'}${process.env.SCRIBA_URL ? ' public' : ''}): native drag/reverse/keyboard selection, formatted text and headings, source/live full virtualized selection, split-pane switching, reset/outside scope, phone/tablet orientations, themes, unchanged totals/source/export/Git.`);
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  await fs.rm(directory, { recursive: true, force: true });
}
