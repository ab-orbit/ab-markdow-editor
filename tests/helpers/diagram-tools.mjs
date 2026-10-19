import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

/** Verify the actual SVG remains mounted through wheel zoom, copy, highlighting and both downloads. */
export async function checkDiagramTools(page, figure, source, { webkit = false, screenshot } = {}) {
  const viewport = figure.getByRole('group', { name: 'Zoom do diagrama', exact: true });
  await viewport.scrollIntoViewIfNeeded();
  const svg = figure.locator('[data-diagram-drawing] > svg'), original = await svg.elementHandle();
  const timing = await figure.locator('output').getAttribute('aria-label');
  const bounds = await viewport.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + Math.min(bounds.height * .4, 150));
  const scroll = await page.locator('[data-document-scroll]').evaluate(element => element.scrollTop);
  await page.mouse.wheel(0, -180);
  await expect.poll(async () => Number(await viewport.getAttribute('data-diagram-zoom'))).toBeGreaterThan(1.1);
  assert.equal(await original.evaluate(node => node.isConnected), true);
  assert.equal(await figure.locator('output').getAttribute('aria-label'), timing, 'zoom never runs the renderer again');
  assert.equal(await page.locator('[data-document-scroll]').evaluate(element => element.scrollTop), scroll);
  await figure.getByRole('button', { name: 'Ajustar diagrama à largura', exact: true }).click(); await expect(viewport).toHaveAttribute('data-diagram-zoom', '1.000');
  await viewport.focus(); await page.keyboard.press('+'); await expect.poll(async () => Number(await viewport.getAttribute('data-diagram-zoom'))).toBeGreaterThan(1); await page.keyboard.press('0'); await expect(viewport).toHaveAttribute('data-diagram-zoom', '1.000');
  await figure.getByRole('button', { name: 'Ver código do diagrama', exact: true }).click();
  const code = figure.getByRole('region', { name: 'Código do diagrama', exact: true });
  await expect(code.locator('pre')).toHaveText(source);
  await expect(code.locator('pre span[style]').first()).toBeVisible();
  assert.equal(await code.locator('pre code').textContent(), source);
  const colors = await code.locator('pre span[style]').evaluateAll(elements => [...new Set(elements.map(element => getComputedStyle(element).color))]);
  assert.ok(colors.length >= 2, 'Mermaid grammar highlights syntax with multiple colors');
  const backgrounds = await code.evaluate(element => ({ code: getComputedStyle(element.closest('section')).backgroundColor, document: getComputedStyle(element.closest('article')).backgroundColor }));
  assert.notEqual(backgrounds.code, backgrounds.document, 'the code panel has a distinct background');
  const row = await Promise.all([figure.getByRole('button', { name: 'Ocultar código do diagrama', exact: true }).boundingBox(), figure.getByRole('group', { name: 'Ampliar diagrama', exact: true }).boundingBox(), figure.getByLabel('Baixar diagrama', { exact: true }).boundingBox()]);
  assert.ok(Math.max(...row.map(box => box.y)) - Math.min(...row.map(box => box.y)) < 2, 'code, zoom and download share one compact row');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (!webkit) await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await figure.getByRole('button', { name: 'Copiar código do diagrama', exact: true }).click();
  await expect(figure.getByRole('button', { name: 'Código copiado', exact: true })).toBeVisible();
  if (!webkit) assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n?/g, '\n'), source.replace(/\r\n?/g, '\n'));
  if (screenshot) await page.screenshot({ path: screenshot });
  const dimensionsBeforeZoom = await svg.evaluate(element => ({ width: Math.ceil(element.viewBox.baseVal.width), height: Math.ceil(element.viewBox.baseVal.height) }));
  await figure.getByRole('button', { name: 'Aumentar zoom do diagrama', exact: true }).click();
  for (const format of ['svg', 'png']) {
    await figure.getByLabel('Baixar diagrama', { exact: true }).click();
    const pending = page.waitForEvent('download');
    await figure.getByRole('button', { name: format === 'svg' ? 'SVG vetorial' : 'PNG transparente', exact: true }).click();
    const download = await pending, bytes = await fs.readFile(await download.path());
    assert.ok(download.suggestedFilename().endsWith(`.${format}`));
    if (format === 'svg') {
      const text = bytes.toString('utf8'); assert.ok(text.includes('<svg')); assert.ok(!text.includes('<script')); assert.ok(!text.includes('<foreignObject')); assert.ok(!/style="[^\"]*(?:fill|stroke):\s*var\(/.test(text));
      const dimensions = await page.evaluate(source => { const svg = new DOMParser().parseFromString(source, 'image/svg+xml'); return { parserError: !!svg.querySelector('parsererror'), width: Number(svg.documentElement.getAttribute('width')), height: Number(svg.documentElement.getAttribute('height')) }; }, text);
      assert.equal(dimensions.parserError, false); assert.ok(dimensions.width > 0 && dimensions.height > 0);
      assert.equal(dimensions.width, dimensionsBeforeZoom.width); assert.equal(dimensions.height, dimensionsBeforeZoom.height, 'exports contain the complete diagram rather than the zoom viewport');
    } else {
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      const pixels = await page.evaluate(async source => { const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(source), char => char.charCodeAt(0))], { type: 'image/png' })); try { const image = new Image(); image.src = url; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let transparent = 0, drawn = 0; for (let index = 3; index < data.length; index += 4) { if (data[index] === 0) transparent++; else drawn++; } return { transparent, drawn, width: canvas.width, height: canvas.height }; } finally { URL.revokeObjectURL(url); } }, bytes.toString('base64'));
      assert.ok(pixels.transparent > 100, JSON.stringify(pixels)); assert.ok(pixels.drawn > 100, JSON.stringify(pixels)); assert.ok(pixels.width * pixels.height <= 16_020_000);
    }
  }
  await figure.getByRole('button', { name: 'Ajustar diagrama à largura', exact: true }).click();
  await figure.getByRole('button', { name: 'Ocultar código do diagrama', exact: true }).click();
  await expect(figure.getByRole('region', { name: 'Código do diagrama', exact: true })).toHaveCount(0);
}
