import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({headless:true});
try{for(const alreadyActivated of [false,true]){
 const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'});
 await context.addInitScript(()=>{
  localStorage.setItem('scriba-language','pt');
  const events=new EventTarget();
  const worker={postMessage(message){if(message.type==='SCRIBA_APPLY_UPDATE'){localStorage.setItem('test-update-applied','true');events.dispatchEvent(new Event('controllerchange'));}}};
  const registration={waiting:localStorage.getItem('test-update-applied')?null:worker,addEventListener(){}};
  Object.defineProperty(navigator,'serviceWorker',{value:{controller:{},ready:Promise.resolve(registration),register:async()=>registration,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)}});
 });
 const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'web-update.md',mimeType:'text/markdown',buffer:Buffer.from('# Web update\n\nOriginal paragraph.\n')});
 await page.getByRole('button',{name:'Escrever',exact:true}).click();await page.locator('.tiptap p').first().fill('DRAFT-PRESERVED-BEFORE-RELOAD');
 await expect(page.getByRole('complementary',{name:'Atualização do Scriba',exact:true})).toBeVisible();
 if(alreadyActivated)await page.evaluate(async()=>{(await window.scribaPwaRegistration).waiting=null;localStorage.setItem('test-update-applied','true');});
 await page.getByRole('link',{name:'Atualizar agora',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('test-update-applied'))).toBe('true');
 await expect(page.locator('.tiptap,article').filter({hasText:'DRAFT-PRESERVED-BEFORE-RELOAD'}).first()).toBeVisible();
 await expect(page.getByRole('complementary',{name:'Atualização do Scriba',exact:true})).toHaveCount(0);
 await context.close();}
 console.log('PASS: explicit web update persists and restores the latest edit before activating/reloading, including a worker already activated by another tab, with no forced refresh.');
}finally{await browser.close();await server.close();}
