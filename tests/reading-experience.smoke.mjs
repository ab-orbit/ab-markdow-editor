import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile), git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-reading-'));
const evidence = new URL('../docs/evidence/reading-experience/', import.meta.url);
const prose = '# Relatório de temas e prioridades\n\n## Visão geral\n\nEste relatório identifica os temas de maior relevância para a pesquisa e analisa as relações entre **organizações, pessoas e conhecimento**. A leitura precisa manter o ritmo, a hierarquia dos títulos e o conforto visual em diferentes tamanhos de tela.\n\nOs resultados foram agrupados em áreas complementares: **métodos**, **redes de colaboração** e **produção científica**. Cada tema traz um contexto para orientar a investigação e a tomada de decisão.\n\n## Temas em perspectiva\n\n| Tema | Ocorrências | Pesquisadores | Diagnóstico |\n| :--- | ---: | :--- | :--- |\n| Inovação e desenvolvimento tecnológico | 28 | Ana Paula, Carlos Silva e Marina Costa | Convergência entre projetos de inovação e aplicações de inteligência artificial na saúde. |\n| Redes de colaboração científica | 16 | Beatriz Souza e João Almeida | Relações entre instituições de ensino, pesquisa aplicada e desenvolvimento regional. |\n| Métodos e avaliação de evidências | 12 | Carolina Lima e Pedro Nunes | Avaliação de dados, construção de hipóteses e critérios para validação de resultados. |\n| Governança e políticas públicas | 9 | Renata Dias e Bruno Freitas | Integração entre políticas de ciência, indicadores de impacto e necessidades da sociedade. |\n\n## Próximos passos\n\nUma tabela larga deve manter palavras inteiras e permitir navegar por todas as colunas com um gesto horizontal. O texto continua rolando verticalmente.\n';
const untouched = '~~~~mermaid\nflowchart LR\n  A[Pesquisa] --> B[Conhecimento]\n~~~~';
const original = '\uFEFF' + ['<!-- scriba-private: keep exactly -->', '# Edição visual', 'Este parágrafo tem **negrito** e uma referência[^nota].', 'Outro parágrafo permanece com *sintaxe original* e [um link][origem].', '| Tema | Estado |\n| :--- | :--- |\n| Pesquisa | Em análise |\n| Escrita | Revisão |', untouched, '![Imagem externa](https://example.invalid/private-image.png)', '[origem]: https://example.invalid/context "Título original"', '[^nota]: Definição preservada.\n    Segunda linha da referência.'].join('\r\n\r\n').replace(/(?<!\r)\n/g, '\r\n') + '\r\n';
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
let server, browser, root, remote, initialHead;
const errors = [], externalImages = [];
try {
  let origin = process.env.SCRIBA_URL;
  if (!origin) {
    const state = path.join(directory, 'state'); root = path.join(directory, 'notes'); remote = path.join(directory, 'remote.git');
    for (const folder of [state, root, remote]) await fs.mkdir(folder);
    root = await fs.realpath(root);
    await git(remote, 'init', '--bare', '-b', 'main'); await git(root, 'init', '-b', 'main');
    for (const [key, value] of [['user.name', 'Scriba Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null'], ['core.autocrlf', 'false']]) await git(root, 'config', key, value);
    await fs.writeFile(path.join(root, 'Leitura.md'), prose); await fs.writeFile(path.join(root, 'Edicao.md'), original);
    await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Initial'); await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main'); initialHead = await git(root, 'rev-parse', 'HEAD');
    await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { autoSave: false, askCommitNote: false, intervalMinutes: 1 } }));
    await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: ['Leitura.md'], welcomeImageVersion: 1, diagramManualVersion: 1 } }));
    const runtime = path.join(directory, 'runtime.json');
    server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
    for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
    assert.ok(origin);
  }
  browser = safari ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('private-image.png')) externalImages.push(request.url()); });
  page.on('dialog', dialog => dialog.accept());
  await fs.mkdir(evidence, { recursive: true });
  await page.goto(origin);
  const workbench = page.getByLabel('Bancada Markdown'), reading = page.getByRole('article'), input = page.getByLabel('Arquivo Markdown', { exact: true });
  async function importSource(name, source) {
    await expect(input).toBeEnabled();
    await input.setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(source) });
    await expect(workbench).toHaveAttribute('data-mode', 'read');
    await expect(workbench).toHaveAttribute('data-reading-editable', 'false');
  }
  async function desktopActions() {
    if (await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).isVisible() && !await page.getByRole('button', { name: 'Fonte', exact: true }).isVisible()) await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
  }
  async function sourceValue() {
    await desktopActions(); await page.getByRole('button', { name: 'Fonte', exact: true }).click();
    const pending = page.waitForEvent('download');
    if (await page.getByRole('button', { name: 'Exportar nota', exact: true }).isVisible()) await page.getByRole('button', { name: 'Exportar nota', exact: true }).click();
    await page.getByRole('button', { name: 'Baixar .md', exact: true }).click();
    const source = await fs.readFile(await (await pending).path(), 'utf8');
    await page.getByRole('button', { name: 'Ler', exact: true }).click(); return source;
  }
  async function caretAtEnd(locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate(element => { element.closest('[contenteditable=true]').focus(); const range = document.createRange(); range.selectNodeContents(element); range.collapse(false); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
  }
  await importSource('Leitura.md', prose);
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const themeButton = page.getByRole('button', { name: theme === 'light' ? 'Usar tema claro' : 'Usar tema escuro', exact: true });
    if (await themeButton.isVisible()) await themeButton.click();
    for (const [width, height] of [[440, 956], [390, 844], [844, 390], [820, 1180], [1180, 820], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true }); if (await close.isVisible()) await close.click();
      const table = reading.getByRole('region', { name: 'Tabela com rolagem horizontal' }); await table.scrollIntoViewIfNeeded();
      const metrics = await reading.evaluate(element => {
        const p = element.querySelector('p'), h = element.querySelector('h1'), scroller = element.querySelector('[role=region]'), cell = element.querySelector('td'), rows = element.querySelectorAll('tbody tr');
        return { font: getComputedStyle(p).fontFamily, size: getComputedStyle(p).fontSize, leading: getComputedStyle(p).lineHeight, align: getComputedStyle(p).textAlign, headingAlign: getComputedStyle(h).textAlign, scroll: scroller.scrollWidth, client: scroller.clientWidth, wordBreak: getComputedStyle(cell).wordBreak, cellWidth: cell.getBoundingClientRect().width, zebra: [...rows].slice(0, 3).map(row => getComputedStyle(row).backgroundColor), scrollbar: getComputedStyle(scroller).scrollbarWidth, bodyWidth: document.documentElement.scrollWidth, viewport: innerWidth };
      });
      assert.ok(metrics.font.includes('Avenir')); assert.equal(metrics.size, width < 900 ? '14px' : '15px'); assert.equal(metrics.align, 'justify'); assert.notEqual(metrics.headingAlign, 'justify'); assert.equal(metrics.wordBreak, 'normal'); assert.ok(metrics.cellWidth > 90); assert.notEqual(metrics.zebra[0], metrics.zebra[1]); assert.equal(metrics.zebra[0], metrics.zebra[2]); assert.ok(metrics.bodyWidth <= metrics.viewport);
      if (width < 900) {
        assert.ok(metrics.scroll > metrics.client + 100, JSON.stringify(metrics));
        await table.focus(); await page.keyboard.press('ArrowRight'); await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
      if (theme === 'light' && [440, 1440].includes(width)) {
        await reading.locator('h1').scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`reading-${width}x${height}${safari ? '-webkit' : ''}.png`, evidence).pathname });
        await table.scrollIntoViewIfNeeded(); await table.evaluate(element => element.scrollLeft = 0);
        await page.screenshot({ path: new URL(`table-${width}x${height}${safari ? '-webkit' : ''}.png`, evidence).pathname });
      }
    }
  }
  if (!safari) {
    await page.setViewportSize({ width: 390, height: 844 }); const table = reading.getByRole('region'); await table.scrollIntoViewIfNeeded(); await table.evaluate(element => element.scrollLeft = 0);
    const rect = await table.boundingBox(), cdp = await context.newCDPSession(page), y = Math.max(90, rect.y + 75);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width - 30, y }] });
    for (let step = 1; step <= 12; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: rect.x + rect.width - 30 - (rect.width - 60) * step / 12, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(20); await cdp.detach();
  }
  await page.setViewportSize({ width: 1440, height: 900 }); assert.equal(await sourceValue(), prose, 'reading/scrolling never rewrites the source');
  await importSource('Edicao.md', original);
  await page.getByRole('button', { name: 'Escrever', exact: true }).click();
  const visual = page.getByRole('textbox', { name: 'Texto da nota', exact: true }); await expect(visual).toBeVisible();
  await expect(workbench).toHaveAttribute('data-mode', 'read'); await expect(workbench).toHaveAttribute('data-reading-editable', 'true');
  await expect(visual).not.toContainText('**negrito**'); await expect(visual.locator('p strong')).toHaveText('negrito'); await expect(visual.locator('table')).toHaveCount(1);
  await expect(visual.locator('figure[data-diagram-engine]')).toHaveCount(1); await expect(visual.locator('img[src^="http"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Concluir edição', exact: true }).filter({ visible: true }).click(); assert.equal(await sourceValue(), original, 'enter/leave visual editing is byte-preserving');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Editar nota', exact: true }).click(); await expect(visual).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fonte', exact: true })).toBeHidden();
  const paragraph = visual.locator('p').filter({ hasText: 'Este parágrafo tem' });
  await caretAtEnd(paragraph); await page.keyboard.insertText(' Texto acrescentado.');
  await expect(paragraph).toContainText('Texto acrescentado.'); await page.keyboard.press('ControlOrMeta+z'); await expect(paragraph).not.toContainText('Texto acrescentado.'); await page.keyboard.press('ControlOrMeta+Shift+z'); await expect(paragraph).toContainText('Texto acrescentado.');
  await page.keyboard.press('Enter'); await page.keyboard.insertText('Um novo parágrafo visual.'); await expect(visual.locator('p').filter({ hasText: 'Um novo parágrafo visual.' })).toBeVisible();
  const cell = visual.locator('td').filter({ hasText: /^Em análise$/ }).locator('p'); await caretAtEnd(cell); await page.keyboard.insertText(' concluída'); await expect(visual.locator('td').filter({ hasText: /^Em análise concluída$/ })).toBeVisible();
  await page.keyboard.press('Tab'); await page.keyboard.insertText('Nova linha');
  await visual.locator('h1').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Mostrar formatação', exact: true }).filter({ visible: true }).click();
  const text = visual.locator('p').filter({ hasText: 'Um novo parágrafo visual.' }); await text.scrollIntoViewIfNeeded(); await text.evaluate(element => { element.closest('[contenteditable=true]').focus(); const range = document.createRange(); range.selectNodeContents(element); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
  await page.getByRole('button', { name: 'Negrito', exact: true }).click(); await expect(text.locator('strong')).toHaveText('Um novo parágrafo visual.');
  await page.screenshot({ path: new URL(`visual-editing-mobile${safari ? '-webkit' : ''}.png`, evidence).pathname });
  // Save while the rendered editor still owns focus, without switching to source first.
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByRole('status').filter({ hasText: root ? 'Arquivo salvo, commit criado e enviado ao remoto.' : 'Nota salva neste navegador.' })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir edição', exact: true }).filter({ visible: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 }); const edited = await sourceValue();
  assert.ok(edited.startsWith('\uFEFF<!-- scriba-private: keep exactly -->\r\n\r\n# Edição visual\r\n\r\n'));
  assert.ok(edited.includes('Este parágrafo tem **negrito** e uma referência[^nota]. Texto acrescentado.'));
  assert.ok(edited.includes('**Um novo parágrafo visual.**')); assert.ok(edited.includes('Em análise concluída'));
  for (const raw of ['Outro parágrafo permanece com *sintaxe original* e [um link][origem].', untouched.replace(/\n/g, '\r\n'), '![Imagem externa](https://example.invalid/private-image.png)', '[origem]: https://example.invalid/context "Título original"', '[^nota]: Definição preservada.\r\n    Segunda linha da referência.']) assert.ok(edited.includes(raw), `untouched Markdown preserved: ${raw}`);
  assert.equal(edited.replace(/\r\n/g, '').includes('\n'), false, 'new blocks keep the original CRLF convention');
  // The host shortcut saves the latest rendered edits, including table cells, to Git and pushes them.
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByRole('status').filter({ hasText: root ? 'Arquivo salvo, commit criado e enviado ao remoto.' : 'Nota salva neste navegador.' })).toBeVisible();
  if (root) { assert.equal(await fs.readFile(path.join(root, 'Edicao.md'), 'utf8'), edited); assert.equal((await exec('git', ['-C', remote, 'show', 'main:Edicao.md'])).stdout, edited); assert.notEqual(await git(root, 'rev-parse', 'HEAD'), initialHead); }
  assert.deepEqual(externalImages, []); assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chrome'}): desktop/phone/tablet both orientations, both themes, justified typography, readable zebra tables, keyboard/touch scrolling, visual paragraph/table editing, Enter, bold, undo/redo, exact untouched Markdown + BOM/CRLF, Cmd+S${root ? ' + real commit/push' : ''}.`);
} finally {
  await browser?.close(); if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  await fs.rm(directory, { recursive: true, force: true });
}
