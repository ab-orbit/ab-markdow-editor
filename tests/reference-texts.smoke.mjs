import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import names from '../server/reference-texts.json' with {type:'json'};
import welcomes from '../server/welcome-texts.json' with {type:'json'};
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
 await expect(page.locator('article h1').first()).toHaveText('Welcome to Scriba');assert.equal(await page.evaluate(()=>localStorage.getItem('scriba-welcome-opened')),'1');
 let previous='en';
 for(const language of ['en','de','fr','pt']){
  if(language!=='en'){
   await page.getByRole('button',{name:welcomes[previous],exact:true}).click();
   await page.getByRole('button',{name:label(previous,'Configurações'),exact:true}).click();await page.locator('#interface-language').selectOption(language);await page.getByRole('button',{name:label(language,'Voltar ao editor'),exact:true}).click();
  }
  const welcome=await readFile('docs/welcome-texts/'+welcomes[language],'utf8');await expect(page.locator('article h1').first()).toHaveText(welcome.split('\n')[0].slice(2));
  await expect.poll(()=>page.locator('article img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator('article [data-document-icon] svg')).toHaveCount(8);
  await mkdir('docs/evidence/welcome-texts',{recursive:true});await page.screenshot({path:`docs/evidence/welcome-texts/${language}-${safari?'webkit':'chrome'}.png`,fullPage:true});
  await page.getByRole('button',{name:names[language],exact:true}).click();
  const text=await readFile('docs/reference-texts/'+names[language],'utf8');
  await expect(page.locator('article h1').first()).toHaveText(text.split('\n')[0].slice(2));
  await expect.poll(()=>page.locator('article img[alt="cover"]').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const state=await snapshot(page);assert.equal(state.notes[names[language]].value,text);assert.equal(state.notes[names[language]].files[0].path,'assets/cover.jpg');
  await page.screenshot({path:`docs/evidence/reference-texts/${language}-${safari?'webkit':'chrome'}.png`});previous=language;
 }
 // Switching a bundled welcome saves edits first; ordinary notes never follow the UI language.
 await page.getByRole('button',{name:welcomes.pt,exact:true}).click();
 await page.getByRole('button',{name:'Fonte',exact:true}).click();
 await page.locator('.cm-content[contenteditable="true"]').fill('# My edited welcome\n\nKeep my words.');
 await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.locator('#interface-language').selectOption('en');
 await page.getByRole('button',{name:label('en','Voltar ao editor'),exact:true}).click();
 await expect(page.locator('article h1').first()).toHaveText('Welcome to Scriba');assert.match((await snapshot(page)).notes[welcomes.pt].value,/Keep my words/);
 await page.getByRole('button',{name:names.pt,exact:true}).click();
 await page.getByRole('button',{name:label('en','Configurações'),exact:true}).click();await page.locator('#interface-language').selectOption('pt');await page.getByRole('button',{name:'Voltar ao editor',exact:true}).click();
 await expect(page.locator('article h1').first()).toHaveText((await readFile('docs/reference-texts/'+names.pt,'utf8')).split('\n')[0].slice(2));
 let state=await snapshot(page);assert.equal(Object.keys(state.notes).length,8);assert.equal(Object.keys(state.referenceTexts).length,4);assert.equal(Object.keys(state.welcomeTexts).length,4);
 const annotation=state.notes[names.pt].value+'\nUser annotation, preserved.\n';
 await page.evaluate(({name,annotation})=>new Promise(resolve=>{const open=indexedDB.open('scriba-private-notes',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('library','readwrite'),store=tx.objectStore('library'),get=store.get('state');get.onsuccess=()=>{const s=get.result;s.notes[name].value=annotation;s.pins=s.pins.filter(n=>n!==name);store.put(s,'state');};tx.oncomplete=()=>{db.close();resolve();};};}),{name:names.pt,annotation});
 await page.reload();await expect(page.getByRole('button',{name:names.en,exact:true})).toBeVisible();state=await snapshot(page);await expect(page.locator('article h1').first()).toHaveText(annotation.split('\n')[0].slice(2));assert.equal(state.notes[names.pt].value,annotation);assert.ok(!state.pins.includes(names.pt));assert.equal(Object.keys(state.notes).length,8);
 // Welcome edits, removal and unpinning are user decisions, just like resource notes.
 await page.evaluate(({edited,removed})=>new Promise(resolve=>{const open=indexedDB.open('scriba-private-notes',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('library','readwrite'),store=tx.objectStore('library'),get=store.get('state');get.onsuccess=()=>{const state=get.result;state.notes[edited].value+='\nMy personal welcome.\n';state.pins=state.pins.filter(name=>name!==edited&&name!==removed);delete state.notes[removed];store.put(state,'state');};tx.oncomplete=()=>{db.close();resolve();};};}),{edited:welcomes.pt,removed:welcomes.de});
 await page.reload();await expect(page.getByRole('button',{name:names.en,exact:true})).toBeVisible();state=await snapshot(page);assert.match(state.notes[welcomes.pt].value,/My personal welcome/);assert.ok(!state.pins.includes(welcomes.pt));assert.ok(!state.notes[welcomes.de]);
 // Canonical scopes still reject restoration into a genuinely different library.
 await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('ab-markdown-drafts',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),get=store.get(sessionStorage.getItem('ab-markdown-draft-id'));get.onsuccess=()=>{const draft=get.result;draft.repository.scope='github:other/repository:main:notes';store.put(draft);};tx.oncomplete=()=>{db.close();resolve();};};}));
 await page.reload();await expect(page.getByRole('heading',{name:'Configurações',exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'O rascunho pertence a outro repositório.'})).toBeVisible();
 assert.deepEqual(errors,[]);await context.close();
 const mobile=await browser.newContext({locale:'pt-BR',viewport:{width:390,height:844},serviceWorkers:'block'});const phone=await mobile.newPage();await phone.goto(server.resolvedUrls.local[0]);
 await expect(phone.locator('article h1').first()).toHaveText('Bem-vindo ao Scriba');await expect(phone.locator('#recent-notes')).toHaveCount(0);
 const welcomeButton=phone.getByRole('button',{name:welcomes.pt,exact:true});if(!await welcomeButton.isVisible())await phone.getByRole('button',{name:'Voltar às notas',exact:true}).click();await welcomeButton.click();
 await expect(phone.locator('article h1').first()).toHaveText('Bem-vindo ao Scriba');await expect(phone.locator('article [data-document-icon] svg')).toHaveCount(8);await expect.poll(()=>phone.locator('article img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.screenshot({path:`docs/evidence/welcome-texts/pt-mobile-${safari?'webkit':'chrome'}.png`});await mobile.close();
 console.log('PASS: unsupported-device English fallback, four independent authored references, live language selection, shared cover, exact source, user edits/unpin preservation and no duplicate seeding.');
}finally{await browser.close();await server.close();}
