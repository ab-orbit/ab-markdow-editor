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
  assert.deepEqual((await request('preferences')).body, { askCommitNote: false, autoSave: false, intervalMinutes: 1, doubleClickToEdit: true });
  const preferences = { askCommitNote: true, autoSave: true, intervalMinutes: 2, doubleClickToEdit: false };
  assert.equal((await request('preferences', { ...preferences, intervalMinutes: 0 })).status, 400);
  assert.equal((await request('preferences', { ...preferences, intervalMinutes: 1.5 })).status, 400);
  assert.equal((await request('preferences', preferences)).status, 200);
  assert.equal((await request('preferences', {...preferences,doubleClickToEdit:'yes'})).status,400);
  assert.equal((await request('preferences',{askCommitNote:true,autoSave:true,intervalMinutes:2})).body.doubleClickToEdit,false,'older clients retain the editing preference');
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

test('recent notes returns the latest 100 safe existing Markdown paths by file modification time', async () => {
  await request('connect', {directory:checkout});
  const folder=path.join(checkout,'recent-test');await fs.mkdir(folder);
  try {
    for(let i=0;i<105;i++) {const filename=path.join(folder,`note-${String(i).padStart(3,'0')}.md`);await fs.writeFile(filename,`# ${i}`);const time=new Date(Date.now()+100000+i*1000);await fs.utimes(filename,time,time);}
    await fs.symlink(path.join(folder,'note-104.md'),path.join(folder,'unsafe.md'));
    const response=await request('recent');assert.equal(response.status,200);assert.equal(response.body.length,100);
    assert.equal(response.body[0].name,'recent-test/note-104.md');assert.equal(response.body[0].title,'104');assert.equal(response.body[99].name,'recent-test/note-005.md');
    assert.ok(response.body.every(note=>Number.isFinite(Date.parse(note.modifiedAt))));
  } finally {await fs.rm(folder,{recursive:true,force:true});}
});

test('guide is seeded once, committed and pushed; pins persist per checkout without changing Git', async () => {
  const repo=path.join(temporary,'library-repo'),upstream=path.join(temporary,'library-remote.git');await fs.mkdir(repo);await fs.mkdir(upstream);
  await git(repo,'init','-b','main');await git(upstream,'init','--bare','-b','main');
  for(const [key,value] of [['user.name','Library Test'],['user.email','library@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(repo,'config',key,value);
  await fs.writeFile(path.join(repo,'note.md'),'# Minha nota\n\nConteúdo');await git(repo,'add','.');await git(repo,'commit','-m','Initial');await git(repo,'remote','add','origin',upstream);
  await request('connect',{directory:repo});
  const initialized=await request('library/initialize',{});assert.equal(initialized.status,200);assert.equal(initialized.body.synchronization.synced,true);assert.equal(initialized.body.pinned[0].name,'AB-Markdown-Guia.md');assert.equal(initialized.body.pinned[1].name,'Scriba-Diagramas.md');assert.equal(await fs.readFile(path.join(repo,'Scriba-Diagramas.md'),'utf8'),await fs.readFile(new URL('../docs/Scriba-Diagramas.md',import.meta.url),'utf8'));assert.match(await git(upstream,'show','main:Scriba-Diagramas.md'),/Manual contextual de diagramas/);
  const thumbnail=await request('thumbnail?name=AB-Markdown-Guia.md');assert.equal(thumbnail.status,200);assert.equal(thumbnail.body.mime,'image/jpeg');assert.ok(Buffer.from(thumbnail.body.data,'base64').length>1000);
  const diskImage=await fs.readFile(path.join(repo,'assets','escriba-welcome-v1.jpg'));assert.equal(thumbnail.body.data,diskImage.toString('base64'));
  assert.ok(await git(upstream,'cat-file','-s','main:assets/escriba-welcome-v1.jpg'));
  assert.equal((await request('library')).body.pinned[0].hasImage,true);
  const guide=await git(upstream,'show','main:AB-Markdown-Guia.md');assert.match(guide,/Google Drive/);assert.match(guide,/Temas/);assert.match(guide,/Aeon Bridge/);
  const head=await git(repo,'rev-parse','HEAD');assert.equal((await request('library/initialize',{})).body.synchronization,undefined);assert.equal(await git(repo,'rev-parse','HEAD'),head);
  assert.equal((await request('pin',{name:'note.md',pinned:true})).status,200);
  await request('connect',{directory:checkout});assert.equal((await request('library')).body.pinned.length,0);await request('connect',{directory:repo});
  const persisted=await request('library');assert.deepEqual(persisted.body.pinned.map(note=>note.name),['AB-Markdown-Guia.md','Scriba-Diagramas.md','note.md']);assert.equal(await git(repo,'rev-parse','HEAD'),head);
  await request('pin',{name:'note.md',pinned:false});assert.equal((await request('library')).body.pinned.length,2);
  assert.equal((await request('pin',{name:'../note.md',pinned:true})).status,400);
});


test('thumbnails never fetch remote images and reject traversal, SVG and symlinks', async () => {
  await request('connect',{directory:checkout});
  await fs.writeFile(path.join(checkout,'thumb.md'),'# Remote\n![image](https://example.invalid/secret.png)');assert.equal((await request('thumbnail?name=thumb.md')).body,null);
  await fs.writeFile(path.join(checkout,'thumb.md'),'# Traversal\n![image](../outside.png)');assert.equal((await request('thumbnail?name=thumb.md')).status,400);
  await fs.writeFile(path.join(checkout,'unsafe.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');await fs.writeFile(path.join(checkout,'thumb.md'),'![image](unsafe.svg)');assert.equal((await request('thumbnail?name=thumb.md')).status,400);
  await fs.symlink(path.join(checkout,'notes/assets/pixel.png'),path.join(checkout,'linked.png'));await fs.writeFile(path.join(checkout,'thumb.md'),'![image](linked.png)');assert.equal((await request('thumbnail?name=thumb.md')).status,400);
});

test('existing guides gain the welcome image once while preserving user edits', async () => {
  const repo=path.join(temporary,'old-guide'),upstream=path.join(temporary,'old-guide.git');await fs.mkdir(repo);await fs.mkdir(upstream);
  await git(repo,'init','-b','main');await git(upstream,'init','--bare','-b','main');
  for(const [key,value] of [['user.name','Guide Test'],['user.email','guide@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(repo,'config',key,value);
  const name='AB-Markdown-Guia.md';const text='# AB Markdown — Guia da plataforma\n\nMeu conteúdo editado deve permanecer.\n';
  await fs.writeFile(path.join(repo,name),text);await git(repo,'add','.');await git(repo,'commit','-m','Old guide');await git(repo,'remote','add','origin',upstream);
  const info=await request('connect',{directory:repo});const file=path.join(temporary,'state','library.json');const state=JSON.parse(await fs.readFile(file,'utf8'));state[info.body.repository]={pinned:[name]};await fs.writeFile(file,JSON.stringify(state));
  const migrated=await request('library/initialize',{});assert.equal(migrated.status,200);assert.equal(migrated.body.synchronization.synced,true);assert.equal(migrated.body.pinned[0].name,name);const updated=await fs.readFile(path.join(repo,name),'utf8');assert.match(updated,/Meu conteúdo editado deve permanecer/);assert.equal(updated.split('escriba-welcome-v1.jpg').length-1,1);
  const head=await git(repo,'rev-parse','HEAD');await request('library/initialize',{});assert.equal(await git(repo,'rev-parse','HEAD'),head);assert.match(await git(upstream,'show',`main:${name}`),/escriba-welcome-v1.jpg/);
});

test('Finder handoff reads only native inbox IDs and distinguishes imports from checkout documents', async () => {
  const directory = path.join(temporary, 'state', 'finder-inbox'); await fs.mkdir(directory, {recursive:true});
  const id = '12345678-1234-1234-1234-123456789abc';
  const info = (await request('repository')).body;
  await fs.writeFile(path.join(directory, `${id}.json`), JSON.stringify({filename:path.join(info.repository,'finder-note.md'),value:'# Finder selected',version:'test-version',files:[],warnings:[]}));
  const document = await request(`finder-document?id=${id}`);
  assert.equal(document.status,200);assert.equal(document.body.inRepository,true);assert.equal(document.body.name,'finder-note.md');assert.equal(document.body.value,'# Finder selected');assert.equal(document.body.filename,undefined);
  await fs.writeFile(path.join(directory, `${id}.json`), JSON.stringify({filename:path.join(temporary,'outside.md'),value:'# Imported',version:'outside-version',files:[],warnings:[]}));
  assert.equal((await request(`finder-document?id=${id}`)).body.inRepository,false);
  assert.equal((await request('finder-document?id=../../settings')).status,400);
  assert.equal((await fetch(`${base}/api/finder-document?id=${id}`)).status,403);
});

test('document revision probes detect external edits/deletions without changing Git or the file', async () => {
  await request('connect',{directory:checkout});
  const file=path.join(checkout,'reload.md');await fs.writeFile(file,'# Before');
  const initial=await request('document?name=reload.md'),head=await git(checkout,'rev-parse','HEAD');
  assert.deepEqual((await request('document-version?name=reload.md')).body,{version:initial.body.version});
  await fs.writeFile(file,'# Changed elsewhere');
  const revision=await request('document-version?name=reload.md');
  assert.equal(revision.status,200);assert.notEqual(revision.body.version,initial.body.version);
  assert.equal((await request('document?name=reload.md&fresh=1')).body.value,'# Changed elsewhere');
  assert.equal(await git(checkout,'rev-parse','HEAD'),head);assert.equal(await fs.readFile(file,'utf8'),'# Changed elsewhere');
  assert.equal((await request('document-version?name=reload.md&repository=wrong-checkout')).status,400);
  assert.equal((await request('document-version?name=../escape.md')).status,400);
  await fs.rm(file);assert.deepEqual((await request('document-version?name=reload.md')).body,{version:null});
});

test('Finder snapshots remain readable after deletion; explicit reload reads only the original outside the checkout', async () => {
  const directory=path.join(temporary,'finder-original'),inbox=path.join(temporary,'state','finder-inbox');
  await fs.mkdir(directory);await fs.mkdir(inbox,{recursive:true});
  const filename=path.join(directory,'outside.md'),id='ec186143-4722-433b-b508-a884c2360001';
  await fs.writeFile(filename,'# Original');
  await fs.writeFile(path.join(inbox,`${id}.json`),JSON.stringify({filename,value:'# Snapshot',version:'snapshot',files:[],warnings:[]}));
  await fs.writeFile(filename,'# New original');
  const fresh=await request(`finder-document?id=${id}&fresh=1`);
  assert.equal(fresh.body.value,'# New original');assert.equal(fresh.body.inRepository,false);
  assert.equal((await request(`finder-document-version?id=${id}`)).body.version,fresh.body.version);
  assert.equal(await fs.readFile(filename,'utf8'),'# New original');
  await fs.rm(directory,{recursive:true});
  assert.deepEqual((await request(`finder-document-version?id=${id}`)).body,{version:null});
  const cached=await request(`finder-document?id=${id}`);assert.equal(cached.status,200);assert.equal(cached.body.value,'# Snapshot');
});

/** Legacy checkouts model upgrades without re-running first-install guide setup. */
async function referenceCheckout(label, files, pins=[]) {
  const repo=path.join(temporary,label),upstream=path.join(temporary,`${label}.git`);
  await fs.mkdir(repo);await fs.mkdir(upstream);await git(repo,'init','-b','main');await git(upstream,'init','--bare','-b','main');
  for(const [key,value] of [['user.name','Reference Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(repo,'config',key,value);
  for(const [name,value] of Object.entries(files))await fs.writeFile(path.join(repo,name),value);
  await git(repo,'add','.');await git(repo,'commit','-m','Existing notes');await git(repo,'remote','add','origin',upstream);await git(repo,'push','-u','origin','main');
  const connected=await request('connect',{directory:repo});assert.equal(connected.status,200);
  const file=path.join(temporary,'state','library.json'),state=JSON.parse(await fs.readFile(file,'utf8'));state[connected.body.repository]={pinned:pins,welcomeImageVersion:1};await fs.writeFile(file,JSON.stringify(state));
  return {repo,upstream};
}
test('diagram reference upgrades existing checkouts without overwriting collisions or later user decisions',async()=>{
  const text='# Minha referência particular\n', {repo,upstream}=await referenceCheckout('reference-collision',{'Scriba-Diagramas.md':text,'User.md':'# Nota do usuário'},['User.md']);
  const first=await request('library/initialize',{});assert.equal(first.status,200);assert.equal(first.body.synchronization.synced,true);
  const name='Scriba-Diagramas-2.md';assert.deepEqual(first.body.pinned.map(note=>note.name),[name,'User.md']);
  assert.equal(await fs.readFile(path.join(repo,'Scriba-Diagramas.md'),'utf8'),text);
  const original=(await request(`document?name=${name}`)).body;const changed=original.value+'\nMinha anotação ao manual.\n';
  assert.equal((await request('save-sync',{name,value:changed,version:original.version,files:[],message:'Annotate reference'})).body.synced,true);
  await request('pin',{name,pinned:false});const head=await git(repo,'rev-parse','HEAD');
  await request('library/initialize',{});assert.equal(await git(repo,'rev-parse','HEAD'),head);assert.equal(await fs.readFile(path.join(repo,name),'utf8'),changed);assert.ok(!(await request('library')).body.pinned.some(note=>note.name===name));
  assert.equal(await git(upstream,'show',`main:${name}`),changed.trimEnd());
  await fs.rm(path.join(repo,name));await request('library/initialize',{});await assert.rejects(fs.access(path.join(repo,name)));assert.equal(await git(repo,'rev-parse','HEAD'),head);
});
test('already copied diagram references retain annotations and receive the ZenUML extension once',async()=>{
  const value='# Meu manual anotado\n\n<!-- scriba-reference:diagram-manual version=1 -->\n\nAlterações preservadas.\n';
  const {repo}=await referenceCheckout('reference-adopt',{'Scriba-Diagramas.md':value});const head=await git(repo,'rev-parse','HEAD');
  const result=await request('library/initialize',{});assert.equal(result.status,200);assert.equal(result.body.pinned[0].name,'Scriba-Diagramas.md');const extended=await fs.readFile(path.join(repo,'Scriba-Diagramas.md'),'utf8');assert.ok(extended.startsWith(value));assert.match(extended,/scriba-extension:zenuml-v1:start/);assert.notEqual(await git(repo,'rev-parse','HEAD'),head);const next=await git(repo,'rev-parse','HEAD');await request('library/initialize',{});assert.equal(await git(repo,'rev-parse','HEAD'),next);assert.equal(await fs.readFile(path.join(repo,'Scriba-Diagramas.md'),'utf8'),extended);
});
test('failed reference synchronization preserves the full file and seed marker for explicit retry',async()=>{
  const {repo}=await referenceCheckout('reference-pending',{'User.md':'# Existing'});
  await fs.writeFile(path.join(repo,'User.md'),'# Staged user work');await git(repo,'add','User.md');
  const result=await request('library/initialize',{});assert.equal(result.status,200);assert.equal(result.body.synchronization.synced,false);assert.equal(result.body.synchronization.stage,'commit');
  assert.equal(await git(repo,'diff','--cached','--name-only'),'User.md');
  const head=await git(repo,'rev-parse','HEAD');const value=await fs.readFile(path.join(repo,'Scriba-Diagramas.md'),'utf8');assert.match(value,/scriba-reference:diagram-manual/);
  await request('library/initialize',{});assert.equal(await git(repo,'rev-parse','HEAD'),head);assert.equal(await fs.readFile(path.join(repo,'Scriba-Diagramas.md'),'utf8'),value);await assert.rejects(fs.access(path.join(repo,'Scriba-Diagramas-2.md')));
});


test('ZenUML upgrade preserves CRLF annotations and unpinned state and respects later section deletion',async()=>{
  const name='Scriba-Diagramas.md',value='# Manual anotado\r\n\r\n<!-- scriba-reference:diagram-manual version=1 -->\r\n\r\nMinha revisão particular.\r\n';
  const {repo,upstream}=await referenceCheckout('zenuml-upgrade',{[name]:value,'User.md':'# Minha nota'},['User.md']);
  const file=path.join(temporary,'state','library.json'),state=JSON.parse(await fs.readFile(file,'utf8'));
  state[await fs.realpath(repo)]={pinned:['User.md'],welcomeImageVersion:1,diagramManualVersion:1,diagramManualName:name};await fs.writeFile(file,JSON.stringify(state));
  const result=await request('library/initialize',{});assert.equal(result.status,200);assert.equal(result.body.synchronization.synced,true);assert.deepEqual(result.body.pinned.map(item=>item.name),['User.md']);
  const extended=await fs.readFile(path.join(repo,name),'utf8');assert.ok(extended.startsWith(value));assert.ok(extended.includes('```zenuml\r\n'));assert.equal(extended.replace(/\r\n/g,'').includes('\n'),false);assert.equal((extended.match(/scriba-extension:zenuml-v1:start/g)||[]).length,1);
  assert.equal(await git(upstream,'show',`main:${name}`),extended.replace(/\r\n/g,'\n').trimEnd());
  const head=await git(repo,'rev-parse','HEAD');await fs.writeFile(path.join(repo,name),value);await request('library/initialize',{});assert.equal(await fs.readFile(path.join(repo,name),'utf8'),value);assert.equal(await git(repo,'rev-parse','HEAD'),head);
  await fs.rm(path.join(repo,name));await request('library/initialize',{});await assert.rejects(fs.access(path.join(repo,name)));
});

test('ZenUML upgrade never appends to a user replacement without the owned manual marker',async()=>{
  const name='Scriba-Diagramas.md',value='# Minha própria referência\n';const {repo}=await referenceCheckout('zenuml-replaced',{[name]:value});
  const file=path.join(temporary,'state','library.json'),state=JSON.parse(await fs.readFile(file,'utf8'));state[await fs.realpath(repo)]={pinned:[],welcomeImageVersion:1,diagramManualVersion:1,diagramManualName:name};await fs.writeFile(file,JSON.stringify(state));
  const head=await git(repo,'rev-parse','HEAD');await request('library/initialize',{});assert.equal(await fs.readFile(path.join(repo,name),'utf8'),value);assert.equal(await git(repo,'rev-parse','HEAD'),head);
});

test('Excalidraw extends an annotated manual once without restoring a deliberately removed ZenUML section', async () => {
  const name = 'Scriba-Diagramas.md', value = '# Referência revisada\r\n\r\n<!-- scriba-reference:diagram-manual version=1 -->\r\n\r\nMinha anotação e organização permanecem.\r\n';
  const { repo, upstream } = await referenceCheckout('excalidraw-upgrade', { [name]: value, 'User.md': '# Minha nota' }, ['User.md']);
  const file = path.join(temporary, 'state', 'library.json'), state = JSON.parse(await fs.readFile(file, 'utf8'));
  state[await fs.realpath(repo)] = { pinned: ['User.md'], welcomeImageVersion: 1, diagramManualVersion: 1, diagramManualName: name, diagramManualZenUmlVersion: 1 };
  await fs.writeFile(file, JSON.stringify(state));
  const result = await request('library/initialize', {}); assert.equal(result.status, 200); assert.deepEqual(result.body.pinned.map(item => item.name), ['User.md']);
  const extended = await fs.readFile(path.join(repo, name), 'utf8'); assert.ok(extended.startsWith(value)); assert.equal(extended.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal((extended.match(/scriba-extension:excalidraw-v1:start/g) || []).length, 1); assert.equal((extended.match(/excalidraw-example:/g) || []).length, 29); assert.ok(!extended.includes('scriba-extension:zenuml-v1:start'));
  assert.equal(await git(upstream, 'show', `main:${name}`), extended.replace(/\r\n/g, '\n').trimEnd());
  const head = await git(repo, 'rev-parse', 'HEAD'); await request('library/initialize', {}); assert.equal(await git(repo, 'rev-parse', 'HEAD'), head);
  await fs.writeFile(path.join(repo, name), value); await request('library/initialize', {}); assert.equal(await fs.readFile(path.join(repo, name), 'utf8'), value);
  await fs.rm(path.join(repo, name)); await request('library/initialize', {}); await assert.rejects(fs.access(path.join(repo, name)));
});
