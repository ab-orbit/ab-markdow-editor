import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const origin=process.env.SCRIBA_URL||'http://127.0.0.1:43999';
try{for(const [width,height] of [[390,844],[844,390],[768,1024],[1440,900]]){
 const page=await browser.newPage({locale:'pt-BR',viewport:{width,height},serviceWorkers:'block'});
 await page.goto(origin);await page.getByRole('button',{name:'Fonte',exact:true}).click();const editor=page.locator('.cm-content');await editor.fill('# Rascunho preservado\n\nPágina de configurações.');
 await page.getByRole('button',{name:'Configurações',exact:true}).click();const settings=page.getByRole('region',{name:'Configurações',exact:true});await settings.waitFor();assert.equal(new URL(page.url()).hash,'#settings');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await editor.isVisible(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('heading',{name:'Salvamento e sincronização',exact:true}).scrollIntoViewIfNeeded();const back=page.getByRole('button',{name:'Voltar ao editor'});assert.ok(await back.isVisible());const box=await back.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height);await page.screenshot({path:`docs/evidence/settings-page-${width}x${height}.png`});
 await back.click();await editor.waitFor();assert.match(await editor.innerText(),/Rascunho preservado/);assert.equal(new URL(page.url()).hash,'');
 await page.getByRole('button',{name:'Configurações',exact:true}).click();await settings.waitFor();await page.goBack();await editor.waitFor();assert.match(await editor.innerText(),/Página de configurações/);
 await page.goto(origin+'/#settings');await settings.waitFor();await page.reload();await settings.waitFor();await page.getByRole('button',{name:'Voltar ao editor'}).click();await editor.waitFor();await page.close();
}console.log('PASS: full-page settings at four sizes, independent scroll/sticky back, no modal, editor preservation, browser Back, direct URL and reload.');}finally{await browser.close();}
