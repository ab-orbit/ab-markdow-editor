import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { checkDiagramTools } from './helpers/diagram-tools.mjs';

// Test the actual reference examples, bundled renderers and saved presentation choices.
const manual = await fs.readFile(new URL('../docs/Scriba-Diagramas.md', import.meta.url), 'utf8');
const examples = [...manual.matchAll(/<!-- diagram-example: ([\w-]+) family=c4 -->[\s\S]*?```mermaid\n([\s\S]*?)```/g)].map(([, id, source]) => ({ id, source }));
assert.equal(examples.length, 5);
const fence = '`'.repeat(3);
const source = '# Arquitetura do Acervo Aurora\n\n' + examples.map(example => `## ${example.id}\n\n${fence}mermaid\n${example.source}${fence}\n`).join('\n');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-c4-'));
const exec = promisify(execFile), git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const webKit = process.env.MARKDOWN_BROWSER === 'webkit', baseline = process.env.BASELINE === '1';
const evidence = new URL('../docs/evidence/c4-diagrams/', import.meta.url);
const measurements = [], errors = [];
let server, browser, root, origin = process.env.SCRIBA_URL;
try {
  await fs.mkdir(evidence, { recursive: true });
  if (!origin) {
    root = path.join(temporary, 'notes'); const state = path.join(temporary, 'state'); await fs.mkdir(root); await fs.mkdir(state); root = await fs.realpath(root);
    await git(root, 'init', '-b', 'main');
    for (const [key, value] of [['user.name', 'C4 Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
    await fs.writeFile(path.join(root, 'C4.md'), source); await git(root, 'add', '.'); await git(root, 'commit', '-m', 'C4 fixture');
    await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { askCommitNote: false, autoSave: false, intervalMinutes: 1 } }));
    await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: ['C4.md'], welcomeImageVersion: 1, diagramManualVersion: 1 } }));
    const runtime = path.join(temporary, 'runtime.json');
    server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
    for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  }
  assert.ok(origin);
  browser = webKit ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }), page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByLabel('Bancada Markdown').waitFor();
  if (root) await page.getByRole('button', { name: 'C4.md', exact: true }).click();
  else {
    await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
    await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'C4.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
  }
  const figures = page.locator('article figure[data-diagram-engine]'); await expect(figures).toHaveCount(5);
  if (!baseline) {
    await expect(figures.first()).toHaveAttribute('data-diagram-engine', 'pele');
    assert.deepEqual(await figures.first().getByRole('combobox').locator('option').evaluateAll(options => options.map(option => option.value)), ['mermaid', 'pele', 'beautiful']);
  }
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: 'Usar tema claro', exact: true }).click();
    for (const engine of ['pele', 'mermaid']) {
      for (let index = 0; index < examples.length; index++) {
        const figure = figures.nth(index); await figure.scrollIntoViewIfNeeded(); await figure.getByRole('combobox').selectOption(engine);
        await expect.poll(async () => { await figure.scrollIntoViewIfNeeded(); return figure.getAttribute('data-diagram-state'); }, { timeout: 30_000 }).toBe('ready');
        const svg = figure.locator('[data-diagram-drawing] > svg'); await expect(svg).toBeVisible();
        const stats = await svg.evaluate(element => {
          const view = element.viewBox.baseVal, bounds = element.getBoundingClientRect();
          const texts = [...element.querySelectorAll('text')].filter(node => node.textContent.trim()).map(node => {
            const style = getComputedStyle(node), box = node.getBoundingClientRect();
            return { text: node.textContent, font: style.fontSize, fill: style.fill, width: box.width, height: box.height };
          });
          const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
          const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
          const figureStyle = getComputedStyle(element.closest('figure')), background = figureStyle.backgroundColor;
          const probe = document.createElement('span'); probe.style.display = 'none'; probe.style.color = figureStyle.getPropertyValue('--bg-elevated'); element.closest('figure').append(probe);
          const nodeBackground = getComputedStyle(probe).color; probe.remove();
          // Check both actual C4 surfaces: the canvas and filled node cards.
          const minimumContrast = Math.min(...texts.flatMap(text => [contrast(text.fill, background), contrast(text.fill, nodeBackground)]));
          const labels = [...element.querySelectorAll(':scope > g')].filter(group => group.querySelector(':scope > [marker-end], :scope > [marker-start]')).flatMap(group => [...group.querySelectorAll(':scope > text')]);
          const nodes = [...element.querySelectorAll('.c4-shape .label')].map(node => node.getBoundingClientRect());
          const overlaps = labels.filter(label => { const rect = label.getBoundingClientRect(); return nodes.some(node => rect.left < node.right && rect.right > node.left && rect.top < node.bottom && rect.bottom > node.top); }).map(label => label.textContent);
          return { width: bounds.width, height: bounds.height, viewBox: [view.x, view.y, view.width, view.height], minimumContrast, overlaps, texts };
        });
        if (!baseline) { assert.ok(stats.minimumContrast >= 4.5, JSON.stringify({ theme, engine, id: examples[index].id, contrast: stats.minimumContrast })); assert.deepEqual(stats.overlaps, [], 'Connection labels must not cover node text.'); }
        measurements.push({ theme, engine, id: examples[index].id, ...stats });
        await figure.screenshot({ path: new URL(`${baseline ? 'before-' : ''}${examples[index].id}-${theme}-${engine}-${webKit ? 'webkit' : 'chrome'}.png`, evidence).pathname });
        if (!baseline && index === 0) await page.screenshot({ path: new URL(`c4-desktop-${theme}-${engine}-${webKit ? 'webkit' : 'chrome'}.png`, evidence).pathname });
        console.log(`${theme} / ${engine} / ${examples[index].id}: ${Math.round(stats.width)} × ${Math.round(stats.height)}`);
      }
    }
  }
  if (!baseline) {
    const first = figures.first(); await first.scrollIntoViewIfNeeded(); await first.getByRole('combobox').selectOption('pele');
    await expect(first).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30000 });
    await first.screenshot({ path: new URL(`c4-before-tools-${webKit ? 'webkit' : 'chrome'}.png`, evidence).pathname });
    await checkDiagramTools(page, first, examples[0].source, { webkit: webKit });
    // Explicit choices survive a reload without changing the available engines.
    await first.scrollIntoViewIfNeeded(); await first.getByRole('combobox').selectOption('beautiful');
    await expect.poll(async () => { await first.scrollIntoViewIfNeeded(); return first.getAttribute('data-diagram-state'); }, { timeout: 30000 }).toBe('error');
    await first.getByRole('combobox').selectOption('mermaid');
    await expect.poll(async () => { await first.scrollIntoViewIfNeeded(); return first.getAttribute('data-diagram-state'); }, { timeout: 30000 }).toBe('ready');
    await page.reload(); await expect(figures).toHaveCount(5); await expect(figures.first()).toHaveAttribute('data-diagram-engine', 'mermaid');
    // A separate browser has no stored choices and starts every block on Pele.
    if (root) {
      const fresh = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }), freshPage = await fresh.newPage();
      await freshPage.goto(origin); await freshPage.getByRole('button', { name: 'C4.md', exact: true }).click();
      await expect(freshPage.locator('article figure[data-diagram-engine=pele]')).toHaveCount(5);
      await freshPage.getByRole('button', { name: 'Escrever', exact: true }).click();
      await expect(freshPage.locator('figure[data-diagram-engine=pele]')).toHaveCount(5);
      await fresh.close();
    }
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(size);
      if (await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar lista de notas', exact: true }).click();
      for (const engine of ['pele', 'mermaid']) {
        const first = figures.first(); await first.scrollIntoViewIfNeeded(); await first.getByRole('combobox').selectOption(engine);
        await expect(first).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (engine === 'mermaid' && size.width === 390) {
          const pan = await first.getByRole('group', { name: 'Zoom do diagrama', exact: true }).evaluate(node => {
            node.scrollLeft = node.scrollWidth; const offset = node.scrollLeft; node.scrollLeft = 0;
            const label = node.querySelector('.c4-name text'), matrix = label.getScreenCTM();
            return { offset, overflow: node.scrollWidth - node.clientWidth, textSize: parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.a, matrix.b) };
          });
          // C4 may reflow vertically on a narrow screen; wide drawings must pan.
          assert.ok(pan.textSize >= 11, JSON.stringify(pan));
          if (pan.overflow > 2) assert.ok(pan.offset > 0, 'Wide C4 drawings remain horizontally accessible.');
        }
        await page.screenshot({ path: new URL(`c4-${engine}-${size.width}x${size.height}-${webKit ? 'webkit' : 'chrome'}.png`, evidence).pathname });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const authored = 'C4Context\n Person(a, "Pessoa")\n System(b, "Sistema")\n Rel(a, b, "Conexão autoral")\n UpdateElementStyle(a, "#243447", "#ffffff", "#d2a761")\n UpdateRelStyle(a, b, "#444444", "#a34a20", "17", "-30")\n';
    await page.getByRole('button', { name: 'Fonte', exact: true }).click();
    await page.locator('.cm-content[contenteditable=true]').fill(`${fence}mermaid\n${authored}${fence}\n`);
    await page.getByRole('button', { name: 'Ler', exact: true }).click();
    const custom = figures.first(); await expect(figures).toHaveCount(1); await custom.scrollIntoViewIfNeeded(); await custom.getByRole('combobox').selectOption('mermaid');
    await expect(custom).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30000 });
    const authorStyle = await custom.locator('[data-diagram-drawing] > svg').evaluate(svg => {
      const label = [...svg.querySelectorAll(':scope > g > text')].find(node => node.textContent.includes('Conexão autoral'));
      const person = svg.querySelector('.c4-person .label text'), line = svg.querySelector('line[marker-end]');
      return { label: getComputedStyle(label).fill, offsetPreserved: !label.hasAttribute('transform'), person: getComputedStyle(person).fill, line: getComputedStyle(line).stroke };
    });
    assert.deepEqual(authorStyle, { label: 'rgb(68, 68, 68)', offsetPreserved: true, person: 'rgb(255, 255, 255)', line: 'rgb(163, 74, 32)' });
    await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await page.locator('.cm-content[contenteditable=true]').fill(source); await page.getByRole('button', { name: 'Ler', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  if (root) { assert.equal(await fs.readFile(path.join(root, 'C4.md'), 'utf8'), source); assert.equal(await git(root, 'status', '--porcelain'), ''); }
  await fs.writeFile(new URL(`${baseline ? 'before' : `verification-${root ? 'native' : 'browser'}`}-${webKit ? 'webkit' : 'chrome'}.json`, evidence), JSON.stringify({ testedAt: new Date().toISOString(), mode: root ? 'native' : 'browser', measurements, errors }, null, 2) + '\n');
} finally {
  await browser?.close(); server?.kill(); if (server && server.exitCode === null) await new Promise(resolve => server.once('exit', resolve)); await fs.rm(temporary, { recursive: true, force: true });
}
