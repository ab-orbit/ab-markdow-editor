import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
await mkdir('docs/evidence/library-insertion',{recursive:true});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:844},locale:'en-US',serviceWorkers:'block'});
  await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();
  await page.getByLabel('Markdown file',{exact:true}).setInputFiles({name:'Library.md',mimeType:'text/markdown',buffer:Buffer.from('# Library\n')});
  await page.getByRole('button',{name:'Open whiteboard',exact:true}).click();
  await expect(page.locator('[data-whiteboard-state]')).toHaveAttribute('data-whiteboard-state','ready',{timeout:60000});
  const importDrawing=page.getByRole('button',{name:'Import .excalidraw into whiteboard',exact:true});await expect(importDrawing).toContainText('Import drawing');
  const file=page.getByLabel('Whiteboard file',{exact:true});await expect(file).toHaveAttribute('accept','.excalidraw,application/vnd.excalidraw+json');
  await file.setInputFiles({name:'note.md',mimeType:'text/markdown',buffer:Buffer.from('# Wrong format')});
  await expect(page.getByRole('alert')).toContainText('To import Markdown notes, return to Note mode.');
  await file.setInputFiles({name:'invalid.excalidraw',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.getByRole('alert')).toContainText('does not contain a valid Excalidraw drawing');
  await file.setInputFiles({name:'valid.excalidraw',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'excalidraw',version:2,elements:[],appState:{},files:{}}))});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByTitle('Library',{exact:true}).click();
  const insert=page.getByRole('button',{name:'Add selected',exact:true});await expect(insert).toBeVisible();await expect(insert).toBeDisabled();
  const cells=page.locator('.library-unit__active');await expect(cells.first()).toBeVisible({timeout:30000});
  await cells.nth(0).locator('.library-unit__checkbox').click();await cells.nth(1).locator('.library-unit__checkbox').click();
  const add=page.getByRole('button',{name:'Add selected (2)',exact:true});await expect(add).toBeEnabled();
  await page.screenshot({path:`docs/evidence/library-insertion/${engine.name()}-selected.png`});
  await add.click();await expect(page.locator('.library-menu-items-container')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to note',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Note text',exact:true});await expect(editor).toBeVisible();
  await expect(editor.locator('[data-excalidraw-state]')).toHaveAttribute('data-excalidraw-state','ready',{timeout:30000});
  await page.getByRole('button',{name:'See drawing code',exact:true}).click();
  const scene=JSON.parse(await editor.locator('pre').innerText());expect(scene.elements.filter(element=>!element.isDeleted).length).toBeGreaterThan(1);
  await page.getByRole('button',{name:'Hide drawing code',exact:true}).click();
  await page.screenshot({path:`docs/evidence/library-insertion/${engine.name()}-inserted.png`});
  console.log(`${engine.name()}: selected library symbols inserted without leaving the app; sidebar dismissed and drawing returned to note.`);
 }finally{await browser.close();}
}}finally{await server.close();}
