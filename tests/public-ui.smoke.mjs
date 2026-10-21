import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900}});
const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
 await page.goto(process.env.SCRIBA_URL||'https://scriba.aeonbridge.app');
 const newNote=async()=>{
  await page.getByRole('complementary',{name:'Notas recentes'}).getByRole('button',{name:'Nova nota',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('dialog[open]') || document.querySelector('.tiptap h1')?.textContent==='');
  const discard=page.getByRole('button',{name:'Descartar e criar',exact:true});if(await discard.isVisible())await discard.click();
  await page.locator('.tiptap h1').waitFor();
  await page.waitForFunction(()=>document.activeElement?.classList.contains('tiptap'));
  assert.equal(await page.locator('.tiptap').evaluate(element=>getComputedStyle(element).outlineStyle),'none');
 };
 await newNote();await page.keyboard.insertText('Verificação de deploy');
 await page.getByRole('button',{name:'Salvar nota',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Nota salva neste navegador.'}).waitFor();
 await newNote();await page.keyboard.insertText('Verificação de deploy');
 await page.locator('span[title="Verificação de deploy (1).md"]').waitFor();
 assert.equal(await page.getByRole('button',{name:'Salvar nota',exact:true}).evaluate(element=>element.nextElementSibling?.getAttribute('aria-label')),'Salvar como');
 assert.equal(await page.getByRole('button',{name:'Mostrar outline',exact:true}).evaluate(element=>element.nextElementSibling?.getAttribute('aria-label')),'Usar tema claro');
 await page.getByLabel('Exportar nota',{exact:true}).click();
 assert.equal(await page.getByRole('group',{name:'Formatos de exportação'}).getByRole('button').count(),2);
 await page.screenshot({path:'docs/evidence/deploy-20261020-ui/public-title-export-desktop.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: public H1 focus, no editor frame, title filenames, increment on collision, save adjacency, outline position and unified exports.');
} finally {await context.close();await browser.close();}
