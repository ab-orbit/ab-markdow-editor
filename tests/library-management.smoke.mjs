import { chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

process.env.VITE_STORAGE_MODE = 'browser';
const server = process.env.SCRIBA_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = process.env.SCRIBA_URL || server.resolvedUrls.local[0];
const output = process.env.SCRIBA_LIBRARY_OUTPUT || 'artifacts/library-management';
const engines = process.env.MARKDOWN_BROWSER ? [process.env.MARKDOWN_BROWSER] : ['chromium', 'webkit'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 820, height: 1180 }, { name: 'tablet-landscape', width: 1180, height: 820 },
].filter(viewport => !process.env.SCRIBA_LIBRARY_VIEWPORT || viewport.name === process.env.SCRIBA_LIBRARY_VIEWPORT);
const element = (id, type = 'rectangle', x = 0) => ({ id, type, x, y: 0, width: 80, height: 50, angle: 0, strokeColor: '#1971c2', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 42, version: 1, versionNonce: 1, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false });
const symbols = Array.from({ length: 13 }, (_, index) => ({ id: `qa-library-${index}`, name: `QA Symbol ${index}`, status: 'unpublished', created: 1, elements: [element(`qa-element-${index}`)] }));
symbols[0].elements.push({ ...element('qa-arrow', 'arrow', 100), points: [[0, 0], [80, 0]], startArrowhead: null, endArrowhead: 'arrow', startBinding: { elementId: 'qa-element-0', focus: 0, gap: 20 }, endBinding: null });
symbols[0].elements[0].boundElements = [{ id: 'qa-arrow', type: 'arrow' }];
const library = { name: 'Field symbols.excalidrawlib', mimeType: 'application/vnd.excalidrawlib+json', buffer: Buffer.from(JSON.stringify({ type: 'excalidrawlib', version: 2, source: 'Scriba QA', libraryItems: symbols })) };
const results = [];

async function openLibrary(page) {
  if (!await page.locator('.library-menu-items-container').isVisible()) await page.getByTitle('Library', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import library', exact: true })).toBeVisible();
}

try {
  await mkdir(output, { recursive: true });
  for (const engine of engines) {
    const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({ locale: 'en-US', viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, serviceWorkers: 'block' });
        // The native WebView can load bundled resources through a custom scheme.
        // Library imports remain portable without requiring the WebCrypto capability.
        await context.addInitScript(() => Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true }));
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin);
          await expect(page.getByLabel('Markdown file', { exact: true })).toBeEnabled({ timeout: 30000 });
          await page.getByLabel('Markdown file', { exact: true }).setInputFiles({ name: 'Library reference.md', mimeType: 'text/markdown', buffer: Buffer.from('# Library reference\n') });
          const whiteboard = page.getByRole('button', { name: viewport.width < 900 ? 'Open whiteboard' : 'Whiteboard', exact: true });
          await whiteboard.click();
          await expect(page.locator('[data-whiteboard-state]')).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 60000 });
          await openLibrary(page);
          await expect(page.locator('.library-unit__active')).toHaveCount(187, { timeout: 30000 });
          for (const type of ['architecture', 'charts', 'algorithms', 'icons', 'notes']) await expect(page.locator(`[data-library-group="${type}"]`)).toBeVisible();
          const chooser = page.waitForEvent('filechooser');
          await page.getByRole('button', { name: 'Import library', exact: true }).click();
          await (await chooser).setFiles(library);
          await expect(page.getByRole('status').filter({ hasText: '13 symbols imported' })).toBeVisible({ timeout: 30000 });
          await expect(page.locator('.library-unit__active')).toHaveCount(200, { timeout: 30000 });
          const file = page.getByLabel('Library file', { exact: true });
          await file.setInputFiles({ name: 'invalid.excalidrawlib', mimeType: 'application/json', buffer: Buffer.from('{broken') });
          await expect(page.getByRole('alert')).toContainText('Choose a valid .excalidrawlib file');
          await expect(page.locator('.library-unit__active')).toHaveCount(200);
          await file.setInputFiles(library);
          await expect(page.getByRole('status').filter({ hasText: 'This library has already been imported' })).toBeVisible();
          await expect(page.locator('.library-unit__active')).toHaveCount(200);

          const importedIds = await page.locator('.library-unit[data-library-id] .library-unit__dragger').evaluateAll(nodes => Object.fromEntries(nodes.filter(node => node.getAttribute('aria-label')?.startsWith('Insert QA Symbol ')).map(node => [node.getAttribute('aria-label').replace('Insert ', ''), node.parentElement.dataset.libraryId])));
          const fingerprint = createHash('sha256').update(library.buffer).digest('hex');
          expect(Object.values(importedIds).every(id => id.startsWith(`scriba:import:${fingerprint}:`))).toBe(true);
          const sequence = [...symbols.map(item => importedIds[item.name]), importedIds['QA Symbol 4']];
          for (const id of sequence) {
            await openLibrary(page);
            const unit = page.locator(`.library-unit[data-library-id="${id}"] .library-unit__dragger`);
            await expect(unit).toBeVisible();
            await unit.click();
            await openLibrary(page);
            await expect(page.locator('[data-recent-library-id]').first()).toHaveAttribute('data-recent-library-id', id);
          }
          if (viewport.name === 'desktop') {
            const draggedId = importedIds['QA Symbol 1'];
            await page.locator(`.library-unit[data-library-id="${draggedId}"] .library-unit__dragger`).dragTo(page.locator('canvas.interactive'));
            await openLibrary(page);
            await expect(page.locator('[data-recent-library-id]').first()).toHaveAttribute('data-recent-library-id', draggedId);
            sequence.push(draggedId);
          }
          const expected = [...new Set([...sequence].reverse())].slice(0, 11);
          expect(await page.locator('[data-recent-library-id]').evaluateAll(nodes => nodes.map(node => node.dataset.recentLibraryId))).toEqual(expected);
          await expect(page.getByRole('region', { name: 'Recently used', exact: true })).toContainText('11/11');
          await page.locator('[data-library-organized]').evaluate(element => element.scrollTo({ top: 0 }));
          await expect(page.getByRole('region', { name: 'Recently used', exact: true })).toBeInViewport();
          for (const theme of ['dark', 'light']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-${theme}.png`) });
          }
          await page.locator('[data-recent-library-id]').first().click();
          if (viewport.width < 900) await expect(page.locator('.library-menu-items-container')).toHaveCount(0);
          await page.getByRole('button', { name: viewport.width < 900 ? 'Back to note' : 'Note', exact: true }).click();
          const editor = page.getByRole('textbox', { name: 'Note text', exact: true });
          await expect(editor).toBeVisible();
          await page.getByRole('button', { name: 'See drawing code', exact: true }).click();
          const scene = JSON.parse(await editor.locator('pre').innerText());
          const live = scene.elements.filter(element => !element.isDeleted), ids = new Set(live.map(element => element.id));
          expect(ids.size).toBe(live.length);
          expect(live.length).toBeGreaterThanOrEqual(16);
          const arrow = live.find(element => element.type === 'arrow');
          expect(arrow).toBeTruthy();
          expect(ids.has(arrow.startBinding.elementId)).toBe(true);
          await page.getByRole('button', { name: 'Hide drawing code', exact: true }).click();
          await page.keyboard.press('Meta+s');
          await expect(page.locator('dialog[open]')).toHaveCount(0);
          await page.reload();
          await expect(page.getByLabel('Markdown file', { exact: true })).toBeEnabled({ timeout: 30000 });
          if (!await page.locator('[data-whiteboard-state]').isVisible()) await page.getByRole('button', { name: viewport.width < 900 ? 'Open whiteboard' : 'Whiteboard', exact: true }).click();
          await expect(page.locator('[data-whiteboard-state]')).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 60000 });
          await openLibrary(page);
          await expect(page.locator('.library-unit__active')).toHaveCount(200, { timeout: 30000 });
          expect(await page.locator('[data-recent-library-id]').evaluateAll(nodes => nodes.map(node => node.dataset.recentLibraryId))).toEqual(expected);
          expect(errors).toEqual([]);
          results.push({ engine, viewport: viewport.name, symbols: 200, recent: expected, liveElements: live.length, uniqueIds: true, arrowBindingPreserved: true, passed: true });
          console.log(`${engine} ${viewport.name}: import, deduplication, type groups, 11 recent items, insertion bindings and reload passed.`);
        } catch (cause) {
          await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-failure.png`) }).catch(() => {});
          throw cause;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, results }, null, 2) + '\n');
} finally { await server?.close(); }
