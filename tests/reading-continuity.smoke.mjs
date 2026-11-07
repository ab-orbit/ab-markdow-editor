import {webkit} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';

const server=await createServer({server:{host:'127.0.0.1',port:0,watch:{ignored:['**/dist/**','**/dist-ios/**','**/ios/**','**/artifacts/**','**/docs/evidence/**']}}});
await server.listen();const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.goto(new URL('tests/fixtures/reading-continuity.html',server.resolvedUrls.local[0]).href);
 await page.locator('#heading-10').waitFor();
 await page.evaluate(async()=>{
  const root=document.querySelector('#reading'),anchor=document.querySelector('#heading-10');
  root.scrollTop+=anchor.getBoundingClientRect().top-root.getBoundingClientRect().top;anchor.focus({preventScroll:true});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
 for(const width of [640,370,800,390]){
  // WebKit can publish a scroll event after reflow but before ResizeObserver.
  // That event must not replace the anchor with a block from the new layout.
  await page.evaluate(width=>{const root=document.querySelector('#reading');root.style.width=`${width}px`;root.dispatchEvent(new Event('scroll'));},width);
  await page.waitForFunction(()=>Math.abs(document.querySelector('#heading-10').getBoundingClientRect().top-document.querySelector('#reading').getBoundingClientRect().top)<2);
  assert.equal(await page.locator('#heading-10').evaluate(element=>document.activeElement===element),true,'Reading continuity preserves keyboard focus from the outline.');
 }
 console.log('PASS: focused outline heading preserved through four reflows, including scroll-before-resize ordering.');
}finally{await browser.close();await server.close();}
