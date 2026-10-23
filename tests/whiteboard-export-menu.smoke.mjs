import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/dist/**','**/dist-ios/**','**/ios/App/App/public/**','**/docs/evidence/**']}}});await server.listen();const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1008,height:900}});await page.addInitScript(()=>{localStorage.setItem('scriba-language','en');localStorage.setItem('scriba-welcome-opened','1');});await page.goto(server.resolvedUrls.local[0]);
 const format=page.locator('[data-ui="format-segments"]');await expect(format.locator('button').nth(1)).toBeEnabled({timeout:30000});await format.locator('button').nth(1).click();
 const trigger=page.getByLabel('Export whiteboard',{exact:true}),menu=page.getByRole('menu',{name:'Whiteboard format',exact:true});
 await trigger.waitFor();await mkdir('docs/evidence/whiteboard-export-menu',{recursive:true});
 for(const [width,height,label]of [[1008,900,'desktop'],[390,844,'mobile']]){
  await page.setViewportSize({width,height});if(!await menu.isVisible())await trigger.click();await expect(menu).toBeVisible();await expect(menu.getByRole('menuitem')).toHaveCount(3);await expect(menu.getByRole('menuitem').first()).toBeEnabled({timeout:30000});
  const geometry=await menu.evaluate(el=>({radius:parseFloat(getComputedStyle(el).borderRadius),border:getComputedStyle(el).borderTopWidth,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,left:el.getBoundingClientRect().left,scroll:el.scrollWidth,client:el.clientWidth}));
  if(geometry.radius>24||geometry.border!=='1px'||geometry.left<0||geometry.right>width||geometry.scroll>geometry.client+1)throw Error('Malformed menu: '+JSON.stringify(geometry));
  for(const item of await menu.getByRole('menuitem').all()){const radius=await item.evaluate(el=>parseFloat(getComputedStyle(el).borderRadius));if(radius>16)throw Error('Capsule menu item');}
  await menu.screenshot({path:`docs/evidence/whiteboard-export-menu/${label}.png`});await page.keyboard.press('Escape');await expect(menu).toBeHidden();
 }
 console.log('Whiteboard export menu: normal rounded panel, compact rows and no viewport overflow on desktop/mobile');
}finally{await browser.close();await server.close();}
