import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
await mkdir('docs/evidence/whiteboard-colors',{recursive:true});
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({locale:'en-US',viewport:{width,height:900},serviceWorkers:'block'});const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);
  await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();
  async function showNotes(){if(width<900)await page.getByRole('button',{name:'Back to notes',exact:true}).click();await expect(page.getByRole('button',{name:'New whiteboard',exact:true})).toBeVisible();}
  await showNotes();await page.getByRole('button',{name:'New whiteboard',exact:true}).click();
  const board=page.locator('[data-whiteboard-state]');await expect(board).toHaveAttribute('data-whiteboard-state','ready',{timeout:60000});
  const original=await page.locator('header button[aria-label="Rename file"]').textContent();expect(original).toMatch(/Whiteboard \d{4}-\d{2}-\d{2}T.+\.md$/);
  async function openRename(){if(width<900){await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByRole('menuitem',{name:'Rename file',exact:true}).click();}else await page.getByRole('button',{name:'Rename file',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rename file',exact:true})).toBeVisible();}
  await openRename();await page.getByLabel('File name',{exact:true}).fill('Project drawing.md');await page.getByRole('button',{name:'Rename',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rename file',exact:true})).toHaveCount(0);
  await expect(page.locator('header button[aria-label="Rename file"]')).toHaveText('Project drawing.md');
  const stored=()=>page.evaluate(async()=>{const {browserFetch}=await import('/src/lib/browserStore.ts');return (await browserFetch('document?name=Project%20drawing.md')).json();});expect((await stored()).value).toContain('```excalidraw');
  await board.getByRole('radio',{name:'Rectangle',exact:true}).locator('..').click();const canvas=board.locator('canvas.interactive'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:5});await page.mouse.up();
  if(width<900){
   const back=page.getByRole('button',{name:'Back to note',exact:true});
   const geometry=await back.evaluate(button=>{const svg=button.querySelector('svg').getBoundingClientRect(),text=button.querySelector('span').getBoundingClientRect(),b=button.getBoundingClientRect();return {icon:svg.width,iconRight:svg.right,textLeft:text.left,textRight:text.right,right:b.right,width:b.width};});
   expect(geometry.icon).toBeGreaterThanOrEqual(18);expect(geometry.iconRight).toBeLessThanOrEqual(geometry.textLeft);expect(geometry.textRight).toBeLessThanOrEqual(geometry.right);expect(geometry.width).toBeGreaterThan(44);
   await page.screenshot({path:`docs/evidence/whiteboard-colors/${engine.name()}-${width}-back-to-note.png`});
   await back.click();
  }else await page.getByRole('button',{name:'Note',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Note text',exact:true});await expect(editor).toBeVisible({timeout:30000});
  await expect.poll(()=>editor.evaluate(element=>{const selection=window.getSelection();return !!selection?.anchorNode && element.contains(selection.anchorNode) && element.lastElementChild?.tagName==='P' && element.lastElementChild.contains(selection.anchorNode);})).toBe(true);
  await page.keyboard.type('Writing immediately after the drawing.');await expect(editor).toContainText('Writing immediately after the drawing.');
  expect(await editor.locator(':scope > p').count()).toBeGreaterThanOrEqual(2);
  await expect(editor.locator('[data-excalidraw-state]')).toHaveAttribute('data-excalidraw-state','ready',{timeout:30000});
  await page.screenshot({path:`docs/evidence/whiteboard-colors/${engine.name()}-${width}-writing-after-drawing.png`});
  await editor.locator('[data-diagram-zoom]').dblclick();
  await expect(page.getByRole('dialog',{name:'Excalidraw editor',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close Excalidraw editor',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Excalidraw editor',exact:true})).toHaveCount(0);

  await openRename();await page.getByLabel('File name',{exact:true}).fill('Renamed note.md');await page.getByRole('button',{name:'Rename',exact:true}).click();await expect(page.getByRole('dialog',{name:'Rename file',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.locator('header button[aria-label="Rename file"]')).toHaveText('Renamed note.md',{timeout:30000});
  expect(await page.evaluate(async()=>{const {browserFetch}=await import('/src/lib/browserStore.ts');return (await(await browserFetch('document?name=Renamed%20note.md')).json()).value;})).toContain('Writing immediately after the drawing.');
  await showNotes();await page.getByRole('button',{name:'New note',exact:true}).click();
  await expect(page.locator('header button[aria-label="Rename file"]')).toHaveText(/\d{4}-\d{2}-\d{2}T.+\.md$/);
  const newName=await page.locator('header button[aria-label="Rename file"]').textContent();expect(newName).toMatch(/\d{4}-\d{2}-\d{2}T.+\.md$/);expect(newName).not.toBe(original);
  console.log(`${engine.name()} ${width}: timestamped creation, real note/whiteboard rename and immediate writing after drawing survive reload.`);
  await context.close();
 }}finally{await browser.close();}
}}finally{await server.close();}
