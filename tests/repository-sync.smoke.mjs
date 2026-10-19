import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';

// Real browser, local HTTP service and bare Git remote; no user checkout is touched.
const exec=promisify(execFile);
const git=async(cwd,...args)=>(await exec('git',['-C',cwd,...args])).stdout.trim();
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-sync-browser-'));
let server, browser;
try {
  let checkout=path.join(directory,'notes');const remote=path.join(directory,'remote.git'),state=path.join(directory,'state');
  await fs.mkdir(checkout);await fs.mkdir(remote);await fs.mkdir(state);
  checkout=await fs.realpath(checkout);
  await git(remote,'init','--bare','-b','main');await git(checkout,'init','-b','main');
  for(const [key,value] of [['user.name','Scriba Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(checkout,'config',key,value);
  await fs.writeFile(path.join(checkout,'README.md'),'# Notes');await git(checkout,'add','.');await git(checkout,'commit','-m','Initial');await git(checkout,'remote','add','origin',remote);await git(checkout,'push','-u','origin','main');
  await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:checkout,preferences:{askCommitNote:true,autoSave:false,intervalMinutes:1}}));
  await fs.writeFile(path.join(state,'library.json'),JSON.stringify({[checkout]:{pinned:[],welcomeImageVersion: 1, diagramManualVersion: 1}}));
  await fs.mkdir(path.join(checkout,'scriba'));await fs.writeFile(path.join(checkout,'scriba','Nova.md'),'# Nota para sincronizar');
  const runtime=path.join(directory,'runtime.json');
  server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  let origin;for(let i=0;i<100;i++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(origin);
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let calls=0;
  await page.route('**/api/sync',async route=>{calls++;await new Promise(resolve=>setTimeout(resolve,250));await route.continue();});
  await page.goto(origin+'/#settings');
  await expect(page.locator('.repository > summary')).toContainText(checkout);await page.locator('.repository > summary').click();
  const sync=page.getByRole('button',{name:'Sincronizar repositório',exact:true});
  await expect(page.getByLabel('Alterações no repositório')).toHaveText('Ainda não versionado: scriba/');
  const connection=page.locator('.repository-summary .connection-status');
  await expect(connection).toHaveText('Pasta conectada');
  await expect(connection).toHaveAttribute('data-state','connected');
  for(const theme of ['dark','light']) {
    await page.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);
    for(const [width,height] of [[1440,900],[390,844],[844,390],[768,1024]]) {
      await page.setViewportSize({width,height});await sync.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const colors=await connection.evaluate(element=>({text:getComputedStyle(element).color,tint:getComputedStyle(element).backgroundColor,surface:getComputedStyle(element.closest('.repository')).backgroundColor}));
      const rgb=value=>value.match(/[\d.]+/g).map(Number),foreground=rgb(colors.text),tint=rgb(colors.tint),surface=rgb(colors.surface),background=tint.slice(0,3).map((channel,index)=>channel*(tint[3]??1)+surface[index]*(1-(tint[3]??1)));
      const luminance=channels=>channels.slice(0,3).map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((total,channel,index)=>total+channel*[.2126,.7152,.0722][index],0);
      const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
      assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,`${theme} connection badge contrast`);
      if(theme==='dark'&&width===1440||theme==='light'&&width===390)await page.locator('details.repository').screenshot({path:`docs/evidence/repository-connected-${theme}-${width}.png`});
    }
  }
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});await page.setViewportSize({width:1440,height:900});

  await sync.scrollIntoViewIfNeeded();await page.screenshot({path:'docs/evidence/repository-sync-desktop.png'});
  await sync.click();
  const dialog=page.getByRole('dialog',{name:'Nota do commit'});
  await dialog.getByLabel('Nota do commit',{exact:true}).fill('Publish local note folder');
  await dialog.getByRole('button',{name:'Commit e push',exact:true}).click();
  await expect(sync).toBeDisabled();await expect(page.getByRole('status').filter({hasText:'Repositório sincronizado com o remoto.'})).toBeVisible();
  assert.equal(calls,1);assert.equal(await git(remote,'show','main:scriba/Nova.md'),'# Nota para sincronizar');assert.equal(await git(remote,'log','-1','--pretty=%s'),'Publish local note folder');
  await expect(page.getByLabel('Alterações no repositório')).toHaveText('Nenhuma alteração local pendente.');
  await expect(page.locator('.repository-sync-feedback')).toHaveAttribute('data-state','success');
  const head=await git(checkout,'rev-parse','HEAD');
  await sync.click();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(calls,1);assert.equal(await git(checkout,'rev-parse','HEAD'),head);
  await git(checkout,'remote','set-url','origin',path.join(directory,'missing.git'));await fs.writeFile(path.join(checkout,'scriba','Retry.md'),'# Retry safely');
  await page.reload();await expect(page.locator('.repository > summary')).toContainText(checkout);await page.locator('.repository > summary').click();await sync.click();await dialog.getByLabel('Nota do commit',{exact:true}).fill('Keep local commit');await dialog.getByRole('button',{name:'Commit e push',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Envio pendente:'})).toBeVisible();await expect(sync).toBeEnabled();await expect(connection).toHaveText('Pasta conectada');await expect(page.locator('.repository-sync-feedback')).toHaveAttribute('data-state','error');
  const retryHead=await git(checkout,'rev-parse','HEAD');assert.notEqual(retryHead,head);
  await git(checkout,'remote','set-url','origin',remote);await sync.click();await dialog.getByLabel('Nota do commit',{exact:true}).fill('Retry pending push');await dialog.getByRole('button',{name:'Commit e push',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Repositório sincronizado com o remoto.'})).toBeVisible();
  assert.equal(await git(remote,'rev-parse','main'),retryHead);assert.equal(await git(checkout,'rev-parse','HEAD'),retryHead);
  await page.setViewportSize({width:390,height:844});await sync.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'docs/evidence/repository-sync-mobile.png'});
  await page.locator('.repository > summary').click();await expect(connection).toBeVisible();
  await page.route('**/api/repository',route=>route.fulfill({status:400,json:{error:'Pasta indisponível (teste).'}}));await page.reload();
  await expect(connection).toHaveText('Conexão indisponível');await expect(connection).toHaveAttribute('data-state','pending');
  assert.deepEqual(errors,[]);
  console.log('PASS: sync icon commits and pushes a real folder, honors commit-note preference, handles cancellation and retries a failed push; connection badge persists while collapsed, unavailable folders stay unconfirmed, and four viewports in both themes meet contrast requirements.');
}finally{await browser?.close();if(server){server.kill();await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(directory,{recursive:true,force:true});}
