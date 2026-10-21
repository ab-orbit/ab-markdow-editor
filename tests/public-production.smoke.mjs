import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const origin=process.env.SCRIBA_URL||'https://scriba.aeonbridge.app';
const context=await browser.newContext({locale:'pt-BR',viewport:{width:390,height:844}});
const page=await context.newPage();const errors=[];const api=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
try {
 await page.goto(origin);await page.locator('button[aria-label="Voltar às notas"]:visible, button[aria-label="Mostrar notas recentes"]:visible').first().click();await page.getByRole('button',{name:'Boas-vindas.md',exact:true}).waitFor();
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await new Promise(resolve=>{if(navigator.serviceWorker.controller)resolve();else navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});});});
 // Exercise the real storage adapter through the visible editor and save action.
 await page.getByRole('button',{name:'Boas-vindas.md',exact:true}).click();await page.getByRole('status').filter({hasText:'Documento aberto.'}).waitFor();
 if(await page.getByRole('button',{name:'Mais opções da nota',exact:true}).isVisible())await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();await page.getByRole('button',{name:'Fonte',exact:true}).click();
 const editor=page.locator('.cm-content[contenteditable=true]');await editor.fill('# Teste privado\n\nConteúdo exclusivo deste navegador.');
 await page.getByRole('button',{name:'Salvar nota',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Nota salva neste navegador.'}).waitFor();
 await page.reload();await page.locator('button[aria-label="Voltar às notas"]:visible, button[aria-label="Mostrar notas recentes"]:visible').first().click();await page.getByRole('button',{name:'Boas-vindas.md',exact:true}).waitFor();
 assert.ok(await page.getByText('Teste privado',{exact:true}).count());
 const other=await browser.newContext({locale:'pt-BR'});const second=await other.newPage();await second.goto(origin);await second.getByRole('button',{name:'Boas-vindas.md',exact:true}).waitFor();assert.equal(await second.getByText('Teste privado',{exact:true}).count(),0);await other.close();
 await context.setOffline(true);await page.reload();await page.locator('button[aria-label="Voltar às notas"]:visible, button[aria-label="Mostrar notas recentes"]:visible').first().click();await page.getByRole('button',{name:'Boas-vindas.md',exact:true}).waitFor();
 await page.getByRole('button',{name:'Boas-vindas.md',exact:true}).click();await page.getByRole('status').filter({hasText:'Documento aberto.'}).waitFor();
 if(await page.getByRole('button',{name:'Mais opções da nota',exact:true}).isVisible())await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();await page.getByRole('button',{name:'Fonte',exact:true}).click();await editor.fill('# Offline privado');await page.getByRole('button',{name:'Salvar nota',exact:true}).click();await page.getByRole('status').filter({hasText:'Nota salva neste navegador.'}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'docs/evidence/scriba-production-mobile.png',fullPage:true});
 console.log('PASS: HTTPS, guide, edit/save/reload, isolated browser contexts, offline save, no API requests, mobile overflow.');
} finally {await browser.close();}
