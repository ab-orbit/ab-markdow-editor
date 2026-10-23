import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
/** Isolated UI regression: large drawing source returns to preview; copy actions retain a separate row. */
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();const engine=process.env.SMOKE_BROWSER==='webkit'?'webkit':'chromium';const browser=await ({chromium,webkit}[engine]).launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.addInitScript(()=>{Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});localStorage.setItem('scriba-language','pt');localStorage.setItem('scriba-welcome-opened','1');});await page.goto(server.resolvedUrls.local[0]);
 const input=page.locator('header input[type=file][accept*=".bear"]');await expect(input).toBeEnabled({timeout:30000});
 const scene=await page.evaluate(async()=>{const {loadExcalidraw}=await import('/src/lib/markdown/excalidraw.ts');const sdk=await loadExcalidraw();const elements=sdk.convertToExcalidrawElements(Array.from({length:30},(_,n)=>({type:'rectangle',x:n*10,y:n*70,width:450,height:60,label:{text:'SUPERCOMPUTAÇÃO DE ALTO DESEMPENHO '+n,fontSize:20}})));return JSON.stringify({type:'excalidraw',version:2,elements,appState:{},files:{}},null,2);});
 await input.setInputFiles({name:'excalidraw-regression.md',mimeType:'text/markdown',buffer:Buffer.from('# Test\n\n```excalidraw\n'+scene+'\n```\n\nAfter\n')});
 await expect(page.locator('[data-excalidraw-state="ready"]')).toBeVisible({timeout:60000});console.log('Initial drawing ready; scene length',scene.length);
 
 await page.getByRole('button',{name:'Ler',exact:true}).click();
 await page.getByRole('button',{name:'Ver código do desenho',exact:true}).click();
 await page.getByRole('button',{name:'Editar JSON',exact:true}).click();
 await expect(page.locator('[data-mode]')).toHaveAttribute('data-mode','live');
 await page.getByRole('button',{name:'Visão',exact:true}).click();
 await expect(page.locator('[data-mode]')).toHaveAttribute('data-mode','split');
 await expect(page.locator('[data-inline-block-editor]')).toHaveCount(0);
 await expect(page.locator('article [data-excalidraw-state="ready"]')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Salvar como',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Salvar uma cópia',exact:true});await expect(dialog).toBeVisible();
 const {mkdir}=await import('node:fs/promises');await mkdir('docs/evidence/save-copy-layout',{recursive:true});
 for(const [width,height,label]of [[1440,900,'desktop'],[390,844,'mobile']]){
  await page.setViewportSize({width,height});await dialog.getByLabel('Nome da cópia').fill('Análise Comparativa e Diretrizes Estratégicas para a Governança e Plano de Inteligência Artificial.md');
  const inputBox=await dialog.getByLabel('Nome da cópia').boundingBox();const footerBox=await dialog.locator('footer').boundingBox();
  if(footerBox.y<inputBox.y+inputBox.height)throw Error('Actions overlap the filename row');
  const geometry=await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));if(geometry.scroll>geometry.width+1)throw Error('Dialog overflows horizontally');
  await page.screenshot({path:'docs/evidence/save-copy-layout/'+engine+'-'+label+'.png'});
 }
 console.log('Save-copy layout: separate action row and no horizontal overflow on desktop/mobile');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await browser.close();await server.close();}
