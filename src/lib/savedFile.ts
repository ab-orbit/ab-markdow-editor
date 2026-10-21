import { t } from '../i18n';
import {createMarkdownPackage, readMarkdownPackage, type MarkdownAsset} from './markdown/assets';
import {readMarkdownFile} from './markdown/files';
import {isIosApp} from './ios';

export interface SavedFileTarget {
  /** Private capability, never an arbitrary path received from a document. */
  id: string;
  /** Markdown name shown in the editor; ZIP packages keep their own visible location. */
  name: string;
  /** User-selected path on native Mac, or basename exposed by the browser. */
  location: string;
  /** Revision of the selected destination, acknowledged again after writing. */
  version: string | null;
}
type WritableHandle = FileSystemFileHandle & {queryPermission(options:{mode:'readwrite'}):Promise<PermissionState>};
interface StoredTarget {
  /** Serializable capability stored only in this origin's IndexedDB. */
  handle:WritableHandle;
  /** Markdown filename used by the editor, including when stored inside a ZIP. */
  name:string;
  /** Actual filename exposed by the file picker. */
  location:string;
  /** Keep Markdown and attached raster images together in a single writable file. */
  packaged:boolean;
}
type PickerWindow = Window & {showSaveFilePicker?:(options:unknown)=>Promise<WritableHandle>};
let connection:Promise<IDBDatabase> | undefined;
const handles = new Map<string,StoredTarget>();
function database() {
  return connection ??= new Promise((resolve,reject)=>{
    const request=indexedDB.open('scriba-saved-files',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('handles');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function target(id:string):Promise<StoredTarget> {
  let stored=handles.get(id);
  if(!stored){const db=await database();stored=await new Promise<StoredTarget>((resolve,reject)=>{const request=db.transaction('handles').objectStore('handles').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  if(!stored)throw new Error(t("O arquivo não está autorizado. Use Salvar como para selecioná-lo novamente."));
  handles.set(id,stored);
  if(await stored.handle.queryPermission({mode:'readwrite'})!=='granted')throw new Error(t("O acesso ao arquivo expirou. Use Salvar como para autorizar o destino novamente."));
  return stored;
}
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const encoded=async(file:File)=>{const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let index=0;index<bytes.length;index+=8192)text+=String.fromCharCode(...bytes.subarray(index,index+8192));return btoa(text);};

/** Feature detection keeps unsupported browsers on an explicit copy/share flow. */
export function canSaveFileDirectly() {return !isIosApp && typeof (window as PickerWindow).showSaveFilePicker==='function';}
/** Invoke the picker before any await: processing bytes first would lose browser user activation. */
async function choose(body:{name:string;hasAssets?:boolean}):Promise<SavedFileTarget|null|{unsupported:true}> {
  const picker=(window as PickerWindow).showSaveFilePicker;
  if(!canSaveFileDirectly()||!picker)return {unsupported:true};
  const packaged=!!body.hasAssets;
  let handle:WritableHandle;
  try {handle=await picker.call(window,{id:'scriba-save-as',suggestedName:body.name.split(/[\\/]/).at(-1)!.replace(/\.[^.]+$/,'')+(packaged?'.zip':'.md'),excludeAcceptAllOption:true,types:[packaged?{description:t("Markdown e imagens (ZIP)"),accept:{'application/zip':['.zip']}}:{description:'Markdown',accept:{'text/markdown':['.md','.markdown','.mdown']}}]});}
  catch(error){if(error instanceof DOMException&&error.name==='AbortError')return null;throw error;}
  if(!(packaged?/\.zip$/i:/\.(md|markdown|mdown)$/i).test(handle.name))throw new Error(t("Selecione um arquivo com a extensão indicada."));
  const id=crypto.randomUUID(),stored={handle,packaged,name:packaged?handle.name.replace(/\.zip$/i,'.md'):handle.name,location:handle.name};
  const version=await digest(await(await handle.getFile()).arrayBuffer());
  const db=await database();
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('handles','readwrite');tx.objectStore('handles').put(stored,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  handles.set(id,stored);return {id,name:stored.name,location:stored.location,version};
}
async function versionOf(stored:StoredTarget) {try{return await digest(await(await stored.handle.getFile()).arrayBuffer());}catch(error){if(error instanceof DOMException&&error.name==='NotFoundError')return null;throw error;}}
async function write(body:any) {
  const stored=await target(body.id);
  if(typeof body.value!=='string'||new TextEncoder().encode(body.value).length>5*1024*1024)throw new Error(t("O Markdown excede 5 MB."));
  if(!stored.packaged&&body.files?.length)throw new Error(t("Esta nota contém imagens. Use Salvar como para guardar o Markdown e as imagens juntos em um ZIP."));
  const assets:MarkdownAsset[]=(body.files||[]).map((file:any)=>({path:file.path,url:'',file:new File([Uint8Array.from(atob(file.data),char=>char.charCodeAt(0))],file.path.split('/').at(-1),{type:file.mime||'application/octet-stream'})}));
  const bytes=stored.packaged?Uint8Array.from(await createMarkdownPackage(body.value,assets)):new TextEncoder().encode(body.value);
  const current=await versionOf(stored),version=await digest(bytes.buffer);
  if(current!==body.version&&current!==version)return Response.json({error:t("O arquivo mudou fora do Scriba. Seu texto continua no editor."),code:'DOCUMENT_CONFLICT',conflict:{name:stored.name,kind:current===null?'deleted':'modified',currentVersion:current}},{status:409});
  // Only explicit conflict replacement keeps a private recovery copy, before opening the write stream.
  if(body.backupBeforeReplace&&current!==null){const previous=await(await stored.handle.getFile()).arrayBuffer(),db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('handles','readwrite');tx.objectStore('handles').put({bytes:previous,name:stored.location},`backup:${crypto.randomUUID()}`);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  const stream=await stored.handle.createWritable();
  try {await stream.write(bytes);await stream.close();}catch(error){await stream.abort().catch(()=>{});throw error;}
  return Response.json({version,synced:true});
}
/** External files bypass the configured GitHub/library destination entirely. */
export async function savedFileRequest(route:string,body?:any):Promise<Response> {
  const url=new URL(route,'https://saved-file.invalid/');
  try {
    if(url.pathname==='/pick-save-as')return Response.json(await choose(body));
    if(url.pathname==='/finder-save')return navigator.locks?await navigator.locks.request('scriba-selected-file-write',()=>write(body)):await write(body);
    const id=url.searchParams.get('id')||'',stored=await target(id);
    if(url.pathname==='/finder-document-version')return Response.json({version:await versionOf(stored)});
    const file=await stored.handle.getFile(),version=await digest(await file.arrayBuffer());
    const document=stored.packaged?await readMarkdownPackage(file):{value:await readMarkdownFile(file),files:[]};
    return Response.json({...document,files:await Promise.all(document.files.map(async asset=>({path:asset.path,data:await encoded(asset.file),mime:asset.file.type}))),version,name:stored.name,location:stored.location,warnings:[]});
  }catch(error){return Response.json({error:error instanceof Error?error.message:t("Não foi possível acessar o arquivo selecionado.")},{status:400});}
}
