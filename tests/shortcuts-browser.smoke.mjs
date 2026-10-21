import {chromium, webkit, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {promises as fs} from 'node:fs';

// Exercise the production/browser bundle with private IndexedDB, without any account or user repository.
const server = http.createServer(async (request, response) => {
  if (request.url.startsWith('/github/')) {
    response.writeHead(200, {'Content-Type':'application/json'});
    response.end(JSON.stringify({configured:false,connected:false,user:null,selection:null})); return;
  }
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = new URL(`../dist/${url.pathname === '/' ? 'index.html' : url.pathname.slice(1)}`, import.meta.url);
    const data = await fs.readFile(file);
    response.writeHead(200, {'Content-Type':file.pathname.endsWith('.js') ? 'text/javascript' : file.pathname.endsWith('.css') ? 'text/css' : file.pathname.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); response.end(data);
  } catch {response.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const safari = process.env.MARKDOWN_BROWSER === 'webkit';
const browser = safari ? await webkit.launch({headless:true}) : await chromium.launch({channel:'chrome',headless:true});
try {
  const context = await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'});
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const shortcut = key => page.keyboard.press(`Meta+${key}`);
  const editor = page.locator('.cm-content');
  const closed = page.getByRole('heading', {name:'Nenhuma nota aberta',exact:true});
  const confirmation = page.getByRole('dialog', {name:'Salvar antes de fechar?',exact:true});
  async function open(source) {
    await expect(page.getByLabel('Arquivo Markdown', {exact:true})).toBeEnabled();
    await page.bringToFront();
    const chooser = page.waitForEvent('filechooser'); await shortcut('o');
    await (await chooser).setFiles({name:'Atalhos.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
    await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');
    await expect(page.getByLabel('Arquivo Markdown', {exact:true})).toBeEnabled();
  }
  await open('# Atalhos\n\nNota privada do navegador.'); await shortcut('s');
  await expect(page.getByRole('status').filter({hasText:'Nota salva neste navegador.'})).toBeVisible();
  await page.getByRole('button', {name:'Configurações',exact:true}).click();
  await page.getByLabel('Ativar salvamento automático').check();
  await page.getByRole('button', {name:'Salvar preferências',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Preferências de salvamento atualizadas.'})).toBeVisible();
  await page.getByRole('button', {name:'Voltar ao editor',exact:true}).click();
  await page.getByRole('button', {name:'Fonte',exact:true}).click(); await editor.fill('# Atalhos\n\nAlteração aguardando decisão.');
  await shortcut('w'); await expect(confirmation).toBeVisible();
  await page.clock.fastForward(61000);
  const other = await context.newPage(); await other.goto(page.url());
  // A new tab may recover the active draft; explicitly replace that copy with the saved note.
  other.once('dialog', dialog => dialog.accept());
  await other.getByRole('button', {name:'Atalhos.md',exact:true}).click();
  await expect(other.getByRole('article')).toContainText('Nota privada do navegador.');
  await other.close(); await page.bringToFront();
  await confirmation.getByRole('button', {name:'Cancelar',exact:true}).click();
  await expect(editor).toContainText('Alteração aguardando decisão.');
  await page.clock.fastForward(61000);
  await expect(page.getByRole('status').filter({hasText:'Nota salva neste navegador.'})).toBeVisible();
  await editor.fill('# Atalhos\n\nSalva e fechada no navegador.'); await shortcut('w');
  await confirmation.getByRole('button', {name:'Salvar e fechar',exact:true}).click(); await expect(closed).toBeVisible();
  await page.reload(); await expect(closed).toBeVisible();
  await page.getByRole('button', {name:'Atalhos.md',exact:true}).click();
  await expect(page.getByRole('article')).toContainText('Salva e fechada no navegador.');
  await shortcut('w'); await expect(closed).toBeVisible();
  await open('# Arquivo reaberto\n\nPode cancelar o fechamento.');
  await shortcut('w'); await confirmation.getByRole('button', {name:'Fechar sem salvar',exact:true}).click(); await expect(closed).toBeVisible();
  await page.getByRole('button', {name:'Atalhos.md',exact:true}).click();
  await expect(page.getByRole('article')).toContainText('Salva e fechada no navegador.');
  assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chromium'} public bundle): Meta+O/S and renderer-delivered Meta+W, private save-and-close/reopen, discard preserves saved file, closed state survives reload, autosave pauses during confirmation and resumes after cancel.`);
} finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
