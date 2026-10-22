import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
await mkdir('docs/evidence/whiteboard-colors',{recursive:true});
try {for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try {for(const width of [390,1024,1440]){
  const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:900},serviceWorkers:'block'});
  const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);
  await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();
  await page.getByLabel('Markdown file',{exact:true}).setInputFiles({name:'colors.md',mimeType:'text/markdown',buffer:Buffer.from('# Colors\n\n```excalidraw\n{"type":"excalidraw","version":2,"source":"scriba","elements":[],"appState":{},"files":{}}\n```\n')});
  await page.getByRole('button',{name:'Whiteboard',exact:true}).click();
  const board=page.locator('[data-whiteboard-state]');await expect(board).toHaveAttribute('data-whiteboard-state','ready',{timeout:60000});
  await page.setViewportSize({width,height:900});
  if(width<900 && await page.getByRole("button",{name:"Close list of notes",exact:true}).isVisible())await page.getByRole("button",{name:"Close list of notes",exact:true}).click();
  await page.screenshot({path:`/tmp/scriba-colors-layout-${width}.png`});
  await board.getByRole('radio',{name:/Rectangle/}).locator('..').click();
  if(width<900)await board.getByRole('button',{name:'Edit',exact:true}).click();
  await board.locator('.color-picker__button.active-color').first().click();
  const picker=page.getByRole('dialog',{name:'Color picker',exact:true});await expect(picker).toBeVisible();
  await picker.getByRole('button',{name:/^Blue /}).click();
  expect(await board.locator('.excalidraw').first().evaluate(element=>{const css=getComputedStyle(element);return css.getPropertyValue('--color-primary').trim()===css.getPropertyValue('--cyan').trim();})).toBe(true);
  const geometry=await picker.evaluate(element=>{const panel=element.getBoundingClientRect();const buttons=[...element.querySelectorAll('.color-picker__button')].map(button=>{const r=button.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});return {panel:{x:panel.x,y:panel.y,right:panel.right,bottom:panel.bottom},buttons};});
  for(const [index,a]of geometry.buttons.entries()) {expect(a.width).toBeGreaterThan(0);expect(a.height).toBeGreaterThan(0);expect(a.x).toBeGreaterThanOrEqual(geometry.panel.x);expect(a.right).toBeLessThanOrEqual(geometry.panel.right);for(const b of geometry.buttons.slice(index+1))expect(a.x>=b.right-.5||b.x>=a.right-.5||a.y>=b.bottom-.5||b.y>=a.bottom-.5).toBeTruthy();}
  expect(geometry.panel.x).toBeGreaterThanOrEqual(0);expect(geometry.panel.right).toBeLessThanOrEqual(width);
  await page.screenshot({path:`docs/evidence/whiteboard-colors/${engine.name()}-${width}.png`});
  console.log(`${engine.name()} ${width}: palette and shade swatches do not overlap or clip; Scriba material tokens applied.`);
  await context.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
