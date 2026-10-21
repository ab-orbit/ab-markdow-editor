import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import names from '../server/reference-texts.json' with {type:'json'};
const catalogs=Object.fromEntries(await Promise.all(['en','de','fr'].map(async language=>[language,JSON.parse(await readFile(`src/i18n/${language}.json`,'utf8'))])));
const label=(language,key)=>language==='pt'?key:catalogs[language][key];
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const safari=process.env.MARKDOWN_BROWSER==='webkit',browser=await(safari?webkit:chromium).launch({headless:true});
async function snapshot(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('scriba-private-notes',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();};open.onerror=()=>reject(open.error);}));}
try{
 await mkdir('docs/evidence/reference-texts',{recursive:true});
 const context=await browser.newContext({locale:'ja-JP',viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);
 let previous='en';
 for(const language of ['en','de','fr','pt']){
  if(language!=='en'){
   await page.getByRole('button',{name:label(previous,'Configurações'),exact:true}).click();await page.locator('#interface-language').selectOption(language);await page.getByRole('button',{name:label(language,'Voltar ao editor'),exact:true}).click();
  }
  await page.getByRole('button',{name:names[language],exact:true}).click();
  const text=await readFile('docs/reference-texts/'+names[language],'utf8');
  await expect(page.locator('article h1').first()).toHaveText(text.split('\n')[0].slice(2));
  await expect.poll(()=>page.locator('article img[alt="cover"]').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const state=await snapshot(page);assert.equal(state.notes[names[language]].value,text);assert.equal(state.notes[names[language]].files[0].path,'assets/cover.jpg');
  await page.screenshot({path:`docs/evidence/reference-texts/${language}-${safari?'webkit':'chrome'}.png`});previous=language;
 }
 let state=await snapshot(page);assert.equal(Object.keys(state.notes).length,4);assert.equal(Object.keys(state.referenceTexts).length,4);
 const annotation=state.notes[names.pt].value+'\nUser annotation, preserved.\n';
 await page.evaluate(({name,annotation})=>new Promise(resolve=>{const open=indexedDB.open('scriba-private-notes',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('library','readwrite'),store=tx.objectStore('library'),get=store.get('state');get.onsuccess=()=>{const s=get.result;s.notes[name].value=annotation;s.pins=s.pins.filter(n=>n!==name);store.put(s,'state');};tx.oncomplete=()=>{db.close();resolve();};};}),{name:names.pt,annotation});
 await page.reload();await expect(page.getByRole('button',{name:names.en,exact:true})).toBeVisible();state=await snapshot(page);assert.equal(state.notes[names.pt].value,annotation);assert.ok(!state.pins.includes(names.pt));assert.equal(Object.keys(state.notes).length,4);
 // Canonical scopes still reject restoration into a genuinely different library.
 await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('ab-markdown-drafts',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),get=store.get(sessionStorage.getItem('ab-markdown-draft-id'));get.onsuccess=()=>{const draft=get.result;draft.repository.scope='github:other/repository:main:notes';store.put(draft);};tx.oncomplete=()=>{db.close();resolve();};};}));
 await page.reload();await expect(page.getByRole('heading',{name:'Configurações',exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'O rascunho pertence a outro repositório.'})).toBeVisible();
 assert.deepEqual(errors,[]);await context.close();console.log('PASS: unsupported-device English fallback, four independent authored references, live language selection, shared cover, exact source, user edits/unpin preservation and no duplicate seeding.');
}finally{await browser.close();await server.close();}
