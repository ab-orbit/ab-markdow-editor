import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-new-note-git-'));
const exec = promisify(execFile), git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
let server, browser;
try {
  const state = path.join(directory, 'state'), checkout = path.join(directory, 'notes'), remote = path.join(directory, 'remote.git');
  await fs.mkdir(state); await fs.mkdir(checkout); const root = await fs.realpath(checkout), name = 'Nota.md';
  await git(root, 'init', '-b', 'main');
  for (const [key, value] of [['user.name', 'Scriba Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null']]) await git(root, 'config', key, value);
  await fs.writeFile(path.join(root, name), '# Nota inicial'); await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Initial');
  await git(directory, 'init', '--bare', '-b', 'main', remote); await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
  await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { autoSave: false, askCommitNote: false, intervalMinutes: 1 } }));
  await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: [name], welcomeImageVersion: 1, diagramManualVersion: 1 } }));
  const runtime = path.join(directory, 'runtime.json'); server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
  let origin; for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } } assert.ok(origin);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }), errors = []; page.on('pageerror', error => errors.push(error.message)); await page.goto(origin);
  const editor = page.locator('.cm-content'), confirmation = page.getByRole('dialog', { name: 'Salvar antes de criar uma nova nota?', exact: true });
  async function edit(value) { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('button', { name: 'Fonte', exact: true }).click(); await editor.fill(value); }
  async function saveAndCreate() { await page.keyboard.press('Meta+Shift+Enter'); await confirmation.getByRole('button', { name: 'Salvar e criar', exact: true }).click(); }
  await edit('# Salvar antes da nova nota'); await saveAndCreate(); await expect.poll(() => git(remote, 'show', `main:${name}`)).toBe('# Salvar antes da nova nota'); await expect(editor).toHaveText(''); await expect(editor).toBeFocused();
  // A successful disk write with a failed push must keep the document open and its synchronization pending.
  await edit('# Envio pendente mantém a nota'); await git(root, 'remote', 'set-url', 'origin', path.join(directory, 'missing.git')); await saveAndCreate();
  await expect(page.getByRole('alert')).toContainText('Push pendente'); await expect(editor).toHaveText('# Envio pendente mantém a nota'); assert.equal(await fs.readFile(path.join(root, name), 'utf8'), '# Envio pendente mantém a nota');
  assert.equal(await git(remote, 'show', `main:${name}`), '# Salvar antes da nova nota');
  await git(root, 'remote', 'set-url', 'origin', remote); await saveAndCreate(); await expect.poll(() => git(remote, 'show', `main:${name}`)).toBe('# Envio pendente mantém a nota'); await expect(editor).toHaveText('');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click(); await page.getByLabel('Perguntar nota do commit a cada salvamento').check(); await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click(); await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await edit('# Cancelar mensagem não cria outra nota'); await saveAndCreate(); const message = page.getByRole('dialog', { name: 'Nota do commit', exact: true });
  await message.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(editor).toHaveText('# Cancelar mensagem não cria outra nota');
  await page.keyboard.press('Meta+s'); await message.getByLabel('Nota do commit').fill('Ordinary save'); await message.getByRole('button', { name: 'Salvar, commit e push', exact: true }).click();
  await expect.poll(() => git(remote, 'show', `main:${name}`)).toBe('# Cancelar mensagem não cria outra nota'); await expect(editor).toHaveText('# Cancelar mensagem não cria outra nota');
  await editor.fill('# Criar após mensagem confirmada'); await saveAndCreate(); await message.getByLabel('Nota do commit').fill('Save and create'); await message.getByRole('button', { name: 'Salvar, sincronizar e criar', exact: true }).click();
  await expect.poll(() => git(remote, 'show', `main:${name}`)).toBe('# Criar após mensagem confirmada'); await expect(editor).toHaveText(''); await expect(editor).toBeFocused();
  // Optimistic concurrency still wins over the request to create another note.
  await edit('# Rascunho com conflito'); await fs.writeFile(path.join(root, name), '# Versão externa preservada'); await saveAndCreate(); await message.getByLabel('Nota do commit').fill('Conflict'); await message.getByRole('button', { name: 'Salvar, sincronizar e criar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Resolver versões do arquivo', exact: true })).toBeVisible(); await expect(editor).toHaveText('# Rascunho com conflito'); assert.equal(await fs.readFile(path.join(root, name), 'utf8'), '# Versão externa preservada');
  assert.deepEqual(errors, []); console.log('PASS: save/commit/push before new note, failed push retains the document, pending-sync retry, commit-message cancel/reset/success, focused blank note and external-file conflict protection.');
} finally { await browser?.close(); if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); } await fs.rm(directory, { recursive: true, force: true }); }
