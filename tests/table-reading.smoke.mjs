import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const origin = process.env.SCRIBA_URL || 'http://127.0.0.1:43997/';
const engine = process.env.MARKDOWN_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const output = path.resolve(process.env.SCRIBA_TABLE_OUTPUT || 'artifacts/table-reading');
await fs.mkdir(output, { recursive: true });
const source = '# Table reading\n\n## Sources\n\n| System | Analysis source | Verification |\n|---|---|---|\n| Monitor | `docs/research/independent_source_verification_and_methodology.md` with contextual documentation for comparison. | The complete third column remains readable. |\n| Research | `docs/research/detailed_comparison_methodology.md` with supporting context. | Independently checked. |\n\n## Wide comparison\n\n| Criterion | Monitor | Research | Platform | Interpretation |\n|---|---|---|---|---|\n| Vocabulary | A contextual description of the monitor and its sources. | A contextual description of the research and its sources. | A contextual description of the platform and its sources. | The final column remains reachable through horizontal navigation. |\n';
const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const results = [];
try {
  for (const [width, height] of [[1440,900],[1293,1418],[2551,1365],[390,844],[844,390],[768,1024],[1024,768]]) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width, height }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin);
      const input = page.getByLabel('Arquivo Markdown', { exact: true });
      await expect(input).toBeEnabled();
      await input.setInputFiles({ name: 'table-reading.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
      await expect(page.getByRole('heading', { name: 'Table reading', exact: true })).toBeVisible();
      const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
      if (width < 900 && await close.isVisible()) await close.click();
      const regions = page.getByRole('region', { name: 'Tabela com rolagem horizontal', exact: true });
      const small = regions.nth(0), wide = regions.nth(1);
      const geometry = await small.evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }));
      if (width >= 1024) assert.ok(geometry.content <= geometry.width + 1, `All three columns fit the desktop reading column (${width}: ${geometry.content}/${geometry.width}).`);
      assert.ok(await small.locator('td').first().evaluate(element => element.getBoundingClientRect().width) >= 75, 'Narrow screens never squeeze table cells into tiny columns.');
      if (width < 900) assert.ok(await small.locator('td').nth(1).evaluate(element => element.getBoundingClientRect().width) >= 180, 'Mobile description columns retain a readable width and scroll horizontally.');
      await wide.scrollIntoViewIfNeeded();
      await wide.focus();
      for (let step = 0; step < 30; step++) await page.keyboard.press('ArrowRight');
      await expect.poll(() => wide.evaluate(element => Math.abs(element.scrollWidth - element.clientWidth - element.scrollLeft))).toBeLessThan(2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Tables scroll within the document, not the whole page.');
      if (width === 1440 || width === 390) {
        await small.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `reading-${engine}-${width}x${height}.png`) });
      }
      await page.getByRole('button', { name: 'Formatação', exact: true }).click();
      const editor = page.getByRole('textbox', { name: 'Texto da nota', exact: true });
      await expect(editor).toBeVisible();
      const wrapper = editor.locator('.tableWrapper').first();
      const editing = await wrapper.evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }));
      if (width >= 1024) assert.ok(editing.content <= editing.width + 1, `The visual editor also fits three columns (${width}: ${editing.content}/${editing.width}).`);
      assert.deepEqual(errors, []);
      results.push({ engine, width, height, reading: geometry, editing, keyboardNavigation: true, pageOverflow: false });
      console.log(`PASS ${engine}: ${width}x${height}, small-table fit, wide-table keyboard scrolling, visual editor and page bounds.`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `failure-${engine}-${width}x${height}.png`) });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, `reading-${engine}.json`), JSON.stringify(results, null, 2));
}
