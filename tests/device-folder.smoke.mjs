import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
// Simulate only the OS picker; real browser directory handles and writable streams perform I/O.
await page.addInitScript(()=>{window.showDirectoryPicker=async()=>{const root=await navigator.storage.getDirectory();const file=await root.getFileHandle('nota-existente.md',{create:true});const stream=await file.createWritable();await stream.write('# Nota do repositório existente');await stream.close();return root;};});
try {
 await page.goto('http://127.0.0.1:43999');await page.getByRole('button',{name:'Configurações',exact:true}).click();
 await page.getByRole('button',{name:'Selecionar pasta em Files'}).click();
 await page.getByRole('status').filter({hasText:'notas carregadas. Pasta:'}).waitFor();
 assert.equal(await page.evaluate(async()=>{const db=await new Promise(resolve=>{const request=indexedDB.open('scriba-private-notes');request.onsuccess=()=>resolve(request.result);});return await new Promise(resolve=>{const request=db.transaction('library').objectStore('library').get('state');request.onsuccess=()=>resolve(!!request.result.notes['nota-existente.md']);});}),true);
 assert.equal(await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();const folder=await root.getDirectoryHandle('scriba');return(await(await folder.getFileHandle('Boas-vindas.md')).getFile()).size>0;}),true);
 assert.equal(await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();const folder=await root.getDirectoryHandle('scriba');return(await(await(await folder.getDirectoryHandle('assets')).getFileHandle('boas-vindas.jpg')).getFile()).size>0;}),true);
 await page.getByRole('button',{name:'nota-existente.md',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByText('Pasta selecionada:',{exact:false}).waitFor();
 // An externally modified destination must survive the next synchronization.
 await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();const folder=await root.getDirectoryHandle('scriba');const handle=await folder.getFileHandle('Boas-vindas.md');const stream=await handle.createWritable();await stream.write('External content');await stream.close();});
 await page.getByRole('button',{name:'Autorizar pasta e carregar notas'}).click();await page.getByRole('alert').filter({hasText:'mudou fora do Scriba'}).waitFor();
 assert.equal(await page.evaluate(async()=>{const folder=await(await navigator.storage.getDirectory()).getDirectoryHandle('scriba');return(await(await folder.getFileHandle('Boas-vindas.md')).getFile()).text();}),'External content');
 await page.getByRole('button',{name:'Usar somente navegador'}).click();await page.getByText('Armazenamento privado neste navegador',{exact:true}).waitFor();
 await page.screenshot({path:'docs/evidence/device-folder-mobile.png'});
 console.log('PASS: folder creation, Markdown and image writes, handle persistence, external-change protection, disconnect. OS picker simulated; filesystem operations are real.');
}finally{await browser.close();}
