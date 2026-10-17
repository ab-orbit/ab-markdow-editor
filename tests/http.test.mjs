import http from 'node:http';
import https from 'node:https';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
let temporary, checkout, remote, server, base, token;
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
async function request(route, body, extra = {}) {
  const response = await fetch(`${base}/api/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ab-markdown-http-'));
  checkout = path.join(temporary, 'checkout with spaces'); remote = path.join(temporary, 'remote.git');
  await fs.mkdir(checkout); await fs.mkdir(remote);
  await git(remote, 'init', '--bare', '-b', 'main'); await git(checkout, 'init', '-b', 'main');
  await git(checkout, 'config', 'user.name', 'Markdown Test'); await git(checkout, 'config', 'user.email', 'test@example.invalid');
  await git(checkout, 'config', 'commit.gpgsign', 'false'); await git(checkout, 'config', 'core.hooksPath', '/dev/null');
  await fs.writeFile(path.join(checkout, 'README.md'), '# Initial\n'); await git(checkout, 'add', 'README.md'); await git(checkout, 'commit', '-m', 'Initial');
  await git(checkout, 'remote', 'add', 'origin', remote); await git(checkout, 'push', '-u', 'origin', 'main');
  const runtime = path.join(temporary, 'runtime.json');
  server = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', GIT_SSL_CAINFO: path.join(temporary, 'cert.pem'), MARKDOWN_STATE_DIR: path.join(temporary, 'state'), MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
  for (let i = 0; i < 100; i++) {
    try { base = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.ok(base, 'server started');
  const html = await (await fetch(base)).text(); token = html.match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];
});
after(async () => { server?.kill(); if (server) await new Promise(resolve => server.once('exit', resolve)); await fs.rm(temporary, { recursive: true, force: true }); });

test('HTTP API rejects missing capability, foreign origin and DNS rebinding host', async () => {
  assert.equal((await fetch(`${base}/api/repository`)).status, 403);
  assert.equal((await request('repository', undefined, { Origin: 'https://example.invalid' })).status, 403);
  const status = await new Promise((resolve, reject) => { const req = http.get(`${base}/health`, { headers: { Host: 'evil.invalid' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
  assert.equal(status, 403);
});
test('connects a real checkout and lists Markdown over HTTP', async () => {
  const result = await request('connect', { directory: checkout }); assert.equal(result.status, 200); assert.equal(result.body.repository, await fs.realpath(checkout));
  assert.deepEqual((await request('files')).body, ['README.md']);
});
test('saves and reopens nested Markdown and raster assets', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII=';
  const result = await request('save', { name: 'notes/test.md', value: '# Saved\n\n![pixel](assets/pixel.png)\n', version: null, files: [{ path: 'assets/pixel.png', data: png }] });
  assert.equal(result.status, 200);
  const opened = await request('document?name=notes%2Ftest.md'); assert.equal(opened.body.version, result.body.version); assert.equal(opened.body.files[0].data, png);
  assert.match(opened.body.value, /# Saved/);
});
test('refuses overwrite when destination already exists or was changed externally', async () => {
  assert.equal((await request('save', { name: 'README.md', value: 'overwrite', version: null })).status, 409);
  const old = await request('document?name=README.md'); await fs.writeFile(path.join(checkout, 'README.md'), '# External change');
  const conflict = await request('save', { name: 'README.md', value: 'lost update', version: old.body.version }); assert.equal(conflict.status, 409); assert.equal(conflict.body.conflict.kind, 'modified');
  assert.equal(await fs.readFile(path.join(checkout, 'README.md'), 'utf8'), '# External change');
});
test('rejects traversal, Git metadata, invalid images and symlinks', async () => {
  for (const name of ['../outside.md', '.git/config.md', 'notes/../../outside.md', 'notes\\outside.md']) assert.equal((await request('save', { name, value: 'unsafe', version: null })).status, 400, name);
  await fs.symlink(temporary, path.join(checkout, 'link'));
  assert.equal((await request('save', { name: 'link/outside.md', value: 'unsafe', version: null })).status, 400);
  assert.equal((await request('save', { name: 'bad.md', value: 'bad', version: null, files: [{ path: 'assets/bad.png', data: Buffer.from('not an image').toString('base64') }] })).status, 400);
  await assert.rejects(fs.access(path.join(checkout, 'bad.md')));
});
test('serializes concurrent saves and reports a conflict instead of losing an edit', async () => {
  const body = { name: 'race.md', value: '# First', version: null };
  const results = await Promise.all([request('save', body), request('save', { ...body, value: '# Second' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test('commits only document and assets, pushes to real bare remote', async () => {
  const result = await request('commit', { name: 'notes/test.md', message: 'Save document', assets: ['assets/pixel.png'] }); assert.equal(result.status, 200, result.body.error);
  assert.deepEqual((await git(checkout, 'show', '--pretty=', '--name-only', 'HEAD')).split('\n').sort(), ['notes/assets/pixel.png', 'notes/test.md']);
  const pushed = await request('push', {}); assert.equal(pushed.status, 200, pushed.body.error);
  assert.equal(await git(checkout, 'rev-parse', 'HEAD'), await git(remote, 'rev-parse', 'main'));
  assert.equal(await git(remote, 'show', 'main:notes/test.md'), '# Saved\n\n![pixel](assets/pixel.png)');
});
test('refuses a commit when unrelated changes are already staged', async () => {
  await git(checkout, 'add', 'README.md');
  const result = await request('commit', { name: 'notes/test.md', message: 'Do not mix changes' }); assert.equal(result.status, 400); assert.match(result.body.error, /preparadas/);
  assert.equal(await git(checkout, 'diff', '--cached', '--name-only'), 'README.md');
});
test('rejects embedded HTTPS credentials before attempting a network clone', async () => {
  const result = await request('clone', { url: 'https://secret@example.invalid/repository.git', destination: path.join(temporary, 'clone') }); assert.equal(result.status, 400); assert.match(result.body.error, /credenciais locais/);
});

test('clones a repository through real HTTPS using existing local Git trust settings', async () => {
  const key = path.join(temporary, 'key.pem'); const cert = path.join(temporary, 'cert.pem');
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert]);
  await git(remote, 'update-server-info');
  const transport = https.createServer({ key: await fs.readFile(key), cert: await fs.readFile(cert) }, async (req, res) => {
    try {
      const relative = new URL(req.url, 'https://127.0.0.1').pathname.replace(/^\/remote.git\//, '');
      const filename = path.resolve(remote, relative);
      if (!filename.startsWith(remote + path.sep)) { res.writeHead(404).end(); return; }
      const bytes = await fs.readFile(filename); res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => transport.listen(0, '127.0.0.1', resolve));
  try {
    const destination = path.join(temporary, 'cloned checkout');
    const result = await request('clone', { url: `https://127.0.0.1:${transport.address().port}/remote.git`, destination });
    assert.equal(result.status, 200, result.body.error);
    assert.equal(result.body.repository, await fs.realpath(destination));
    assert.match(await fs.readFile(path.join(destination, 'notes/test.md'), 'utf8'), /# Saved/);
  } finally { await new Promise(resolve => transport.close(resolve)); }
});

test('save-sync saves, commits and pushes only the current document', async () => {
  await git(checkout, 'reset', '--quiet');
  await request('connect', { directory: checkout });
  const result = await request('save-sync', { name: 'sync/manual.md', value: '# Automatic commit\n', version: null, message: 'Research update' });
  assert.equal(result.status, 200, result.body.error); assert.equal(result.body.synced, true); assert.equal(result.body.committed, true);
  assert.equal(await git(remote, 'show', 'main:sync/manual.md'), '# Automatic commit');
  assert.equal(await git(checkout, 'log', '-1', '--pretty=%s'), 'Research update');
  assert.equal(await git(checkout, 'show', '--pretty=', '--name-only', 'HEAD'), 'sync/manual.md');
});

test('unchanged saves do not create empty commits', async () => {
  const previous = await request('document?name=sync%2Fmanual.md');
  const head = await git(checkout, 'rev-parse', 'HEAD');
  const result = await request('save-sync', { name: 'sync/manual.md', value: previous.body.value, version: previous.body.version });
  assert.equal(result.body.synced, true, result.body.error); assert.equal(result.body.committed, false);
  assert.equal(await git(checkout, 'rev-parse', 'HEAD'), head);
});

test('a failed push preserves the saved version and retries without another commit', async () => {
  await git(checkout, 'remote', 'set-url', 'origin', path.join(temporary, 'missing-remote.git'));
  const pending = await request('save-sync', { name: 'sync/offline.md', value: '# Kept locally', version: null });
  assert.equal(pending.body.synced, false); assert.equal(pending.body.stage, 'push'); assert.equal(pending.body.committed, true);
  assert.equal((await request('document?name=sync%2Foffline.md')).body.version, pending.body.version);
  const head = await git(checkout, 'rev-parse', 'HEAD');
  await git(checkout, 'remote', 'set-url', 'origin', remote);
  const retried = await request('save-sync', { name: 'sync/offline.md', value: '# Kept locally', version: pending.body.version });
  assert.equal(retried.body.synced, true, retried.body.error); assert.equal(retried.body.committed, false);
  assert.equal(await git(checkout, 'rev-parse', 'HEAD'), head); assert.equal(await git(remote, 'rev-parse', 'main'), head);
});

test('a failed commit releases its stage so saving can be retried', async () => {
  const hooks = path.join(temporary, 'hooks'); await fs.mkdir(hooks);
  await fs.writeFile(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  await git(checkout, 'config', 'core.hooksPath', hooks);
  const pending = await request('save-sync', { name: 'sync/hook.md', value: '# Hook failure', version: null });
  assert.equal(pending.body.synced, false); assert.equal(pending.body.stage, 'commit');
  assert.equal(await git(checkout, 'diff', '--cached', '--name-only'), '');
  await git(checkout, 'config', 'core.hooksPath', '/dev/null');
  const retried = await request('save-sync', { name: 'sync/hook.md', value: '# Hook failure', version: pending.body.version });
  assert.equal(retried.body.synced, true, retried.body.error);
});

test('first automatic push configures origin upstream for a new branch', async () => {
  await git(checkout, 'checkout', '-b', 'autosave-branch');
  const result = await request('save-sync', { name: 'sync/branch.md', value: '# New branch', version: null });
  assert.equal(result.body.synced, true, result.body.error);
  assert.equal(await git(checkout, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'), 'origin/autosave-branch');
  assert.equal(await git(remote, 'show', 'autosave-branch:sync/branch.md'), '# New branch');
  await git(checkout, 'checkout', 'main');
});

test('save preferences validate the interval, survive reconnect and a fresh server process', async () => {
  assert.deepEqual((await request('preferences')).body, { askCommitNote: false, autoSave: false, intervalMinutes: 1 });
  const preferences = { askCommitNote: true, autoSave: true, intervalMinutes: 2 };
  assert.equal((await request('preferences', { ...preferences, intervalMinutes: 0 })).status, 400);
  assert.equal((await request('preferences', { ...preferences, intervalMinutes: 1.5 })).status, 400);
  assert.equal((await request('preferences', preferences)).status, 200);
  await request('connect', { directory: checkout }); assert.deepEqual((await request('preferences')).body, preferences);
  const runtime = path.join(temporary, 'second-runtime.json');
  const second = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', MARKDOWN_STATE_DIR: path.join(temporary, 'state'), MARKDOWN_RUNTIME_FILE: runtime }, stdio: 'pipe' });
  try {
    let address;
    for (let i = 0; i < 100; i++) { try { address = JSON.parse(await fs.readFile(runtime, 'utf8')).url; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
    assert.ok(address);
    const html = await (await fetch(address)).text(); const capability = html.match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];
    const response = await fetch(`${address}/api/preferences`, { headers: { Authorization: `Bearer ${capability}` } });
    assert.deepEqual(await response.json(), preferences);
  } finally { second.kill(); await new Promise(resolve => second.once('exit', resolve)); }
});

test('an imported original hash binds edits to an existing file without a blind overwrite', async () => {
  const original = '# Imported original\n';
  await fs.writeFile(path.join(checkout, 'imported.md'), original);
  const opened = await request('document?name=imported.md');
  const saved = await request('save-sync', {name:'imported.md',value:'# Imported and edited\n',version:null,baseVersion:opened.body.version});
  assert.equal(saved.body.synced,true,saved.body.error);
  assert.equal(await git(remote,'show','main:imported.md'),'# Imported and edited');
  const stale = await request('save-sync',{name:'imported.md',value:'stale imported edit',version:null,baseVersion:opened.body.version});
  assert.equal(stale.status,409); assert.equal(stale.body.code,'DOCUMENT_CONFLICT'); assert.equal(stale.body.conflict.kind,'exists');
  assert.equal(await fs.readFile(path.join(checkout,'imported.md'),'utf8'),'# Imported and edited\n');
});

test('a repeated identical save is safe even if the browser lost the preceding response', async () => {
  const document = await request('document?name=imported.md');
  const head = await git(checkout,'rev-parse','HEAD');
  const repeated = await request('save-sync',{name:'imported.md',value:document.body.value,version:null});
  assert.equal(repeated.body.synced,true,repeated.body.error); assert.equal(repeated.body.committed,false);
  assert.equal(await git(checkout,'rev-parse','HEAD'),head);
});

test('explicit conflict replacement rechecks the revision and backs up the displaced file', async () => {
  await fs.writeFile(path.join(checkout,'external.md'),'# External A');
  const conflict = await request('save-sync',{name:'external.md',value:'# Browser draft',version:null});
  assert.equal(conflict.status,409);
  await fs.writeFile(path.join(checkout,'external.md'),'# External B');
  const staleConfirmation = await request('save-sync',{name:'external.md',value:'# Browser draft',version:conflict.body.conflict.currentVersion,backupBeforeReplace:true});
  assert.equal(staleConfirmation.status,409); assert.equal(await fs.readFile(path.join(checkout,'external.md'),'utf8'),'# External B');
  const resolved = await request('save-sync',{name:'external.md',value:'# Browser draft',version:staleConfirmation.body.conflict.currentVersion,backupBeforeReplace:true});
  assert.equal(resolved.body.synced,true,resolved.body.error);
  const directory=path.join(temporary,'state','conflict-backups');
  const names=await fs.readdir(directory);
  assert.equal(names.length,1); assert.equal(await fs.readFile(path.join(directory,names[0]),'utf8'),'# External B');
  assert.equal(await git(remote,'show','main:external.md'),'# Browser draft');
});

test('an existing untracked document can be opened and saved in a repository with no commits', async () => {
  const fresh = path.join(temporary,'unborn'); const bare = path.join(temporary,'unborn-remote.git');
  await fs.mkdir(fresh); await fs.mkdir(bare); await git(fresh,'init','-b','main'); await git(bare,'init','--bare','-b','main');
  await git(fresh,'config','user.name','Fresh Repo'); await git(fresh,'config','user.email','fresh@example.invalid'); await git(fresh,'config','commit.gpgsign','false'); await git(fresh,'config','core.hooksPath','/dev/null'); await git(fresh,'remote','add','origin',bare);
  await fs.writeFile(path.join(fresh,'existing.md'),'# Existing without history\n');
  await request('connect',{directory:fresh});
  const opened=await request('document?name=existing.md');
  const saved=await request('save-sync',{name:'existing.md',value:'# Edited after opening\n',version:opened.body.version});
  assert.equal(saved.body.synced,true,saved.body.error); assert.equal(await git(bare,'show','main:existing.md'),'# Edited after opening');
});

test('offline shell reacquires a capability only through a same-origin custom-header request', async () => {
  assert.equal((await fetch(`${base}/api/session`)).status, 403);
  assert.equal((await fetch(`${base}/api/session`, {headers:{'X-AB-Markdown-Client':'1', Origin:'https://example.invalid'}})).status,403);
  assert.equal((await fetch(`${base}/api/session`, {headers:{'X-AB-Markdown-Client':'1','Sec-Fetch-Site':'cross-site'}})).status,403);
  const response=await fetch(`${base}/api/session`,{headers:{'X-AB-Markdown-Client':'1'}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).token,token);
});
test('PWA assets have correct types and the offline shell contains no capability', async () => {
  const manifest=await fetch(`${base}/manifest.webmanifest`);assert.match(manifest.headers.get('content-type'),/application\/manifest\+json/);assert.equal((await manifest.json()).display,'standalone');
  const worker=await fetch(`${base}/sw.js`);assert.equal(worker.headers.get('service-worker-allowed'),'/');assert.equal(worker.headers.get('cache-control'),'no-cache');
  assert.doesNotMatch(await(await fetch(`${base}/app-shell.html`)).text(),/window\.__MARKDOWN_TOKEN__=/);
  assert.match((await fetch(`${base}/favicon.ico`)).headers.get('content-type'),/image\/x-icon/);
});
test('an offline draft cannot save into a different configured checkout', async () => {
  const result=await request('save-sync',{repository:path.join(temporary,'other'),name:'wrong-checkout.md',value:'# Preserve',version:null});
  assert.equal(result.status,400);assert.match(result.body.error,/repositório mudou/);await assert.rejects(fs.access(path.join(checkout,'wrong-checkout.md')));
});
