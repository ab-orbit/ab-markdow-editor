import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch();
const evidence='docs/evidence/apple-design';await mkdir(evidence,{recursive:true});
function contrast(a,b){const l=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try{for(const theme of ['light','dark'])for(const [width,height,scale] of [[390,844,1],[844,390,1],[390,844,2]]){
 const context=await browser.newContext({viewport:{width,height},locale:'pt-BR',isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(({theme,scale})=>{localStorage.setItem('ab-markdown-theme',theme);document.addEventListener('DOMContentLoaded',()=>document.documentElement.style.setProperty('--ui-font-scale-user',String(scale)));},{theme,scale});
 const page=await context.newPage();await page.goto(process.env.SCRIBA_URL||server.resolvedUrls.local[0]);await expect(page.locator('article h1').first()).toHaveText('Bem-vindo ao Scriba');
 await page.getByRole('button',{name:'Mais opções da nota',exact:true}).tap();
 await page.getByRole('menuitem',{name:'Exportar',exact:true}).tap();
 const dialog=page.getByRole('dialog',{name:'Exportar nota',exact:true}),buttons=dialog.locator('[data-menu-item]');await expect(buttons).toHaveCount(2);
 const rest=await buttons.evaluateAll(nodes=>nodes.map(node=>({bg:getComputedStyle(node).backgroundColor,fg:getComputedStyle(node).color,h:node.getBoundingClientRect().height,w:node.getBoundingClientRect().width,focus:node.matches(':focus-visible')})));
 assert.ok(rest.every(x=>x.bg==='rgba(0, 0, 0, 0)'&&!x.focus),'Opening by touch must not fill any row');
 assert.ok(rest.every(x=>x.h>=44&&x.w>=44));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const surface=await dialog.evaluate(node=>getComputedStyle(node).backgroundColor);
 const channels=surface.match(/[\d.]+/g).map(Number),alpha=channels[3]??1;
 for(const underlying of [0,255]){const composite=`rgb(${channels.slice(0,3).map(value=>Math.round(value*alpha+underlying*(1-alpha))).join(',')})`;assert.ok(contrast(rest[0].fg,composite)>=4.5,'Regular glass remains legible over both extreme backdrops');}
 assert.match(await dialog.evaluate(node=>getComputedStyle(node).backdropFilter),/blur/);
 await page.evaluate(()=>document.documentElement.dataset.reduceTransparency='true');
 assert.equal(await dialog.evaluate(node=>getComputedStyle(node).backdropFilter),'none');
 await page.evaluate(()=>delete document.documentElement.dataset.reduceTransparency);
 await page.screenshot({path:`${evidence}/${theme}-${width}x${height}-${scale}x-export.png`});
 await dialog.press('ArrowDown');await expect(buttons.nth(0)).toBeFocused();await page.keyboard.press('ArrowDown');await expect(buttons.nth(1)).toBeFocused();
 const selected=await buttons.evaluateAll(nodes=>nodes.map(node=>({bg:getComputedStyle(node).backgroundColor,fg:getComputedStyle(node).color})));
 assert.equal(selected.filter(x=>x.bg!=='rgba(0, 0, 0, 0)').length,1,'Only the keyboard-focused command is filled');assert.ok(contrast(selected[1].fg,selected[1].bg)>=4.5);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Mais opções da nota',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Informações da nota',exact:true}).tap();
 const information=page.getByRole('dialog',{name:'Estatísticas',exact:true});await expect(information).toHaveAttribute('data-ui','inspector');
 await page.screenshot({path:`${evidence}/${theme}-${width}x${height}-${scale}x-statistics.png`});
 await information.getByRole('tab',{name:'Índice',exact:true}).tap();await expect(page.getByRole('dialog',{name:'Índice',exact:true})).toBeVisible();
 await page.screenshot({path:`${evidence}/${theme}-${width}x${height}-${scale}x-outline.png`});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Mais opções da nota',exact:true}).tap();await page.getByRole('menuitem',{name:'Configurações',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Configurações',exact:true})).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await page.getByLabel('Idioma', {exact:true}).evaluate(node=>node.getBoundingClientRect().height>=44));await page.screenshot({path:`${evidence}/${theme}-${width}x${height}-${scale}x-settings.png`});await context.close();
}console.log('PASS: neutral touch menus, single keyboard selection, AA contrast, 44px targets, Escape/focus return, portrait/landscape, light/dark, 200% UI text and settings overflow.');}finally{await browser.close();await server.close();}
