import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkDiagramMagnifier } from './helpers/diagram-magnifier.mjs';

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-diagrams-'));
const tick = String.fromCharCode(96), fence = tick.repeat(3);
const er = 'erDiagram\n  NOTEBOOK ||--o{ NOTE : contains\n  NOTEBOOK {\n    string title\n  }\n  NOTE {\n    int id PK\n    string text\n  }';
const flow = 'flowchart LR\n  A[Capturar notas] --> B{Revisar?}\n  B -->|Sim| C[Organizar]\n  B -->|Depois| D[Guardar]\n  C --> D';
const gantt = 'gantt\n  title Entrega\n  dateFormat YYYY-MM-DD\n  section Scriba\n  Comparar motores :a1, 2026-10-18, 3d';
const source = `# Comparar diagramas\n\nA mesma nota, três formas de desenhar.\n\n${fence}mermaid\n${er}\n${fence}\n\n## Processo\n\n${fence}mermaid\n${flow}\n${fence}\n\n## Cronograma\n\n${fence}mermaid\n${gantt}\n${fence}\n\n## Exemplo literal\n\n${tick.repeat(4)}markdown\n${fence}mermaid\nflowchart LR\n  EXAMPLE --> ONLY\n${fence}\n${tick.repeat(4)}\n\n## Cerca alternativa\n\n~~~mermaid\nflowchart LR\n  TILDE --> SUPPORTED\n~~~\n\n## Outra cópia independente\n\n${fence}mermaid\n${er}\n${fence}\n`;
let server, browser, page;
try {
  const state = path.join(directory, 'state'), checkout = path.join(directory, 'notes'), remote = path.join(directory, 'remote.git');
  await fs.mkdir(state); await fs.mkdir(checkout); await fs.mkdir(remote);
  const root = await fs.realpath(checkout);
  await git(remote, 'init', '--bare', '-b', 'main'); await git(root, 'init', '-b', 'main');
  for (const [key, value] of [['user.name', 'Scriba Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
  await fs.writeFile(path.join(root, 'Diagramas.md'), source); await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Initial'); await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
  await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { askCommitNote: false, autoSave: false, intervalMinutes: 1 } }));
  await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: ['Diagramas.md'], welcomeImageVersion: 1 } }));
  const runtime = path.join(directory, 'runtime.json');
  server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
  let origin;
  for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  assert.ok(origin);
  const webKit = process.env.MARKDOWN_BROWSER === 'webkit';
  browser = webKit ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  page = await context.newPage(); const errors = [], outsideRequests = [], reactErrors = [], measurements = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /synchronously unmount|unmounted component|Each child|cannot appear/.test(message.text())) reactErrors.push(message.text()); });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) { outsideRequests.push(url.origin + url.pathname); return route.abort(); }
    return route.continue();
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Diagramas.md', exact: true }).click();
  const workbench = page.getByLabel('Bancada Markdown');
  const diagrams = page.locator('article figure[data-diagram-engine]');
  const first = diagrams.first();
  await expect(workbench).toHaveAttribute('data-mode', 'read');
  await expect(diagrams).toHaveCount(5);
  async function choose(figure, engine) {
    await figure.scrollIntoViewIfNeeded();
    await figure.getByRole('combobox', { name: 'Renderizador do diagrama' }).selectOption(engine);
    await expect(figure).toHaveAttribute('data-diagram-engine', engine);
    await expect(figure).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
    await expect(figure.locator('svg').last()).toBeVisible();
  }
  for (const engine of ['mermaid', 'pele', 'beautiful']) {
    await choose(first, engine);
    await expect(first).toContainText('NOTEBOOK'); await expect(first).toContainText('NOTE');
    await expect(first.getByRole('combobox')).toBeEnabled();
    measurements.push({ engine, timing: await first.locator('output').getAttribute('aria-label') });
    await checkDiagramMagnifier(page, first, webKit ? undefined : `docs/evidence/magnifier-${engine}-desktop.png`);
    if (!webKit) await page.screenshot({ path: `docs/evidence/diagrams-${engine}-desktop.png` });
  }
  assert.equal(await fs.readFile(path.join(root, 'Diagramas.md'), 'utf8'), source, 'comparing engines never writes Markdown');
  assert.equal(await git(root, 'status', '--porcelain'), '', 'comparing engines never stages or commits notes');
  await expect(page.getByLabel('Documento alterado', { exact: true })).toHaveCount(0);
  const second = diagrams.nth(1);
  for (const engine of ['mermaid', 'pele', 'beautiful']) { await choose(second, engine); await expect(second).toContainText('Capturar notas'); }
  // Unsupported engines retain their selector and allow explicit recovery.
  const third = diagrams.nth(2);
  await third.scrollIntoViewIfNeeded(); await third.getByRole('combobox').selectOption('beautiful');
  await expect(third).toHaveAttribute('data-diagram-state', 'error'); await expect(third).toContainText('não suporta');
  await expect(third.getByRole('combobox')).toBeEnabled(); await choose(third, 'pele'); await expect(third).toContainText('Entrega');
  await choose(diagrams.nth(3), 'mermaid'); await expect(diagrams.nth(3)).toContainText('TILDE');
  // Identical code blocks have independent choices and collision-free cached SVG IDs.
  await choose(diagrams.nth(4), 'mermaid'); await expect(first).toHaveAttribute('data-diagram-engine', 'beautiful');
  assert.ok(await diagrams.nth(4).locator('output').getAttribute('title').then(value => value.includes('cache')));
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('figure[data-diagram-engine] [id]')].map(node => node.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  assert.deepEqual(duplicateIds, []);
  await first.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Usar tema claro', exact: true }).click();
  await expect(first).toHaveAttribute('data-diagram-state', 'ready');
  assert.equal(await first.evaluate(node => getComputedStyle(node).getPropertyValue('--diagram-bg').trim()), '#faf9f6');
  if (!webKit) await page.screenshot({ path: 'docs/evidence/diagrams-beautiful-light.png' });
  await checkDiagramMagnifier(page, first, webKit ? undefined : 'docs/evidence/magnifier-light.png');
  await page.getByRole('button', { name: 'Usar tema escuro', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Diagramas.md', exact: true }).click();
  await expect(first).toHaveAttribute('data-diagram-engine', 'beautiful'); await expect(first).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
  // The live CodeMirror widget shares the selected engine and can expose its exact source fence.
  await page.getByRole('button', { name: 'Escrever', exact: true }).click();
  const live = page.locator('.md-live-diagram figure[data-diagram-engine]').first();
  await live.scrollIntoViewIfNeeded(); await expect(live).toHaveAttribute('data-diagram-engine', 'beautiful'); await expect(live).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
  await choose(live, 'pele');
  await checkDiagramMagnifier(page, live, webKit ? undefined : 'docs/evidence/magnifier-live.png');
  await live.getByRole('button', { name: 'Editar código do diagrama', exact: true }).click();
  await expect(workbench).toHaveAttribute('data-block-editing', 'true');
  await expect(page.locator('.cm-content')).toContainText('erDiagram');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ler', exact: true }).click();
  await expect(first).toHaveAttribute('data-diagram-engine', 'pele'); await expect(first).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
  assert.equal(await fs.readFile(path.join(root, 'Diagramas.md'), 'utf8'), source);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar .md', exact: true }).click();
  assert.equal(await fs.readFile(await (await download).path(), 'utf8'), source, 'drawing never serializes SVG into Markdown');
  await first.getByRole('button', { name: 'Ativar lupa do diagrama', exact: true }).click();
  await expect(page.locator('[data-diagram-magnifier]')).toHaveCount(1);
  // Source mode keeps literal fences; invalid input is contained in the drawing, then recovers.
  await page.getByRole('button', { name: 'Fonte', exact: true }).click();
  await expect(page.locator('[data-diagram-magnifier]')).toHaveCount(0);
  const editor = page.locator('.cm-content[contenteditable=true]');
  await expect(page.locator('.md-live-diagram')).toHaveCount(0);
  await editor.fill(`# Invalid fixture\n\n${fence}mermaid\nthis-is-not-a-diagram\n${fence}\n`);
  await page.getByRole('button', { name: 'Ler', exact: true }).click();
  const invalid = page.locator('article figure[data-diagram-engine]').first();
  for (const engine of ['mermaid', 'pele', 'beautiful']) {
    await invalid.getByRole('combobox').selectOption(engine);
    await expect(invalid).toHaveAttribute('data-diagram-state', 'error', { timeout: 30_000 });
    await expect(invalid.getByRole('combobox')).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await editor.fill(source); await page.getByRole('button', { name: 'Ler', exact: true }).click(); await choose(first, 'pele');
  for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    if (await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).click();
    for (const engine of ['mermaid', 'pele', 'beautiful']) {
      await choose(first, engine);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${size.width} / ${engine}`);
      const selector = await first.getByRole('combobox').boundingBox(); assert.ok(selector && selector.width > 50 && selector.height >= 44, JSON.stringify({size,engine,selector}));
      const bounds = await first.boundingBox(); assert.ok(selector.x >= bounds.x && selector.x + selector.width <= bounds.x + bounds.width + 1);
      const magnifier = await first.getByRole('button', { name: 'Ativar lupa do diagrama', exact: true }).boundingBox();
      assert.ok(magnifier && magnifier.height >= 44 && magnifier.width >= 44 && magnifier.x + magnifier.width <= bounds.x + bounds.width + 1);
    }
    if (!webKit) await page.screenshot({ path: `docs/evidence/diagrams-${size.width}x${size.height}.png` });
  }
  if (!webKit) {
    // Chromium's real touch input exercises pointer capture and dragging, not a mocked event.
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const touchPage = await touchContext.newPage(); touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.goto(origin);
    await touchPage.locator('button[aria-label="Voltar às notas"]:visible, button[aria-label="Mostrar notas recentes"]:visible').first().tap();
    await touchPage.getByRole('button', { name: 'Diagramas.md', exact: true }).tap();
    const touchFigure = touchPage.locator('article figure[data-diagram-engine]').first();
    await expect(touchFigure).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 });
    await touchFigure.scrollIntoViewIfNeeded();
    await touchFigure.getByRole('button', { name: 'Ativar lupa do diagrama', exact: true }).tap();
    const touchDrawing = touchFigure.locator('[data-diagram-drawing]');
    const touchId = await touchDrawing.getAttribute('id');
    const touchLens = touchPage.locator(`[data-diagram-magnifier="${touchId}"]`);
    const box = await touchDrawing.locator(':scope > svg').boundingBox();
    const session = await touchContext.newCDPSession(touchPage);
    const point = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.6, id: 0 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect(touchLens).toBeVisible();
    const beforeTouch = await touchLens.locator(':scope > div').getAttribute('style');
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, x: point.x + 30 }] });
    await expect(touchLens.locator(':scope > div')).not.toHaveAttribute('style', beforeTouch);
    await touchPage.screenshot({ path: 'docs/evidence/magnifier-touch-mobile.png' });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(touchLens).toBeHidden();
    await touchFigure.getByRole('button', { name: 'Desativar lupa do diagrama', exact: true }).tap();
    await expect(touchLens).toHaveCount(0);
    await touchContext.close();
  }
  assert.deepEqual(outsideRequests, [], 'engines and drawing assets stay on this origin');
  assert.deepEqual(errors, [], 'no uncaught browser errors'); assert.deepEqual(reactErrors, [], 'no React mount lifecycle errors');
  if (!webKit) await fs.writeFile('docs/evidence/diagrams-observed-times.json', JSON.stringify({ scope: 'First observed engine execution, not a comparative benchmark; imports inside the engine may still be lazy', measurements }, null, 2) + '\n');
  console.log(`PASS (${webKit ? 'WebKit' : 'Chromium'}): three real renderers, magnifier hover/keyboard/vector scaling/ID isolation${webKit ? '' : '/real touch drag'}, ER/flowchart, per-block persistence, error recovery, reading/live/source, unchanged export, themes, 320px phone/tablet orientations, no remote assets.`);
} catch (error) {
  await page?.screenshot({path:'docs/evidence/diagrams-failure.png'}).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  await fs.rm(directory, { recursive: true, force: true });
}
