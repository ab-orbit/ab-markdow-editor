import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args])).stdout.trim();
let directory, checkout, remote, base, token, server;
async function request(body) {
  const response = await fetch(`${base}/api/sync`, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify({repository:checkout,...body})});
  return {status:response.status, body:await response.json()};
}
before(async () => {
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-sync-http-'));
  checkout=path.join(directory,'checkout'); remote=path.join(directory,'remote.git');
  await fs.mkdir(checkout); await fs.mkdir(remote);
  await git(remote,'init','--bare','-b','main'); await git(checkout,'init','-b','main');
  for(const [key,value] of [['user.name','Scriba Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']]) await git(checkout,'config',key,value);
  await fs.writeFile(path.join(checkout,'README.md'),'# Original');
  await fs.writeFile(path.join(checkout,'remove.md'),'# Remove');
  await fs.writeFile(path.join(checkout,'.gitignore'),'ignored.txt\n');
  await git(checkout,'add','.'); await git(checkout,'commit','-m','Initial');
  await git(checkout,'remote','add','origin',remote); await git(checkout,'push','-u','origin','main');
  const runtime=path.join(directory,'runtime.json');
  server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:path.join(directory,'state'),MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  for(let i=0;i<100;i++) {try{base=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
  assert.ok(base,'HTTP service started');
  token=(await (await fetch(base)).text()).match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];
  const connected=await fetch(`${base}/api/connect`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({directory:checkout})});
  assert.equal(connected.status,200);
  checkout=(await connected.json()).repository;
});
after(async () => {if(server){server.kill();await new Promise(resolve=>server.once('exit',resolve));}if(directory)await fs.rm(directory,{recursive:true,force:true});});

test('syncs an untracked folder, modified and deleted files through HTTP, honoring ignore rules',async()=>{
  await fs.mkdir(path.join(checkout,'scriba'));
  await fs.writeFile(path.join(checkout,'scriba','Nota com acento á.md'),'# Nota nova');
  await fs.writeFile(path.join(checkout,'scriba','image.png'),Buffer.from([137,80,78,71]));
  await fs.writeFile(path.join(checkout,'README.md'),'# Updated');
  await fs.writeFile(path.join(checkout,'ignored.txt'),'Not published');
  await fs.rm(path.join(checkout,'remove.md'));
  const result=await request({message:'Sync local folder'});
  assert.equal(result.status,200);assert.equal(result.body.synced,true,result.body.error);assert.equal(result.body.committed,true);
  assert.equal(await git(remote,'show','main:scriba/Nota com acento á.md'),'# Nota nova');
  assert.equal(await git(remote,'show','main:README.md'),'# Updated');
  const files=await git(remote,'ls-tree','-r','--name-only','main');
  assert.ok(files.includes('scriba/image.png'));assert.ok(!files.includes('remove.md'));assert.ok(!files.includes('ignored.txt'));
  assert.equal(await git(checkout,'status','--porcelain'),'');
});
test('a retry without file changes pushes without creating an empty commit',async()=>{
  const head=await git(checkout,'rev-parse','HEAD');
  assert.equal((await request({})).body.synced,true);
  assert.equal(await git(checkout,'rev-parse','HEAD'),head);
});
test('failed push retains the commit and a clean checkout can retry it',async()=>{
  await git(checkout,'remote','set-url','origin',path.join(directory,'missing.git'));
  await fs.writeFile(path.join(checkout,'scriba','retry.md'),'# Retry');
  const result=await request({});assert.equal(result.body.synced,false);assert.equal(result.body.stage,'push');assert.equal(result.body.committed,true);
  const head=await git(checkout,'rev-parse','HEAD');assert.equal(await git(checkout,'status','--porcelain'),'');
  await git(checkout,'remote','set-url','origin',remote);
  assert.equal((await request({})).body.synced,true);
  assert.equal(await git(remote,'rev-parse','main'),head);assert.equal(await git(checkout,'rev-parse','HEAD'),head);
});
test('preserves files staged by another tool and rejects a different checkout',async()=>{
  await fs.writeFile(path.join(checkout,'README.md'),'# Staged elsewhere');await git(checkout,'add','README.md');
  const head=await git(checkout,'rev-parse','HEAD');
  const staged=await request({});assert.equal(staged.status,400);assert.match(staged.body.error,/preparadas/);
  assert.equal(await git(checkout,'diff','--cached','--name-only'),'README.md');
  assert.equal((await request({repository:'/different/repository'})).status,400);assert.equal(await git(checkout,'rev-parse','HEAD'),head);
  await git(checkout,'reset','--quiet');await git(checkout,'restore','README.md');
});
test('failed commit releases only the newly prepared index and retains the files for retry',async()=>{
  const hooks=path.join(directory,'hooks');await fs.mkdir(hooks);await fs.writeFile(path.join(hooks,'pre-commit'),'#!/bin/sh\nexit 1\n',{mode:0o755});await git(checkout,'config','core.hooksPath',hooks);
  await fs.writeFile(path.join(checkout,'scriba','hook.md'),'# Still here');
  const result=await request({});assert.equal(result.body.synced,false);assert.equal(result.body.stage,'commit');
  assert.equal(await git(checkout,'diff','--cached','--name-only'),'');assert.equal(await fs.readFile(path.join(checkout,'scriba','hook.md'),'utf8'),'# Still here');
  await git(checkout,'config','core.hooksPath','/dev/null');assert.equal((await request({})).body.synced,true);
});
test('a diverged remote merges independent changes and preserves both histories',async()=>{
  const other=path.join(directory,'other');await git(directory,'clone',remote,other);
  await git(other,'config','user.name','Other');await git(other,'config','user.email','other@example.invalid');await git(other,'config','commit.gpgsign','false');await git(other,'config','core.hooksPath','/dev/null');
  await fs.writeFile(path.join(other,'remote.md'),'# Remote');await git(other,'add','.');await git(other,'commit','-m','Remote change');await git(other,'push');
  const remoteHead=await git(remote,'rev-parse','main');
  await fs.writeFile(path.join(checkout,'scriba','local.md'),'# Local');
  const result=await request({});assert.equal(result.body.synced,true,result.body.error);
  const head=await git(checkout,'rev-parse','HEAD');
  assert.equal(await git(remote,'rev-parse','main'),head);
  await git(checkout,'merge-base','--is-ancestor',remoteHead,head);
  assert.equal(await fs.readFile(path.join(checkout,'remote.md'),'utf8'),'# Remote');
  assert.equal(await git(remote,'show','main:scriba/local.md'),'# Local');
  assert.equal(await git(checkout,'status','--porcelain'),'');
});
