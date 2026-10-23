import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/dist/**','**/dist-ios/**','**/ios/App/App/public/**','**/docs/evidence/**']}}});
await server.listen();const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await page.addInitScript(()=>{localStorage.setItem('scriba-language','en');localStorage.setItem('scriba-welcome-opened','1');});
 await page.goto(server.resolvedUrls.local[0]);
 const bar=page.locator('[class*="mobileReadingBar"]');
 const notes=page.locator('#recent-notes');
 await expect(bar).toBeVisible({timeout:30000});await expect(notes).toHaveCount(0);
 for(let attempt=0;attempt<2;attempt++){
  await bar.getByRole('button',{name:'More options',exact:true}).focus();
  await bar.getByRole('button',{name:'More options',exact:true}).click();
  await page.getByRole('dialog',{name:'More options',exact:true}).getByRole('button',{name:'Show recent notes',exact:true}).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  // WebKit may restore the invoker after the command opens the sidebar.
  await bar.getByRole('button',{name:'More options',exact:true}).evaluate(button=>{button.blur();button.focus();});
  await expect(notes).toBeVisible();
  // Wait beyond dialog cleanup and restored focus before asserting persistence.
  await page.waitForTimeout(400);await expect(notes).toBeVisible();
  if(attempt===0){await mkdir('docs/evidence/recent-notes-menu',{recursive:true});await page.screenshot({path:'docs/evidence/recent-notes-menu/mobile-library.png'});}
  await notes.getByRole('button',{name:'Close list of notes',exact:true}).click();await expect(notes).toHaveCount(0);
 }
 await bar.getByRole('button',{name:'Back to notes',exact:true}).click();await expect(notes).toBeVisible();
 await page.locator('[data-document-scroll]').click({position:{x:330,y:300}});await expect(notes).toHaveCount(0);
 console.log('Mobile recent notes survives menu focus restoration, reopens, and dismisses on document interaction');
}finally{await browser.close();await server.close();}
