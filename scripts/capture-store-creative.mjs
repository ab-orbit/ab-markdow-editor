import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {readFile,mkdir} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';

/** Capture the current responsive product with fictional content in an isolated browser. */
process.env.VITE_STORAGE_MODE='browser';
const root=new URL('../docs/app-store/creative-assets/',import.meta.url);
const copy=JSON.parse(await readFile(new URL('sources/copy.json',root),'utf8'));
const cover=await readFile(new URL('../docs/welcome-texts/assets/boas-vindas.jpg',import.meta.url));
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({headless:true});
try{
 for(const [locale,c]of Object.entries(copy)){
  await mkdir(new URL(`captures/${locale}/`,root),{recursive:true});
  const context=await browser.newContext({locale:c.locale,viewport:{width:1024,height:1024},deviceScaleFactor:2,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(({language})=>{localStorage.setItem('scriba-language',language);if(!localStorage.getItem('ab-markdown-theme'))localStorage.setItem('ab-markdown-theme','dark');localStorage.setItem('scriba-welcome-opened','1');},{language:c.language});
  const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);
  const input=page.locator('header input[type=file][accept*=".bear"]');await expect(input).toBeEnabled({timeout:30000});
  const source=`# ${c.title}\n\n${c.intro}\n\n![Scriba](assets/cover.jpg)\n\n## ${c.chapter}\n\n- ${c.tasks[0]}\n- ${c.tasks[1]}\n- ${c.tasks[2]}\n\n${c.closing}\n`;
  await input.setInputFiles({name:c.noteName.replace('.md','.zip'),mimeType:'application/zip',buffer:Buffer.from(zipSync({'text.md':strToU8(source),'assets/cover.jpg':cover}))});
  await expect(page.locator('header button[title="'+c.noteName+'"]')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:c.title,exact:true})).toBeVisible();
  async function capture(name){
   const close=page.locator('.toast button');for(let n=await close.count();n>0;n--){if(await close.first().isVisible())await close.first().click();}
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
   await page.screenshot({path:new URL(`captures/${locale}/${name}.png`,root).pathname});
  }
  const formatting=page.locator('header button[aria-expanded=true]').filter({has:page.locator('svg.lucide-type')});if(await formatting.count())await formatting.click();
  await capture('writing-dark');
  // Reloading applies the same persisted appearance preference as the settings control.
  await page.evaluate(()=>localStorage.setItem('ab-markdown-theme','light'));await page.reload();
  await expect(page.getByRole('heading',{name:c.title,exact:true})).toBeVisible();await capture('writing-light');
  const scene=await page.evaluate(async({nodes})=>{
   const {loadExcalidraw}=await import('/src/lib/markdown/excalidraw.ts');const sdk=await loadExcalidraw();
   const elements=sdk.convertToExcalidrawElements([
    {id:'idea',type:'rectangle',x:0,y:120,width:225,height:150,backgroundColor:'#fff4df',strokeColor:'#183d52',strokeWidth:2,roundness:{type:3},label:{text:nodes[0],fontSize:26}},
    {id:'links',type:'rectangle',x:330,y:120,width:225,height:150,backgroundColor:'#d4e8f0',strokeColor:'#183d52',strokeWidth:2,roundness:{type:3},label:{text:nodes[1],fontSize:26}},
    {id:'next',type:'rectangle',x:660,y:120,width:225,height:150,backgroundColor:'#ffd8aa',strokeColor:'#183d52',strokeWidth:2,roundness:{type:3},label:{text:nodes[2].replace(/\\n/g,'\n'),fontSize:26}},
    {type:'arrow',x:235,y:195,width:85,height:0,points:[[0,0],[85,0]],strokeColor:'#183d52',strokeWidth:2},
    {type:'arrow',x:565,y:195,width:85,height:0,points:[[0,0],[85,0]],strokeColor:'#183d52',strokeWidth:2}
   ]);
   return JSON.stringify({type:'excalidraw',version:2,source:'Scriba',elements,appState:{viewBackgroundColor:'#ffffff'},files:{}});
  },{nodes:c.nodes});
  await input.setInputFiles({name:c.boardName,mimeType:'text/markdown',buffer:Buffer.from(`# ${c.draw.join(' ')}\n\n\`\`\`excalidraw\n${scene}\n\`\`\`\n`)});
  await expect(page.locator('header button[title="'+c.boardName+'"]')).toHaveCount(1);
  // The document format group uses stable ordering across all four translations.
  await page.locator('header [role=group]').first().getByRole('button').nth(1).click();
  await expect(page.locator('[data-whiteboard-state]')).toHaveAttribute('data-whiteboard-state','ready',{timeout:60000});
  await expect(page.locator('canvas.interactive')).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await capture('drawing-light');await context.close();
  console.log(`${locale}: current UI captured for writing, light appearance and whiteboard.`);
 }
}finally{await browser.close();await server.close();}
