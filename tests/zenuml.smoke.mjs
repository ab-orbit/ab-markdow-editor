import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {createServer} from 'node:http';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {validate} from '@zenuml/core/parser';
import {checkDiagramTools} from './helpers/diagram-tools.mjs';

// Real bundled SVG output, across both storage modes and all authored ZenUML examples.
const manual=await fs.readFile(new URL('../docs/Scriba-Diagramas.md',import.meta.url),'utf8');
const examples=[...manual.matchAll(/<!-- zenuml-example: ([\w-]+) capability=(\w+) -->\n```zenuml\n([\s\S]*?)```/g)].map(([,id,capability,source])=>({id,capability,source}));
assert.equal(examples.length,25);
const count=examples.length;
for(const example of examples)assert.deepEqual(validate(example.source).errorDetails,[],example.id);
const fence='`'.repeat(3), firstCode=examples[0].source.trimEnd();
const source=('# ZenUML em avaliação\n\nTexto inicial preservado.\n\n'+examples.map(example=>`## ${example.id}\n\n${fence}zenuml\n${example.source}${fence}\n`).join('\n')+`\n## Diretiva Mermaid\n\n${fence}mermaid\nzenuml\n${firstCode}\n${fence}\n\n## Cerca alternativa\n\n~~~ZeNuMl\n${firstCode}\n~~~\n\n## Erro isolado\n\n${fence}zenuml\nif (@\n${fence}\n\n## Sequência Mermaid preservada\n\n${fence}mermaid\nsequenceDiagram\n A->>B: Olá\n${fence}\n\n## Ícones repetidos\n\n${fence}zenuml\n@S3 Origem\n@S3 Destino\n@AzureFunction Sincronizador\n@AzureFunction Auditoria\nOrigem -> Destino.copiar() {\n Sincronizador.validar()\n Auditoria.registrar()\n}\n${fence}\n`).replace(/\n/g,'\r\n');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-zenuml-'));
const exec=promisify(execFile),git=async(cwd,...args)=>(await exec('git',['-C',cwd,...args])).stdout.trim();
const publicMode=process.env.SCRIBA_BROWSER_MODE==='1',webKit=process.env.MARKDOWN_BROWSER==='webkit';
const evidence=new URL('../docs/evidence/zenuml/',import.meta.url),report={version:'4.7.2',testedAt:new Date().toISOString(),browser:webKit?'webkit':'chrome',mode:publicMode?'browser':'native',examples:[]};
let server,browser,origin=process.env.SCRIBA_URL,root;
try {
  await fs.mkdir(evidence,{recursive:true});
  if(!origin&&publicMode) {
    const dist=new URL('../dist/',import.meta.url),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
    server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=new URL('.'+(url.pathname==='/'?'/index.html':url.pathname),dist);if(!file.href.startsWith(dist.href))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':mime[path.extname(file.pathname)]||'application/octet-stream','Content-Security-Policy':"font-src 'self'"}).end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  }else if(!origin) {
    root=path.join(temporary,'notes');const state=path.join(temporary,'state');await fs.mkdir(root);await fs.mkdir(state);root=await fs.realpath(root);
    await git(root,'init','-b','main');for(const [key,value] of [['user.name','ZenUML Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(root,'config',key,value);
    await fs.writeFile(path.join(root,'ZenUML.md'),source);await git(root,'add','.');await git(root,'commit','-m','ZenUML fixture');
    await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:root,preferences:{askCommitNote:false,autoSave:false,intervalMinutes:1}}));
    await fs.writeFile(path.join(state,'library.json'),JSON.stringify({[root]:{pinned:['ZenUML.md'],welcomeImageVersion:1,diagramManualVersion:1}}));
    const runtime=path.join(temporary,'runtime.json');server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
    for(let n=0;n<150;n++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
  }
  assert.ok(origin);browser=webKit?await webkit.launch({headless:true}):await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:publicMode?'allow':'block'}),page=await context.newPage(),errors=[],outside=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol)&&url.hostname!=='static.cloudflareinsights.com')outside.push(url.origin+url.pathname);});
  await page.goto(origin);await page.getByLabel('Bancada Markdown').waitFor();
  if(publicMode) {
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
    await context.setOffline(true);await page.reload();await page.getByLabel('Bancada Markdown').waitFor();
    // First import of the engine, font, cloud icons and syntax highlighter is offline.
    await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
    await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'ZenUML.md',mimeType:'text/markdown',buffer:Buffer.from(source)});
  }else await page.getByRole('button',{name:'ZenUML.md',exact:true}).click();
  const figures=page.locator('article figure[data-diagram-engine]');try{await expect(figures).toHaveCount(count+5);}catch(error){console.log({errors,body:await page.locator('body').innerText()});throw error;}
  async function ready(figure) {
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(async()=>{await figure.scrollIntoViewIfNeeded();return figure.getAttribute('data-diagram-state');},{timeout:45000}).toBe('ready');
    const svg=figure.locator('[data-diagram-drawing] > svg');await expect(svg).toBeVisible();
    await svg.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.ok(await svg.locator('text').count()>0);assert.equal(await svg.locator('foreignObject, script, image, a').count(),0);
    return svg;
  }
  for(let index=0;index<examples.length;index++) {
    const svg=await ready(figures.nth(index));
    const stats=await svg.evaluate(element=>({texts:element.querySelectorAll('text').length,paths:element.querySelectorAll('path').length,width:element.viewBox.baseVal.width,height:element.viewBox.baseVal.height}));
    assert.ok(stats.width>0&&stats.height>0);report.examples.push({...examples[index],...stats});console.log(`${index+1}/${count} ${examples[index].id}: SVG ${Math.round(stats.width)}×${Math.round(stats.height)}`);
  }
  assert.ok(report.examples.find(example=>example.id==='zen-aws').paths>=3,'cloud icons are real local vector paths');
  assert.ok(await page.evaluate(()=>[...document.fonts].some(face=>face.family.replace(/[\"']/g,'')==='IBM Plex Sans'&&face.status==='loaded')),'the same-origin diagram font must load, including offline under font-src self');
  await ready(figures.nth(count));await ready(figures.nth(count+1));
  await figures.nth(count+2).scrollIntoViewIfNeeded();await expect(figures.nth(count+2)).toHaveAttribute('data-diagram-state','error');await expect(figures.nth(count+2)).toContainText('linha');
  await figures.nth(count+2).getByRole('button',{name:'Ver código do diagrama',exact:true}).click();await expect(figures.nth(count+2).getByRole('region',{name:'Código do diagrama',exact:true})).toContainText('if (@');
  await ready(figures.nth(count+3));await expect(figures.nth(count+3).getByRole('combobox')).toHaveValue('pele');
  const repeated=await ready(figures.nth(count+4));assert.equal(await repeated.locator('.participant-icon').count(),4);
  assert.deepEqual(await repeated.evaluate(element=>{const ids=[...element.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index);}),[]);
  const inspected=figures.nth(2);await ready(inspected);
  // A visual assertion also flushes WebKit's remote scrolling/paint tree before the native wheel gesture.
  await inspected.screenshot({path:new URL(`initial-diagram-${report.mode}-${report.browser}.png`,evidence).pathname});
  await checkDiagramTools(page,inspected,examples[2].source,{webkit:webKit,screenshot:new URL(`code-desktop-${report.mode}-${report.browser}.png`,evidence).pathname});
  await inspected.getByRole('button',{name:'Ativar lupa do diagrama',exact:true}).click();
  const drawing=inspected.locator('[data-diagram-drawing]');await drawing.focus();const lens=page.locator('[data-diagram-magnifier]');await expect(lens).toBeVisible();await expect(lens).toContainText('Pesquisadora');await page.keyboard.press('Escape');await expect(lens).toHaveCount(0);
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>{localStorage.setItem('ab-markdown-theme',theme);document.documentElement.dataset.theme=theme;},theme);
    await ready(inspected);const svg=inspected.locator('[data-diagram-drawing] > svg');
    assert.equal(await svg.locator('.stereotype-label').first().evaluate(element=>getComputedStyle(element).fill),await svg.locator('.participant-label').first().evaluate(element=>getComputedStyle(element).fill),'stereotypes must remain readable in both themes');
    assert.equal(await svg.locator('.participant-label').first().evaluate(element=>getComputedStyle(element).fill),await svg.evaluate(element=>getComputedStyle(element).getPropertyValue('--text-primary').trim()).then(color=>page.evaluate(color=>{const c=document.createElement('i');c.style.color=color;document.body.append(c);const value=getComputedStyle(c).color;c.remove();return value;},color)));
    await page.screenshot({path:new URL(`diagram-${theme}-${report.mode}-${report.browser}.png`,evidence).pathname});
  }
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:820,height:1180},{width:1180,height:820},{width:320,height:740}]) {
    await page.setViewportSize(viewport);if(await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).isVisible())await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).click();
    await ready(inspected);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(viewport.width===390)await checkDiagramTools(page,inspected,examples[2].source,{webkit:webKit,screenshot:new URL(`code-mobile-${report.mode}-${report.browser}.png`,evidence).pathname});
  }
  await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Escrever',exact:true}).click();const editor=page.getByRole('textbox',{name:'Texto da nota',exact:true});await expect(editor).toBeVisible();
  const visual=editor.locator('figure[data-diagram-engine]');await expect(visual).toHaveCount(count+5);await ready(visual.nth(2));
  const paragraph=editor.locator(':scope > p').filter({hasText:'Texto inicial preservado.'});await paragraph.click();await page.keyboard.press('End');await page.keyboard.type(' Acrescentado visualmente.');
  await page.keyboard.press('Meta+s');
  if(root)await expect.poll(async()=>await fs.readFile(path.join(root,'ZenUML.md'),'utf8')).toContain('Acrescentado visualmente.');
  else await expect(page.getByRole('status').filter({hasText:/salv|guard/i}).first()).toBeVisible();
  // Rendering and visual editing preserve both dialects and all original CRLF fences.
  const saved=root?await fs.readFile(path.join(root,'ZenUML.md'),'utf8'):await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('scriba-private-notes',1);r.onsuccess=()=>{const q=r.result.transaction('library').objectStore('library').get('state');q.onsuccess=()=>resolve(q.result.notes['ZenUML.md'].value);};}));
  for(const example of examples)assert.ok(saved.includes(example.source.replace(/\n/g,'\r\n')),example.id);
  assert.ok(saved.includes('```mermaid\r\nzenuml\r\n'));assert.ok(saved.includes('~~~ZeNuMl\r\n'));
  await visual.first().scrollIntoViewIfNeeded();await visual.first().getByRole('button',{name:'Editar código do diagrama',exact:true}).click();
  await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-block-editing','true');await expect(page.locator('.cm-content[contenteditable=true]')).toContainText('```zenuml');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Editar blocos Markdown',exact:true}).click();await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','live');
  const live=page.locator('.cm-editor figure[data-diagram-engine=zenuml]').first();await ready(live);
  await page.getByRole('button',{name:'Visão',exact:true}).click();await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','split');await ready(page.locator('article figure[data-diagram-engine=zenuml]').first());
  await page.getByRole('button',{name:'Ler',exact:true}).click();
  // No stylesheet from the HTML-based ZenUML editor is injected at import time.
  const afterStyles=await page.evaluate(()=>[...document.head.querySelectorAll('style')].map(element=>element.textContent));
  assert.ok(!afterStyles.some(css=>css.includes('.zenuml .sequence-diagram')));assert.ok(afterStyles.every(css=>!css.includes('editable-span-base')));
  const duplicates=await page.evaluate(()=>{const ids=[...document.querySelectorAll('figure[data-diagram-engine] [id]')].map(element=>element.id);return ids.filter((id,index)=>ids.indexOf(id)!==index);});assert.deepEqual(duplicates,[]);
  // Exercise every annotation listed in the shipped reference, not just common cloud aliases.
  const catalog=manual.split('<!-- zenuml-icon-catalog:start -->')[1].split('<!-- zenuml-icon-catalog:end -->')[0];
  const iconKeys=[...new Set([...catalog.matchAll(/`@([a-z0-9_]+)`/g)].map(match=>match[1]))];assert.equal(iconKeys.length,513);
  const batches=[];for(let offset=0;offset<iconKeys.length;offset+=24)batches.push(iconKeys.slice(offset,offset+24));
  const iconSource='# Catálogo vetorial em teste\n\n'+batches.map((keys,index)=>`${fence}zenuml\ntitle Catálogo ${index+1}\n${keys.map((key,n)=>`@${key} P${n}`).join('\n')}\n${keys.map((_key,n)=>`P${n}.verificar()`).join('\n')}\n${fence}\n`).join('\n');
  await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'ZenUML-Icones.md',mimeType:'text/markdown',buffer:Buffer.from(iconSource)});await expect(figures).toHaveCount(batches.length);
  const missing=[];
  for(let index=0;index<batches.length;index++) {
    const svg=await ready(figures.nth(index));
    const present=await svg.evaluate(element=>[...element.querySelectorAll('.participant')].filter(node=>{const icon=node.querySelector('.participant-icon');if(!icon)return false;const box=icon.getBBox();return box.width>0&&box.height>0;}).map(node=>Number(node.getAttribute('data-participant').slice(1))));
    batches[index].forEach((key,n)=>{if(!present.includes(n))missing.push(key);});
    assert.deepEqual(await svg.evaluate(element=>{const ids=[...element.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,n)=>ids.indexOf(id)!==n);}),[],'vendor icon IDs remain unique within each SVG');
  }
  report.icons={tested:iconKeys.length,missing};assert.deepEqual(missing,[],'every listed vector annotation must survive the actual bundle and sanitizer');
  console.log(`Vector icon catalog: ${iconKeys.length}/${iconKeys.length}`);
  if(publicMode) {
    const old='# Minha referência anotada\r\n\r\n<!-- scriba-reference:diagram-manual version=1 -->\r\n\r\nAnotação que precisa permanecer.\r\n';
    const readManual=()=>page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('scriba-private-notes',1);r.onsuccess=()=>{const q=r.result.transaction('library').objectStore('library').get('state');q.onsuccess=()=>resolve(q.result);};}));
    async function replaceManual(value,reset) {
      await page.evaluate(({value,reset})=>new Promise(resolve=>{const r=indexedDB.open('scriba-private-notes',1);r.onsuccess=()=>{const tx=r.result.transaction('library','readwrite'),store=tx.objectStore('library'),q=store.get('state');q.onsuccess=()=>{const state=q.result,name='Scriba-Diagramas.md';state.notes[name]={...state.notes[name],value,version:crypto.randomUUID(),cached:true,pending:false};state.diagramManualName=name;state.diagramManualVersion=1;state.pins=state.pins.filter(item=>item!==name);if(reset)delete state.diagramManualZenUmlVersion;store.put(state,'state');};tx.oncomplete=()=>resolve();};}),{value,reset});
    }
    await replaceManual(old,true);await page.reload();
    await expect.poll(async()=>(await readManual()).notes['Scriba-Diagramas.md'].value).toContain('scriba-extension:zenuml-v1:start');
    const upgraded=await readManual();assert.ok(upgraded.notes['Scriba-Diagramas.md'].value.startsWith(old));assert.ok(!upgraded.pins.includes('Scriba-Diagramas.md'));assert.equal(upgraded.diagramManualZenUmlVersion,1);
    assert.equal((upgraded.notes['Scriba-Diagramas.md'].value.match(/scriba-extension:zenuml-v1:start/g)||[]).length,1);
    await replaceManual(old,false);await page.reload();await page.getByLabel('Bancada Markdown').waitFor();assert.equal((await readManual()).notes['Scriba-Diagramas.md'].value,old,'removing the appended section is respected on later starts');
    report.migration='preserved annotations, CRLF, unpin and later section removal';
  }
  assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
  await fs.writeFile(new URL(`compatibility-${report.mode}-${report.browser}.json`,evidence),JSON.stringify({...report,errors,outside},null,2)+'\n');
  console.log(JSON.stringify({passed:examples.length,mode:report.mode,browser:report.browser,offline:publicMode,tools:'zoom, copy, highlighting, SVG/PNG transparency, magnifier, themes, visual editing, source preservation'}));
}finally {
  await browser?.close();if(server?.kill){server.kill();if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));}else if(server)await new Promise(resolve=>server.close(resolve));
  await fs.rm(temporary,{recursive:true,force:true});
}
