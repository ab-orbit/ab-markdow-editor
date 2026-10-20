import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

test('Save As writes only the explicitly selected file, preserves originals and detects external changes over HTTP', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-save-as-'));
  const state = path.join(temporary, 'state'), outside = path.join(temporary, 'another folder');
  await fs.mkdir(path.join(state, 'finder-inbox'), {recursive:true}); await fs.mkdir(outside);
  const original = path.join(outside, 'original.md'), filename = path.join(outside, 'Cópia.md');
  await fs.writeFile(original, '# Original\n');
  const id = randomUUID(), readOnlyId = randomUUID();
  // These private capabilities stand in for the native picker result; no personal files or dialogs are used.
  await fs.writeFile(path.join(state, 'finder-inbox', `${id}.json`), JSON.stringify({filename,writable:true}));
  await fs.writeFile(path.join(state, 'finder-inbox', `${readOnlyId}.json`), JSON.stringify({filename:original}));
  const runtime = path.join(temporary, 'runtime.json');
  const server = spawn(process.execPath, ['server/index.mjs'], {cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  try {
    let base;
    for(let n=0;n<100;n++){try{base=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
    assert.ok(base);
    const token = (await (await fetch(base)).text()).match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];
    const request = async (route,body) => {const result=await fetch(`${base}/api/${route}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:result.status,body:await result.json()};};
    assert.equal((await request('finder-save',{id:readOnlyId,value:'unsafe',version:null})).status,400,'Finder imports never grant overwrite permission');
    assert.equal((await request('finder-save',{id:'../outside',value:'unsafe',version:null})).status,400);
    const value = '\uFEFF# Cópia\r\n\r\n![Pixel](assets/pixel.png)\r\n';
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII=';
    const saved=await request('finder-save',{id,value,version:null,files:[{path:'assets/pixel.png',data:png}]});
    assert.equal(saved.status,200,JSON.stringify(saved.body)); assert.equal(saved.body.synced,true);
    assert.equal(await fs.readFile(filename,'utf8'),value);
    assert.equal(await fs.readFile(original,'utf8'),'# Original\n');
    assert.equal((await fs.readFile(path.join(outside,'assets/pixel.png'))).toString('base64'),png);
    assert.equal((await request('repository')).body.repository,null,'Save As never changes the global checkout');
    const read=await request(`finder-document?id=${id}&fresh=1`);
    assert.equal(read.body.value,value);assert.equal(read.body.name,'Cópia.md');assert.equal(read.body.location,filename);assert.equal(read.body.files[0].data,png);
    await fs.writeFile(filename,'# External\n');
    const conflict=await request('finder-save',{id,value:'lost update',version:saved.body.version});
    assert.equal(conflict.status,409);assert.equal(await fs.readFile(filename,'utf8'),'# External\n');
    const current=createHash('sha256').update('# External\n').digest('hex');
    assert.equal((await request(`finder-document-version?id=${id}`)).body.version,current);
    const replaced=await request('finder-save',{id,value:'# Confirmed\n',version:current,backupBeforeReplace:true});
    assert.equal(replaced.status,200);assert.equal(await fs.readFile(filename,'utf8'),'# Confirmed\n');
    const backups=await fs.readdir(path.join(state,'conflict-backups'));
    assert.equal(backups.length,1);assert.equal(await fs.readFile(path.join(state,'conflict-backups',backups[0]),'utf8'),'# External\n');
  } finally {server.kill();await new Promise(resolve=>server.once('exit',resolve));await fs.rm(temporary,{recursive:true,force:true});}
});
