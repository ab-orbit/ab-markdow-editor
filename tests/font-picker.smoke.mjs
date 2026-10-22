import {chromium, webkit, expect} from '@playwright/test';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=http.createServer(async(request,response)=>{
 try{const path=new URL(request.url,'http://localhost').pathname;const file=new URL(path==='/'?'index.html':path.slice(1),new URL(process.env.SCRIBA_TEST_DIST || '../dist/',import.meta.url));response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path==='/'?'text/html':'application/octet-stream');response.end(await readFile(file));}catch{response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const safari=process.env.MARKDOWN_BROWSER==='webkit';
const browser=await(safari?webkit:chromium).launch({headless:true});
try{
 const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'Fonts.md',mimeType:'text/markdown',buffer:Buffer.from('# Fonts\n')});
 await page.getByRole('group',{name:'Formato do documento',exact:true}).getByRole('button',{name:'Whiteboard',exact:true}).click();
 const board=page.getByRole('region',{name:'Whiteboard Excalidraw',exact:true});
 await expect(board).toHaveAttribute('data-whiteboard-state','ready');
 await board.getByRole('radio',{name:'Texto',exact:true}).locator('..').click();
 await mkdir('docs/evidence/font-picker-alignment',{recursive:true});
 for(const width of [440,390,1440]){
  await page.setViewportSize({width,height:width===1440?900:956});
  const close=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(await close.isVisible())await close.click();
  if(width===440){
   const drawing=board.locator('canvas').last();
   await drawing.click({position:{x:100,y:150}});
   await page.keyboard.type('Drawing preview');
   await page.keyboard.press('Escape');
  }
  const edit=board.getByRole('button',{name:'Editar',exact:true});
  if(width<700 && !await page.locator('.FontPicker__container').isVisible() && await edit.isVisible())await edit.click();
  const picker=page.locator('.FontPicker__container');
  await expect(picker).toBeVisible();
  if(width<700){
   const panel=page.locator('.App-mobile-menu');
   const box=await panel.boundingBox();
   assert.ok(box.height<=281,'Properties leave most of the drawing visible');
   await picker.scrollIntoViewIfNeeded();
  }
  const controls=picker.locator('button');
  const geometry=await controls.evaluateAll(elements=>elements.map(element=>({id:element.dataset.testid,...element.getBoundingClientRect().toJSON()})));
  assert.equal(geometry.length,4);
  assert.ok(Math.max(...geometry.map(x=>x.y))-Math.min(...geometry.map(x=>x.y))<2,`Font controls align at ${width}px`);
  if(width<700)for(const box of geometry)assert.ok(box.width>=44 && box.height>=44,'Font choices retain 44px touch targets');
  const normal=picker.getByTestId('font-family-normal');await normal.click();await expect(normal).toHaveClass(/active/);
  const expand=picker.getByTestId('font-family-show-fonts');await expand.click();
  await expect(page.getByPlaceholder('Quick search')).toBeVisible();
  if(width<700){
   const popup=await page.locator('.properties-content > .Island').boundingBox();
   assert.ok(popup.y >= (await page.locator('.App-mobile-menu').boundingBox()).y - 16,'Font list overlays properties rather than the drawing');
   assert.ok(popup.height<=281 && popup.x>=0 && popup.x+popup.width<=width,'Font list stays bounded on mobile');
  }
  await page.screenshot({path:`docs/evidence/font-picker-alignment/fonts-${width}-${safari?'webkit':'chrome'}.png`});
  await page.keyboard.press('Escape');
  console.log(`PASS: font alignment, touch sizes, selection and full picker at ${width}px.`);
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
