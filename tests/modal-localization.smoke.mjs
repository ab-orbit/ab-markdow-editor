import {chromium, webkit, expect} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
try {
 for (const engine of [chromium,webkit]) {
  const browser=await engine.launch({headless:true});
  try {
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await page.goto(server.resolvedUrls.local[0]+'privacy.html');
   await page.evaluate(async()=>{
    const reactModule=await import('/node_modules/.vite/deps/react.js');const React=reactModule.default||reactModule;
    const clientModule=await import('/node_modules/.vite/deps/react-dom_client.js');const {createRoot}=clientModule.default||clientModule;
    const {EditorDialog}=await import('/src/components/Markdown/EditorDialog.tsx');
    document.body.replaceChildren();
    const host=document.createElement('div');document.body.append(host);
    window.backgroundEvents=[];
    const record=event=>window.backgroundEvents.push(event.type);
    function Fixture(){const [open,setOpen]=React.useState(true);return React.createElement('section',{onPointerDown:record,onPointerUp:record,onTouchStart:record,onTouchEnd:record,onContextMenu:record,onKeyDown:record,onClick:record},open?React.createElement(EditorDialog,{title:'Rename file',onClose:()=>setOpen(false)},React.createElement('label',null,'File name',React.createElement('input',{defaultValue:'whiteboard-copy.md'}))):React.createElement('p',null,'Closed'));}
    createRoot(host).render(React.createElement(Fixture));
   });
   const input=page.getByLabel('File name');await expect(input).toBeVisible();
   await input.click();await input.fill('My revised drawing.md');await input.press('End');await input.press('ArrowLeft');await input.click({button:'right'});
   await expect(input).toHaveValue('My revised drawing.md');
   expect(await page.evaluate(()=>window.backgroundEvents)).toEqual([]);
   await input.press('Escape');await expect(page.getByText('Closed',{exact:true})).toBeVisible();
   for(const [language,expected]of [['pt','Nota salva em Notes/scriba.'],['en','Note saved in Notes/scriba.'],['de','Notiz in Notes/scriba gespeichert.'],['fr','Note enregistrée dans Notes/scriba.']]) {
    expect(await page.evaluate(async language=>{const {setLanguage,t}=await import('/src/i18n/index.ts');setLanguage(language);return t('Nota salva em {0}.','Notes/scriba');},language)).toBe(expected);
   }
   console.log(`${engine.name()}: modal input remains editable without sending canvas events; save messages respect all four languages.`);
  }finally{await browser.close();}
 }
} finally {await server.close();}
