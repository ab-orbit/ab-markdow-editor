import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
test.use({serviceWorkers:'block'});
test('legacy browser draft retains text and image after storage format upgrade',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Older File-based drafts are exercised in Chromium, which can create them.');
 await page.route('**/api/repository',route=>route.fulfill({json:{repository:null,branch:'',status:''}}));
 await page.goto('/');await expect(page.getByRole('region', {name:'Configurações',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const id=sessionStorage.getItem('ab-markdown-draft-id')!;
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII='),char=>char.charCodeAt(0));
  const value='# Rascunho legado\n\nTexto anterior à atualização.\n\n![imagem](assets/legacy.png)\n';
  await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('ab-markdown-drafts',1);request.onsuccess=()=>{const db=request.result,transaction=db.transaction('drafts','readwrite');transaction.objectStore('drafts').put({id,repository:{repository:null,branch:'',status:''},name:'legado.md',loadedName:'legado.md',value,baseline:value,version:null,importedVersion:null,pendingSync:false,preferences:{askCommitNote:false,autoSave:false,intervalMinutes:1},assets:[{path:'assets/legacy.png',file:new File([bytes],'legacy.png',{type:'image/png'})}],updatedAt:Date.now()});transaction.oncomplete=()=>{db.close();resolve();};transaction.onerror=()=>reject(transaction.error);};request.onerror=()=>reject(request.error);});
 });
 await page.reload();const settings=page.getByRole('region', {name:'Configurações',exact:true});await expect(settings).toBeVisible();await settings.getByRole('button',{name:'Voltar ao editor',exact:true}).click();await page.getByRole('button',{name:'Ler',exact:true}).click();await expect(page.getByRole('article')).toContainText('Texto anterior à atualização.');await expect(page.locator('article img')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>new Promise<boolean>((resolve,reject)=>{const request=indexedDB.open('ab-markdown-drafts',1);request.onsuccess=()=>{const db=request.result;const get=db.transaction('drafts').objectStore('drafts').get(sessionStorage.getItem('ab-markdown-draft-id')!);get.onsuccess=()=>{resolve(get.result.assets[0].bytes instanceof ArrayBuffer);db.close();};get.onerror=()=>reject(get.error);};request.onerror=()=>reject(request.error);}))).toBe(true);
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar pacote',exact:true}).click();const download=await event;const archive=unzipSync(new Uint8Array(await readFile((await download.path())!)));expect(strFromU8(archive['text.md'])).toContain('Rascunho legado');expect(Object.keys(archive).some(name=>name.startsWith('assets/'))).toBe(true);await expect(page.getByRole('alert')).toHaveCount(0);
});
