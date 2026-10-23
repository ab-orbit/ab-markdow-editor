import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const origin=process.env.SCRIBA_URL || 'https://scriba.aeonbridge.app';
const browser=await chromium.launch({channel:'chrome'});
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],localApi=[];
 await context.addInitScript(()=>{localStorage.setItem('scriba-language','en');localStorage.setItem('scriba-welcome-opened','1');});
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))localApi.push(request.url());});
 await page.goto(origin);const input=page.locator('input[type="file"][accept*=".bear"]');await expect(input).toBeEnabled({timeout:30000});
 await input.setInputFiles({name:'web-release-validation.md',mimeType:'text/markdown',buffer:Buffer.from('# Web release validation\n\nRelease persistence marker.\n')});
 await expect(page.getByRole('heading',{name:'Web release validation',exact:true})).toBeVisible();
 // Check the persisted record before reload so a merely rendered import cannot pass.
 await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readonly'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(Object.values(get.result?.notes || {}).some(note=>note.value?.includes('Release persistence marker.')));tx.oncomplete=()=>db.close();};})),{timeout:15000}).toBe(true);
 await page.reload();await expect(page.getByRole('heading',{name:'Web release validation',exact:true})).toBeVisible();
 const isolated=await browser.newContext(),other=await isolated.newPage();await other.goto(origin);await expect(other.locator('input[type="file"][accept*=".bear"]')).toBeEnabled({timeout:30000});await expect(other.getByRole('heading',{name:'Web release validation',exact:true})).toHaveCount(0);await isolated.close();
 await mkdir('docs/evidence/deploy-20261023',{recursive:true});await page.screenshot({path:'docs/evidence/deploy-20261023/desktop-persistence.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(localApi,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS: production HTTPS, imported note persisted in IndexedDB, reload, private-context isolation, no local API traffic, no page errors, desktop layout.');
} finally {await browser.close();}
