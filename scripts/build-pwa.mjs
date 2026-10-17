import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
async function files(directory){const result=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const name=path.join(directory,entry.name);if(entry.isDirectory())result.push(...await files(name));else result.push(name);}return result;}
// The offline shell never contains the process-specific API capability injected into online HTML.
await fs.copyFile(path.join(dist,'index.html'),path.join(dist,'app-shell.html'));
const assets=(await files(dist)).filter(file=>!file.endsWith('/index.html')&&!file.endsWith('/sw.js')&&!file.endsWith('/icons/scribe-source.png'));
const hash=createHash('sha256');for(const file of assets.sort())hash.update(await fs.readFile(file));
const cache=`ab-markdown-shell-${hash.digest('hex').slice(0,16)}`;
const urls=assets.map(file=>'/'+path.relative(dist,file).split(path.sep).join('/'));
await fs.writeFile(path.join(dist,'sw.js'),`/* Generated, versioned application-shell cache. API responses and tokens are never cached. */
const CACHE=${JSON.stringify(cache)};
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
// Updates wait for the previous app windows to close; never reload an editing session.
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ab-markdown-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/github/')||url.pathname==='/health')return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/app-shell.html'))));return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(url.pathname)||fetch(event.request)));
});
`);
console.log(`PWA shell: ${urls.length} assets, ${cache}`);
