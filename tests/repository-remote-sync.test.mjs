import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();

/** Exercise the real HTTP service against two private, disposable Git checkouts. */
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-remote-http-'));
  let server;
  t.after(async () => {
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill(); await exited;
    }
    await fs.rm(directory, {recursive:true, force:true});
  });
  const remote = path.join(directory, 'remote.git');
  const checkout = path.join(directory, 'checkout');
  const other = path.join(directory, 'other');
  await fs.mkdir(remote); await fs.mkdir(checkout);
  await git(remote, 'init', '--bare', '-b', 'main');
  await git(checkout, 'init', '-b', 'main');
  async function configure(cwd) {
    for (const [key, value] of [['user.name','Scriba Test'], ['user.email','test@example.invalid'], ['commit.gpgsign','false'], ['core.hooksPath','/dev/null']]) await git(cwd, 'config', key, value);
  }
  await configure(checkout);
  await fs.writeFile(path.join(checkout, 'README.md'), '# Original\n');
  await git(checkout, 'add', '.'); await git(checkout, 'commit', '-m', 'Initial');
  await git(checkout, 'remote', 'add', 'origin', remote);
  await git(checkout, 'push', '-u', 'origin', 'main');
  await git(directory, 'clone', remote, other); await configure(other);
  async function remoteChange(name, value, publish = true) {
    await fs.writeFile(path.join(other, name), value);
    await git(other, 'add', '--', name); await git(other, 'commit', '-m', 'Edit from another device');
    if (publish) await git(other, 'push');
    return git(other, 'rev-parse', 'HEAD');
  }
  const runtime = path.join(directory, 'runtime.json');
  server = spawn(process.execPath, ['server/index.mjs'], {cwd:new URL('..', import.meta.url), env:{...process.env, PORT:'0', MARKDOWN_STATE_DIR:path.join(directory,'state'), MARKDOWN_RUNTIME_FILE:runtime}, stdio:'ignore'});
  let base;
  for (let index = 0; index < 100; index++) {
    try { base = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.ok(base, 'HTTP service started');
  const token = (await (await fetch(base)).text()).match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];
  async function post(endpoint, body) {
    const response = await fetch(`${base}${endpoint}`, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
    return {status:response.status, body:await response.json()};
  }
  const connected = await post('/api/connect', {directory:checkout});
  assert.equal(connected.status, 200);
  const root = connected.body.repository;
  return {directory, remote, checkout:root, other, remoteChange, post, sync:() => post('/api/sync', {repository:root})};
}

test('sync downloads a remote-only update without creating a commit', async t => {
  const f = await fixture(t);
  const remoteHead = await f.remoteChange('phone.md', '# Written on the phone\n');
  const result = await f.sync();
  assert.equal(result.body.synced, true, result.body.error);
  assert.equal(result.body.committed, false);
  assert.equal(await git(f.checkout, 'rev-parse', 'HEAD'), remoteHead);
  assert.equal(await fs.readFile(path.join(f.checkout, 'phone.md'), 'utf8'), '# Written on the phone\n');
});

test('conflicting note edits stop synchronization without changing either version or leaving a merge active', async t => {
  const f = await fixture(t);
  const remoteHead = await f.remoteChange('README.md', '# Phone version\n');
  await fs.writeFile(path.join(f.checkout, 'README.md'), '# Mac version\n');
  const result = await f.sync();
  assert.equal(result.body.synced, false);
  assert.equal(result.body.committed, true);
  assert.match(result.body.error, /conflito/i);
  assert.match(result.body.error, /README\.md/);
  assert.equal(await fs.readFile(path.join(f.checkout, 'README.md'), 'utf8'), '# Mac version\n');
  assert.equal(await git(f.remote, 'rev-parse', 'main'), remoteHead);
  assert.equal(await git(f.remote, 'show', 'main:README.md'), '# Phone version');
  assert.equal(await git(f.checkout, 'status', '--porcelain'), '');
  await assert.rejects(git(f.checkout, 'rev-parse', '--verify', 'MERGE_HEAD'));
});

test('saving one note preserves unrelated uncommitted work when remote changes need integration', async t => {
  const f = await fixture(t);
  const remoteHead = await f.remoteChange('phone.md', '# Phone note\n');
  await fs.writeFile(path.join(f.checkout, 'README.md'), '# Uncommitted external edit\n');
  const result = await f.post('/api/save-sync', {repository:f.checkout, name:'saved.md', value:'# Saved safely\n', version:null});
  assert.equal(result.status, 200);
  assert.equal(result.body.synced, false);
  assert.equal(result.body.committed, true);
  assert.match(result.body.error, /alteraç|sincronizar/i);
  assert.equal(await fs.readFile(path.join(f.checkout, 'README.md'), 'utf8'), '# Uncommitted external edit\n');
  assert.equal(await git(f.checkout, 'show', 'HEAD:saved.md'), '# Saved safely');
  assert.equal(await git(f.remote, 'rev-parse', 'main'), remoteHead);
  assert.equal(await git(f.checkout, 'diff', '--cached', '--name-only'), '');
  assert.equal(await git(f.checkout, 'stash', 'list'), '');
});

test('sync leaves a user-started merge untouched even when its index is clean', async t => {
  const f = await fixture(t);
  const remoteHead = await f.remoteChange('phone.md', '# Phone note\n');
  await git(f.checkout, 'switch', '-c', 'feature');
  await git(f.checkout, 'commit', '--allow-empty', '-m', 'Existing local feature');
  const featureHead = await git(f.checkout, 'rev-parse', 'HEAD');
  await git(f.checkout, 'switch', 'main');
  await git(f.checkout, 'merge', '--no-commit', '--no-ff', 'feature');
  assert.equal(await git(f.checkout, 'status', '--porcelain'), '');
  const result = await f.sync();
  assert.equal(result.body.synced, false);
  assert.match(result.body.error, /integração|andamento/i);
  assert.equal(await git(f.checkout, 'rev-parse', 'MERGE_HEAD'), featureHead);
  assert.equal(await git(f.remote, 'rev-parse', 'main'), remoteHead);
});

test('a remote advance during push is integrated once while retaining both commits', async t => {
  const f = await fixture(t);
  const remoteHead = await f.remoteChange('phone.md', '# Concurrent phone note\n', false);
  const hooks = path.join(f.directory, 'hooks'); await fs.mkdir(hooks);
  const marker = path.join(f.directory, 'pushed-once');
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  await fs.writeFile(path.join(hooks, 'pre-push'), `#!/bin/sh\nif [ ! -f ${quote(marker)} ]; then\n  touch ${quote(marker)}\n  git -C ${quote(f.other)} push origin main || exit 1\nfi\n`, {mode:0o755});
  await git(f.checkout, 'config', 'core.hooksPath', hooks);
  await fs.writeFile(path.join(f.checkout, 'mac.md'), '# Concurrent Mac note\n');
  const result = await f.sync();
  assert.equal(result.body.synced, true, result.body.error);
  const head = await git(f.checkout, 'rev-parse', 'HEAD');
  assert.equal(await git(f.remote, 'rev-parse', 'main'), head);
  await git(f.checkout, 'merge-base', '--is-ancestor', remoteHead, head);
  assert.equal(await git(f.remote, 'show', 'main:mac.md'), '# Concurrent Mac note');
  assert.equal(await git(f.checkout, 'show', 'HEAD:phone.md'), '# Concurrent phone note');
});

test('first synchronization can merge an existing remote before establishing its upstream', async t => {
  const f = await fixture(t);
  await git(f.checkout, 'branch', '--unset-upstream');
  await f.remoteChange('phone.md', '# Phone note\n');
  await fs.writeFile(path.join(f.checkout, 'mac.md'), '# Mac note\n');
  const result = await f.sync();
  assert.equal(result.body.synced, true, result.body.error);
  assert.equal(await git(f.checkout, 'rev-parse', '--abbrev-ref', '@{upstream}'), 'origin/main');
  assert.equal(await git(f.remote, 'show', 'main:mac.md'), '# Mac note');
  assert.equal(await fs.readFile(path.join(f.checkout, 'phone.md'), 'utf8'), '# Phone note\n');
});
