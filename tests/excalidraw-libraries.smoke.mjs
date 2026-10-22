import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]+'privacy.html');
 const result=await page.evaluate(async()=>{
  const {initialCanvasLibrary,writeCanvasState,readCanvasState}=await import('/src/lib/markdown/excalidrawStore.ts');
  const seed=await initialCanvasLibrary();const custom={...seed[0],id:'personal-symbol',name:'My own symbol'};
  const edited=[custom,...seed.slice(1)];await writeCanvasState('library',edited);
  const again=await initialCanvasLibrary();await writeCanvasState('library',[]);const cleared=await initialCanvasLibrary();
  return {count:seed.length,unique:new Set(seed.map(item=>item.id)).size,personal:again.find(item=>item.id==='personal-symbol')?.name,removed:again.some(item=>item.id===seed[0].id),cleared:cleared.length,marker:await readCanvasState('bundled-libraries-v1')};
 });
 expect(result).toEqual({count:187,unique:187,personal:'My own symbol',removed:false,cleared:0,marker:true});
 await page.reload();await page.evaluate(()=>import('/src/lib/markdown/excalidrawStore.ts'));await page.context().setOffline(true);
 expect(await page.evaluate(async()=>{const {initialCanvasLibrary}=await import('/src/lib/markdown/excalidrawStore.ts');return (await initialCanvasLibrary()).length;})).toBe(0);
 console.log(`${engine.name()}: 187 default symbols, personal edits preserved, no reseeding after removal or clearing.`);
 }finally{await browser.close();}
}}finally{await server.close();}
