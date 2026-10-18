import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
let directory,source,remote,config,base,token,server;
const git=async(cwd,...args)=>(await exec('git',['-C',cwd,...args],{env:{...process.env,GIT_CONFIG_GLOBAL:config,GIT_CONFIG_NOSYSTEM:'1'}})).stdout.trim();
async function request(route,body){const result=await fetch(`${base}/api/${route}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:result.status,body:await result.json()};}
async function createRepo(name,readme='# Target') {
  const checkout=path.join(directory,name),origin=path.join(directory,'remotes',`${name}.git`);await fs.mkdir(checkout);await fs.mkdir(origin);
  await git(origin,'init','--bare','-b','main');await git(checkout,'init','-b','main');
  if(readme!==null){await fs.writeFile(path.join(checkout,'README.md'),readme);await git(checkout,'add','.');await git(checkout,'commit','-m','Initial');}
  await git(checkout,'remote','add','origin',origin);if(readme!==null)await git(checkout,'push','-u','origin','main');
  return {checkout:await fs.realpath(checkout),remote:origin};
}
async function connectSource(){const result=await request('connect',{directory:source});assert.equal(result.status,200);}
async function prepare(target,extra={}){return request('repository/prepare-switch',{repository:source,mode:'local',directory:target,carryFiles:true,folder:'imported',...extra});}
before(async()=>{
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-repository-switch-'));await fs.mkdir(path.join(directory,'remotes'));
  config=path.join(directory,'gitconfig');await fs.writeFile(config,'');
  for(const [key,value] of [['user.name','Scriba Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null'],[`url.file://${directory}/remotes/.insteadOf`,'https://migration.invalid/']])await exec('git',['config','--file',config,key,value]);
  ({checkout:source,remote}=await createRepo('source','# Original'));
  await fs.mkdir(path.join(source,'notes','assets'),{recursive:true});await fs.mkdir(path.join(source,'.obsidian'));
  await fs.writeFile(path.join(source,'notes','Nota á.md'),'# Source\n\n![image](assets/test.png)');await fs.writeFile(path.join(source,'notes','assets','test.png'),Buffer.from([137,80,78,71,1,2]));await fs.writeFile(path.join(source,'.obsidian','preferences.json'),'{}');await fs.writeFile(path.join(source,'.gitignore'),'ignored.bin\n');await git(source,'add','.');await git(source,'commit','-m','Source structure');await git(source,'push');
  await fs.writeFile(path.join(source,'pending.md'),'# Not committed yet');await fs.writeFile(path.join(source,'ignored.bin'),'Private ignored content');
  const runtime=path.join(directory,'runtime.json');server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,GIT_CONFIG_GLOBAL:config,GIT_CONFIG_NOSYSTEM:'1',PORT:'0',MARKDOWN_STATE_DIR:path.join(directory,'state'),MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  for(let i=0;i<100;i++){try{base=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(base);token=(await(await fetch(base)).text()).match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];await connectSource();
});
after(async()=>{if(server){server.kill();await new Promise(resolve=>server.once('exit',resolve));}if(directory)await fs.rm(directory,{recursive:true,force:true});});

test('disconnect preserves files, Git config, preferences and the remembered source across restart',async()=>{
  const before=await git(source,'status','--porcelain'),head=await git(source,'rev-parse','HEAD');
  const result=await request('disconnect',{repository:source});assert.equal(result.status,200);assert.equal(result.body.repository,null);assert.equal(result.body.previousRepository,source);
  assert.equal((await request('sync',{repository:source})).status,400);assert.equal(await git(source,'rev-parse','HEAD'),head);assert.equal(await git(source,'status','--porcelain'),before);
  const persisted=JSON.parse(await fs.readFile(path.join(directory,'state','settings.json'),'utf8'));assert.equal(persisted.repository,null);assert.equal(persisted.previousRepository,source);
  const runtime=path.join(directory,'second.json'),second=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,GIT_CONFIG_GLOBAL:config,PORT:'0',MARKDOWN_STATE_DIR:path.join(directory,'state'),MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  try{let origin;for(let i=0;i<100;i++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}const html=await(await fetch(origin)).text(),capability=html.match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];const info=await(await fetch(origin+'/api/repository',{headers:{Authorization:`Bearer ${capability}`}})).json();assert.equal(info.repository,null);assert.equal(info.previousRepository,source);}finally{second.kill();await new Promise(resolve=>second.once('exit',resolve));}
  const reconnect=await request('repository/prepare-switch',{repository:null,mode:'local',directory:source,carryFiles:true});assert.equal(reconnect.status,200,reconnect.body.error);const applied=await request('repository/apply-switch',{id:reconnect.body.id,publish:false});assert.equal(applied.status,200,applied.body.error);assert.equal(applied.body.info.repository,source);assert.equal(await git(source,'rev-parse','HEAD'),head);
});
test('previews conflicts without copying, then copies a complete subfolder and pushes while preserving both histories',async()=>{
  const target=await createRepo('target'),sourceHead=await git(source,'rev-parse','HEAD'),targetHead=await git(target.checkout,'rev-parse','HEAD');
  const conflict=await prepare(target.checkout,{folder:''});assert.equal(conflict.status,200);assert.deepEqual(conflict.body.conflicts,['README.md']);
  assert.equal((await request('repository')).body.repository,source);assert.equal((await request('repository/apply-switch',{id:conflict.body.id,publish:true})).status,400);await assert.rejects(fs.access(path.join(target.checkout,'notes')));
  const plan=await prepare(target.checkout);assert.equal(plan.status,200);assert.deepEqual(plan.body.conflicts,[]);
  const result=await request('repository/apply-switch',{id:plan.body.id,publish:true,message:'Carry complete structure'});assert.equal(result.status,200,result.body.error);assert.equal(result.body.synchronization.synced,true,result.body.synchronization.error);assert.equal(result.body.info.repository,target.checkout);
  assert.equal(await git(target.remote,'show','main:README.md'),'# Target');assert.equal(await git(target.remote,'show','main:imported/notes/Nota á.md'),'# Source\n\n![image](assets/test.png)');assert.equal(await git(target.remote,'show','main:imported/pending.md'),'# Not committed yet');
  await fs.access(path.join(target.checkout,'imported','notes','assets','test.png'));assert.ok(Math.abs((await fs.stat(path.join(target.checkout,'imported','notes','Nota á.md'))).mtimeMs-(await fs.stat(path.join(source,'notes','Nota á.md'))).mtimeMs)<1);await fs.access(path.join(target.checkout,'imported','.obsidian','preferences.json'));await assert.rejects(fs.access(path.join(target.checkout,'imported','.git')));await assert.rejects(fs.access(path.join(target.checkout,'imported','ignored.bin')));
  assert.equal(await git(source,'rev-parse','HEAD'),sourceHead);assert.equal(await git(target.checkout,'rev-parse','HEAD^'),targetHead);assert.equal(await fs.readFile(path.join(source,'pending.md'),'utf8'),'# Not committed yet');await connectSource();
});
test('source changes and destination changes invalidate a review before any copy or connection change',async()=>{
  const target=await createRepo('stale');let plan=await prepare(target.checkout);assert.equal(plan.status,200);
  await fs.writeFile(path.join(source,'changed.md'),'# Changed');let result=await request('repository/apply-switch',{id:plan.body.id});assert.equal(result.status,400);assert.match(result.body.error,/origem mudaram/);await fs.rm(path.join(source,'changed.md'));await assert.rejects(fs.access(path.join(target.checkout,'imported')));
  plan=await prepare(target.checkout);await fs.writeFile(path.join(target.checkout,'unexpected.md'),'# New destination change');result=await request('repository/apply-switch',{id:plan.body.id});assert.equal(result.status,400);assert.match(result.body.error,/destino mudou/);assert.equal((await request('repository')).body.repository,source);
});
test('rejects traversal, nested destinations and dirty destination checkouts',async()=>{
  const target=await createRepo('unsafe');for(const folder of ['../escape','.git/import','nested/../../escape','/absolute'])assert.equal((await prepare(target.checkout,{folder})).status,400);
  assert.equal((await prepare(source)).status,400);await fs.writeFile(path.join(target.checkout,'local.md'),'# Keep');assert.equal((await prepare(target.checkout)).status,400);assert.equal(await fs.readFile(path.join(target.checkout,'local.md'),'utf8'),'# Keep');
});
test('symlinks are excluded and an already identical file is not overwritten',async()=>{
  const target=await createRepo('same','# Original');await fs.symlink(path.join(directory,'gitconfig'),path.join(source,'external-link'));const plan=await prepare(target.checkout,{folder:''});assert.equal(plan.status,200);assert.ok(plan.body.skipped.includes('external-link'));assert.equal(plan.body.identical,1);
  const modified=(await fs.stat(path.join(target.checkout,'README.md'))).mtimeMs;const result=await request('repository/apply-switch',{id:plan.body.id,publish:false});assert.equal(result.status,200,result.body.error);assert.equal((await fs.stat(path.join(target.checkout,'README.md'))).mtimeMs,modified);const head=await git(target.checkout,'rev-parse','HEAD');await request('library/initialize',{});assert.equal(await git(target.checkout,'rev-parse','HEAD'),head);await assert.rejects(fs.access(path.join(target.checkout,'AB-Markdown-Guia.md')));await assert.rejects(fs.access(path.join(target.checkout,'external-link')));await fs.rm(path.join(source,'external-link'));await connectSource();
});
test('a clone is reviewed without switching and all transferred paths are published even with destination ignore rules',async()=>{
  const target=await createRepo('cloned-remote');await fs.writeFile(path.join(target.checkout,'.gitignore'),'*.md\nimported/\n');await git(target.checkout,'add','.gitignore');await git(target.checkout,'commit','-m','Ignore rule');await git(target.checkout,'push');
  const destination=path.join(directory,'new-clone');const plan=await prepare('',{mode:'clone',url:'https://migration.invalid/cloned-remote.git',destination});assert.equal(plan.status,200,plan.body.error);assert.equal((await request('repository')).body.repository,source);
  const result=await request('repository/apply-switch',{id:plan.body.id,publish:true});assert.equal(result.status,200,result.body.error);assert.equal(result.body.synchronization.synced,true,result.body.synchronization.error);assert.equal(await git(target.remote,'show','main:imported/pending.md'),'# Not committed yet');await connectSource();
});
test('changing only the remote preserves the folder, sends the current structure to the new origin and keeps the old remote intact',async()=>{
  const target=await createRepo('empty-remote',null),oldHead=await git(remote,'rev-parse','main');await git(source,'config','remote.origin.pushurl',remote);
  const plan=await prepare('',{mode:'remote',url:'https://migration.invalid/empty-remote.git'});assert.equal(plan.status,200,plan.body.error);assert.equal(await git(source,'remote','get-url','origin'),remote);
  const result=await request('repository/apply-switch',{id:plan.body.id,publish:true,message:'Move to new origin'});assert.equal(result.status,200,result.body.error);assert.equal(result.body.synchronization.synced,true,result.body.synchronization.error);assert.equal(result.body.info.repository,source);assert.equal(await git(target.remote,'show','main:pending.md'),'# Not committed yet');assert.equal(await git(remote,'rev-parse','main'),oldHead);assert.equal(await git(source,'config','--get','remote.origin.pushurl'),'https://migration.invalid/empty-remote.git');
  await git(source,'remote','set-url','origin',remote);await git(source,'config','--unset-all','remote.origin.pushurl');
});
test('an unrelated remote history is rejected without altering the origin',async()=>{
  await createRepo('unrelated','# Different history');const before=await git(source,'remote','get-url','origin');const result=await prepare('',{mode:'remote',url:'https://migration.invalid/unrelated.git'});assert.equal(result.status,400);assert.match(result.body.error,/histórico diferente/);assert.equal(await git(source,'remote','get-url','origin'),before);
});
test('push failure retains the copied files and selected destination for a normal retry',async()=>{
  const target=await createRepo('push-failure');await git(target.checkout,'config','remote.origin.pushurl',path.join(directory,'not-a-remote.git'));
  const plan=await prepare(target.checkout);assert.equal(plan.status,200);const result=await request('repository/apply-switch',{id:plan.body.id,publish:true});assert.equal(result.status,200,result.body.error);assert.equal(result.body.synchronization.synced,false);assert.equal(result.body.synchronization.stage,'push');assert.equal((await request('repository')).body.repository,target.checkout);const head=await git(target.checkout,'rev-parse','HEAD');await fs.access(path.join(target.checkout,'imported','notes','Nota á.md'));
  await git(target.checkout,'config','--unset-all','remote.origin.pushurl');const retry=await request('sync',{repository:target.checkout});assert.equal(retry.body.synced,true,retry.body.error);assert.equal(await git(target.remote,'rev-parse','main'),head);
});
