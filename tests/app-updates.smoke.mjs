import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
process.env.VITE_STORAGE_MODE='browser';process.env.VITE_APP_PLATFORM='ios';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await(process.env.MARKDOWN_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
try{
 await mkdir('docs/evidence/app-updates',{recursive:true});
 for(const channel of ['app-store','testflight']){
  const context=await browser.newContext({locale:'pt-BR',viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(channel=>{
   localStorage.setItem('scriba-language','pt');window.CapacitorCustomPlatform={name:'ios'};window.updateCalls=[];
   const methods=['appearance','folderStatus','updateInfo','openUpdate','openExternal'];
   window.Capacitor={PluginHeaders:[{name:'ScribaNative',methods:methods.map(name=>({name,rtype:'promise'}))}],nativePromise:async(_,method,args)=>{
    if(method==='folderStatus')return {label:''};
    if(method==='updateInfo')return {version:'1.16.1',build:'13',channel,catalog:channel==='testflight'?{schema:1,testflight:{version:'1.16.1',build:'14',status:'testing',expiresAt:new Date(Date.now()+86400000).toISOString()}}:{results:[{trackId:6824664840,bundleId:'com.aeonbridge.scriba',version:'1.17.0'}]}};
    if(method==='openUpdate'||method==='openExternal')window.updateCalls.push({method,...args});return {};
   }};
  },channel);
  if(process.env.MARKDOWN_THEME==='light')await context.addInitScript(()=>localStorage.setItem('ab-markdown-theme','light'));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
  const notice=page.getByRole('complementary',{name:'Atualização do Scriba',exact:true});await expect(notice).toContainText('Nova versão disponível');
  const action=notice.getByRole('link',{name:channel==='testflight'?'Abrir TestFlight':'Abrir App Store',exact:true});
  await expect(action).toHaveAttribute('href',channel==='testflight'?'itms-beta://':'https://apps.apple.com/app/id6824664840');
  await action.click();await expect.poll(()=>page.evaluate(()=>window.updateCalls)).toEqual([{method:'openUpdate',channel}]);
  await page.screenshot({path:`docs/evidence/app-updates/${channel}-${process.env.MARKDOWN_BROWSER||'chrome'}${process.env.MARKDOWN_THEME==='light'?'-light':''}-mobile.png`});
  await notice.getByRole('button',{name:'Lembrar depois',exact:true}).click();await expect(notice).toHaveCount(0);
  if(errors.length)throw new Error(errors.join('\n'));await context.close();
 }
 console.log('PASS: native channel detection fixture, version notice, fixed store/TestFlight destinations, explicit opening and dismissal in the actual editor.');
}finally{await browser.close();await server.close();}
