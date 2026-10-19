import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

// Real navigation across reading, visual editing, CodeMirror and both split panes.
const fence = '`'.repeat(3), prose = Array.from({ length: 9 }, (_, index) => `Parágrafo ${index + 1}. Evidências e referências documentam o contexto desta seção.\n\n`).join('');
const source = ('\uFEFF# Caderno de **pesquisa**\n\n' + prose + '## Visão geral\n\n' + prose + '### Perguntas e hipóteses\n\n' + prose + '#### Repetido\n\nDetalhe fora do índice.\n\n' + fence + 'markdown\n# Falso no código\n## Outra seção falsa\n' + fence + '\n\n<!--\n## Comentário oculto\n-->\n\n\\# Marcador escapado\n\n## Repetido\n\n' + prose + '## Repetido\n\n' + prose + '### Contratos `HTTP` e **fontes**\n\n' + prose + 'Título alternativo\n---\n\n' + prose + '## Última seção\n\n' + prose).replace(/\n/g, '\r\n');
const labels = ['Caderno de pesquisa', 'Visão geral', 'Perguntas e hipóteses', 'Repetido', 'Repetido', 'Contratos HTTP e fontes', 'Título alternativo', 'Última seção'];
const exec = promisify(execFile), git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-outline-')), safari = process.env.MARKDOWN_BROWSER === 'webkit';
const evidence = new URL('../docs/evidence/outline/', import.meta.url);
let server, browser, root, origin = process.env.SCRIBA_URL;
try {
  await fs.mkdir(evidence, { recursive: true });
  if (!origin) {
    root = path.join(temporary, 'notes'); const state = path.join(temporary, 'state'); await fs.mkdir(root); await fs.mkdir(state); root = await fs.realpath(root);
    await git(root, 'init', '-b', 'main'); for (const [key, value] of [['user.name', 'Outline Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
    await fs.writeFile(path.join(root, 'Outline.md'), source); await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Outline fixture');
    await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { askCommitNote: false, autoSave: false, intervalMinutes: 1 } }));
    await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: ['Outline.md'], welcomeImageVersion: 1, diagramManualVersion: 1 } }));
    const runtime = path.join(temporary, 'runtime.json'); server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
    for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  }
  assert.ok(origin); browser = safari ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.goto(origin); await page.getByLabel('Bancada Markdown').waitFor();
  if (root) await page.getByRole('button', { name: 'Outline.md', exact: true }).click();
  const input = page.getByLabel('Arquivo Markdown', { exact: true }); await expect(input).toBeEnabled(); await input.setInputFiles({ name: 'Outline.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
  const outline = page.getByLabel('Índice da nota', { exact: true }), sections = page.getByRole('navigation', { name: 'Seções da nota', exact: true }), workbench = page.getByLabel('Bancada Markdown');
  const toggle = () => page.getByRole('button', { name: 'Mostrar outline', exact: true }).filter({ visible: true }).first();
  await expect(outline).toHaveCount(0); await toggle().click(); await expect(outline).toBeVisible();
  await expect(sections.getByRole('link')).toHaveText(labels);
  assert.deepEqual(await sections.locator('li').evaluateAll(nodes => nodes.map(node => node.dataset.level)), ['1', '2', '3', '2', '2', '3', '2', '2']);
  assert.equal(await sections.getByText('Falso no código').count(), 0); await expect(page.locator('dialog[open]')).toHaveCount(0);
  assert.equal(await sections.getByRole('link', { name: 'Repetido', exact: true }).nth(1).getAttribute('href'), '#repetido-2');
  await sections.getByRole('link', { name: 'Repetido', exact: true }).nth(1).click();
  await expect(page.locator('article #repetido-2')).toBeInViewport(); await expect(sections.locator('[aria-current="location"]')).toHaveText('Repetido');
  await page.locator('article #visão-geral').evaluate(node => node.scrollIntoView({ block: 'start' })); await expect(sections.locator('[aria-current="location"]')).toHaveText('Visão geral');
  await page.screenshot({ path: new URL(`outline-desktop-dark-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
  const download = async () => { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar .md', exact: true }).click(); return fs.readFile(await (await pending).path(), 'utf8'); };
  assert.equal(await download(), source, 'Opening and navigating the outline preserves BOM and CRLF.');
  for (const mode of ['Fonte', 'Visão', 'Editar blocos Markdown']) {
    await page.getByRole('button', { name: mode, exact: true }).click(); await sections.getByRole('link', { name: 'Última seção', exact: true }).click();
    await expect(page.locator('.cm-line').filter({ hasText: 'Última seção' }).first()).toBeInViewport();
    if (mode === 'Visão') await expect(page.locator('article #última-seção')).toBeInViewport();
  }
  await page.getByRole('button', { name: 'Escrever', exact: true }).click();
  const visual = page.getByRole('textbox', { name: 'Texto da nota', exact: true }); await expect(visual).toBeVisible();
  await sections.getByRole('link', { name: 'Última seção', exact: true }).click(); await expect(visual.getByRole('heading', { name: 'Última seção', exact: true })).toBeInViewport();
  const last = visual.getByRole('heading', { name: 'Última seção', exact: true });
  await last.evaluate(node => { node.closest('[contenteditable=true]').focus(); const range = document.createRange(); range.selectNodeContents(node); range.collapse(false); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
  await last.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.type(' revisada');
  await expect(sections.getByRole('link', { name: 'Última seção revisada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await page.locator('.cm-content[contenteditable=true]').fill(source); await page.getByRole('button', { name: 'Ler', exact: true }).click();
  for (const theme of ['light', 'dark']) {
    const themeToggle = page.getByRole('button', { name: theme === 'light' ? 'Usar tema claro' : 'Usar tema escuro', exact: true }); if (await themeToggle.isVisible()) await themeToggle.click();
    for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(size);
      const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
      if (await closeNotes.isVisible()) {
        if (await page.getByRole('dialog', { name: 'Índice da nota', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar outline', exact: true }).click();
        await closeNotes.click();
      }
      if (!await outline.count()) await toggle().click(); await expect(outline).toBeVisible();
      if (size.width < 900) {
        await expect(page.getByRole('dialog', { name: 'Índice da nota', exact: true })).toHaveAttribute('open', '');
        await expect.poll(() => page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true);
        await page.keyboard.press('Tab');
        await expect.poll(() => page.evaluate(() => ({ inside: !!document.activeElement.closest('dialog'), tag: document.activeElement.outerHTML.slice(0, 150) }))).toMatchObject({ inside: true });
      }
      const touch = await sections.getByRole('link').first().boundingBox(); assert.ok(touch.height >= 44);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: new URL(`outline-${theme}-${size.width}x${size.height}-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
      await sections.getByRole('link', { name: 'Última seção', exact: true }).click();
      if (size.width < 900) await expect(outline).toHaveCount(0);
      await expect(page.locator('article #última-seção')).toBeInViewport();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); if (!await outline.count()) await toggle().click(); await expect(page.getByRole('dialog', { name: 'Índice da nota', exact: true })).toHaveAttribute('open', ''); await page.keyboard.press('Escape'); await expect(outline).toHaveCount(0); await expect(toggle()).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await page.locator('.cm-content[contenteditable=true]').fill('Apenas texto, sem títulos.'); await page.getByRole('button', { name: 'Ler', exact: true }).click(); await toggle().click(); await expect(outline).toContainText('Os títulos de níveis 1, 2 e 3'); await expect(sections).toHaveCount(0);
  if (root) { assert.equal(await fs.readFile(path.join(root, 'Outline.md'), 'utf8'), source); assert.equal(await git(root, 'status', '--porcelain'), ''); }
  assert.deepEqual(errors, []); console.log(`PASS (${safari ? 'WebKit' : 'Chrome'}, ${root ? 'native' : 'browser'}): heading levels, Markdown parsing, duplicate anchors, scroll tracking, all editor modes, live updates, source preservation, keyboard and both themes across phone/tablet orientations.`);
} finally { await browser?.close(); server?.kill(); if (server && server.exitCode === null) await new Promise(resolve => server.once('exit', resolve)); await fs.rm(temporary, { recursive: true, force: true }); }
