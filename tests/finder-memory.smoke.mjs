import {chromium} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
// Tests only a generated document; never changes the user's configured checkout.
const exec=promisify(execFile),state=path.join(os.homedir(),'Library/Application Support/AB Markdown'),inbox=path.join(state,'finder-inbox');
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-finder-memory-')),file=path.join(directory,'Nota em memória.md');await fs.writeFile(file,'# Aberta em memória\n\nOriginal fora da pasta padrão.');const before=new Set(await fs.readdir(inbox).catch(()=>[]));
await exec('/usr/bin/open',['-a','/Applications/Scriba.app',file]);let handoff;for(let i=0;i<80;i++){handoff=(await fs.readdir(inbox).catch(()=>[])).find(name=>!before.has(name));if(handoff)break;await new Promise(resolve=>setTimeout(resolve,150));}assert.ok(handoff,'native Finder handoff arrived');
const runtime=JSON.parse(await fs.readFile(path.join(state,'runtime.json'),'utf8'));const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.route('**/api/repository',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Pasta padrão indisponível (teste).'})}));const response=await page.goto(`${runtime.url}/?finder=${handoff.replace('.json','')}`);assert.equal(response.status(),200);await page.getByRole('status').filter({hasText:'Documento do Finder importado.'}).waitFor();assert.equal(await page.getByRole('alert').count(),0);assert.match(await page.locator('.cm-content').innerText(),/Aberta em memória/);assert.equal(await fs.readFile(file,'utf8'),'# Aberta em memória\n\nOriginal fora da pasta padrão.');assert.ok(!page.url().includes('finder='));await page.screenshot({path:'docs/evidence/finder-memory-without-default.png'});console.log('PASS: Finder opens an external file in memory even when the default repository API fails, preserving the original.');}finally{await browser.close();await fs.rm(directory,{recursive:true,force:true});}
