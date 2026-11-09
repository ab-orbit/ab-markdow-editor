import { chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.env.VITE_STORAGE_MODE = 'browser';
const server = process.env.SCRIBA_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const origin = process.env.SCRIBA_URL || server.resolvedUrls.local[0];
const output = process.env.SCRIBA_WIDE_OUTPUT || 'artifacts/wider-reading';
const engines = process.env.MARKDOWN_BROWSER ? [process.env.MARKDOWN_BROWSER] : ['chromium', 'webkit'];
const viewports = [
  { name: 'wide-desktop', width: 2208, height: 1408 }, { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet-landscape', width: 1180, height: 820 }, { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844 },
].filter(viewport => !process.env.SCRIBA_WIDE_VIEWPORT || viewport.name === process.env.SCRIBA_WIDE_VIEWPORT);
const elements = Array.from({ length: 8 }, (_, index) => ({ id: `wide-box-${index}`, type: 'rectangle', x: index * 320, y: 120, width: 280, height: 160, strokeColor: '#1971c2', backgroundColor: 'transparent' }));
elements.push({ id: 'wide-title', type: 'text', x: 0, y: 0, width: 2600, height: 60, fontSize: 48, fontFamily: 2, lineHeight: 1.25, text: 'From an idea to a published product', originalText: 'From an idea to a published product', autoResize: false, textAlign: 'left', verticalAlign: 'top', strokeColor: '#1e1e1e' });
const scene = { type: 'excalidraw', version: 2, elements, appState: {}, files: {} };
const source = '# A wider workspace\n\nA contextual plan with room for the full diagram and its comparisons.\n\n## Publishing plan\n\n```excalidraw\n' + JSON.stringify(scene) + '\n```\n\n## Comparison\n\n| Stage | Research | Design | Build | Publish | Learn |\n| --- | --- | --- | --- | --- | --- |\n| Team | Sources and evidence | Decisions and alternatives | Features and tests | Release and distribution | Feedback and improvements |\n';
const results = [];

async function geometry(page) {
  return page.locator('[data-document-scroll] article').evaluate(article => ({
    width: article.getBoundingClientRect().width,
    available: article.parentElement.clientWidth,
    parentPadding: [getComputedStyle(article.parentElement).paddingLeft, getComputedStyle(article.parentElement).paddingRight].map(Number.parseFloat),
    padding: [getComputedStyle(article).paddingLeft, getComputedStyle(article).paddingRight].map(Number.parseFloat),
    bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}
function checkWidth(box) {
  expect(Math.abs(box.width - Math.min(1600, box.available - box.parentPadding.reduce((sum, value) => sum + value, 0))), JSON.stringify(box)).toBeLessThanOrEqual(2);
  expect(box.bodyOverflow).toBeLessThanOrEqual(1);
}

try {
  await mkdir(output, { recursive: true });
  for (const engine of engines) {
    const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
    try {
      for (const viewport of viewports) {
        const touch = viewport.name === 'phone' || viewport.name.startsWith('tablet');
        const context = await browser.newContext({ locale: 'en-US', viewport: { width: viewport.width, height: viewport.height }, isMobile: touch, hasTouch: touch, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin);
          const input = page.getByLabel('Markdown file', { exact: true });
          await expect(input).toBeEnabled({ timeout: 30000 });
          await input.setInputFiles({ name: 'Wide workspace.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
          const diagram = page.locator('[data-excalidraw-state]');
          await expect(diagram).toHaveAttribute('data-excalidraw-state', 'ready', { timeout: 60000 });
          const reading = await geometry(page);
          checkWidth(reading);
          if (viewport.width >= 1440) expect(reading.width).toBeGreaterThan(1000);
          const zoom = diagram.locator('[data-diagram-zoom]');
          const fit = await zoom.evaluate(element => ({ width: element.clientWidth, overflow: element.scrollWidth - element.clientWidth }));
          if (viewport.width >= 900) expect(fit.overflow).toBeLessThanOrEqual(2);
          else expect(fit.overflow).toBeGreaterThan(0);
          for (const theme of ['dark', 'light']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await expect(diagram).toHaveAttribute('data-excalidraw-state', 'ready', { timeout: 30000 });
            await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-${theme}.png`) });
          }
          await diagram.getByRole('button', { name: 'Zoom in on the diagram', exact: true }).click();
          await expect(zoom).toHaveAttribute('data-diagram-zoom', '1.250');
          await diagram.getByRole('button', { name: 'Fit diagram to width', exact: true }).click();
          await expect(zoom).toHaveAttribute('data-diagram-zoom', '1.000');
          if (viewport.width >= 900) await expect.poll(() => zoom.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);

          const closeLibrary = page.getByRole('button', { name: 'Close list of notes', exact: true });
          if (await closeLibrary.isVisible()) {
            await closeLibrary.click();
            await expect(page.locator('#recent-notes')).toHaveCount(0);
          }
          const withoutLibrary = await geometry(page);
          checkWidth(withoutLibrary);
          await page.getByRole('button', { name: 'Show outline', exact: true }).click();
          await expect(page.getByRole('navigation', { name: 'Note sections', exact: true })).toBeVisible();
          checkWidth(await geometry(page));
          await page.getByRole('button', { name: 'Close outline', exact: true }).click();

          await page.evaluate(() => document.documentElement.dataset.nativeChrome = 'true');
          const nativeReader = await geometry(page);
          checkWidth(nativeReader);
          const headingControls = await page.locator('[data-heading-section] > [class*="sectionHeading"] > button').evaluateAll(buttons => buttons.map(button => {
            const box = button.getBoundingClientRect(), pane = button.closest('[data-document-scroll]').getBoundingClientRect();
            return { left: box.left - pane.left, width: box.width };
          }));
          expect(headingControls.length).toBeGreaterThan(0);
          for (const button of headingControls) { expect(button.left).toBeGreaterThanOrEqual(0); expect(button.width).toBeGreaterThanOrEqual(44); }
          await page.evaluate(() => document.documentElement.dataset.nativeChrome = 'false');

          await page.getByRole('button', { name: 'Formatting', exact: true }).click();
          await expect(page.getByRole('textbox', { name: 'Note text', exact: true })).toBeVisible({ timeout: 30000 });
          const editing = await geometry(page);
          checkWidth(editing);
          // Verify native-layout CSS separately from UIKit or the software keyboard.
          await page.evaluate(() => document.documentElement.dataset.nativeChrome = 'true');
          const nativeLayout = await geometry(page);
          checkWidth(nativeLayout);
          expect(Math.min(...nativeLayout.padding)).toBeGreaterThanOrEqual(20);
          expect(Math.max(...nativeLayout.padding)).toBeLessThanOrEqual(40);
          expect(errors).toEqual([]);
          results.push({ engine, viewport: viewport.name, reading, withoutLibrary, editing, nativeReader, headingControls, nativeLayout, diagram: fit, passed: true });
          console.log(`${engine} ${viewport.name}: wider reading/editing, sidebar and outline resizing, diagram fit and zoom passed.`);
        } catch (cause) {
          await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-failure.png`) }).catch(() => {});
          throw cause;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, results }, null, 2) + '\n');
} finally { await server?.close(); }
