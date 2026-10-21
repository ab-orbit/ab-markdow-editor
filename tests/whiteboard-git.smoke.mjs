import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

// Exercise the real local save/commit/push path with an isolated checkout and bare remote.
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-whiteboard-git-'));
const exec = promisify(execFile), git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout;
let server, browser;
try {
  const state = path.join(directory, 'state'), checkout = path.join(directory, 'notes'), remote = path.join(directory, 'remote.git');
  await fs.mkdir(state); await fs.mkdir(checkout);
  const root = await fs.realpath(checkout), name = 'Plano.md';
  const prefix = '\uFEFF# Plano compartilhado\r\n\r\nTexto com **formatação preservada**.\r\n';
  await git(root, 'init', '-b', 'main');
  for (const [key, value] of [['user.name', 'Scriba Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null'], ['core.autocrlf', 'false']]) await git(root, 'config', key, value);
  await fs.writeFile(path.join(root, name), prefix); await git(root, 'add', '.'); await git(root, 'commit', '-m', 'Initial note');
  await git(directory, 'init', '--bare', '-b', 'main', remote); await git(root, 'remote', 'add', 'origin', remote); await git(root, 'push', '-u', 'origin', 'main');
  await fs.writeFile(path.join(state, 'settings.json'), JSON.stringify({ repository: root, preferences: { autoSave: false, askCommitNote: false, intervalMinutes: 1 } }));
  await fs.writeFile(path.join(state, 'library.json'), JSON.stringify({ [root]: { pinned: [name], welcomeImageVersion: 1, diagramManualVersion: 1 } }));
  const runtime = path.join(directory, 'runtime.json');
  server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: state, MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
  let origin;
  for (let attempt = 0; attempt < 100; attempt++) { try { origin = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  assert.ok(origin);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({locale:'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin); await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Plano compartilhado');
  await page.getByRole('group', { name: 'Formato do documento', exact: true }).getByRole('button', { name: 'Whiteboard', exact: true }).click();
  const board = page.getByRole('region', { name: 'Whiteboard Excalidraw', exact: true });
  await expect(board).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 30000 });
  async function writeText(text, vertical) {
    await board.getByRole('radio', { name: 'Texto', exact: true }).locator('..').click();
    const bounds = await board.locator('canvas.interactive').boundingBox();
    await page.mouse.click(bounds.x + bounds.width * .6, bounds.y + bounds.height * vertical);
    await board.locator('textarea.excalidraw-wysiwyg').fill(text);
  }
  await writeText('Quadro enviado ao Git', .55); await page.keyboard.press('Meta+s');
  await expect.poll(() => git(remote, 'show', `main:${name}`)).toContain('Quadro enviado ao Git');
  const saved = await fs.readFile(path.join(root, name), 'utf8');
  assert.ok(saved.startsWith(prefix)); assert.equal(await git(remote, 'show', `main:${name}`), saved);
  await writeText('Texto salvo ao fechar', .8); await page.keyboard.press('Meta+w');
  const confirmation = page.getByRole('dialog', { name: 'Salvar antes de fechar?', exact: true });
  await expect(confirmation).toBeVisible(); await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(board).toBeVisible();
  await board.locator('canvas.interactive').focus(); await page.keyboard.press('Meta+w');
  await confirmation.getByRole('button', { name: 'Salvar e fechar', exact: true }).click();
  await expect.poll(() => git(remote, 'show', `main:${name}`)).toContain('Texto salvo ao fechar');
  await expect(board).toBeHidden();
  assert.ok((await fs.readFile(path.join(root, name), 'utf8')).startsWith(prefix));
  assert.equal((await git(root, 'status', '--porcelain')).trim(), '');
  assert.equal((await git(root, 'rev-parse', 'HEAD')).trim(), (await git(remote, 'rev-parse', 'main')).trim());
  assert.deepEqual(errors, []);
  console.log('PASS: full-workspace drawing, active-text Cmd+S, actual Git commit/push, Cmd+W confirmation/cancel/save, exact prose preservation and clean synchronized history.');
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  await fs.rm(directory, { recursive: true, force: true });
}
