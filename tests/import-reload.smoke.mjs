import {chromium, webkit, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';

// All disk and Git writes belong to disposable fixtures, never the user's notes.
const exec=promisify(execFile),git=async(cwd,...args)=>(await exec('git',['-C',cwd,...args])).stdout.trim();
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-import-reload-'));
let server,browser;
try {
  const state=path.join(directory,'state'),checkout=path.join(directory,'notes'),remote=path.join(directory,'remote.git');
  await Promise.all([state,checkout,remote].map(folder=>fs.mkdir(folder)));const root=await fs.realpath(checkout);
  await git(remote,'init','--bare','-b','main');await git(root,'init','-b','main');
  for(const[key,value]of[['user.name','Scriba Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(root,'config',key,value);
  await fs.writeFile(path.join(root,'Salva.md'),'# Nota do repositório');await git(root,'add','.');await git(root,'commit','-m','Initial');await git(root,'remote','add','origin',remote);await git(root,'push','-u','origin','main');
  await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:root,preferences:{askCommitNote:false,autoSave:false,intervalMinutes:1}}));
  await fs.writeFile(path.join(state,'library.json'),JSON.stringify({[root]:{pinned:['Salva.md'],welcomeImageVersion: 1, diagramManualVersion: 1}}));
  const runtime=path.join(directory,'runtime.json');server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  let origin;for(let i=0;i<100;i++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(origin);
  const safari=process.env.MARKDOWN_BROWSER==='webkit';browser=safari?await webkit.launch({headless:true}):await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);
  const reload=page.getByRole('button',{name:'Recarregar do disco',exact:true}).first(),workbench=page.getByLabel('Bancada Markdown'),editor=page.locator('.cm-content');
  await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
  await expect(reload).toBeDisabled();assert.notEqual(await reload.evaluate(element=>getComputedStyle(element).cursor),'wait','unavailable actions must not look like ongoing work');
  const outside=path.join(directory,'Externa.md'),wrong=path.join(directory,'Outro-arquivo.md');
  await fs.writeFile(outside,'# Original externo\n\nAberto sem mover o arquivo.');await fs.writeFile(wrong,'# Arquivo diferente');
  await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles(outside);await expect(workbench).toHaveAttribute('data-mode','read');
  await expect(reload).toBeEnabled();await expect(reload).toHaveAttribute('aria-busy','false');await expect(reload).toHaveAttribute('title',/selecione novamente o arquivo original/i);
  const head=await git(root,'rev-parse','HEAD');
  async function choose(file) {const chooser=page.waitForEvent('filechooser');await reload.click();await(await chooser).setFiles(file);}
  await fs.writeFile(outside,'# Atualizado no disco\n\nVersão relida do arquivo original.');await choose(outside);
  await expect(page.getByRole('heading',{name:'Atualizado no disco',exact:true})).toBeVisible();await expect(reload).toBeEnabled();
  await expect(page.getByRole('status').filter({hasText:'Arquivo relido do disco.'})).toBeVisible();
  assert.equal(await git(root,'rev-parse','HEAD'),head,'reading the original never commits');
  assert.equal(await fs.stat(path.join(root,'Externa.md')).then(()=>true,()=>false),false,'reading the original never copies it into the repository');
  // Cancel the chooser, then reject a different filename without replacing the current note.
  await choose([]);await expect(page.getByRole('heading',{name:'Atualizado no disco',exact:true})).toBeVisible();await expect(reload).toBeEnabled();
  await choose(wrong);await expect(page.getByRole('alert').filter({hasText:'Selecione o arquivo original Externa.md'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Atualizado no disco',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fonte',exact:true}).click();await editor.fill('# Meu rascunho protegido');
  page.once('dialog',dialog=>dialog.dismiss());await choose(outside);await expect(editor).toHaveText('# Meu rascunho protegido');await expect(workbench).toHaveAttribute('data-mode','source');
  page.once('dialog',dialog=>dialog.accept());await choose(outside);await expect(editor).toContainText('Versão relida do arquivo original.');await expect(workbench).toHaveAttribute('data-mode','source');await expect(reload).toBeEnabled();
  for(const size of[{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768}]) {
    await page.setViewportSize(size);if(size.width<900&&await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).isVisible())await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).click();
    await expect(reload).toBeVisible();await expect(reload).toBeEnabled();assert.equal(await reload.evaluate(element=>getComputedStyle(element).cursor),'pointer');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(!safari&&[1440,390].includes(size.width))await page.screenshot({path:`docs/evidence/import-reload-${size.width===1440?'desktop':'mobile'}.png`});
  }
  await page.setViewportSize({width:1440,height:900});await editor.fill('# Cópia salva no destino Git');await page.getByRole('button',{name:'Salvar no repositório',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Arquivo salvo, commit criado e enviado ao remoto.'})).toBeVisible();
  assert.equal(await git(remote,'show','main:Externa.md'),'# Cópia salva no destino Git');assert.ok((await fs.readFile(outside,'utf8')).includes('Versão relida do arquivo original.'));
  await expect(reload).not.toHaveAttribute('title',/selecione novamente/);
  await fs.writeFile(path.join(root,'Externa.md'),'# Agora relida diretamente do repositório');await reload.click();await expect(editor).toHaveText('# Agora relida diretamente do repositório');await expect(reload).toBeEnabled();
  assert.deepEqual(errors,[]);console.log(`PASS (${safari?'WebKit':'Chromium'}): disabled controls have no wait cursor; imported file reload opens a chooser, reads fresh bytes without Git writes, preserves mode, handles cancellation/wrong files/dirty confirmation, works on phone/tablet, and uses direct repository reload after saving.`);
} finally {await browser?.close();if(server){server.kill();await new Promise(resolve=>server.once('exit',resolve));}await fs.rm(directory,{recursive:true,force:true});}
