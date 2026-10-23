import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/dist/**','**/dist-ios/**','**/ios/App/App/public/**','**/artifacts/**','**/docs/evidence/**','**/native/**']}}});await server.listen();const browser=await chromium.launch(process.env.SMOKE_CHROME==='1'?{channel:'chrome'}:{});
try {
 const page=await browser.newPage({viewport:{width:1008,height:900}});
 await page.addInitScript(()=>{localStorage.setItem('scriba-language','en');localStorage.setItem('scriba-welcome-opened','1');});
 await page.goto(server.resolvedUrls.local[0]);
 const header=page.locator('header[data-ui="toolbar"]');
 await expect(header.getByRole('button',{name:'More options',exact:true})).toBeEnabled({timeout:30000});
 await expect(header.getByRole('group',{name:'Edit mode',exact:true})).toHaveCount(0);
 await expect(header.getByRole('button',{name:'Open .md/ZIP',exact:true})).toHaveCount(0);
 await expect(page.getByRole('toolbar',{name:'Editing tools',exact:true})).toHaveCount(0);
 await header.getByRole('button',{name:'More options',exact:true}).click();
 const menu=page.getByRole('dialog',{name:'More options',exact:true});await expect(menu).toBeVisible();
 await expect(menu.getByRole('menuitemradio',{name:'Source',exact:true})).toBeVisible();
 await mkdir('docs/evidence/document-context-menu',{recursive:true});
 await page.screenshot({path:'docs/evidence/document-context-menu/desktop-menu.png'});
 await menu.getByRole('menuitemradio',{name:'Source',exact:true}).click();
 await expect(page.locator('[data-mode="source"]')).toBeVisible();await expect(menu).toHaveCount(0);
 await header.getByRole('button',{name:'Note information',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Statistics',exact:true})).toBeVisible();
 for(const close of await page.locator('button[data-ui="dismiss"]:visible').all()){const style=await close.evaluate(el=>({name:el.getAttribute('aria-label'),border:getComputedStyle(el).borderTopWidth,shadow:getComputedStyle(el).boxShadow,radius:parseFloat(getComputedStyle(el).borderRadius)}));if(style.border!=='0px'||style.shadow!=='none'||style.radius<22)throw Error('Framed dismissal button: '+JSON.stringify(style));}
 await page.screenshot({path:'docs/evidence/document-context-menu/desktop-info.png'});await page.keyboard.press('Escape');
 await header.getByRole('button',{name:'Formatting',exact:true}).click();await expect(page.getByRole('toolbar',{name:'Editing tools',exact:true})).toBeVisible();if((await page.getByRole('toolbar',{name:'Editing tools',exact:true}).boundingBox()).height>60)throw Error('Desktop formatting toolbar wraps');
 const editor=page.getByRole('textbox',{name:'Note text',exact:true});await expect(editor).toBeVisible({timeout:30000});await editor.click();await editor.press('Meta+A');await page.getByRole('toolbar',{name:'Editing tools',exact:true}).getByRole('button',{name:'Bold',exact:true}).click();await expect(editor.locator('strong').first()).toBeVisible();
 await page.getByRole('toolbar',{name:'Editing tools',exact:true}).getByRole('button',{name:'More formatting options',exact:true}).click();
 await expect(page.getByRole('menu',{name:'More formatting options',exact:true})).toBeVisible();
 await page.screenshot({path:'docs/evidence/document-context-menu/formatting-more-desktop.png'});
 await page.getByRole('menuitem',{name:'Hide formatting',exact:true}).click();await expect(page.getByRole('toolbar',{name:'Editing tools',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 const mobile=page.locator('[class*="mobileReadingBar"]');await expect(mobile).toBeVisible();
 await mobile.getByRole('button',{name:'Formatting',exact:true}).click();const strip=page.getByRole('toolbar',{name:'Editing tools',exact:true});await expect(strip).toBeVisible();if((await strip.boundingBox()).height>112)throw Error('Formatting toolbar exceeds two mobile rows');for(const name of ['Divider','Undo','Redo','Icon Gallery','Strikethrough','Insert reference'])await expect(strip.getByRole('button',{name,exact:true})).toBeVisible();await strip.getByRole('button',{name:'More formatting options',exact:true}).click();await page.screenshot({path:'docs/evidence/document-context-menu/formatting-more-mobile.png'});await page.keyboard.press('Escape');
 await mobile.getByRole('button',{name:'More options',exact:true}).click();await expect(menu).toBeVisible();
 await page.screenshot({path:'docs/evidence/document-context-menu/mobile-menu.png'});
 console.log('Desktop/mobile context menu, source mode, information and formatting passed');
}finally{await browser.close();await server.close();}
