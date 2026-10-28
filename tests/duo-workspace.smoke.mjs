import {webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';

// Browser regression complements real UIKit tests; it does not simulate a hinge.
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/dist/**','**/dist-ios/**','**/ios/**','**/artifacts/**','**/docs/evidence/**']}}});await server.listen();
const browser=await webkit.launch({headless:true});
const evidence='docs/evidence/iphone-duo-20261027';mkdirSync(evidence,{recursive:true});
const source='# Acervo Aurora\r\n\r\nUma nota para acompanhar a pesquisa, reunir evidências e desenvolver uma ideia.\r\n\r\n## Fontes\r\n\r\n| Documento de referência | Responsável | Próximo passo detalhado | Situação |\r\n|---|---|---|---|\r\n| Entrevistas com a equipe | Pesquisa | Conferir as transcrições e registrar as citações | Em revisão |\r\n| Coleção histórica da cidade | Curadoria | Confirmar datas e organizar o inventário | Em andamento |\r\n\r\n## Plano\r\n\r\n- [ ] Revisar evidências\r\n- [ ] Escrever a síntese\r\n';
const results=[];
// CSS integration fixture only: this is deliberately not called a simulated hinge.
async function reserveRegionFixture(page,enabled){
 await page.evaluate(enabled=>{
  const root=document.documentElement,app=document.querySelector('.editor-app');
  root.dataset.nativeChrome=String(enabled);app.dataset.workspaceDivided=String(enabled);app.dataset.workspaceArrangement='overlay';
  for(const [key,value] of Object.entries({'x':730,'y':20,'width':690,'height':860})){
   const property=`--workspace-focus-${key}`;
   if(enabled)app.style.setProperty(property,`${value}px`);else app.style.removeProperty(property);
  }
 },enabled);
}
try {
 for(const [width,height,theme] of [[390,844,'light'],[844,390,'dark'],[768,1024,'light'],[1024,768,'dark'],[1440,900,'light']]){
  const page=await browser.newPage({locale:'pt-BR',hasTouch:width<1200,isMobile:width<900,viewport:{width,height},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(theme=>localStorage.setItem('ab-markdown-theme',theme),theme);
  await page.goto(server.resolvedUrls.local[0]);
  await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
  await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'Aurora.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
  await expect(page.getByRole('article')).toContainText('Acervo Aurora');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const table=page.getByRole('table');const tableBox=await table.boundingBox();
  if(width===390)assert.ok(tableBox.width>390,'The table keeps readable columns and scrolls horizontally.');
  await page.screenshot({path:`${evidence}/browser-${theme}-${width}x${height}.png`});
  // Exercise the exact command channel used by UIKit, retaining the normal browser shell.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:live'})));
  const text=page.getByRole('textbox',{name:'Texto da nota',exact:true});await expect(text).toBeVisible();
  assert.ok(await text.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))>=16);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:source'})));
  await expect(page.locator('.cm-content')).toContainText('## Fontes');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:read'})));
  await expect(page.getByRole('article')).toContainText('Coleção histórica da cidade');
  if(width===1024){
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:whiteboard'})));
   const board=page.getByRole('region',{name:'Whiteboard Excalidraw',exact:true});await expect(board).toHaveAttribute('data-whiteboard-state','ready',{timeout:30000});
   const bounds=await board.locator('canvas.interactive').boundingBox();
   await board.getByRole('radio',{name:'Texto',exact:true}).locator('..').click();
   await page.mouse.click(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
   const input=board.locator('textarea.excalidraw-wysiwyg');await expect(input).toBeVisible();await input.fill('Uma ideia preservada entre telas');
   // Deliberately leave the text box active. A native mode command must commit it first.
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:live'})));
   await expect(text).toBeVisible({timeout:30000});
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:source'})));
   await expect(page.locator('.cm-content')).toContainText('Uma ideia preservada entre telas');
   await expect(page.locator('.cm-content')).toContainText('Coleção histórica da cidade');
  }
  if(width===1440){
   // A loading veil blocks pointer input, but a library button can retain keyboard focus.
   page.on('dialog',dialog=>dialog.accept());
   await page.evaluate(()=>{
    const file=new File(['# Importação anterior\n\nNão pode substituir a nota escolhida.'],'slow.md',{type:'text/markdown'});
    const bytes=file.arrayBuffer();
    file.arrayBuffer=()=>new Promise(resolve=>{window.__releaseDuoImport=async()=>resolve(await bytes);window.__duoImportStarted=true;});
    const transfer=new DataTransfer();transfer.items.add(file);
    const input=document.querySelector('input[aria-label="Arquivo Markdown"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   });
   await page.waitForFunction(()=>window.__duoImportStarted===true);
   const otherNote=page.locator('.open-note').first();await expect(otherNote).toBeEnabled();await otherNote.focus();await page.keyboard.press('Enter');
   await expect(page.getByRole('article')).not.toContainText('Acervo Aurora');
   const selectedTitle=await page.getByRole('article').locator('h1').first().textContent();
   await page.evaluate(async()=>{await window.__releaseDuoImport();await new Promise(resolve=>setTimeout(resolve,500));});
   await expect(page.getByRole('article').locator('h1').first()).toHaveText(selectedTitle);
   await expect(page.getByRole('article')).not.toContainText('Importação anterior');
   await reserveRegionFixture(page,true);
   const libraryBounds=await page.locator('#recent-notes').boundingBox();
   assert.ok(libraryBounds.x>=730 && libraryBounds.x+libraryBounds.width<=1421,'An overlay library stays within its reserved-region fixture.');
   await reserveRegionFixture(page,false);
   await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();
   await page.getByRole('menuitem',{name:'Configurações',exact:true}).click();
   await expect(page.locator('#settings-page')).toBeVisible();
   await reserveRegionFixture(page,true);
   const settingsBounds=await page.locator('#settings-page').boundingBox();
   assert.ok(settingsBounds.x>=730 && settingsBounds.x+settingsBounds.width<=1421 && settingsBounds.y>=20 && settingsBounds.y+settingsBounds.height<=881,'Settings stay on one side of the reserved-region fixture.');
   await expect(page.locator('.editor-layout')).toBeHidden();
   await page.evaluate(()=>{const status=document.createElement('p');status.className='notice toast';status.textContent='Estado de teste da região reservada';status.dataset.regionFixture='true';document.querySelector('.editor-app').append(status);});
   const toastBounds=await page.locator('[data-region-fixture]').boundingBox();
   assert.ok(toastBounds.x>=730 && toastBounds.x+toastBounds.width<=1421 && toastBounds.y>=20 && toastBounds.y+toastBounds.height<=881,'Status also stays inside the fixture region.');
   await page.screenshot({path:`${evidence}/browser-reserved-region-css-fixture.png`});
  }
  assert.deepEqual(errors,[]);results.push({width,height,theme,overflow:false,editingMinimum:16,commands:true});
  await page.close();
 }
 writeFileSync(`${evidence}/browser-regression.json`,JSON.stringify(results,null,2)+'\n');
 console.log('PASS: five WebKit viewports; both themes; table scrolling; reading/source/writing; whiteboard text committed before native mode changes; stale imports cannot replace a newly selected note.');
}finally{await browser.close();await server.close();}
