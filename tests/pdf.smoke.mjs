import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { zipSync, strToU8 } from 'fflate';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile), origin = process.env.SCRIBA_URL || 'http://127.0.0.1:43997/';
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
const offline = process.env.SCRIBA_OFFLINE === '1';
const browser = await (safari ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-pdf-'));
try {
  const context = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: offline ? 'allow' : 'block', acceptDownloads: true }), page = await context.newPage(), errors = [], external = [], writes = [], workers = [];
  page.on('worker',worker=>workers.push(worker.url()));
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.origin !== new URL(origin).origin && !['blob:', 'data:'].includes(url.protocol) && url.hostname !== 'static.cloudflareinsights.com') external.push(url.href); if (request.method() !== 'GET') writes.push(url.pathname); });
  await page.goto(origin); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  if (offline) { await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); }); await context.setOffline(true); await page.reload(); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled(); }
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 160; const context = canvas.getContext('2d'); context.fillStyle = '#e4eef3'; context.fillRect(0, 0, 640, 160); context.fillStyle = '#283842'; context.font = '24px sans-serif'; context.fillText('Imagem local - contexto Aurora', 30, 88); return canvas.toDataURL('image/png').split(',')[1]; });
  const reference = await fs.readFile(new URL('../docs/Scriba-Diagramas.md', import.meta.url), 'utf8');
  const scene = /```excalidraw\n([\s\S]*?)\n```/.exec(reference)[1];
  const markdown = '# Organização do Acervo Aurora\n\nUm relatório com **ênfase**, *contexto* e [fonte](https://example.invalid/fonte). Referência[^origem].\n\n## Quadro comparativo\n\n| Etapa | Responsável | Evidência | Revisão | Estado | Próxima ação |\n|---|---|---|---|---|---|\n' + Array.from({ length: 18 }, (_, index) => `| Etapa ${index + 1} | Curadoria | Documento verificado | Revisão contextual | Em análise | Preservar a documentação e suas referências |`).join('\n') + '\n\n## Imagem local\n\n![Imagem do acervo](assets/contexto.png)\n\n## Fluxo visual\n\n```mermaid\nflowchart LR\nA[Capturar] --> B[Revisar] --> C[Preservar]\n```\n\n## Quadro editável\n\n```excalidraw\n' + scene + '\n```\n\n## Exemplo de código\n\n```javascript\nconst acervo = "Organização";\nconsole.log(acervo);\n```\n\n' + Array.from({ length: 18 }, (_, index) => `### Contexto ${index + 1}\n\nEste parágrafo explica uma decisão de preservação. A exportação deve manter a organização do documento, os acentos e a leitura confortável, com espaço suficiente entre as seções.`).join('\n\n') + '\n\n[^origem]: Fonte contextual preservada.\n';
  const archive = zipSync({ 'text.md': strToU8(markdown), 'assets/contexto.png': Buffer.from(png, 'base64') });
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'Relatorio-Aurora.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) });
  await expect(page.getByRole('article')).toContainText('Organização do Acervo Aurora'); await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  const sourceBefore = await page.getByLabel('Bancada Markdown').getAttribute('data-mode');
  const startWrites = writes.length;
  await expect(page.getByRole('button', { name: 'Exportar PDF', exact: true }).first()).toBeVisible();
  const pending = Promise.race([page.waitForEvent('download', { timeout: 90000 }), page.getByRole('alert').waitFor({ state: 'visible', timeout: 90000 }).then(async () => { throw new Error(await page.getByRole('alert').textContent()); })]); await page.getByRole('button', { name: 'Exportar PDF', exact: true }).first().click();
  const download = await pending; assert.equal(download.suggestedFilename(), 'Relatorio-Aurora.pdf');
  const pdf = path.join(directory, download.suggestedFilename()); await download.saveAs(pdf); await fs.copyFile(pdf, `/tmp/scriba-pdf-debug-${safari ? 'webkit' : 'chrome'}.pdf`);
  assert.ok((await fs.readFile(pdf)).subarray(0, 5).toString() === '%PDF-');
  const { stdout: info } = await exec('pdfinfo', [pdf]); const pages = Number(/^Pages:\s+(\d+)/m.exec(info)[1]); assert.ok(pages >= 3); assert.match(info, /A4/);
  const text = path.join(directory, 'text.txt'); await exec('pdftotext', ['-layout', pdf, text]); const content = await fs.readFile(text, 'utf8');
  for (const expected of ['Organização do Acervo Aurora', 'Quadro comparativo', 'documentação', 'Exemplo de código', 'Fonte contextual preservada.']) assert.ok(content.replace(/\s+/g, ' ').includes(expected), expected);
  const pageTexts = content.split('\f').filter(value => value.trim()); assert.equal(pageTexts.length, pages);
  for (const pageText of pageTexts) { assert.ok(pageText.includes('scriba markdown editor')); assert.ok(pageText.includes('powered by Aeon Bridge Co.')); }
  assert.ok(!content.includes('Diagrama não renderizado'), 'Both Mermaid and Excalidraw diagrams are exported as visual graphics.');
  for (const pageText of pageTexts) { const body = pageText.split('\n').map(line => line.trim()).filter(line => line && !line.includes('powered by') && !/^\d+\s*\/\s*\d+$/.test(line)); assert.ok(!/^(?:Fluxo visual|Quadro editável|Contexto \d+)$/.test(body.at(-1)), 'Section headings stay with their content.'); }
  const { stdout: images } = await exec('pdfimages', ['-list', pdf]); for (let pageNumber = 1; pageNumber <= pages; pageNumber++) assert.ok(images.split('\n').some(line => new RegExp(`^\\s*${pageNumber}\\s+`).test(line) && /\s64\s+64\s/.test(line)), `Logo is embedded on page ${pageNumber}.`);
  assert.equal(await page.getByLabel('Bancada Markdown').getAttribute('data-mode'), sourceBefore); assert.equal(writes.length, startWrites);
  if (!offline) {
    let release, started; const held = new Promise(resolve => { release = resolve; }), loading = new Promise(resolve => { started = resolve; });
    await page.route('**/icons/profile-v3/scribe-64.png', async route => { started(); await held; try { await route.continue(); } catch { /* Cancellation already closed this request. */ } });
    let extraDownloads = 0; const downloaded = () => { extraDownloads++; }; page.on('download', downloaded);
    await page.getByRole('button', { name: 'Exportar PDF', exact: true }).first().click(); await loading;
    await page.getByRole('button', { name: 'Cancelar exportação', exact: true }).click(); await expect(page.getByRole('button', { name: 'Cancelar exportação', exact: true })).toHaveCount(0); release();
    await page.unroute('**/icons/profile-v3/scribe-64.png'); await expect(page.getByRole('button', { name: 'Exportar PDF', exact: true }).first()).toBeEnabled();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.equal(extraDownloads, 0); page.off('download', downloaded);
  }
  const noteDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar .md', exact: true }).click(); assert.equal(await fs.readFile(await (await noteDownload).path(), 'utf8'), markdown);
  const evidence = new URL('../docs/evidence/pdf/', import.meta.url); await fs.mkdir(evidence, { recursive: true });
  await exec('pdftoppm', ['-f', '1', '-l', '2', '-r', '100', '-png', pdf, path.join(directory, 'page')]);
  if (!safari) { await fs.copyFile(pdf, new URL('export-example.pdf', evidence)); for (const file of await fs.readdir(directory)) if (/^page-\d+\.png$/.test(file)) await fs.copyFile(path.join(directory, file), new URL(file, evidence)); }
  await page.setViewportSize({ width: 390, height: 844 }); const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true }); if (await close.isVisible()) await close.click(); await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
  await page.locator('summary[aria-label="Exportar nota"]').click(); await expect(page.getByRole('button', { name: 'Exportar PDF', exact: true }).last()).toBeVisible(); await page.screenshot({ path: new URL(`pdf-export-menu-mobile-${safari ? 'webkit' : 'chrome'}.png`, evidence).pathname });
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(workers.length > 0);
  // The PNG adapter targets the shipped bundle; Vite development uses dependency prebundles.
  if(workers.some(url=>/\/assets\/pdf\.worker-/.test(url)))assert.ok(workers.every(url=>new URL(url).origin===new URL(origin).origin && !url.startsWith('blob:')), 'Built PDF processing uses only the self-hosted worker, with no nested Blob workers.');
  console.log(`PASS (${safari ? 'WebKit' : 'Chromium'}${offline ? ', first PDF load offline' : ''}): downloadable A4 PDF (${pages} pages), selectable Portuguese text, tables, image/diagram conversion, logo and branded footer on every page, unchanged source, no writes/external requests and mobile export menu.`);
} finally { await browser.close(); await fs.rm(directory, { recursive: true, force: true }); }
