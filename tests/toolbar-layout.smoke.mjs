import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
await mkdir('docs/evidence/toolbar-layout',{recursive:true});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{const context=await browser.newContext({locale:'en-US',viewport:{width:1180,height:820},serviceWorkers:'block'});const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);
 const name='Whiteboard 2026-10-22T14-12-33-918Z — Architecture planning and supporting diagrams for the entire project.md';
 await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();await page.getByLabel('Markdown file',{exact:true}).setInputFiles({name,mimeType:'text/markdown',buffer:Buffer.from('# Long filename\n')});
 await page.getByRole('button',{name:'Whiteboard',exact:true}).click();await expect(page.locator('[data-whiteboard-state]')).toHaveAttribute('data-whiteboard-state','ready',{timeout:60000});
 for(const [width,height]of [[1180,820],[1024,768],[1440,900],[820,1180],[1180,820]]){
  await page.setViewportSize({width,height});
  if(width<900){await expect(page.locator('#recent-notes')).toHaveCount(0);await expect(page.getByRole('button',{name:'Back to note',exact:true})).toBeVisible();continue;}
  const rename=page.getByRole('button',{name:'Rename file',exact:true});await expect(rename).toBeVisible();await expect(rename).toHaveAttribute('title',name);
  const geometry=await rename.evaluate(button=>{const header=button.closest('header'),filename=button.parentElement,close=filename.querySelector('button:not([title])')||filename.lastElementChild;const box=node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};const groups=[...header.children].filter(node=>node.tagName==='DIV'&&node.getClientRects().length).map(box);const style=getComputedStyle(header);return {button:box(button),close:box(close),filename:box(filename),groups,right:header.getBoundingClientRect().right-parseFloat(style.paddingRight)-parseFloat(style.borderRightWidth),ellipsis:getComputedStyle(button).textOverflow,clipped:button.scrollWidth>button.clientWidth};});
  expect(geometry.ellipsis).toBe('ellipsis');expect(geometry.button.right).toBeLessThanOrEqual(geometry.close.x);expect(geometry.close.right).toBeLessThanOrEqual(geometry.filename.right+1);
  for(const [index,a]of geometry.groups.entries())for(const b of geometry.groups.slice(index+1))expect(a.x>=b.right-.5||b.x>=a.right-.5||a.y>=b.bottom-.5||b.y>=a.bottom-.5).toBeTruthy();
  expect(Math.abs(geometry.groups.at(-1).right-geometry.right)).toBeLessThanOrEqual(2);
  await page.screenshot({path:`docs/evidence/toolbar-layout/${engine.name()}-${width}x${height}.png`});
 }
 console.log(`${engine.name()}: long filenames truncate inside their own group, controls never overlap and actions use the right edge after rotation.`);
 await page.getByRole('button',{name:'Note',exact:true}).click();await expect(page.getByRole('textbox',{name:'Note text',exact:true})).toBeVisible();await page.screenshot({path:`docs/evidence/toolbar-layout/${engine.name()}-note-landscape.png`});
 await context.close();}finally{await browser.close();}
}}finally{await server.close();}
