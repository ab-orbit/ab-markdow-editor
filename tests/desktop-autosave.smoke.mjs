import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
process.env.VITE_STORAGE_MODE='browser';
const server=process.env.SCRIBA_URL?null:await createServer({server:{host:'127.0.0.1',port:0}});if(server)await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
async function storage(page,modify=false){return page.evaluate(modify=>new Promise((resolve,reject)=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library',modify?'readwrite':'readonly'),store=tx.objectStore('library'),get=store.get('state');get.onsuccess=()=>{const state=get.result;if(modify){state.preferences.autoSave=false;state.preferences.askCommitNote=true;store.put(state,'state');}else resolve(state);};tx.oncomplete=()=>{db.close();if(modify)resolve(true);};tx.onerror=()=>reject(tx.error);};}),modify);}
try{
 const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(process.env.SCRIBA_URL||server.resolvedUrls.local[0]);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await storage(page,true);await page.reload();await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'desktop-autosave.md',mimeType:'text/markdown',buffer:Buffer.from('# Desktop autosave\n\nOriginal paragraph.\n')});
 await expect(page.getByRole('heading',{name:'Desktop autosave',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Escrever',exact:true}).click();
 const editor=page.locator('.tiptap');await editor.locator('p').click();await page.keyboard.press('End');await page.keyboard.insertText(' DESKTOP-AUTO-SAVED');
 await expect.poll(async()=>{const state=await storage(page);return state.notes['desktop-autosave.md']?.value;},{timeout:10000}).toContain('DESKTOP-AUTO-SAVED');
 await expect(page.getByRole('dialog',{name:'Nota do commit',exact:true})).toHaveCount(0);
 await expect(editor).toBeFocused();
 await page.keyboard.insertText(' STILL-EDITING');
 await expect.poll(async()=>{const state=await storage(page);return state.notes['desktop-autosave.md']?.value;},{timeout:10000}).toContain('STILL-EDITING');
 await page.getByRole('button',{name:'Configurações',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Ativar salvamento automático',exact:true})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Ativar salvamento automático',exact:true})).toBeDisabled();
 console.log('PASS: desktop autosaves despite legacy opt-out, bypasses commit prompts and preserves editing focus across repeated saves.');
}finally{await browser.close();await server?.close();}
