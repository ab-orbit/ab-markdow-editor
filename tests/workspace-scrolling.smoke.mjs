import { chromium, webkit, expect } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const output = path.resolve(process.env.SCRIBA_SCROLL_OUTPUT || 'artifacts/workspace-scrolling');
await mkdir(output, { recursive: true });
// Build with VITE_STORAGE_MODE=browser first, or target an existing SCRIBA_URL.
const local = process.env.SCRIBA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const origin = process.env.SCRIBA_URL || local.resolvedUrls.local[0];
const engines = process.env.MARKDOWN_BROWSER === 'webkit' ? ['webkit'] : process.env.MARKDOWN_BROWSER === 'chromium' ? ['chromium'] : ['chromium', 'webkit'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900, touch: false },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'tablet-portrait', width: 820, height: 1180, touch: true },
  { name: 'tablet-landscape', width: 1180, height: 820, touch: true },
].filter(viewport => !process.env.SCRIBA_SCROLL_VIEWPORT || viewport.name === process.env.SCRIBA_SCROLL_VIEWPORT);
assert.ok(viewports.length, 'Unknown workspace viewport');
const filename = 'Caderno de pesquisa — observações, evidências e próximos passos.md';
const source = '# Caderno de pesquisa\n\nUm espaço para reunir perguntas e escrever com clareza.\n\n' +
  Array.from({ length: 16 }, (_, section) => `## ${section + 1}. Observações de campo\n\n` +
    Array.from({ length: 5 }, () => 'Cada observação reúne o contexto, a fonte consultada e o próximo passo. A escrita continua no seu ritmo, com as ferramentas sempre à mão.\n\n').join('')).join('');
const notes = [
  { name: filename, mimeType: 'text/markdown', buffer: Buffer.from(source) },
  ...Array.from({ length: 30 }, (_, index) => ({
    name: `Pesquisa-${String(index + 1).padStart(2, '0')}.md`, mimeType: 'text/markdown',
    buffer: Buffer.from(`# ${['Fontes e referências', 'Plano da próxima entrevista', 'Diário de pesquisa', 'Ideias para desenvolver'][index % 4]} ${index + 1}\n\nContexto e registros para retomar a pesquisa, um passo de cada vez.\n`),
  })),
];
const results = [];

async function openLibrary(page) {
  const library = page.locator('#recent-notes');
  if (await library.isVisible()) return;
  const back = page.getByRole('button', { name: 'Voltar às notas', exact: true });
  if (await back.isVisible()) await back.click();
  else {
    await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
    await page.getByRole('button', { name: 'Mostrar notas recentes', exact: true }).click();
  }
  await expect(library).toBeVisible();
}
async function rectangle(locator) {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}
function stationary(before, after, label) {
  for (const coordinate of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[coordinate] - after[coordinate]) < 1, `${label} ${coordinate} moved`);
}
function color(value) {
  if (value.startsWith('#')) return value.slice(1).match(/.{2}/g).map(part => Number.parseInt(part, 16));
  return value.match(/[\d.]+/g).map(Number);
}
function luminance(rgb) {
  const channels = rgb.slice(0, 3).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function thumbContrast(thumb, surface, background) {
  const foreground = color(thumb), pane = color(surface), base = color(background), alpha = pane[3] ?? 1;
  const composite = pane.slice(0, 3).map((channel, index) => channel * alpha + base[index] * (1 - alpha));
  const a = luminance(foreground), b = luminance(composite);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

try {
  for (const engine of engines) {
    const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] }));
    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.touch, hasTouch: viewport.touch, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin);
          await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled({ timeout: 30000 });
          await openLibrary(page);
          await expect(page.locator('#recent-notes .notes-search')).toHaveCount(0);
          await page.getByLabel('Arquivos de notas', { exact: true }).setInputFiles(notes);
          await expect(page.getByRole('article')).toContainText('Plano da próxima entrevista 30', { timeout: 60000 });
          await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled({ timeout: 30000 });
          await openLibrary(page);
          const library = page.locator('#recent-notes'), list = library.locator(':scope > nav');
          await expect(library.getByRole('button', { name: filename, exact: true })).toBeEnabled();
          await library.getByRole('button', { name: filename, exact: true }).click();
          await expect(page.getByRole('article')).toContainText('Caderno de pesquisa');
          await expect(page.locator('.toast')).toHaveCount(0, { timeout: 7000 });
          const documentScroll = page.locator('[data-document-scroll]');
          const desktopToolbar = page.locator('[data-markdown-workbench] > header[data-ui="toolbar"]');
          const toolbar = await desktopToolbar.isVisible() ? desktopToolbar : page.locator('[class*="mobileReadingBar"]');
          const header = await rectangle(toolbar);
          // Playwright's mobile WebKit supports DOM scrolling for layout checks.
          // Chromium and desktop WebKit exercise the actual wheel input path.
          const domScroll = engine === 'webkit' && viewport.touch;
          if (domScroll) {
            await documentScroll.evaluate(element => element.scrollBy({ top: 900, behavior: 'instant' }));
          } else {
            await documentScroll.hover();
            await page.mouse.wheel(0, 900);
          }
          await expect.poll(() => documentScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(300);
          stationary(header, await rectangle(toolbar), 'Document toolbar');
          await expect(page.getByRole('button', { name: 'Mais opções da nota', exact: true })).toBeVisible();
          await openLibrary(page);
          const commandbar = library.locator('.notes-commandbar'), search = library.locator('.notes-search');
          await library.getByRole('button', { name: 'Mostrar busca de notas', exact: true }).click();
          const searchInput = library.getByRole('searchbox', { name: 'Buscar nas notas recentes', exact: true });
          await expect(searchInput).toBeFocused();
          await searchInput.fill(filename);
          await expect(list.locator('.open-note')).toHaveCount(1);
          await library.getByRole('button', { name: 'Ocultar busca de notas', exact: true }).click();
          await expect(search).toHaveCount(0);
          await expect.poll(() => list.locator('.open-note').count()).toBeGreaterThan(30);
          await library.getByRole('button', { name: 'Mostrar busca de notas', exact: true }).click();
          await expect(searchInput).toHaveValue('');
          await expect(searchInput).toBeFocused();
          await list.evaluate(async element => {
            element.scrollTop = 0;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0);
          const commandsBefore = await rectangle(commandbar), searchBefore = await rectangle(search);
          if (domScroll) {
            await list.evaluate(element => element.scrollBy({ top: 900, behavior: 'instant' }));
          } else {
            await list.hover();
            await page.mouse.wheel(0, 900);
          }
          await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(250);
          stationary(commandsBefore, await rectangle(commandbar), 'Library commands');
          stationary(searchBefore, await rectangle(search), 'Library search');
          assert.equal(await library.evaluate(element => element.scrollTop), 0);
          const metrics = await list.evaluate(element => ({
            scrollbar: getComputedStyle(element).scrollbarWidth,
            thumb: getComputedStyle(element).getPropertyValue('--ui-scrollbar-thumb').trim(),
            surface: getComputedStyle(element.parentElement).backgroundColor,
            background: getComputedStyle(document.body).backgroundColor,
            sidebarBorder: getComputedStyle(element.parentElement).borderRightWidth,
            documentOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          }));
          assert.equal(metrics.documentOverflow, false);
          assert.ok(thumbContrast(metrics.thumb, metrics.surface, metrics.background) >= 3, 'Scroll thumb contrast');
          if (!viewport.touch) await page.screenshot({ path: path.join(output, `${engine}-desktop-search-expanded.png`) });
          await library.getByRole('button', { name: 'Ocultar busca de notas', exact: true }).click();
          await expect(search).toHaveCount(0);
          for (const theme of ['dark', 'light']) {
            await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
            await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-${theme}.png`) });
            const colors = await list.evaluate(element => ({ thumb: getComputedStyle(element).getPropertyValue('--ui-scrollbar-thumb').trim(), surface: getComputedStyle(element.parentElement).backgroundColor, background: getComputedStyle(document.body).backgroundColor }));
            assert.ok(thumbContrast(colors.thumb, colors.surface, colors.background) >= 3, `${theme} scrollbar contrast`);
          }
          if (!viewport.touch) {
            const firstNote = library.locator('.open-note').first();
            await firstNote.focus();
            const initial = await list.evaluate(element => element.scrollTop);
            await page.keyboard.press('PageDown');
            await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(initial + 100);
            stationary(commandsBefore, await rectangle(commandbar), 'Keyboard library commands');
            assert.equal(await desktopToolbar.evaluate(element => getComputedStyle(element).borderRadius), '0px');
          }
          assert.deepEqual(errors, []);
          results.push({ engine, viewport: viewport.name, scrollInput: domScroll ? 'DOM layout check' : 'wheel', searchInitiallyCollapsed: true, searchFocusOnOpen: true, filterClearedOnClose: true, commandsPinned: true, searchPinned: true, documentToolbarPinned: true, independentScrolling: true, darkAndLight: true, ...metrics });
          console.log(`PASS ${engine}: ${viewport.name}, independent note/document scrolling with pinned controls and themed indicators.`);
        } catch (error) {
          await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-failure.png`) });
          await writeFile(path.join(output, `${engine}-${viewport.name}-failure.txt`), await page.locator('body').ariaSnapshot());
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally {
  await writeFile(path.join(output, `results-${engines.join('-')}.json`), JSON.stringify(results, null, 2) + '\n');
  if (local) await new Promise(resolve => local.httpServer.close(resolve));
}
