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
let server,browser;
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
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],saves=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('/api/save-sync'))saves.push(request.url());});
 await page.clock.install();await page.goto(origin);await page.getByRole('button',{name:'A.md',exact:true}).click();await page.getByRole('button',{name:'Fonte',exact:true}).click();
 const editor=page.locator('.cm-content'),reload=page.getByRole('button',{name:'Recarregar do disco',exact:true}).first(),banner=page.locator('.source-change');
 const head=await git(root,'rev-parse','HEAD');
 await fs.writeFile(file,'# Alterada em outro editor');await page.clock.fastForward(5100);await expect(editor).toHaveText('# Alterada em outro editor');await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','source');assert.equal(await git(root,'rev-parse','HEAD'),head);
 await page.getByRole('button',{name:'Ler',exact:true}).click();await fs.writeFile(file,'# Atualizada durante leitura');await page.clock.fastForward(5100);await expect(page.getByRole('heading',{name:'Atualizada durante leitura',exact:true})).toBeVisible();await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');
 await page.getByRole('button',{name:'Fonte',exact:true}).click();await editor.fill('# Meu rascunho seguro');await fs.writeFile(file,'# Alteração externa com rascunho');await page.clock.fastForward(5100);await expect(banner).toContainText('Suas edições foram mantidas');await expect(editor).toHaveText('# Meu rascunho seguro');
 const savedCount=saves.length;await page.clock.fastForward(61000);assert.equal(saves.length,savedCount,'auto-save pauses while an external change is unresolved');assert.equal(await fs.readFile(file,'utf8'),'# Alteração externa com rascunho');
 await reload.click();const dialog=page.getByRole('dialog',{name:'Recarregar do disco',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Continuar editando'}).click();await expect(editor).toHaveText('# Meu rascunho seguro');
 await page.screenshot({path:'docs/evidence/document-reload-conflict-desktop.png'});
 for(const size of [{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768}]){
  await page.setViewportSize(size);if(await page.getByRole('button',{name:'Fechar lista de notas'}).isVisible())await page.getByRole('button',{name:'Fechar lista de notas'}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no page overflow at ${size.width}x${size.height}`);
  await expect(reload).toBeVisible();const box=await reload.boundingBox();assert.ok(box.width>=44&&box.height>=44,'reload has a 44px touch target');
  const bounds=await page.getByLabel('Bancada Markdown').boundingBox();assert.ok(bounds.x+bounds.width<=size.width+1,'editor stays inside viewport');
 }
 await page.setViewportSize({width:390,height:844});
 for(const theme of ['dark','light']) {
  if(theme==='light')await page.getByRole('button',{name:'Usar tema claro',exact:true}).click();
  const contrast=await banner.evaluate(element=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
   ctx.fillStyle=getComputedStyle(element.closest('[aria-label="Bancada Markdown"]')).backgroundColor;ctx.fillRect(0,0,1,1);ctx.fillStyle=getComputedStyle(element).backgroundColor;ctx.fillRect(0,0,1,1);const bg=Array.from(ctx.getImageData(0,0,1,1).data);
   ctx.clearRect(0,0,1,1);ctx.fillStyle=getComputedStyle(element).color;ctx.fillRect(0,0,1,1);const fg=Array.from(ctx.getImageData(0,0,1,1).data);
   const luminance=channels=>channels.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0),values=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);
  });assert.ok(contrast>=4.5,`${theme} external-change notice contrast: ${contrast}`);
  await page.screenshot({path:theme==='dark'?'docs/evidence/document-reload-conflict-mobile.png':'docs/evidence/document-reload-conflict-mobile-light.png'});
 }
 await page.getByRole('button',{name:'Usar tema escuro',exact:true}).click();
 await page.locator('summary[aria-label="Exportar nota"]').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar .md',exact:true}).click();assert.equal((await download).suggestedFilename(),'A.md');
 await reload.click();await dialog.getByRole('button',{name:'Recarregar e descartar rascunho'}).click();await expect(editor).toHaveText('# Alteração externa com rascunho');await expect(banner).toHaveCount(0);
 await editor.fill('# Salva após recarregar');await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Arquivo salvo, commit criado e enviado ao remoto.'})).toBeVisible();assert.equal(await git(remote,'show','main:A.md'),'# Salva após recarregar');
 await fs.rm(file);await page.clock.fastForward(5100);await expect(banner).toContainText('foi removido');await expect(editor).toHaveText('# Salva após recarregar');await fs.writeFile(file,'# Salva após recarregar');await page.clock.fastForward(5100);await expect(banner).toHaveCount(0);
 await page.setViewportSize({width:1440,height:900});
 let release,started;const waiting=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
 await page.route('**/api/document?name=A.md&**fresh=1',async route=>{const response=await route.fetch();started();await hold;await route.fulfill({response});});
 await fs.writeFile(file,'# Chegou enquanto eu digitava');await page.clock.fastForward(5100);await waiting;await editor.fill('# Digitação durante a resposta');release();await expect(banner).toContainText('Suas edições foram mantidas');await expect(reload).toBeEnabled();
 await expect(editor).toHaveText('# Digitação durante a resposta');await page.unroute('**/api/document?name=A.md&**fresh=1');
 await reload.click();await dialog.getByRole('button',{name:'Recarregar e descartar rascunho'}).click();await expect(editor).toHaveText('# Chegou enquanto eu digitava');
 let releaseLate,startedLate,finishedLate;const doneLate=new Promise(resolve=>finishedLate=resolve),waitingLate=new Promise(resolve=>startedLate=resolve),holdLate=new Promise(resolve=>releaseLate=resolve);
 await page.route('**/api/document?name=A.md&**fresh=1',async route=>{const response=await route.fetch();startedLate();await holdLate;await route.fulfill({response});finishedLate();});
 await fs.writeFile(file,'# Resposta da nota anterior');await page.clock.fastForward(5100);await waitingLate;await page.getByRole('button',{name:'Mostrar notas recentes',exact:true}).click();await page.getByRole('button',{name:'B.md',exact:true}).click();await expect(editor).toHaveText('# Outra nota');await expect(reload).toBeEnabled();await reload.click();await expect(reload).toBeEnabled();releaseLate();await doneLate;await page.unroute('**/api/document?name=A.md&**fresh=1');await expect(editor).toHaveText('# Outra nota');
 await page.getByRole('button',{name:'Long.md',exact:true}).click();await page.getByRole('button',{name:'Ler',exact:true}).click();await page.locator('[data-document-scroll]').evaluate(element=>{element.scrollTop=600;});await fs.writeFile(path.join(root,'Long.md'),longText+'\n\nAdicionado por outro editor.');await page.clock.fastForward(5100);await expect(page.getByText('Adicionado por outro editor.',{exact:true})).toBeAttached();await expect.poll(()=>page.locator('[data-document-scroll]').evaluate(element=>element.scrollTop)).toBeGreaterThan(550);
 // Finder imports keep an independent read-only source even outside the configured checkout.
 const outside=path.join(directory,'outside.md'),id=randomUUID(),snapshot='# Arquivo externo';await fs.writeFile(outside,snapshot);await fs.mkdir(path.join(state,'finder-inbox'),{recursive:true});await fs.writeFile(path.join(state,'finder-inbox',`${id}.json`),JSON.stringify({filename:outside,value:snapshot,version:createHash('sha256').update(snapshot).digest('hex'),files:[],warnings:[]}));
 const finder=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});await finder.clock.install();await finder.goto(`${origin}/?finder=${id}`);await finder.getByRole('button',{name:'Fonte',exact:true}).click();await expect(finder.locator('.cm-content')).toHaveText(snapshot);await fs.writeFile(outside,'# Original externo atualizado');await finder.clock.fastForward(5100);await expect(finder.locator('.cm-content')).toHaveText('# Original externo atualizado');assert.equal(await fs.readFile(outside,'utf8'),'# Original externo atualizado');assert.deepEqual(errors,[]);
 console.log('PASS: actual browser and Git fixtures; clean auto-refresh, mode preservation, dirty warning/confirmation, auto-save pause, save after reload, deleted source, edits during delayed responses, stale replies, Finder originals, and phone/tablet in both orientations.');
}finally{await browser?.close();if(server){server.kill();await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(directory,{recursive:true,force:true});}
