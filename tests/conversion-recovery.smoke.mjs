import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
const markdown='# Recovered content\n\nText with an unfinished expression x = {.\n';
const raw=JSON.stringify({data:{success:true,source:'file',cleaned_text:markdown},metadata:{function:'convert_to_markdown'}});
try{
 const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 const boards=await page.evaluate(async()=>{
  const {WhiteboardSource}=await import('/src/lib/markdown/whiteboard.ts');
  const {EMPTY_EXCALIDRAW}=await import('/src/lib/markdown/excalidrawScene.ts');
  const prose=new WhiteboardSource();prose.read('# A heading\n\nProse text.');prose.append();
  const empty=new WhiteboardSource();empty.read('<!-- Comment -->\n');empty.append();
  const existing=new WhiteboardSource();const scenes=existing.read('\uFEFF```excalidraw\n'+EMPTY_EXCALIDRAW+'\n```\n');
  return {title:prose.read(prose.replace(0,EMPTY_EXCALIDRAW))[0].title,proseStandalone:prose.standalone,emptyStandalone:empty.standalone,bomBoards:scenes.length,bomStandalone:existing.standalone};
 });
 assert.deepEqual(boards,{title:'A heading',proseStandalone:false,emptyStandalone:true,bomBoards:1,bomStandalone:true});
 // Simulate an old frozen session whose exact JSON source had already been saved in the library.
 await page.evaluate(async raw=>{
  const library=await new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readwrite'),store=tx.objectStore('library'),get=store.get('state');let state;get.onsuccess=()=>{state=get.result;state.notes['legacy-response.md']={name:'legacy-response.md',value:raw,version:'original-version',modifiedAt:new Date().toISOString(),files:[],cached:true};store.put(state,'state');};tx.oncomplete=()=>{db.close();resolve(state);};};});
  await new Promise(resolve=>{const request=indexedDB.open('ab-markdown-drafts',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),id=sessionStorage.getItem('ab-markdown-draft-id'),get=store.get(id);get.onsuccess=()=>store.put({...get.result,id,repository:{repository:'Notas neste navegador',scope:'state',branch:'',status:''},name:'legacy-response.md',loadedName:'legacy-response.md',value:raw,baseline:raw,version:'original-version',importedVersion:null,pendingSync:false,autoSavePaused:false,assets:[],updatedAt:Date.now()});tx.oncomplete=()=>{db.close();resolve(true);};};});
 },raw);
 await page.reload();await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();await expect(page.getByRole('heading',{name:'Recovered content',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result.notes['legacy-response (Markdown).md']?.value);tx.oncomplete=()=>db.close();};})),{timeout:10000}).toBe(markdown);
 const original=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result.notes['legacy-response.md']);tx.oncomplete=()=>db.close();};}));
 assert.equal(original.value,raw);assert.equal(original.version,'original-version');
 await page.getByRole('button',{name:'legacy-response.md',exact:true}).click();await expect(page.getByRole('heading',{name:'Recovered content',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result.notes['legacy-response (Markdown) (1).md']?.value);tx.oncomplete=()=>db.close();};})),{timeout:10000}).toBe(markdown);
 console.log('PASS: legacy JSON drafts and saved library notes recover into distinct Markdown copies; original bytes/version stay unchanged and copy collisions increment.');
}finally{await browser.close();await server.close();}
