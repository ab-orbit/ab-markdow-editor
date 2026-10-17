/** Optional user-visible directory storage; never substitutes the browser-private filesystem. */
type Directory = FileSystemDirectoryHandle & {queryPermission(options:{mode:string}):Promise<string>;requestPermission(options:{mode:string}):Promise<string>};
export const canChooseFolder = () => 'showDirectoryPicker' in window;
async function database():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open('scriba-device-folder',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
async function setting<T>(key:string,value?:T):Promise<T|undefined> {const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('settings',value===undefined?'readonly':'readwrite'),store=tx.objectStore('settings');const r=value===undefined?store.get(key):store.put(value,key);let result:T;r.onsuccess=()=>{result=r.result as T;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function folderLabel() {return (await setting<{label:string}>('label'))?.label||'';}
export async function disconnectFolder() {await setting('handle',null);await setting('label',{label:''});}
/** Invoke directly from a click so the OS permission prompt retains user activation. */
export async function chooseDeviceFolder() {
 const picker=(window as unknown as {showDirectoryPicker(options:{mode:string}):Promise<Directory>}).showDirectoryPicker;
 if(!picker)throw new Error('Este navegador não permite gravar em uma pasta do Files. Use as notas no navegador e exporte ZIPs para Files.');
 const parent=await picker.call(window,{mode:'readwrite'});
 const folder=await parent.getDirectoryHandle('scriba',{create:true}) as Directory;
 await setting('handle',folder);await setting('label',{label:`${parent.name}/scriba`});return `${parent.name}/scriba`;
}
export async function authorizeDeviceFolder() {const folder=await setting<Directory>('handle');if(folder&&await folder.requestPermission({mode:'readwrite'})!=='granted')throw new Error('Permita o acesso à pasta para salvar nela.');}
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
