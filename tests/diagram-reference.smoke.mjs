import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Exercise the Markdown parser, UI selector, SVG sanitizer and actual bundled engines together.
const exec=promisify(execFile),git=async(cwd,...args)=>(await exec('git',['-C',cwd,...args])).stdout.trim();
const source=await fs.readFile(new URL('../docs/Scriba-Diagramas.md',import.meta.url),'utf8');
const examples=[...source.matchAll(/<!-- diagram-example: ([\w-]+) family=(\w+) -->[\s\S]*?```mermaid\n([\s\S]*?)```/g)].map(match=>({id:match[1],family:match[2],source:match[3]}));
assert.equal(examples.length,58);
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-reference-'));
const report={version:'1.0.0',testedAt:new Date().toISOString(),defaultEngine:'pele',engines:{mermaid:'12.2.0',pele:'1.6.0',beautiful:'1.1.3'},examples:[]};
let server,browser;
try {
  const checkout=path.join(directory,'notes'),state=path.join(directory,'state');await fs.mkdir(checkout);await fs.mkdir(state);const root=await fs.realpath(checkout);
  await git(root,'init','-b','main');
  for(const [key,value] of [['user.name','Reference Test'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']])await git(root,'config',key,value);
  await fs.writeFile(path.join(root,'Scriba-Diagramas.md'),source);await git(root,'add','.');await git(root,'commit','-m','Reference fixture');
  await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:root,preferences:{askCommitNote:false,autoSave:false,intervalMinutes:1}}));
  await fs.writeFile(path.join(state,'library.json'),JSON.stringify({[root]:{pinned:['Scriba-Diagramas.md'],welcomeImageVersion:1,diagramManualVersion:1}}));
  const runtime=path.join(directory,'runtime.json');
  server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  let origin;for(let n=0;n<100;n++){try{origin=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(origin);
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],outside=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol)){outside.push(url.origin+url.pathname);return route.abort();}return route.continue();});
  await page.goto(origin);
  try{await page.getByRole('button',{name:'Scriba-Diagramas.md',exact:true}).click({timeout:15000});}catch(error){console.log(await page.locator('body').innerText());console.log({errors,outside});throw error;}
  await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode','read');
  const figures=page.locator('article figure[data-diagram-engine]:not([data-diagram-engine=zenuml])');await expect(figures).toHaveCount(examples.length);
  assert.deepEqual(await figures.evaluateAll(nodes=>[...new Set(nodes.map(node=>node.dataset.diagramEngine))]),['pele'],'All 58 unchosen reference diagrams start on Pele.');
  await page.getByRole('link',{name:'Estruturas e contratos',exact:true}).click();
  assert.equal(decodeURIComponent(new URL(page.url()).hash),'#estruturas-e-contratos');
  await expect(page.locator('#estruturas-e-contratos')).toBeInViewport();
  for(let i=0;i<examples.length;i++) {
    const example=examples[i];if(process.env.EXAMPLES&&!process.env.EXAMPLES.split(',').includes(example.id))continue;
    const figure=figures.nth(i),results={};
    for(const engine of ['mermaid','pele','beautiful']) {
      await figure.scrollIntoViewIfNeeded();await figure.getByRole('combobox',{name:'Renderizador do diagrama'}).selectOption(engine);
      await expect(figure).toHaveAttribute('data-diagram-engine',engine);
      try{await expect.poll(async()=>{await figure.scrollIntoViewIfNeeded();return await figure.getAttribute('data-diagram-state');},{timeout:30000}).toMatch(/^(ready|error)$/);}
      catch{results[engine]={state:'timeout'};continue;}
      const state=await figure.getAttribute('data-diagram-state');
      results[engine]={state,...(state==='error'?{error:await figure.getByRole('alert').innerText()}:{timing:await figure.locator('output').getAttribute('aria-label'),svg:await figure.locator('svg').count()})};
      if(state==='ready')await expect(figure.locator('svg').last()).toBeVisible();
    }
    report.examples.push({...example,results});
    console.log(`${i+1}/${examples.length} ${example.id}: ${Object.entries(results).map(([engine,result])=>`${engine}=${result.state}`).join(' ')}`);
  }
  const evidence=new URL('../docs/evidence/diagram-reference/',import.meta.url);await fs.mkdir(evidence,{recursive:true});
  const reportPath=process.env.EXAMPLES?'/tmp/scriba-reference-targeted.json':new URL('compatibility.json',evidence);
  await fs.writeFile(reportPath,JSON.stringify({...report,errors,outside},null,2)+'\n');
  // Keep source, note and Git clean despite renderer changes.
  assert.equal(await fs.readFile(path.join(root,'Scriba-Diagramas.md'),'utf8'),source);assert.equal(await git(root,'status','--porcelain'),'');
  await figures.first().scrollIntoViewIfNeeded();await figures.first().getByRole('combobox').selectOption('mermaid');await expect(figures.first()).toHaveAttribute('data-diagram-state','ready');
  await page.screenshot({path:new URL('reference-process-desktop.png',evidence).pathname});
  await page.setViewportSize({width:390,height:844});
  if(await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).isVisible())await page.getByRole('button',{name:'Fechar lista de notas',exact:true}).click();
  await figures.first().scrollIntoViewIfNeeded();await expect(figures.first()).toHaveAttribute('data-diagram-state','ready',{timeout:30000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:new URL('reference-process-mobile.png',evidence).pathname});
  assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
  const failed=report.examples.filter(example=>example.results.pele.state!=='ready'||example.results.mermaid.state!=='ready').map(example=>example.id);
  console.log(JSON.stringify({tested:report.examples.length,defaultFailures:failed,report:String(reportPath)}));
  assert.deepEqual(failed,[],'Every published example must render with default Pele and alternate Mermaid.');
}finally{await browser?.close();server?.kill();if(server&&server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));await fs.rm(directory,{recursive:true,force:true});}
