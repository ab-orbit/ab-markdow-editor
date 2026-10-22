import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import names from '../server/reference-texts.json' with {type:'json'};
import welcomes from '../server/welcome-texts.json' with {type:'json'};
const exec=promisify(execFile);
test('all four authored references use the same bundled cover and keep independent titles',async()=>{
 const titles=[];for(const name of Object.values(names)){const text=await fs.readFile(new URL('../docs/reference-texts/'+name,import.meta.url),'utf8');assert.match(text,/!\[cover\]\(assets\/cover\.jpg\)/);assert.equal((text.match(/!\[/g)||[]).length,1);titles.push(text.split('\n')[0]);}assert.equal(new Set(titles).size,4);assert.ok((await fs.stat(new URL('../docs/reference-texts/assets/cover.jpg',import.meta.url))).size>1000);
});
test('HTTP reference initialization selects independent locale files, preserves edits, unpins and shared-cover collisions',async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'scriba-reference-locales-')),state=path.join(temporary,'state'),root=path.join(temporary,'notes');let server;
 try{
  await fs.mkdir(root);await exec('git',['init','-b','main',root]);await fs.mkdir(state);
  await fs.writeFile(path.join(state,'settings.json'),JSON.stringify({repository:root,preferences:{askCommitNote:false,autoSave:false,intervalMinutes:1}}));
  const runtime=path.join(temporary,'runtime.json');server=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',MARKDOWN_STATE_DIR:state,MARKDOWN_RUNTIME_FILE:runtime},stdio:'pipe'});
  let base;for(let i=0;i<100;i++){try{base=JSON.parse(await fs.readFile(runtime,'utf8')).url;break;}catch{await new Promise(resolve=>setTimeout(resolve,30));}}assert.ok(base);
  const token=(await(await fetch(base)).text()).match(/window\.__MARKDOWN_TOKEN__="([a-f0-9]+)"/)[1];
  const api=async(route,body)=>{const response=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;};
  // A user's existing cover must never be overwritten by a built-in reference.
  await fs.mkdir(path.join(root,'assets'));await fs.writeFile(path.join(root,'assets/cover.jpg'),'user-owned-cover');
  await fs.mkdir(path.join(root,'Scriba-References'));await fs.writeFile(path.join(root,'Scriba-References',names.en),'# User-owned note');
  await fs.mkdir(path.join(root,'Scriba-Welcome'));await fs.writeFile(path.join(root,'Scriba-Welcome',welcomes.en),'# User-owned welcome');
  await fs.mkdir(path.join(root,'Scriba-References/assets'));await fs.writeFile(path.join(root,'Scriba-References/assets/boas-vindas.jpg'),'user-owned-welcome-image');
  for(const language of ['en','de','fr','pt']){
   const first=await api('library/initialize',{language});const name=first.pinned.find(n=>n.name.replace(/ \(\d+\)(?=\.md$)/,'').endsWith(names[language])).name;assert.ok(name.startsWith('Scriba-References/'));
   const doc=await api('document?name='+encodeURIComponent(name));const authored=await fs.readFile(new URL('../docs/reference-texts/'+names[language],import.meta.url),'utf8');assert.equal(doc.value,authored);
   const privateText=authored+'\nUser annotation.\n';await api('save',{name,value:privateText,version:doc.version});await api('pin',{name,pinned:false});
   const welcomeName=first.pinned.find(n=>n.name.replace(/ \(\d+\)(?=\.md$)/,'').endsWith(welcomes[language])).name;
   const welcome=await api('document?name='+encodeURIComponent(welcomeName));const welcomeSource=await fs.readFile(new URL('../docs/welcome-texts/'+welcomes[language],import.meta.url),'utf8');assert.equal(welcome.value,welcomeSource.replace(names[language],name));
   await api('save',{name:welcomeName,value:welcome.value+'\nMy welcome annotation.\n',version:welcome.version});await api('pin',{name:welcomeName,pinned:false});
   const again=await api('library/initialize',{language});assert.ok(!again.pinned.some(note=>note.name===welcomeName));assert.match((await api('document?name='+encodeURIComponent(welcomeName))).value,/My welcome annotation/);assert.ok(!again.pinned.some(note=>note.name===name));assert.equal((await api('document?name='+encodeURIComponent(name))).value,privateText);
  }
  assert.equal(await fs.readFile(path.join(root,'assets/cover.jpg'),'utf8'),'user-owned-cover');assert.deepEqual(await fs.readFile(path.join(root,'Scriba-References/assets/cover.jpg')),await fs.readFile(new URL('../docs/reference-texts/assets/cover.jpg',import.meta.url)));
  assert.equal(await fs.readFile(path.join(root,'Scriba-References',names.en),'utf8'),'# User-owned note');
  assert.equal(await fs.readFile(path.join(root,'Scriba-References/assets/boas-vindas.jpg'),'utf8'),'user-owned-welcome-image');assert.equal(await fs.readFile(path.join(root,'Scriba-Welcome',welcomes.en),'utf8'),'# User-owned welcome');
  assert.deepEqual(await fs.readFile(path.join(root,'Scriba-Welcome/assets/boas-vindas.jpg')),await fs.readFile(new URL('../docs/welcome-texts/assets/boas-vindas.jpg',import.meta.url)));
  const library=await api('library');assert.equal([...library.pinned,...library.recent].length,10,'New localized clients do not seed obsolete common references');
  await fs.unlink(path.join(root,'Scriba-Welcome',welcomes.pt));await api('library/initialize',{language:'pt'});await assert.rejects(fs.access(path.join(root,'Scriba-Welcome',welcomes.pt)),{code:'ENOENT'});
  await fs.unlink(path.join(root,'Scriba-References',names.pt));await api('library/initialize',{language:'pt'});await assert.rejects(fs.access(path.join(root,'Scriba-References',names.pt)),{code:'ENOENT'});
 }finally{server?.kill();if(server)await new Promise(resolve=>server.once('exit',resolve));await fs.rm(temporary,{recursive:true,force:true});}
});

test('welcome files have localized resource references, vector icons and the unchanged artwork',async()=>{
 const originals=await fs.readFile(new URL('../server/assets/escriba-welcome-v1.jpg',import.meta.url));
 assert.deepEqual(await fs.readFile(new URL('../docs/welcome-texts/assets/boas-vindas.jpg',import.meta.url)),originals);
 const titles=[];for(const [language,name] of Object.entries(welcomes)) {
  const text=await fs.readFile(new URL('../docs/welcome-texts/'+name,import.meta.url),'utf8');
  assert.ok(text.includes(names[language]));assert.match(text,/assets\/boas-vindas.jpg/);assert.equal((text.match(/data-lucide=/g)||[]).length,8);
  assert.doesNotMatch(text,/\p{Extended_Pictographic}|sparkles|Salvar ou|toque em Salvar/u);titles.push(text.split('\n')[0]);
 }assert.equal(new Set(titles).size,4);
});
