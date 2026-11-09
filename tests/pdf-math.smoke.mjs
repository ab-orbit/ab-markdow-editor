import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const origin = process.env.SCRIBA_URL || 'http://127.0.0.1:43998/';
const engine = process.env.MARKDOWN_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const offline = process.env.SCRIBA_OFFLINE === '1';
const output = path.resolve(process.env.SCRIBA_PDF_OUTPUT || 'artifacts/pdf-math');
const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
await fs.mkdir(output, { recursive: true });
const fixture = String.raw`# Probability reference

## Bernoulli and binomial

An observation $X\in\{0,1\}$ has probability $P(X=1)=p$. The expectation $\mathbb{E}[X]=p$ remains beside selectable prose, with variance $\operatorname{Var}(X)=p(1-p)$.

$$
P(X=k)=p^k(1-p)^{1-k},\quad \mathbb{E}[X]=p,\quad\operatorname{Var}(X)=p(1-p)
$$

An inline fraction $\frac{r(1-p)}{p^2}$ retains its numerator and denominator. This complete final sentence remains searchable.

Imported notation P(Y \= k) \= \\binom{n}{k} p^k (1 \- p)^{n \- k}, \\quad \\mathbb{E}\[Y\] \= np.

Imported units 10\\text{ minutes} and 49\\text{ mm} remain attached to their values.

## Matrices and systems

\[
\begin{aligned}A&=\begin{pmatrix}1&2\\3&4\end{pmatrix}\\f(x)&=\begin{cases}x^2&x>0\\0&x\le0\end{cases}\end{aligned}
\]

## Math fence

\`\`\`latex
\[ I = \frac{\text{observed events}}{\text{total events}} \times 100 \]
\`\`\`

## Wide comparison

| Model | Mass | Mean | Variance | Context |
|---|---|---|---|---|
| Binomial | $\binom{n}{k}p^k(1-p)^{n-k}$ | $np$ | $np(1-p)$ | Independent observations in a fixed sample. |
| Poisson | $\frac{\lambda^k e^{-\lambda}}{k!}$ | $\lambda$ | $\lambda$ | Events counted during a fixed interval. |
| Geometric | $(1-p)^{k-1}p$ | $\frac1p$ | $\frac{1-p}{p^2}$ | Attempts until the first event. |

## Final portrait section

All five table columns and this final paragraph must remain in the PDF. Literal code remains literal.

\`\`\`python
print("\\Delta is literal code")
\`\`\`
`.replaceAll('\\`', '`');
const cases = [{ name: 'probability-reference', source: fixture }];
if (process.env.SCRIBA_PDF_SOURCE) cases.push({ name: 'course-reference', source: await fs.readFile(process.env.SCRIBA_PDF_SOURCE, 'utf8'), private: true });
const results = [];
async function openExport(page) {
  const menu = page.getByLabel('Exportar nota', { exact: true });
  if (await menu.isVisible()) await menu.click();
  else {
    await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Exportar', exact: true }).click();
  }
}
try {
  for (const item of cases) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: offline ? 'allow' : 'block', acceptDownloads: true });
    const page = await context.newPage(), errors = [], external = [], writes = [];
    const digest = createHash('sha256').update(item.source).digest('hex');
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      const edgeStatistics = url.origin === 'https://static.cloudflareinsights.com' && url.pathname.startsWith('/beacon.min.js/');
      if (url.origin !== new URL(origin).origin && !['data:', 'blob:'].includes(url.protocol) && !edgeStatistics) external.push(url.href);
      if (request.method() !== 'GET') writes.push(url.pathname);
    });
    try {
      await page.goto(origin);
      const input = page.getByLabel('Arquivo Markdown', { exact: true });
      await expect(input).toBeEnabled({ timeout: 30000 });
      await input.setInputFiles({ name: `${item.name}.md`, mimeType: 'text/markdown', buffer: Buffer.from(item.source) });
      await expect(page.getByRole('article')).toContainText(item.private ? 'Curso Prático' : 'Probability reference');
      await expect(input).toBeEnabled();
      if (offline) {
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 120000 }).toBe(true);
        await context.setOffline(true);
      }
      const startWrites = writes.length;
      await openExport(page);
      const downloadEvent = Promise.race([
        page.waitForEvent('download', { timeout: 120000 }),
        page.getByRole('alert').waitFor({ state: 'visible', timeout: 120000 }).then(async () => {
          throw new Error(await page.getByRole('alert').textContent());
        }),
      ]);
      const started = Date.now();
      await page.getByRole('button', { name: 'PDF (.pdf)', exact: true }).click();
      const download = await downloadEvent;
      const pdf = path.join(output, `${item.name}-${engine}.pdf`);
      await download.saveAs(pdf);
      const durationMs = Date.now() - started;
      const { stdout: contents } = await exec('pdftotext', ['-layout', pdf, '-'], { maxBuffer: 8 * 1024 * 1024 });
      const { stdout: info } = await exec('pdfinfo', [pdf]);
      assert.match(info, /Creator:\s+Scriba Markdown Editor/);
      assert.ok(contents.includes('powered by Aeon Bridge Co.'));
      if (!item.private) {
        assert.doesNotMatch(contents, /\\frac|\\binom|\\mathbb|\\quad|\\begin|\\text\{/);
        for (const sentence of ['selectable prose', 'This complete final sentence remains searchable.', 'Final portrait section', 'All five table columns']) assert.ok(contents.replace(/\s+/g, ' ').includes(sentence), sentence);
        assert.match(contents, /Delta is literal code/);
        await page.screenshot({ path: path.join(output, `exported-desktop-${engine}.png`) });
        await page.setViewportSize({ width: 390, height: 844 });
        const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
        if (await close.isVisible()) await close.click();
        await page.screenshot({ path: path.join(output, `exported-mobile-${engine}.png`) });
      }
      await openExport(page);
      const markdownEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Markdown (.md)', exact: true }).click();
      const exportedSource = await fs.readFile(await (await markdownEvent).path(), 'utf8');
      assert.equal(exportedSource, item.source, 'Export preserves the imported Markdown byte-for-byte.');
      assert.equal(writes.length, startWrites, 'PDF export never saves or synchronizes the note.');
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      if (item.private) assert.equal(createHash('sha256').update(await fs.readFile(process.env.SCRIBA_PDF_SOURCE)).digest('hex'), digest);
      results.push({ case: item.name, engine, offline, pdf, durationMs, sourceSha256: digest, sourceUnchanged: true, exportWrites: writes.length - startWrites, unexpectedExternalRequests: external.length, pdfBytes: (await fs.stat(pdf)).size, pages: Number(/^Pages:\s+(\d+)/m.exec(info)[1]) });
      console.log(`PASS ${engine}: ${item.name}, mathematical PDF exported through the actual import/export menu in ${durationMs} ms.`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${item.name}-${engine}-failure.png`) });
      await fs.writeFile(path.join(output, `${item.name}-${engine}-failure.txt`), await page.locator('body').ariaSnapshot());
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, `browser-${engine}.json`), JSON.stringify(results, null, 2));
}
