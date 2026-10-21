import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {zipSync,strToU8,unzipSync,strFromU8} from 'fflate';

const safari=process.env.MARKDOWN_BROWSER==='webkit';
const browser=safari?await webkit.launch({headless:true}):await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],writes=[];
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/'))writes.push(request.url());});
  await page.addInitScript(({safari})=>{
    window.__saveAsTest={name:'Cópia.md',mode:'save',calls:[]};
    if(safari){Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});return;}
    // A real serializable file handle exercises writes, reload and restoration. Only the OS selection is simulated.
    window.showSaveFilePicker=async options=>{
      const state=window.__saveAsTest;state.calls.push({active:navigator.userActivation.isActive,options});
      if(state.mode==='cancel')throw new DOMException('Cancelled','AbortError');
      const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(state.name,{create:true});
      if(state.mode==='fail')handle.createWritable=async()=>{throw new Error('Synthetic disk failure');};
      return handle;
    };
  },{safari});
  await page.goto(process.env.SCRIBA_URL||'http://127.0.0.1:43997/');
  const input=page.getByLabel('Arquivo Markdown',{exact:true}),editor=page.locator('.cm-content'),workbench=page.getByLabel('Bancada Markdown');
  const open=async(name,value)=>{await expect(input).toBeEnabled();await input.setInputFiles({name,mimeType:'text/markdown',buffer:Buffer.from(value)});await expect(workbench).toHaveAttribute('data-mode','read');await expect(input).toBeEnabled();};
  const read=()=>page.evaluate(async()=>{const root=await navigator.storage.getDirectory();return (await(await root.getFileHandle('Cópia.md')).getFile()).text();});
  const saveAs=page.getByRole('button',{name:'Salvar como',exact:true});
  const original='# Original preservado\n\nTexto com **acentos** e contexto.\n';
  await open('Original.md',original);
  if(safari){
    await saveAs.click();const dialog=page.getByRole('dialog',{name:'Salvar uma cópia',exact:true});await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nome da cópia').fill('Outra pasta');const download=page.waitForEvent('download');
    await dialog.getByRole('button',{name:'Baixar cópia',exact:true}).click();const file=await download;assert.equal(file.suggestedFilename(),'Outra pasta.md');assert.equal(await fs.readFile(await file.path(),'utf8'),original);
    await expect(page.getByLabel('Destino do arquivo',{exact:true})).toHaveCount(0);await expect(workbench).toContainText('Original.md');
    await expect(page.getByRole('status').filter({hasText:'Cópia preparada.'})).toBeVisible();
  }else{
    await page.evaluate(()=>window.__saveAsTest.mode='cancel');await saveAs.click();await expect(input).toBeEnabled();await expect(page.getByLabel('Destino do arquivo',{exact:true})).toHaveCount(0);
    await page.evaluate(()=>window.__saveAsTest.mode='save');await page.keyboard.press('Meta+Shift+s');
    await expect(page.getByLabel('Destino do arquivo',{exact:true})).toContainText('Cópia.md');assert.equal(await read(),original);
    assert.equal(await page.evaluate(()=>window.__saveAsTest.calls.every(call=>call.active)),true,'Picker retains the user gesture');
    await page.getByRole('button',{name:'Fonte',exact:true}).click();await editor.fill('# Edição no novo local');await page.keyboard.press('Meta+s');
    await expect.poll(()=>read().catch(error=>`Read in progress: ${error.message}`)).toBe('# Edição no novo local');await expect(page.getByRole('status').filter({hasText:'Arquivo salvo em Cópia.md.'})).toBeVisible();
    await page.reload();await expect(page.getByLabel('Destino do arquivo',{exact:true})).toContainText('Cópia.md');
    await page.getByRole('button',{name:'Fonte',exact:true}).click();await editor.fill('# Depois de reabrir');await page.keyboard.press('Control+s');await expect.poll(()=>read().catch(error=>`Read in progress: ${error.message}`)).toBe('# Depois de reabrir');
    await page.evaluate(async()=>{const root=await navigator.storage.getDirectory(),stream=await(await root.getFileHandle('Cópia.md')).createWritable();await stream.write('# Mudança externa');await stream.close();});
    await editor.fill('# Alteração protegida');await page.keyboard.press('Meta+s');
    const conflict=page.getByRole('dialog',{name:'Resolver versões do arquivo',exact:true});await expect(conflict).toBeVisible();assert.equal(await read(),'# Mudança externa');
    await conflict.getByRole('button',{name:'Continuar editando',exact:true}).click();await expect(editor).toHaveText('# Alteração protegida');
    await page.evaluate(()=>{window.__saveAsTest.mode='fail';window.__saveAsTest.name='Falha.md';});await saveAs.click();await expect(page.getByRole('alert').filter({hasText:'Synthetic disk failure'})).toBeVisible();await expect(page.getByLabel('Destino do arquivo',{exact:true})).toContainText('Cópia.md');await expect(editor).toHaveText('# Alteração protegida');
    await page.evaluate(()=>{window.__saveAsTest.mode='save';window.__saveAsTest.name='Segunda.md';});
    await page.keyboard.press('Meta+s');await expect(conflict).toBeVisible();await conflict.getByRole('button',{name:'Salvar como…',exact:true}).click();
    await expect(page.getByLabel('Destino do arquivo',{exact:true})).toContainText('Segunda.md');assert.equal(await read(),'# Mudança externa');
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII=','base64'),source='# Com imagem\n\n![Pixel](assets/pixel.png)\n';
    const archive=zipSync({'text.md':strToU8(source),'assets/pixel.png':png});
    await input.setInputFiles({name:'Imagem.zip',mimeType:'application/zip',buffer:Buffer.from(archive)});await expect(input).toBeEnabled();
    await page.evaluate(()=>window.__saveAsTest.name='Pacote.zip');await saveAs.click();await expect(page.getByLabel('Destino do arquivo',{exact:true})).toContainText('Pacote.zip');
    const bytes=await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();return Array.from(new Uint8Array(await(await(await root.getFileHandle('Pacote.zip')).getFile()).arrayBuffer()));});
    const files=unzipSync(Uint8Array.from(bytes));assert.equal(strFromU8(files['text.md']),source);assert.deepEqual(Buffer.from(files['assets/pixel.png']),png);
    await page.getByRole('button',{name:'Fonte',exact:true}).click();await editor.fill(source+'\nAtualizada.');await page.keyboard.press('Meta+s');
    await expect(page.getByRole('status').filter({hasText:'Arquivo salvo em Pacote.zip.'})).toBeVisible();
    await page.getByRole('group',{name:'Formato do documento',exact:true}).getByRole('button',{name:'Whiteboard',exact:true}).click();
    const board=page.getByRole('region',{name:'Whiteboard Excalidraw',exact:true});await expect(board).toHaveAttribute('data-whiteboard-state','ready',{timeout:30000});
    await board.getByRole('radio',{name:'Texto',exact:true}).locator('..').click();const bounds=await board.locator('canvas.interactive').boundingBox();
    await page.mouse.click(bounds.x+bounds.width*.6,bounds.y+bounds.height*.6);await board.locator('textarea.excalidraw-wysiwyg').fill('Texto ativo antes de Salvar como');
    await page.evaluate(()=>window.__saveAsTest.name='Quadro.zip');await page.keyboard.press('Meta+Shift+s');await expect(page.getByLabel('Destino do arquivo',{exact:true})).toContainText('Quadro.zip');
    const canvasBytes=await page.evaluate(async()=>{const root=await navigator.storage.getDirectory();return Array.from(new Uint8Array(await(await(await root.getFileHandle('Quadro.zip')).getFile()).arrayBuffer()));});
    const canvasFiles=unzipSync(Uint8Array.from(canvasBytes));assert.match(strFromU8(canvasFiles['text.md']),/Texto ativo antes de Salvar como/);assert.deepEqual(Buffer.from(canvasFiles['assets/pixel.png']),png);
    await page.getByRole('group',{name:'Formato do documento',exact:true}).getByRole('button',{name:'Nota',exact:true}).click();

  }
  const evidence=new URL('../docs/evidence/save-as/',import.meta.url);await fs.mkdir(evidence,{recursive:true});
  await page.screenshot({path:new URL(`save-as-desktop-${safari?'webkit':'chrome'}.png`,evidence).pathname});
  await page.setViewportSize({width:390,height:844});const closeNotes=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(await closeNotes.isVisible())await closeNotes.click();if(!await saveAs.isVisible())await page.getByRole('button',{name:'Mais opções da nota',exact:true}).click();await expect(saveAs).toBeVisible();await page.screenshot({path:new URL(`save-as-mobile-${safari?'webkit':'chrome'}.png`,evidence).pathname});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'Selected files never write to the remote service or default library');
  console.log(`PASS (${safari?'WebKit':'Chromium'}): ${safari?'honest copy fallback with exact Markdown bytes and unchanged active destination':'Save As active file, user activation, cancellation, subsequent Cmd/Ctrl+S, draft restoration, external conflicts, failed writes, conflict Save As and complete image ZIP'}. Desktop/mobile controls and no remote writes verified.`);
}finally{await browser.close();}
