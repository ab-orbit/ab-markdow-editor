import {chromium,webkit,expect} from '@playwright/test';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const catalogs=Object.fromEntries(await Promise.all(['en','de','fr'].map(async language=>[language,JSON.parse(await readFile(`src/i18n/${language}.json`,'utf8'))])));
const label=(language,key)=>language==='pt'?key:catalogs[language][key];
const server=http.createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;const file=new URL('../'+(process.env.SCRIBA_TEST_DIST||'dist')+'/'+(pathname==='/'?'index.html':pathname.slice(1)),import.meta.url);response.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':pathname==='/'?'text/html':'application/octet-stream');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const safari=process.env.MARKDOWN_BROWSER==='webkit';const browser=await(safari?webkit:chromium).launch({headless:true});
const base=`http://127.0.0.1:${server.address().port}`;
try{
 await mkdir('docs/evidence/localization',{recursive:true});
 for(const [locale,language]of [['pt-PT','pt'],['en-GB','en'],['de-AT','de'],['fr-CA','fr'],['ja-JP','en']]){
  const context=await browser.newContext({locale,viewport:{width:1440,height:900},serviceWorkers:'block'});const page=await context.newPage();
  await page.goto(base);await expect(page.locator('html')).toHaveAttribute('lang',language==='pt'?'pt-BR':language==='en'?'en-US':`${language}-${language.toUpperCase()}`);
  await expect(page.getByLabel(label(language,'Arquivo Markdown'),{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:label(language,'Configurações'),exact:true}).click();
  await expect(page.locator('#interface-language')).toHaveValue('auto');
  await expect(page.getByRole('heading',{name:label(language,'Configurações'),exact:true})).toBeVisible();
  console.log(`PASS: ${locale} selects ${language}.`);await context.close();
 }
 const context=await browser.newContext({locale:'ja-JP',viewport:{width:1440,height:900},serviceWorkers:'block'});const page=await context.newPage();await page.goto(base);
 const text='# User content\n\nPortuguês English Deutsch Français — this paragraph must remain unchanged.\n';
 const input=page.getByLabel(label('en','Arquivo Markdown'),{exact:true});await expect(input).toBeEnabled();await input.setInputFiles({name:'Language.md',mimeType:'text/markdown',buffer:Buffer.from(text)});
 await expect(page.getByRole('heading',{name:'User content',exact:true})).toBeVisible();
 await page.getByRole('button',{name:label('en','Configurações'),exact:true}).click();
 for(const language of ['de','fr','pt','en']){
  await page.locator('#interface-language').selectOption(language);
  await expect(page.getByRole('heading',{name:label(language,'Configurações'),exact:true})).toBeVisible();
  await expect(page.locator('#interface-language')).toHaveValue(language);
  await page.screenshot({path:`docs/evidence/localization/settings-${language}-${safari?'webkit':'chrome'}.png`});
  await page.reload();await expect(page.locator('#interface-language')).toHaveValue(language);
 }
 await page.locator('#interface-language').selectOption('auto');await expect(page.locator('#interface-language')).toHaveValue('auto');
 await expect(page.getByRole('heading',{name:label('en','Configurações'),exact:true})).toBeVisible();
 await page.getByRole('button',{name:label('en','Voltar ao editor'),exact:true}).click();
 await expect(page.getByRole('heading',{name:'User content',exact:true})).toBeVisible();
 await page.screenshot({path:'docs/evidence/localization/content-after-language-switch.png'});
 assert.ok((await page.locator('article').textContent()).includes(text.trim().split('\n').at(-1)),'Language changes preserve the imported paragraph');
 await page.locator('article p').first().evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
 await expect(page.locator('[data-selected-characters]')).toHaveAttribute('data-selected-characters',String(text.trim().split('\n').at(-1).length));
 await page.evaluate(()=>getSelection().removeAllRanges());
 // Observe the real PDF blob: headless WebKit may preview PDFs rather than emit a download event.
 await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob instanceof Blob&&blob.type==='application/pdf')void blob.slice(0,5).text().then(header=>{globalThis.__scribaPdfHeader=header;});return original.call(this,blob);};});
 await page.getByLabel(label('en','Exportar nota'),{exact:true}).click();
 await page.getByRole('group',{name:label('en','Formatos de exportação'),exact:true}).getByRole('button',{name:/^PDF/}).click();
 await page.waitForFunction(()=>globalThis.__scribaPdfHeader==='%PDF-');
 await page.getByRole('group',{name:label('en','Formato do documento'),exact:true}).getByRole('button',{name:label('en','Whiteboard'),exact:true}).click();
 await expect(page.getByRole('region',{name:label('en','Whiteboard Excalidraw'),exact:true})).toHaveAttribute('data-whiteboard-state','ready');
 await expect(page.getByRole('radio',{name:'Text',exact:true})).toBeAttached();
 for(const language of ['fr','de']){
  await page.getByRole('button',{name:label(language==='fr'?'en':'fr','Configurações'),exact:true}).click();
  await page.locator('#interface-language').selectOption(language);
  await page.getByRole('button',{name:label(language,'Voltar ao editor'),exact:true}).click();
  await expect(page.getByRole('radio',{name:language==='fr'?'Texte':'Auswahl',exact:true})).toBeAttached();
 }
 await page.getByRole('group',{name:label('de','Formato do documento'),exact:true}).getByRole('button',{name:label('de','Nota'),exact:true}).click();
 await page.getByRole('button',{name:label('de','Escrever'),exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('button',{name:label('de','Mostrar formatação'),exact:true})).not.toBeVisible();
 await page.screenshot({path:`docs/evidence/localization/mobile-german-${safari?'webkit':'chrome'}.png`});
 console.log('PASS: live language changes, persistence, automatic fallback, unchanged document and English/French/German drawing controls.');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
