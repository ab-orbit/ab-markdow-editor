import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const safari=process.env.MARKDOWN_BROWSER==='webkit',browser=await(safari?webkit:chromium).launch({headless:true});
const originalPath=process.env.SCRIBA_PERFORMANCE_FILE;
const source=originalPath?await readFile(originalPath,'utf8'):JSON.stringify({data:{success:true,source:'file',cleaned_text:Array.from({length:300},(_,i)=>`## Chapter ${i+1}\n\n${Array.from({length:10},(_,j)=>`Paragraph ${i}-${j}. ${'Readable enterprise research text. '.repeat(7)}`).join('\n\n')}`).join('\n\n')},metadata:{function:'convert_to_markdown'}});
const expected=JSON.parse(source).data.cleaned_text,originalHash=createHash('sha256').update(source).digest('hex');
try{
 const context=await browser.newContext({locale:'pt-BR',viewport:safari?{width:390,height:844}:{width:1440,height:900},serviceWorkers:'block'});
 await context.addInitScript(()=>{
  window.loadingObservations={shown:0,painted:0};
  new MutationObserver(()=>{const loader=document.querySelector('[data-document-loading]');if(loader){window.loadingObservations.shown++;requestAnimationFrame(()=>{if(loader.isConnected)window.loadingObservations.painted++;});}}).observe(document,{childList:true,subtree:true});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();

 const before=await page.evaluate(()=>({...window.loadingObservations})),start=performance.now();
 await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'Large conversion export.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
 const close=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(await close.isVisible())await close.click();
 const article=page.getByRole('article',{name:'Prévia Markdown',exact:true});
 await expect(article.locator('h1,h2,h3,h4,h5,h6').first()).toBeVisible();
 await expect(page.locator('[data-document-loading]')).toHaveCount(0);
 const openedMs=Math.round(performance.now()-start);
 assert.equal(await page.locator('.tiptap').count(),0,'Import opens the book directly in reading mode');
 const observed=await page.evaluate(()=>window.loadingObservations);assert.ok(observed.painted>before.painted,'The plume paints before document preparation');
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('scriba-private-notes',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result.notes['Large conversion export (Markdown).md']?.value);tx.oncomplete=()=>db.close();};})),{timeout:20000}).toBe(expected);
 const responsiveStart=performance.now();
 if(safari){await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Configurações',exact:true})).toBeVisible();await page.keyboard.press('Escape');}
 else{await page.getByRole('button',{name:'Configurações',exact:true}).click();await expect(page.locator('#interface-language')).toBeVisible();await page.getByRole('button',{name:'Voltar ao editor',exact:true}).click();}
 const interactiveMs=Math.round(performance.now()-responsiveStart);
 console.log(JSON.stringify({stage:'opened',browser:safari?'webkit':'chromium',openedMs,interactiveMs}));
 const restoreStart=performance.now();await page.reload();await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled({timeout:20000});await expect(page.getByRole('article').locator('h1,h2,h3,h4,h5,h6').first()).toBeVisible();
 if(originalPath)assert.equal(createHash('sha256').update(await readFile(originalPath)).digest('hex'),originalHash,'Original file stays byte-identical');
 assert.deepEqual(errors,[]);
 const metrics={browser:safari?'webkit':'chromium',inputBytes:Buffer.byteLength(source),markdownCharacters:expected.length,openedMs,interactiveMs,loadingPainted:true,originalUnchanged:true,restoredAfterReload:true,restoredMs:Math.round(performance.now()-restoreStart)};
 await mkdir('docs/evidence/document-loading',{recursive:true});
 // Metrics contain no document content; the supplied book is never copied into the repository.
 await writeFile(`docs/evidence/document-loading/${safari?'webkit':'chromium'}-${originalPath?'supplied':'synthetic'}.json`,JSON.stringify(metrics,null,2)+'\n');
 console.log(JSON.stringify(metrics));
}finally{await browser.close();await server.close();}
