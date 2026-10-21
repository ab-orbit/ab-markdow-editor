import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const origin=process.env.SCRIBA_URL||'https://scriba.aeonbridge.app';
const context=await browser.newContext({locale:'pt-BR',viewport:{width:390,height:844},serviceWorkers:'allow'});
const page=await context.newPage(),errors=[],api=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))api.push(request.url());});
async function saved(marker){await expect.poll(()=>page.evaluate(marker=>new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result.notes['release-validation.md']?.value.includes(marker));tx.oncomplete=()=>db.close();};}),marker),{timeout:15000}).toBe(true);}
async function edit(marker){const button=page.getByRole('button',{name:'Editar nota',exact:true});if(await button.isVisible())await button.click();await page.locator('.tiptap p').first().fill(marker);await saved(marker);}
try{
 await page.goto(origin);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'release-validation.md',mimeType:'text/markdown',buffer:Buffer.from('# Release validation\n\nOriginal paragraph.\n')});
 const close=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(await close.isVisible())await close.click();
 await expect(page.getByRole('heading',{name:'Release validation',exact:true})).toBeVisible();
 await edit('PUBLIC-PRIVATE-CONTEXT');
 await page.reload();await expect(page.locator('.tiptap,article').filter({hasText:'PUBLIC-PRIVATE-CONTEXT'}).first()).toBeVisible();
 const other=await browser.newContext({locale:'pt-BR'}),second=await other.newPage();await second.goto(origin);await expect(second.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();assert.equal(await second.getByText('PUBLIC-PRIVATE-CONTEXT',{exact:true}).count(),0);await other.close();
 // Wait for the real service worker to finish its install before disconnecting.
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),{timeout:90000}).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await edit('PUBLIC-OFFLINE-AUTOSAVE');
 await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();
 await expect(page.getByRole('menuitem')).toHaveText(['Importar','Exportar','Configurações']);
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'docs/evidence/deploy-20261021/offline-mobile.png'});
 console.log('PASS: public HTTPS, automatic save/reload, private context isolation, service-worker offline save, no local API traffic and compact mobile menu.');
}finally{await browser.close();}
