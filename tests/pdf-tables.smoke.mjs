import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

// Every case goes through the shipped file picker and export menu, with isolated
// browser storage. SCRIBA_PDF_SOURCE can reproduce a private report without copying
// it into fixtures or sending it to a remote conversion service.
const origin = process.env.SCRIBA_URL || 'http://127.0.0.1:43997/';
const engine = process.env.MARKDOWN_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const output = path.resolve(process.env.SCRIBA_PDF_OUTPUT || 'artifacts/pdf-tables');
await fs.mkdir(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const parser = unified().use(remarkParse).use(remarkGfm);
const text = node => typeof node.value === 'string' ? node.value : (node.children || []).map(text).join('');
async function openExport(page) {
  const menu = page.getByLabel('Exportar nota', { exact: true });
  if (await menu.isVisible()) await menu.click();
  else {
    await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Exportar', exact: true }).click();
  }
}
const wide = (rows = 24) => '| Criterion | Monitor | Research | Platform | Interpretation |\n|---|---|---|---|---|\n' +
  Array.from({ length: rows }, (_, index) => `| Criterion ${index + 1} | A contextual observation for comparison ${index + 1}. | Sources are independently verified for comparison ${index + 1}. | \`minimum_recent_independent_observations_for_comparison_${index + 1}\` | Keep all five columns and the final interpretation ${index + 1}. |`).join('\n');
const cases = [
  { name: 'mixed', source: '# Report with tables\n\nPortrait introduction.\n\n| Item | Status |\n|---|---|\n| Small table | Preserved |\n\n## Wide comparison\n\n' + wide() + '\n\n## After the comparison\n\nPortrait conclusion after the table.\n\n```javascript\nconst original = "unchanged";\n```\n', expected: { landscape: true, portrait: true, returnToPortrait: true } },
  { name: 'table-only', source: '## First table\n\n' + wide(1) + '\n\n## Second table\n\n' + wide(1) + '\n', expected: { landscape: true, portrait: false, pages: 2 } },
  { name: 'tall-row', source: '# Long record\n\n| Item | Monitor | Research | Platform | Details |\n|---|---|---|---|---|\n| Tall record | First column retained | Second column retained | Third column retained | ' + Array.from({ length: 800 }, (_, index) => `word${index}`).join(' ') + ' END_OF_TALL_RECORD |\n', expected: { landscape: true, portrait: false } },
  { name: 'long-identifier', source: '# Narrow table\n\n| Item | Value |\n|---|---|\n| Identifier | `' + 'UNBROKENIDENTIFIER'.repeat(45) + '` |\n\nFinal portrait paragraph.\n', expected: { landscape: false, portrait: true } },
];
if (process.env.SCRIBA_PDF_SOURCE) cases.unshift({ name: 'signals-benchmark', source: await fs.readFile(process.env.SCRIBA_PDF_SOURCE, 'utf8'), expected: { landscape: true, portrait: true, returnToPortrait: true } });
const results = [];
try {
  for (const fixture of cases) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
    const page = await context.newPage(), errors = [], external = [], edgeScripts = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      // Cloudflare injects this statistics script into production HTML. Record it
      // separately while rejecting any other external request, including converters.
      const edgeScript = url.origin === 'https://static.cloudflareinsights.com' &&
        url.pathname.startsWith('/beacon.min.js/') && request.resourceType() === 'script' && request.method() === 'GET';
      if (edgeScript) edgeScripts.push(url.href);
      else if (url.origin !== new URL(origin).origin && !['blob:', 'data:'].includes(url.protocol)) external.push(url.href);
      if (request.method() !== 'GET') writes.push(url.pathname);
    });
    try {
      await page.goto(origin);
      const input = page.getByLabel('Arquivo Markdown', { exact: true });
      await expect(input).toBeEnabled({ timeout: 30000 });
      await input.setInputFiles({ name: `${fixture.name}.md`, mimeType: 'text/markdown', buffer: Buffer.from(fixture.source) });
      await expect(page.getByRole('article')).toContainText(parser.parse(fixture.source).children.map(text)[0]);
      await expect(input).toBeEnabled();
      const startWrites = writes.length;
      await openExport(page);
      const downloadEvent = page.waitForEvent('download', { timeout: 90000 });
      await page.getByRole('button', { name: 'PDF (.pdf)', exact: true }).click();
      const download = await downloadEvent;
      assert.equal(download.suggestedFilename(), `${fixture.name}.pdf`);
      const pdf = path.join(output, `${fixture.name}-${engine}.pdf`);
      await download.saveAs(pdf);
      assert.equal((await fs.readFile(pdf)).subarray(0, 5).toString(), '%PDF-');
      await expect(page.getByRole('button', { name: 'Cancelar exportação', exact: true })).toHaveCount(0);
      await openExport(page);
      const markdownEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Markdown (.md)', exact: true }).click();
      assert.equal(await fs.readFile(await (await markdownEvent).path(), 'utf8'), fixture.source, 'Export leaves the Markdown byte-for-byte unchanged.');
      assert.equal(writes.length, startWrites, 'PDF export never saves or synchronizes a note.');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      const tables = parser.parse(fixture.source).children.filter(node => node.type === 'table').map(node => ({ headers: node.children[0].children.map(text), cells: node.children.flatMap(row => row.children.map(text)) }));
      const record = { case: fixture.name, engine, pdf, tables, expected: fixture.expected };
      await fs.writeFile(path.join(output, `${fixture.name}-${engine}.json`), JSON.stringify(record, null, 2));
      results.push({ case: fixture.name, engine, pdf, exported: true, sourceUnchanged: true, unexpectedExternalRequests: external.length, edgeStatisticsScriptRequests: edgeScripts.length, exportWrites: writes.length - startWrites });
      console.log(`PASS ${engine}: ${fixture.name}, real import/export, original source preserved, no export writes or unexpected external requests (${edgeScripts.length} edge statistics scripts).`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${fixture.name}-${engine}-failure.png`) });
      await fs.writeFile(path.join(output, `${fixture.name}-${engine}-failure.txt`), await page.locator('body').ariaSnapshot());
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, `browser-${engine}.json`), JSON.stringify(results, null, 2));
}
