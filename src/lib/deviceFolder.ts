/** Optional user-visible directory storage; never substitutes the browser-private filesystem. */
type Directory = FileSystemDirectoryHandle & {queryPermission(options:{mode:string}):Promise<string>;requestPermission(options:{mode:string}):Promise<string>};
export const canChooseFolder = () => 'showDirectoryPicker' in window;
async function database():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open('scriba-device-folder',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
async function setting<T>(key:string,value?:T):Promise<T|undefined> {const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('settings',value===undefined?'readonly':'readwrite'),store=tx.objectStore('settings');const r=value===undefined?store.get(key):store.put(value,key);let result:T;r.onsuccess=()=>{result=r.result as T;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function folderLabel() {return (await setting<{label:string}>('label'))?.label||'';}
export async function disconnectFolder() {await setting('parent',null);await setting('handle',null);await setting('label',{label:''});}
/** Invoke directly from a click so the OS permission prompt retains user activation. */
export async function chooseDeviceFolder() {
 const picker=(window as unknown as {showDirectoryPicker(options:{mode:string}):Promise<Directory>}).showDirectoryPicker;
 if(!picker)throw new Error('Este navegador não permite gravar em uma pasta do Files. Use as notas no navegador e exporte ZIPs para Files.');
 const parent=await picker.call(window,{mode:'readwrite'});
 const folder=await parent.getDirectoryHandle('scriba',{create:true}) as Directory;
 await setting('parent',parent);await setting('handle',folder);await setting('label',{label:`${parent.name}/scriba`});return `${parent.name}/scriba`;
}
export async function authorizeDeviceFolder() {if(!await setting('parent'))throw new Error('Selecione novamente a pasta principal pelo botão Selecionar pasta em Files para carregar as notas existentes. A configuração anterior guardava apenas a subpasta scriba.');const folder=await setting<Directory>('handle');if(folder&&await folder.requestPermission({mode:'readwrite'})!=='granted')throw new Error('Permita o acesso à pasta para salvar nela.');}
function safeParts(name:string) {const parts=name.split('/');if(!parts.length||parts.some(p=>!p||p==='.'||p==='..'||p.includes('\\')||p.includes('\0')))throw new Error('Caminho inválido para salvar na pasta.');return parts;}
async function digest(bytes:Uint8Array) {const hash=await crypto.subtle.digest('SHA-256',bytes as BufferSource);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
/** Reject external changes and collisions; a browser copy survives any permission/write failure. */
async function write(folder:Directory,name:string,bytes:Uint8Array) {
 const parts=safeParts(name),leaf=parts.pop()!;let directory:FileSystemDirectoryHandle=folder;
 for(const part of parts)directory=await directory.getDirectoryHandle(part,{create:true});
 const key=`revision:${await folderLabel()}:${name}`;const expected=await setting<string>(key);const next=await digest(bytes);
 try {const handle=await directory.getFileHandle(leaf);const existing=await digest(new Uint8Array(await(await handle.getFile()).arrayBuffer()));if(existing!==next&&existing!==expected)throw new Error(`O arquivo ${name} já existe ou mudou fora do Scriba. Preserve-o ou escolha outra pasta antes de tentar novamente.`);}
 catch(error){if(!(error instanceof DOMException&&error.name==='NotFoundError'))throw error;}
 const handle=await directory.getFileHandle(leaf,{create:true});const stream=await handle.createWritable();try{await stream.write(bytes as BufferSource);await stream.close();}catch(error){await stream.abort().catch(()=>{});throw error;}
 await setting(key,next);
}
export async function saveToDeviceFolder(note:{name:string;value:string;files:{path:string;data:string}[]}) {
 const folder=await setting<Directory>('handle');if(!folder)return;
 if(await folder.queryPermission({mode:'readwrite'})!=='granted')throw new Error('Nota preservada no navegador. Nas configurações, toque em Autorizar pasta para voltar a salvar em Files.');
 const prefix=note.name.includes('/')?note.name.slice(0,note.name.lastIndexOf('/')+1):'';
 for(const file of note.files)await write(folder,prefix+file.path,Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)));
 await write(folder,note.name,new TextEncoder().encode(note.value));
}

/** Read existing Markdown files from the selected parent and its scriba child. Git metadata is never traversed. */
export async function readDeviceNotes() {
 const folder=await setting<Directory>('handle');const parent=await setting<Directory>('parent');
 if(!folder)return [];
 const notes:{name:string;value:string;files:{path:string;data:string;mime:string}[];modifiedAt:string}[]=[];
 async function scan(directory:FileSystemDirectoryHandle,prefix:string,depth:number) {
  if(depth>10)return;
  for await(const [leaf,entry] of (directory as any).entries()) {
   if(leaf.startsWith('.')||leaf==='node_modules'||(!prefix&&leaf==='scriba'))continue;
   if(entry.kind==='directory'){await scan(entry,`${prefix}${leaf}/`,depth+1);continue;}
   if(!/\.(md|markdown|mdown)$/i.test(leaf))continue;
   const file=await entry.getFile();if(file.size>5*1024*1024)continue;
   const value=await file.text();const files:{path:string;data:string;mime:string}[]=[];
   for(const match of value.matchAll(/!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)) {
    try {const imagePath=decodeURIComponent(match[1]);const parts=safeParts(imagePath);let imageDir=directory;for(const part of parts.slice(0,-1))imageDir=await imageDir.getDirectoryHandle(part);const image=await(await imageDir.getFileHandle(parts.at(-1)!)).getFile();if(image.size>10*1024*1024||!/^image\/(png|jpeg|gif|webp)$/.test(image.type))continue;const bytes=new Uint8Array(await image.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));files.push({path:imagePath,data:btoa(binary),mime:image.type});}catch{/* Keep Markdown available even if an image cannot be read. */}
   }
   notes.push({name:prefix+leaf,value,files,modifiedAt:new Date(file.lastModified).toISOString()});
  }
 }
 if(parent)await scan(parent,'',0);
 await scan(folder,'',0);
 return notes;
}
