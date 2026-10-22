import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';

/** Validate actual page navigation, localized content and mobile/desktop layout. */
const publicRoot=new URL('../public/',import.meta.url),evidence=new URL('../docs/evidence/privacy-localization/',import.meta.url);
await mkdir(evidence,{recursive:true});
const server=createServer(async(req,res)=>{try{const body=await readFile(new URL('.'+req.url,publicRoot));res.setHeader('Content-Type','text/html; charset=utf-8');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=process.env.PRIVACY_ORIGIN||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();const page=await browser.newPage();
try{
 for(const locale of ['pt-BR','en-US','de-DE','fr-FR']){
  for(const [width,height,label]of [[1440,900,'desktop'],[390,844,'mobile']]){
   await page.setViewportSize({width,height});const response=await page.goto(`${origin}/privacy/${locale}.html`);
   if(response.status()!==200)throw Error('HTTP status '+response.status());
   const result=await page.evaluate(()=>({lang:document.documentElement.lang,sections:document.querySelectorAll('main h2').length,paragraphs:document.querySelectorAll('section p').length,overflow:document.documentElement.scrollWidth>innerWidth,links:document.querySelectorAll('.languages a').length,contact:!!document.querySelector('a[href="mailto:contact@aeonbridge.com"]')}));
   if(result.lang!==locale||result.sections!==5||result.paragraphs!==9||result.overflow||result.links!==4||!result.contact)throw Error(JSON.stringify(result));
   await page.screenshot({path:new URL(`${locale}-${label}.png`,evidence).pathname,fullPage:true});
  }
 }
 await page.locator('.languages a[lang="en-US"]').click();await page.waitForURL('**/privacy/en-US.html');
 await page.locator('.languages a[lang="de-DE"]').click();await page.waitForURL('**/privacy/de-DE.html');
 const response=await page.goto(origin+'/privacy.html');if(response.status()!==200)throw Error('Legacy policy unavailable');
 console.log(`${origin}: four locales passed HTTP, content, language-switch navigation, desktop/mobile overflow and legacy URL checks.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
