import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url))),manual=await fs.readFile(new URL('../docs/Scriba-Diagramas.md',import.meta.url),'utf8');
const manualName='Scriba-Diagramas.md',evidence=new URL('../docs/evidence/diagram-reference/',import.meta.url);
let server,browser,origin=process.env.SCRIBA_URL;
const errors=[],fixtureRequests=[],fixtureFailures=[];
async function readState(page,key='state') {
  return page.evaluate(key=>new Promise((resolve,reject)=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readonly'),read=tx.objectStore('library').get(key);tx.oncomplete=()=>{db.close();resolve(read.result);};tx.onerror=()=>reject(tx.error);};}),key);
}
async function context(options={}) {const value=await browser.newContext(options);value.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));return value;}
try {
  if(!origin){const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm'};
    server=createServer(async(request,response)=>{try{const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(dist+path.sep))return response.writeHead(403).end();const bytes=await fs.readFile(file);response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(bytes);}catch{response.writeHead(404).end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  }
  browser=process.env.MARKDOWN_BROWSER==='webkit'?await webkit.launch({headless:true}):await chromium.launch({channel:'chrome',headless:true});await fs.mkdir(evidence,{recursive:true});
  const fresh=await context({viewport:{width:1440,height:900}}),page=await fresh.newPage();
  await page.goto(origin);const sidebar=page.getByRole('complementary',{name:'Notas recentes'}),pinned=sidebar.getByRole('region',{name:'Fixadas',exact:true});
  await expect(pinned.locator('li')).toHaveCount(2);await expect(pinned.getByRole('button',{name:manualName,exact:true})).toBeVisible();
  const first=await readState(page);assert.equal(first.notes[manualName].value,manual);assert.deepEqual(first.pins,['Boas-vindas.md',manualName]);
  assert.ok(!await pinned.locator('.note-preview').last().innerText().then(value=>value.includes('scriba-reference:')));
  await pinned.getByRole('button',{name:manualName,exact:true}).click();await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');await expect(page.locator('article figure[data-diagram-engine]')).toHaveCount(83);
  await page.getByRole('link',{name:'Métricas e conjuntos',exact:true}).click();await expect(page.locator('#métricas-e-conjuntos')).toBeInViewport();
  const diagram=page.locator('article figure[data-diagram-engine]').nth(43);await diagram.scrollIntoViewIfNeeded();await expect(diagram).toHaveAttribute('data-diagram-state','ready',{timeout:30000});
  for(const viewport of [{width:1440,height:900,name:'desktop'},{width:390,height:844,name:'mobile'},{width:844,height:390,name:'mobile-landscape'},{width:820,height:1180,name:'tablet'},{width:1180,height:820,name:'tablet-landscape'}]) {
    await page.setViewportSize(viewport);if(await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).isVisible())await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).click();
    await diagram.scrollIntoViewIfNeeded();await expect(diagram).toHaveAttribute('data-diagram-state','ready',{timeout:30000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(['desktop','mobile'].includes(viewport.name))await page.screenshot({path:new URL(`reference-metrics-${viewport.name}${process.env.MARKDOWN_BROWSER==='webkit'?'-webkit':''}.png`,evidence).pathname});
  }
  await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Fonte',exact:true}).click();const edited=manual+'\nMinha anotação particular.\n';await page.locator('.cm-content[contenteditable=true]').fill(edited);await page.getByRole('button',{name:'Salvar nota',exact:true}).click();
  await expect.poll(async()=>(await readState(page)).notes[manualName].value).toBe(edited);
  if(await page.getByRole('button',{name:'Mostrar notas recentes',exact:true}).isVisible())await page.getByRole('button',{name:'Mostrar notas recentes',exact:true}).click();await page.getByRole('button',{name:`Desafixar ${manualName}`,exact:true}).click();
  await expect.poll(async()=>(await readState(page)).pins.includes(manualName)).toBe(false);
  await page.reload();await expect.poll(async()=>(await readState(page)).pins.includes(manualName)).toBe(false);assert.equal((await readState(page)).notes[manualName].value,edited);assert.equal(Object.keys((await readState(page)).notes).filter(name=>name.startsWith('Scriba-Diagramas')).length,1);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await fresh.setOffline(true);await page.reload();await page.getByRole('button',{name:manualName,exact:true}).click();await page.getByRole('status').filter({hasText:'Documento aberto.'}).waitFor();await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');await expect(page.locator('article figure[data-diagram-engine]')).toHaveCount(83);
  const offlineFirst=page.locator('article figure[data-diagram-engine]').first();await expect.poll(async()=>{try{await offlineFirst.scrollIntoViewIfNeeded({timeout:1000});}catch{/* Re-resolve after an asynchronous note restore. */}return await offlineFirst.getAttribute('data-diagram-state');},{timeout:30000}).toBe('ready');await fresh.setOffline(false);await fresh.close();
  if(!process.env.SCRIBA_URL) {
    const legacy=await context(),old=await legacy.newPage();await old.goto(origin);await old.getByRole('button',{name:manualName,exact:true}).waitFor();
    await old.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readwrite'),store=tx.objectStore('library'),get=store.get('state');get.onsuccess=()=>{const state=get.result;delete state.diagramManualVersion;delete state.diagramManualName;state.notes['Scriba-Diagramas.md']={name:'Scriba-Diagramas.md',value:'# Referência do usuário',version:'user-version',files:[],modifiedAt:new Date().toISOString()};state.pins=['Boas-vindas.md','Scriba-Diagramas.md'];store.put(state,'state');};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
    await old.reload();await old.getByRole('button',{name:'Scriba-Diagramas-2.md',exact:true}).waitFor();const migrated=await readState(old);assert.equal(migrated.notes[manualName].value,'# Referência do usuário');assert.equal(migrated.notes['Scriba-Diagramas-2.md'].value,manual);await legacy.close();
    // HTTP browser-level mocks isolate remote repositories; no real account or credentials are used.
    const selection={fullName:'example/reference-notes',branch:'main',folder:'scriba'},key=`github:${selection.fullName}:main:scriba`;
    const notes=new Map([[manualName,{name:manualName,value:'# Arquivo particular do usuário',version:'existing',files:[],modifiedAt:new Date().toISOString()}]]);let writes=0,unavailable=false;
    async function githubContext() {
      const github=await context({serviceWorkers:'block'});github.on('requestfailed',request=>fixtureFailures.push({url:request.url(),failure:request.failure()}));await github.addInitScript(selection=>{if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('scriba-github-selection',JSON.stringify(selection));},selection);
      await github.route('**/github/**',async route=>{fixtureRequests.push({url:route.request().url(),method:route.request().method(),unavailable});if(unavailable)return route.fulfill({status:503,json:{error:'Remote unavailable in fixture'}});const url=new URL(route.request().url()),name=url.searchParams.get('name');
        if(url.pathname==='/github/status')return route.fulfill({json:{configured:true,connected:true,user:{login:'example'},selection,installUrl:null}});
        if(url.pathname==='/github/library')return route.fulfill({json:{notes:[...notes.values()].map(({value,files,...metadata})=>({...metadata,title:value.split('\n')[0].replace(/^# /,''),preview:'',hasImage:false}))}});
        if(url.pathname==='/github/document')return route.fulfill(notes.has(name)?{json:{...notes.get(name),warnings:[]}}:{status:404,json:{error:'Not found'}});
        if(url.pathname==='/github/document-version')return route.fulfill({json:{version:notes.get(name)?.version||null}});
        if(url.pathname==='/github/save'){const body=route.request().postDataJSON();assert.equal(body.scope,key);const old=notes.get(body.name);if(old&&old.version!==body.version)return route.fulfill({status:409,json:{error:'Existing file',conflict:{name:body.name,kind:'exists',currentVersion:old.version}}});writes++;const version=createHash('sha1').update(body.value).digest('hex');notes.set(body.name,{name:body.name,value:body.value,files:body.files||[],version,modifiedAt:new Date().toISOString()});return route.fulfill({json:{version,synced:true}});}
        throw new Error(`Unexpected route ${url.pathname}`);
      });return github;
    }
    const github=await githubContext(),gitPage=await github.newPage();await gitPage.goto(origin);await gitPage.getByRole('button',{name:'Scriba-Diagramas-2.md',exact:true}).click();await expect(gitPage.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');assert.equal(writes,1);assert.equal(notes.get(manualName).value,'# Arquivo particular do usuário');assert.equal(notes.get('Scriba-Diagramas-2.md').value,manual);assert.equal(!!(await readState(gitPage,key)).notes['Scriba-Diagramas-2.md'].pending,false);
    await gitPage.reload();await gitPage.getByRole('button',{name:'Scriba-Diagramas-2.md',exact:true}).waitFor();assert.equal(writes,1);await github.close();
    notes.get('Scriba-Diagramas-2.md').value+='\nAnotação remota preservada.\n';
    const adopted=await githubContext(),adoptPage=await adopted.newPage();await adoptPage.goto(origin);await adoptPage.getByRole('button',{name:'Scriba-Diagramas-2.md',exact:true}).click();await expect(adoptPage.locator('article')).toContainText('Anotação remota preservada.');assert.equal(writes,1);await adopted.close();
    const legacyRemote='# Manual remoto anotado\n\n<!-- scriba-reference:diagram-manual version=1 -->\n\nPreservar minha anotação.\n';
    notes.get('Scriba-Diagramas-2.md').value=legacyRemote;notes.get('Scriba-Diagramas-2.md').version='legacy-reference';
    const upgraded=await githubContext(),upgradePage=await upgraded.newPage();await upgradePage.goto(origin);await upgradePage.getByRole('button',{name:'Scriba-Diagramas-2.md',exact:true}).click();
    await expect(upgradePage.locator('article')).toContainText('ZenUML — interações descritas como código');assert.ok(notes.get('Scriba-Diagramas-2.md').value.startsWith(legacyRemote));assert.equal(writes,2);
    await upgradePage.reload();await upgradePage.getByRole('button',{name:'Scriba-Diagramas-2.md',exact:true}).waitFor();assert.equal(writes,2);await upgraded.close();
    notes.clear();unavailable=true;const pending=await githubContext(),pendingPage=await pending.newPage();await pendingPage.goto(origin);await pendingPage.getByRole('button',{name:manualName,exact:true}).click();await expect(pendingPage.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');assert.equal((await readState(pendingPage,key)).notes[manualName].pending,true);assert.equal((await readState(pendingPage,key)).notes[manualName].version,null);
    await pendingPage.getByRole('status').filter({hasText:'Aberto com avisos:'}).waitFor();unavailable=false;await pendingPage.getByRole('button',{name:'Salvar nota',exact:true}).click();try{await expect.poll(async()=>!!(await readState(pendingPage,key)).notes[manualName].pending,{timeout:15000}).toBe(false);}catch(error){console.log({writes,remoteNotes:[...notes.keys()],fixtureRequests,fixtureFailures,alerts:await pendingPage.getByRole('alert').allTextContents()});throw error;}assert.equal(notes.get(manualName).value,manual);await pending.close();
  }
  assert.deepEqual(errors,[]);console.log(`PASS (${origin}): pinned reference, exact source, Unicode TOC, desktop/mobile/tablet, editing and unpin persistence, offline${process.env.SCRIBA_URL?'':', legacy collisions, GitHub create/adopt/collision/pending-retry'}.`);
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
