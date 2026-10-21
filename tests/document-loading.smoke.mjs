import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
try{
 await mkdir('docs/evidence/document-loading',{recursive:true});
 for(const theme of ['dark','light']){
  const context=await browser.newContext({locale:'pt-BR',viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(theme=>{localStorage.setItem('ab-markdown-theme',theme);const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){if(this.name==='loading-fixture.md')await new Promise(resolve=>window.finishDocumentRead=resolve);return original.call(this);};},theme);
  const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();await expect(page.locator('[data-document-loading]')).toHaveCount(0);
  const value='# Loading fixture\n\nPlain text with x = {, not a complete formula.\n';
  await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'loading-fixture.md',mimeType:'text/markdown',buffer:Buffer.from(JSON.stringify({data:{success:true,source:'file',cleaned_text:value},metadata:{function:'convert_to_markdown'}}))});
  const loading=page.locator('[data-document-loading]');await expect(loading).toBeVisible();await expect(loading.locator('.hypathia-loader__particle')).toHaveCount(3);
  await expect.poll(()=>page.evaluate(()=>typeof window.finishDocumentRead)).toBe('function');
  await page.screenshot({path:`docs/evidence/document-loading/plume-${process.env.MARKDOWN_BROWSER||'chrome'}-${theme}.png`});
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.hypathia-loader__plume')).opacity)>.95);
  await page.screenshot({path:`docs/evidence/document-loading/plume-formed-${process.env.MARKDOWN_BROWSER||'chrome'}-${theme}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>loading.locator('.hypathia-loader__plume').evaluate(el=>getComputedStyle(el).animationName)).toBe('hyp-reduced');
  await page.evaluate(()=>window.finishDocumentRead());await expect(loading).toHaveCount(0);await expect(page.getByRole('heading',{name:'Loading fixture',exact:true})).toBeVisible();
  const originalJson=await page.getByRole('article').textContent();if(originalJson.includes('cleaned_text'))throw new Error('The converter envelope was rendered as prose');
  await context.close();
 }
 console.log('PASS: exact Polis plume, three particles, both themes, reduced motion, loading before file decoding, extracted Markdown and unfinished-formula responsiveness.');
}finally{await browser.close();await server.close();}
