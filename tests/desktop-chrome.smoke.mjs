import {chromium, webkit, expect} from '@playwright/test';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=http.createServer(async(request,response)=>{
 try{const path=new URL(request.url,'http://localhost').pathname;const file=new URL('../'+(process.env.SCRIBA_TEST_DIST || 'dist')+'/' +(path==='/'?'index.html':path.slice(1)),import.meta.url);response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path==='/'?'text/html':'application/octet-stream');response.end(await readFile(file));}catch{response.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const safari=process.env.MARKDOWN_BROWSER==='webkit';
const browser=await(safari?webkit:chromium).launch({headless:true});
try {
 const context=await browser.newContext({locale:'pt-BR',viewport:{width:2048,height:1152},serviceWorkers:'block'});
 const page=await context.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await mkdir('docs/evidence/desktop-chrome',{recursive:true});
 for(const width of [2048,1440,390]) {
  await page.setViewportSize({width,height:width===390?844:900});
  if(width>=900){
   const sidebar=page.locator('.notes-sidebar');
   assert.equal(Math.round((await sidebar.boundingBox()).width),280);
   const note=sidebar.locator('nav strong').first();
   assert.ok(Number.parseFloat(await note.evaluate(e=>getComputedStyle(e).fontSize))>=15);
   const action=page.locator('.notes-header-actions button').first();
   assert.equal(await action.evaluate(e=>getComputedStyle(e).borderTopColor),'rgba(0, 0, 0, 0)');
   const formats=page.getByRole('group',{name:'Formato do documento',exact:true});
   const area=page.getByRole('region',{name:'Bancada Markdown',exact:true});
   const box=await formats.boundingBox();const origin=await area.boundingBox();
   assert.ok(box.x-origin.x<300,'Commands remain beside the document tab on wide displays');
  }
  await page.screenshot({path:`docs/evidence/desktop-chrome/interface-${width}-${safari?'webkit':'chrome'}.png`});
  if(width===2048){
   const group=page.getByRole('group',{name:'Formato do documento',exact:true});
   await group.getByRole('button',{name:'Whiteboard',exact:true}).click();
   await expect(page.getByRole('region',{name:'Whiteboard Excalidraw',exact:true})).toHaveAttribute('data-whiteboard-state','ready');
   await page.screenshot({path:`docs/evidence/desktop-chrome/whiteboard-${safari?'webkit':'chrome'}.png`});
   await group.getByRole('button',{name:'Nota',exact:true}).click();
  }
 }
 console.log('PASS: desktop interface font, sidebar width, quiet icons, nearby commands and mobile layout.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
