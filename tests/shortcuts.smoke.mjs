import {chromium, webkit, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Every write and push uses an isolated real checkout and bare remote, never user notes.
const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-shortcuts-'));
let server, browser;
try {
  const state = path.join(directory, 'state'), checkout = path.join(directory, 'notes'), remote = path.join(directory, 'remote.git');
  await Promise.all([state, checkout, remote].map(folder => fs.mkdir(folder)));
  const root = await fs.realpath(checkout);
  await git(remote, 'init', '--bare', '-b', 'main'); await git(root, 'init', '-b', 'main');
  for (const [key, value] of [['user.name', 'Scriba Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
  const original = '# Nota de teste\n\nTexto original.\n';
  await fs.writeFile(path.join(root, 'Nota.md'), original);
  await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Initial'); await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
  await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({repository: root, preferences: {askCommitNote: false, autoSave: false, intervalMinutes: 1}}));
  await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({[root]: {pinned: ['Nota.md'], welcomeImageVersion: 1, diagramManualVersion: 1}}));
  const runtime = path.join(directory, 'runtime.json');
  server = spawn(process.execPath, ['server/index.mjs'], {cwd: new URL('..', import.meta.url), env: {...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime}, stdio: 'pipe'});
  let origin;
  for (let index = 0; index < 100; index++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  assert.ok(origin);
  const safari = process.env.MARKDOWN_BROWSER === 'webkit';
  browser = safari ? await webkit.launch({headless: true}) : await chromium.launch({channel: 'chrome', headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, serviceWorkers: 'block'}), errors = [];
  page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {if(request.url().endsWith('/api/save-sync'))console.log('Save request sent.');});
  const workbench = page.getByLabel('Bancada Markdown'), editor = page.locator('.cm-content');
  const closed = page.getByRole('heading', {name: 'Nenhuma nota aberta', exact: true});
  const confirmation = page.getByRole('dialog', {name: 'Salvar antes de fechar?', exact: true});
  const shortcut = key => page.keyboard.press(`Meta+${key}`);
  const openNote = async () => {await page.getByRole('button', {name: 'Nota.md', exact: true}).click(); await expect(workbench).toHaveAttribute('data-mode', 'read');};
  const edit = async text => {await page.getByRole('button', {name: 'Fonte', exact: true}).click(); await editor.fill(text);};
  const remoteText = () => git(remote, 'show', 'main:Nota.md');
  const commits = () => git(root, 'rev-list', '--count', 'HEAD');
  async function openFile(name, source) {
    await expect(page.getByLabel('Arquivo Markdown', {exact: true})).toBeEnabled();
    const chooser = page.waitForEvent('filechooser'); await shortcut('o');
    await (await chooser).setFiles({name, mimeType: 'text/markdown', buffer: Buffer.from(source)});
    await expect(workbench).toBeVisible(); await expect(workbench).toHaveAttribute('data-mode', 'read');
    await expect(page.getByLabel('Arquivo Markdown', {exact: true})).toBeEnabled();
  }
  async function preferences(ask, auto = false) {
    await page.getByRole('button', {name: 'Configurações', exact: true}).click();
    await page.getByLabel('Perguntar nota do commit a cada salvamento').setChecked(ask);
    await page.getByLabel('Ativar salvamento automático').setChecked(auto);
    await page.getByRole('button', {name: 'Salvar preferências', exact: true}).click();
    await expect(page.getByRole('status').filter({hasText: 'Preferências de salvamento atualizadas.'})).toBeVisible();
    await page.getByRole('button', {name: 'Voltar ao editor', exact: true}).click();
  }
  await page.goto(origin); await openNote();
  console.log('Checking open/import/save shortcuts.');
  await page.getByRole('button', {name: 'Configurações', exact: true}).click();
  await openFile('Importada.md', '# Importada\n\nTexto aberto pelo seletor.\n');
  await expect(page.getByRole('heading', {name: 'Importada', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name:'Salvar no repositório',exact:true})).toBeEnabled(); await shortcut('s');
  await expect.poll(() => git(remote, 'show', 'main:Importada.md').catch(() => '')).toContain('Texto aberto pelo seletor.');
  await expect(page.getByRole('status').filter({hasText: 'Arquivo salvo, commit criado e enviado ao remoto.'})).toBeVisible();
  await shortcut('w'); await expect(closed).toBeVisible(); await expect(confirmation).not.toBeVisible();
  console.log('Checking empty workspace restoration.');
  await page.reload(); await expect(closed).toBeVisible();
  // Opening from the empty workspace reuses the same file input and user gesture.
  await openFile('Segunda.md', '# Segunda\n\nAinda não salva no destino.');
  await shortcut('w'); await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape'); await expect(confirmation).not.toBeVisible();
  await expect(page.getByRole('heading', {name: 'Segunda', exact: true})).toBeVisible();
  await shortcut('w'); await confirmation.getByRole('button', {name: 'Fechar sem salvar', exact: true}).click(); await expect(closed).toBeVisible();
  assert.equal(await fs.stat(path.join(root, 'Segunda.md')).then(() => true, () => false), false);

  await openNote(); const changed = '# Nota de teste\n\nSalva com o atalho e **sincronizada**.\n'; await edit(changed);
  console.log('Checking close confirmation and browser navigation guard.');
  // A real navigation exercises the browser-owned fallback when tab-close keys are reserved.
  if (!safari) {
    const dialog = page.waitForEvent('dialog'); const navigation = page.reload({timeout: 3000}).catch(() => {});
    const warning = await dialog; assert.equal(warning.type(), 'beforeunload'); await warning.dismiss(); await navigation;
    await expect(editor).toContainText('Salva com o atalho');
  }
  await shortcut('w'); await expect(confirmation).toBeVisible();
  const beforeCancel = await commits(); await shortcut('s'); assert.equal(await commits(), beforeCancel, 'modal shortcuts never publish behind the confirmation');
  await confirmation.getByRole('button', {name: 'Cancelar', exact: true}).click(); await expect(editor).toContainText('Salva com o atalho');
  await shortcut('w'); await confirmation.getByRole('button', {name: 'Salvar e fechar', exact: true}).click();
  await expect(closed).toBeVisible(); assert.equal(await remoteText(), changed.trimEnd());

  await openNote(); await preferences(true); await edit('# Nota de teste\n\nMensagem de commit cancelada.');
  await shortcut('w'); await confirmation.getByRole('button', {name: 'Salvar e fechar', exact: true}).click();
  const commitDialog = page.getByRole('dialog', {name: 'Nota do commit', exact: true}); await expect(commitDialog).toBeVisible();
  await commitDialog.getByRole('button', {name: 'Cancelar', exact: true}).click(); await expect(closed).not.toBeVisible();
  assert.equal(await remoteText(), changed.trimEnd(), 'cancelled commit note does not save');
  // A subsequent ordinary save must not inherit the cancelled close intent.
  await shortcut('s'); await commitDialog.getByLabel('Nota do commit').fill('Save without closing');
  await commitDialog.getByRole('button', {name: 'Salvar, commit e push', exact: true}).click();
  await expect.poll(() => git(root, 'log', '-1', '--format=%s')).toBe('Save without closing');
  await expect(page.getByRole('status').filter({hasText: 'Arquivo salvo, commit criado e enviado ao remoto.'})).toBeVisible();
  await expect(closed).not.toBeVisible();
  await edit('# Nota de teste\n\nSalvar, anotar e fechar.'); await shortcut('w');
  await confirmation.getByRole('button', {name: 'Salvar e fechar', exact: true}).click();
  await commitDialog.getByLabel('Nota do commit').fill('Save and close');
  await commitDialog.getByRole('button', {name: 'Salvar, sincronizar e fechar', exact: true}).click(); await expect(closed).toBeVisible();
  assert.equal(await git(remote, 'log', '-1', '--format=%s'), 'Save and close');

  await openNote(); await preferences(false);
  await edit('# Nota de teste\n\nPush precisa ser tentado novamente.'); await git(root, 'remote', 'set-url', 'origin', path.join(directory, 'missing.git'));
  await shortcut('w'); await confirmation.getByRole('button', {name: 'Salvar e fechar', exact: true}).click();
  await expect(page.getByRole('alert').filter({hasText: 'Push pendente'})).toBeVisible(); await expect(closed).not.toBeVisible();
  await expect(editor).toContainText('Push precisa ser tentado novamente.');
  const beforeRetry = await commits(); await git(root, 'remote', 'set-url', 'origin', remote);
  await shortcut('w'); await expect(confirmation).toContainText('sincronização pendente');
  await confirmation.getByRole('button', {name: 'Salvar e fechar', exact: true}).click(); await expect(closed).toBeVisible();
  assert.equal(await commits(), beforeRetry, 'retrying a pending push never duplicates its commit');
  assert.ok((await remoteText()).includes('Push precisa ser tentado novamente.'));

  // Hold a real HTTP write to prove that repeated shortcuts cannot close or resubmit it.
  await openNote(); await edit('# Nota de teste\n\nOperação única.');
  let release, reached; const waiting = new Promise(resolve => {release = resolve;}), arrived = new Promise(resolve => {reached = resolve;}); let writes = 0;
  await page.route('**/api/save-sync', async route => {writes++; reached(); await waiting; await route.continue();});
  await shortcut('s'); await arrived; await shortcut('s'); await shortcut('w'); await expect(closed).not.toBeVisible(); await expect(confirmation).not.toBeVisible();
  release(); await expect(page.getByRole('status').filter({hasText: 'Arquivo salvo, commit criado e enviado ao remoto.'})).toBeVisible();
  assert.equal(writes, 1); await page.unroute('**/api/save-sync');

  await edit('# Nota de teste\n\nMinha edição permanece na memória.');
  await fs.writeFile(path.join(root, 'Nota.md'), '# Alteração externa\n\nOutra versão no disco.');
  await shortcut('w'); await confirmation.getByRole('button', {name: 'Salvar e fechar', exact: true}).click();
  const conflict = page.getByRole('dialog', {name: 'Resolver versões do arquivo', exact: true}); await expect(conflict).toBeVisible();
  await conflict.getByRole('button', {name: 'Continuar editando', exact: true}).click(); await expect(editor).toContainText('Minha edição permanece na memória.');
  assert.ok((await fs.readFile(path.join(root, 'Nota.md'), 'utf8')).includes('Outra versão no disco.'), 'conflicts never overwrite external changes');

  // The toolbar alternative uses exactly the same confirmation on touch-sized layouts.
  for (const size of [{width: 1440, height: 900}, {width: 390, height: 844}, {width: 844, height: 390}, {width: 768, height: 1024}, {width: 1024, height: 768}]) {
    await page.setViewportSize(size);
    if (size.width < 900 && await page.getByRole('button', {name: 'Fechar lista de notas', exact: true}).isVisible()) await page.getByRole('button', {name: 'Fechar lista de notas', exact: true}).click();
    await page.getByRole('button', {name: 'Fechar nota', exact: true}).click(); await expect(confirmation).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const button of await confirmation.getByRole('button').all()) {const box = await button.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44);}
    if (!safari && [1440, 390].includes(size.width)) await page.screenshot({path: `docs/evidence/shortcuts-close-${size.width === 1440 ? 'desktop' : 'mobile'}.png`});
    await confirmation.getByRole('button', {name: 'Cancelar', exact: true}).click();
  }
  await page.getByRole('button', {name: 'Usar tema claro', exact: true}).click();
  await page.getByRole('button', {name: 'Fechar nota', exact: true}).click();
  if (!safari) await page.screenshot({path: 'docs/evidence/shortcuts-close-light.png'});
  await confirmation.getByRole('button', {name: 'Fechar sem salvar', exact: true}).click(); await expect(closed).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(`PASS (${safari ? 'WebKit' : 'Chromium'}): native file chooser via Meta+O; save/commit/push via Meta+S; renderer-delivered Meta+W and toolbar close; cancel/discard/save; commit-note cancellation and intent reset; failed-push recovery; no duplicate writes; conflict protection; closed workspace restoration; phone/tablet layouts. Physical browser-reserved shortcuts are outside the renderer test.`);
} finally {
  await browser?.close();
  if (server) {server.kill(); await new Promise(resolve => server.once('exit', resolve));}
  await fs.rm(directory, {recursive: true, force: true});
}
