import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const exec=promisify(execFile),git=async(cwd,...args)=>(await exec('git',['-C',cwd,...args])).stdout.trim();
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-reload-ui-'));
let server,browser,releaseSave;
try {
 const state=path.join(directory,'state'),checkout=path.join(directory,'notes'),remote=path.join(directory,'remote.git');
 await fs.mkdir(state);await fs.mkdir(checkout);await fs.mkdir(remote);
 const root=await fs.realpath(checkout);
 await git(remote,'init','--bare','-b','main');await git(root,'init','-b','main');
 for(const[key,value]of[['user.name','Scriba Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(root,'config',key,value);
 const file=path.join(root,'A.md'),other=path.join(root,'B.md');
 await fs.writeFile(file,'# Primeira versão\n\nConteúdo salvo.');await fs.writeFile(other,'# Outra nota');
 const longText='# Leitura longa\n\n'+Array.from({length:80},(_,i)=>`Parágrafo ${i+1}. Texto suficiente para verificar a posição de leitura.`).join('\n\n');await fs.writeFile(path.join(root,'Long.md'),longText);
 await git(root,'add','.');await git(root,'commit','-m','Initial');await git(root,'remote','add','origin',remote);await git(root,'push','-u','origin','main');
 await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:root,preferences:{autoSave:true,askCommitNote:false,intervalMinutes:1}}));
 await fs.writeFile(path.join(state,'library.json'),JSON.stringify({[root]:{pinned:['A.md','B.md','Long.md'],welcomeImageVersion: 1, diagramManualVersion: 1}}));
 const runtime=path.join(directory,'runtime.json');server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
 let origin;for(let i=0;i<100;i++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(origin);
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],saves=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('/api/save-sync'))saves.push(request.url());});


 await page.addInitScript(()=>localStorage.setItem('scriba-language','en'));
 let written;const savedOnDisk=new Promise(resolve=>written=resolve),held=new Promise(resolve=>releaseSave=resolve);let intercepted=false;
 await page.route('**/api/save-sync',async route=>{const response=await route.fetch();if(!intercepted){intercepted=true;written();await held;}await route.fulfill({response});});
 await page.goto(origin);await page.getByRole('button',{name:'A.md',exact:true}).click();await expect(page.getByRole('heading',{name:'Primeira versão',exact:true})).toBeVisible();
 const format=page.locator('[data-ui="format-segments"]');await format.locator('button').nth(1).click();
 let saveTimeout;await Promise.race([savedOnDisk,new Promise((_,reject)=>{saveTimeout=setTimeout(()=>reject(Error('Autosave did not reach disk')),30000);})]).finally(()=>clearTimeout(saveTimeout));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(5500);
 await expect(page.locator('.source-change')).toHaveCount(0);
 const acknowledged=page.waitForResponse(response=>response.url().endsWith('/api/save-sync'));releaseSave();await acknowledged;
 await page.waitForTimeout(500);await format.locator('button').nth(0).click();await page.waitForTimeout(5500);await expect(page.locator('.source-change')).toHaveCount(0);
 await page.locator('header[data-ui="toolbar"]').getByRole('button',{name:'More options',exact:true}).click();await page.getByRole('menuitemradio',{name:'Source',exact:true}).click();
 await page.locator('.cm-content').fill('# Local draft retained');await fs.writeFile(file,'# Actual external edit');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.source-change')).toContainText('Your edits');await expect(page.locator('.cm-content')).toHaveText('# Local draft retained');
 await fs.mkdir('docs/evidence/whiteboard-source-reload',{recursive:true});await page.screenshot({path:'docs/evidence/whiteboard-source-reload/genuine-external-change.png'});
 await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:'docs/evidence/whiteboard-source-reload/genuine-external-change-light.png'});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.setViewportSize({width:390,height:844});await expect(page.locator('.notes-sidebar')).toBeHidden();await expect(page.locator('.source-change')).toBeVisible();if(await page.locator('.source-change').evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('External-change notice overflows on mobile');await page.screenshot({path:'docs/evidence/whiteboard-source-reload/genuine-external-change-mobile.png'});
 console.log('Own in-flight autosave stays quiet across Note/Whiteboard; real external edits remain protected');
}finally{releaseSave?.();await browser?.close();server?.kill();await fs.rm(directory,{recursive:true,force:true});}
