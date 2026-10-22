import { t } from '../i18n';
/** Optional user-visible directory storage; never substitutes the browser-private filesystem. */
import { isIosApp, iosBridge } from './ios';
type Directory = FileSystemDirectoryHandle & {queryPermission(options:{mode:string}):Promise<string>;requestPermission(options:{mode:string}):Promise<string>};
export const canChooseFolder = () => isIosApp || 'showDirectoryPicker' in window;
async function database():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open('scriba-device-folder',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
async function setting<T>(key:string,value?:T):Promise<T|undefined> {const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('settings',value===undefined?'readonly':'readwrite'),store=tx.objectStore('settings');const r=value===undefined?store.get(key):store.put(value,key);let result:T;r.onsuccess=()=>{result=r.result as T;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function folderLabel() {if(isIosApp)return (await iosBridge.folderStatus()).label;return (await setting<{label:string}>('label'))?.label||'';}
export async function disconnectFolder() {if(isIosApp)return iosBridge.disconnectFolder();await setting('parent',null);await setting('handle',null);await setting('label',{label:''});}
/** Invoke directly from a click so the OS permission prompt retains user activation. */
export async function chooseDeviceFolder() {
 if(isIosApp)return (await iosBridge.chooseFolder()).label;
 const picker=(window as unknown as {showDirectoryPicker(options:{mode:string}):Promise<Directory>}).showDirectoryPicker;
 if(!picker)throw new Error(t("Este navegador não permite gravar em uma pasta do Files. Use as notas no navegador e exporte ZIPs para Files."));
 const parent=await picker.call(window,{mode:'readwrite'});
 const folder=await parent.getDirectoryHandle('scriba',{create:true}) as Directory;
 await setting('parent',parent);await setting('handle',folder);await setting('label',{label:`${parent.name}/scriba`});return `${parent.name}/scriba`;
}
export async function authorizeDeviceFolder() {if(isIosApp)return iosBridge.authorizeFolder();if(!await setting('parent'))throw new Error(t("Selecione novamente a pasta principal pelo botão Selecionar pasta em Files para carregar as notas existentes. A configuração anterior guardava apenas a subpasta scriba."));const folder=await setting<Directory>('handle');if(folder&&await folder.requestPermission({mode:'readwrite'})!=='granted')throw new Error(t("Permita o acesso à pasta para salvar nela."));}
function safeParts(name:string) {const parts=name.split('/');if(!parts.length||parts.some(p=>!p||p==='.'||p==='..'||p.includes('\\')||p.includes('\0')))throw new Error(t("Caminho inválido para salvar na pasta."));return parts;}
async function digest(bytes:Uint8Array) {const hash=await crypto.subtle.digest('SHA-256',bytes as BufferSource);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
/** Reject external changes and collisions; a browser copy survives any permission/write failure. */
async function write(folder:Directory,name:string,bytes:Uint8Array) {
 const parts=safeParts(name),leaf=parts.pop()!;let directory:FileSystemDirectoryHandle=folder;
 for(const part of parts)directory=await directory.getDirectoryHandle(part,{create:true});
 const key=`revision:${await folderLabel()}:${name}`;const expected=await setting<string>(key);const next=await digest(bytes);
 try {const handle=await directory.getFileHandle(leaf);const existing=await digest(new Uint8Array(await(await handle.getFile()).arrayBuffer()));if(existing!==next&&existing!==expected)throw new Error(t("O arquivo {0} já existe ou mudou fora do Scriba. Preserve-o ou escolha outra pasta antes de tentar novamente.", name));}
 catch(error){if(!(error instanceof DOMException&&error.name==='NotFoundError'))throw error;}
 const handle=await directory.getFileHandle(leaf,{create:true});const stream=await handle.createWritable();try{await stream.write(bytes as BufferSource);await stream.close();}catch(error){await stream.abort().catch(()=>{});throw error;}
 await setting(key,next);
}
export async function saveToDeviceFolder(note:{name:string;value:string;files:{path:string;data:string}[]}) {
 if(isIosApp){if((await iosBridge.folderStatus()).label)await iosBridge.saveNote(note);return;}
 const folder=await setting<Directory>('handle');if(!folder)return;
 if(await folder.queryPermission({mode:'readwrite'})!=='granted')throw new Error(t("Nota preservada no navegador. Nas configurações, toque em Autorizar pasta para voltar a salvar em Files."));
 const prefix=note.name.includes('/')?note.name.slice(0,note.name.lastIndexOf('/')+1):'';
 for(const file of note.files)await write(folder,prefix+file.path,Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)));
 await write(folder,note.name,new TextEncoder().encode(note.value));
}

/** Read existing Markdown files from the selected parent and its scriba child. Git metadata is never traversed. */
export async function readDeviceNotes() {
 if(isIosApp)return (await iosBridge.readNotes()).notes;
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

/** A single source read never creates directories or asks for permissions in the background. */
async function locateDocument(name:string) {
 const parts=safeParts(name),folder=await setting<Directory>('handle'),parent=await setting<Directory>('parent');
 if(!folder)throw new Error(t("Selecione uma pasta nas configurações para recarregar do disco."));
 if(await folder.queryPermission({mode:'readwrite'})!=='granted')throw new Error(t("Autorize novamente a pasta nas configurações para recarregar do disco."));
 const hasSavedCopy=!!await setting(`revision:${await folderLabel()}:${name}`);
 for(const root of [folder,hasSavedCopy ? null : parent].filter(Boolean) as Directory[]) {
  try {
   let directory:FileSystemDirectoryHandle=root;
   for(const part of parts.slice(0,-1))directory=await directory.getDirectoryHandle(part);
   const file=await(await directory.getFileHandle(parts.at(-1)!)).getFile();
   if(file.size>5*1024*1024)throw new Error(t("O Markdown excede 5 MB."));
   return {file,directory,isSavedFolder:root===folder};
  }catch(error){if(!(error instanceof DOMException&&error.name==='NotFoundError'))throw error;}
 }
 return null;
}
/** Content hashes let saved files and read-only probes share an optimistic concurrency revision. */
export async function textVersion(value:string) {return digest(new TextEncoder().encode(value));}
export async function deviceDocumentVersion(name:string) {
 if(isIosApp)return iosBridge.documentVersion({name});
 const source=await locateDocument(name);
 return {version:source ? await digest(new Uint8Array(await source.file.arrayBuffer())) : null};
}
/** Read a fresh note and its raster assets, acknowledging only the bytes actually read. */
export async function readDeviceDocument(name:string) {
 if(isIosApp)return {...await iosBridge.document({name}),warnings:[]};
 const source=await locateDocument(name);
 if(!source)throw new Error(t("O arquivo foi removido da pasta. Seu rascunho continua no editor."));
 const bytes=new Uint8Array(await source.file.arrayBuffer());
 const value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),version=await digest(bytes);
 const files:{path:string;data:string;mime:string}[]=[],warnings:string[]=[];let total=0;
 const label=await folderLabel(),prefix=name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):'';
 for(const match of value.matchAll(/!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)) {
  let imagePath:string;try{imagePath=decodeURIComponent(match[1]);}catch{warnings.push(t("Referência de imagem inválida."));continue;}
  if(/^[a-z][a-z0-9+.-]*:/i.test(imagePath)||files.some(file=>file.path===imagePath))continue;
  try {
   const parts=safeParts(imagePath);let directory=source.directory;
   for(const part of parts.slice(0,-1))directory=await directory.getDirectoryHandle(part);
   const image=await(await directory.getFileHandle(parts.at(-1)!)).getFile();
   const mime=image.type||(/\.png$/i.test(imagePath)?'image/png':/\.webp$/i.test(imagePath)?'image/webp':/\.gif$/i.test(imagePath)?'image/gif':/\.jpe?g$/i.test(imagePath)?'image/jpeg':'');
   if(image.size>10*1024*1024||total+image.size>40*1024*1024||files.length>=50||!/^image\/(png|jpeg|gif|webp)$/.test(mime))throw new Error(t("Imagem não suportada ou maior que o limite."));
   const bytes=new Uint8Array(await image.arrayBuffer());total+=bytes.length;
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   files.push({path:imagePath,data:btoa(binary),mime});
   if(source.isSavedFolder)await setting(`revision:${label}:${prefix}${imagePath}`,await digest(bytes));
  }catch{warnings.push(t("Imagem indisponível: {0}", imagePath));}
 }
 if(source.isSavedFolder)await setting(`revision:${label}:${name}`,version);
 return {name,value,version,files,warnings,modifiedAt:new Date(source.file.lastModified).toISOString()};
}

/** Native/browser moves never relocate image directories or overwrite an existing note. */
export async function renameDeviceNote(body:{name:string;newName:string;version:string}) {
 if(isIosApp)return iosBridge.renameNote(body);
 const source=await locateDocument(body.name);
 if(!source)throw new Error(t("O arquivo mudou. Reabra a nota antes de renomear."));
 const oldLeaf=safeParts(body.name).at(-1)!,newLeaf=safeParts(body.newName).at(-1)!;
 if(body.name===body.newName)return;
 if(body.name.split('/').slice(0,-1).join('/')!==body.newName.split('/').slice(0,-1).join('/'))throw new Error(t("Mantenha o arquivo na mesma pasta ao renomear."));
 const handle=await source.directory.getFileHandle(oldLeaf) as FileSystemFileHandle & {move?:(name:string)=>Promise<void>};
 if(await digest(new Uint8Array(await(await handle.getFile()).arrayBuffer()))!==body.version)throw new Error(t("O arquivo mudou. Reabra a nota antes de renomear."));
 try {await source.directory.getFileHandle(newLeaf);throw new Error(t("Já existe um arquivo com esse nome na pasta."));}catch(error){if(!(error instanceof DOMException && error.name==='NotFoundError'))throw error;}
 // A directory capability alone cannot guarantee exclusive copy-and-delete; use an actual move.
 if(!handle.move)throw new Error(t("Este navegador não permite renomear arquivos nesta pasta. Renomeie pelo aplicativo Files e atualize as notas."));
 await handle.move(newLeaf);
 await setting(`revision:${await folderLabel()}:${body.newName}`,body.version);
}
