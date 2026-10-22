import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {zipSync,strToU8} from 'fflate';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const text='# Original\n\nContent to duplicate.\n\n![Pixel](assets/pixel.png)\n\n```mermaid\ngraph LR\n A-->B\n```\n';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},locale:'en-US',serviceWorkers:'block'});await page.goto(server.resolvedUrls.local[0]);
  await expect(page.getByLabel('Markdown file',{exact:true})).toBeEnabled();
  await page.getByLabel('Markdown file',{exact:true}).setInputFiles({name:'Original.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'text.md':strToU8(text),'assets/pixel.png':png}))});
  await expect(page.locator('header button[aria-label="Rename file"]')).toHaveText('Original.md',{timeout:30000});
  await page.getByRole('button',{name:'Edit note',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Note text',exact:true});await expect(editor).toBeVisible();

  await editor.locator('p').filter({hasText:'Content to duplicate.'}).click();await page.keyboard.type(' Unsaved original edit.');
  await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByRole('menuitem',{name:'Make a copy',exact:true}).click();
  await expect(page.locator('header button[aria-label="Rename file"]')).toHaveText(/^Copy of Original .*\.md$/,{timeout:30000});
  const copyName=await page.locator('header button[aria-label="Rename file"]').textContent();
  const docs=await page.evaluate(async copyName=>{const {browserFetch}=await import('/src/lib/browserStore.ts');const get=async name=>(await browserFetch('document?name='+encodeURIComponent(name))).json();return {original:await get('Original.md'),copy:await get(copyName)};},copyName);
  expect(docs.copy.value).toBe(docs.original.value);expect(docs.original.value).toContain('Unsaved original edit.');expect(docs.copy.value).toContain('```mermaid');expect(docs.copy.files).toEqual(docs.original.files);expect(docs.copy.files.length).toBeGreaterThan(0);
  await page.reload();await expect(page.locator('header button[aria-label="Rename file"]')).toHaveText(copyName);
  console.log(`${engine.name()}: copy saves unsaved original, preserves attached image and diagram, opens independently and survives reload.`);
 }finally{await browser.close();}
}}finally{await server.close();}
