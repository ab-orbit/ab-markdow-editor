import {chromium, webkit, expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch();
const origin=server.resolvedUrls.local[0];
const evidence='docs/evidence/storage-settings';await mkdir(evidence,{recursive:true});
async function settings(page){const existing=page.getByRole('region',{name:'Armazenamento',exact:true});if(await existing.isVisible())return existing;const direct=page.getByRole('button',{name:'Configurações',exact:true});if(await direct.isVisible())await direct.click();else{const close=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(await close.isVisible())await close.click();await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();await page.getByRole('menuitem',{name:'Configurações',exact:true}).click();}return page.getByRole('region',{name:'Armazenamento',exact:true});}
async function folder(page){await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('scriba-device-folder',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>{const db=r.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({label:'Notes/scriba'},'label');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));}
try{for(const [theme,width,height] of [['light',390,844],['dark',1440,900]]){
 const context=await browser.newContext({locale:'pt-BR',viewport:{width,height},serviceWorkers:'block'});
 await context.addInitScript(theme=>{localStorage.setItem('ab-markdown-theme',theme);if(!('showDirectoryPicker' in window))window.showDirectoryPicker=async()=>{throw new Error('Unexpected picker');};},theme);
 const page=await context.newPage();await page.goto(origin);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();let panel=await settings(page);
 await expect(panel.getByText('Neste navegador',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Escolher pasta',exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Conectar GitHub',exact:true})).toBeVisible();
 await panel.screenshot({path:`${evidence}/${theme}-${width}-local.png`});
 // A folder destination has exactly one disconnect action and no GitHub setup controls.
 await folder(page);await page.reload();await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();panel=await settings(page);await expect(panel.getByText('Notes/scriba',{exact:true})).toBeVisible();await expect(panel.getByRole('button')).toHaveText(['Desconectar pasta']);
 await panel.screenshot({path:`${evidence}/${theme}-${width}-folder.png`});await panel.getByRole('button',{name:'Desconectar pasta'}).click();await expect(panel.getByText('Neste navegador',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>localStorage.getItem('scriba-github-selection')),null);
 // A selected remote takes precedence even over a stale local folder label.
 await folder(page);await page.evaluate(()=>localStorage.setItem('scriba-github-selection',JSON.stringify({fullName:'example/notes',branch:'main',folder:'scriba'})));
 await context.route('**/github/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/github/status')return route.fulfill({json:{configured:true,connected:true,user:{login:'example'},selection:{fullName:'example/notes',branch:'main',folder:'scriba'},installUrl:null}});if(path==='/github/repositories')return route.fulfill({json:[]});if(path==='/github/logout')return route.fulfill({json:{ok:true}});return route.fulfill({json:{error:'Isolated offline repository fixture'},status:503});});
 await page.reload();await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();panel=await settings(page);await expect(panel.getByText('example/notes',{exact:true})).toBeVisible();await expect(panel.getByRole('button')).toHaveText(['Desconectar GitHub']);await expect(panel.getByText('Notes/scriba',{exact:true})).toHaveCount(0);await expect(panel.getByText('main',{exact:true})).toBeVisible();
 await panel.screenshot({path:`${evidence}/${theme}-${width}-github.png`});await expect(panel.getByRole('button',{name:'Desconectar GitHub'})).toBeEnabled();await panel.getByRole('button',{name:'Desconectar GitHub'}).click();await expect(panel.getByText('Neste navegador',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>localStorage.getItem('scriba-github-selection')),null);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
}console.log('PASS: one storage destination, local/folder/GitHub states, isolated remote, both disconnect flows, stale-folder precedence, light mobile and dark desktop.');}finally{await browser.close();await server.close();}
