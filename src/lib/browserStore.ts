import {saveToDeviceFolder, readDeviceNotes} from './deviceFolder';
import welcomeUrl from '../../server/assets/escriba-welcome-v1.jpg?url';
/** Public builds keep all user content in this origin's IndexedDB, never on the VPS. */
export const browserMode = import.meta.env.VITE_STORAGE_MODE === 'browser';
interface Note { name: string; value: string; version: string; modifiedAt: string; files: {path:string;data:string;mime:string}[] }
interface State { notes: Record<string,Note>; pins: string[]; preferences: {askCommitNote:boolean;autoSave:boolean;intervalMinutes:number} }
const initial = ():State => ({notes:{},pins:[],preferences:{askCommitNote:false,autoSave:true,intervalMinutes:1}});
let database: Promise<IDBDatabase>;
function db() {
  return database ||= new Promise((resolve,reject)=>{const request=indexedDB.open('scriba-private-notes',1);request.onupgradeneeded=()=>request.result.createObjectStore('library');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
function library(state:State) {
  const summary=(note:Note)=>({name:note.name,modifiedAt:note.modifiedAt,title:note.value.match(/^#\s+(.+)$/m)?.[1]||note.name,preview:note.value.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/[#*`>\[\]]/g,'').replace(/\s+/g,' ').slice(0,160),hasImage:note.files.length>0});
  return {pinned:state.pins.filter(name=>state.notes[name]).map(name=>summary(state.notes[name])),recent:Object.values(state.notes).filter(note=>!state.pins.includes(note.name)).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)).slice(0,100).map(summary)};
}
/** Transactions serialize cross-tab edits and reject stale document revisions. */
export async function browserFetch(route:string, body?:any):Promise<Response> {
  try {
    const database=await db();
    const url=new URL(route,'https://browser.invalid/');
    const imported = url.pathname === '/folder/import' ? await readDeviceNotes() : [];
    let guide:Note|undefined;
    if(url.pathname==='/library/initialize') {
      const image=await fetch(welcomeUrl); const bytes=new Uint8Array(await image.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      guide={name:'Boas-vindas.md',version:crypto.randomUUID(),modifiedAt:new Date().toISOString(),value:'# Bem-vindo ao Scriba\n\n![Escriba egípcio](assets/boas-vindas.jpg)\n\nEscreva, organize e guarde suas notas Markdown neste navegador.\n\n## Comece aqui\n\nCrie uma nota, escreva e pressione Salvar ou ⌘S. Busque e fixe notas na lateral. Importe Markdown e ZIP e exporte suas notas com imagens.\n\n## Privacidade e armazenamento\n\nSuas notas ficam somente neste navegador e dispositivo. Não são enviadas ao nosso servidor. Limpar os dados do site remove as notas; exporte pacotes ZIP para backup. Não há sincronização automática entre dispositivos.\n\nRascunhos são preservados durante a edição. O salvamento automático da biblioteca vem ativado a cada 1 minuto e pode ser ajustado nas configurações.\n\n## Git e roadmap\n\nA versão local para Mac já permite selecionar um repositório e salvar com commit e push. Na versão pública, integração Git remota por usuário (inclusive mobile), Google Drive e novos temas estão no roadmap, ainda sem data.\n\n[Baixar versão local](https://github.com/ab-orbit/ab-markdow-editor)\n\nPowered by **Aeon Bridge Co.** — offered to community.',files:[{path:'assets/boas-vindas.jpg',data:btoa(binary),mime:'image/jpeg'}]};
    }
    const response = await new Promise<Response>((resolve,reject)=>{
      const tx=database.transaction('library','readwrite'),store=tx.objectStore('library'),request=store.get('state');let result:unknown;let status=200;
      request.onsuccess=()=>{
        const state:State=request.result||initial();const name=body?.name||url.searchParams.get('name')||'';
        switch(url.pathname) {
          case '/folder/import':for(const note of imported){const existing=state.notes[note.name];if(!existing)state.notes[note.name]={...note,version:crypto.randomUUID()};}result=library(state);break;
          case '/repository':result={repository:'Notas neste navegador',branch:'',status:''};break;
          case '/preferences':if(body)state.preferences={askCommitNote:false,autoSave:!!body.autoSave,intervalMinutes:Math.max(1,Math.min(1440,Number(body.intervalMinutes)||1))};result=state.preferences;break;
          case '/files':result=Object.keys(state.notes).sort();break;
          case '/library/initialize':if(guide&&!state.notes[guide.name]){state.notes[guide.name]=guide;state.pins.unshift(guide.name);}result=library(state);break;
          case '/library':case '/recent':result=library(state);break;
          case '/pin':state.pins=state.pins.filter(item=>item!==name);if(body.pinned&&state.notes[name])state.pins.push(name);result=library(state);break;
          case '/document':result=state.notes[name]?{...state.notes[name],warnings:[]}:{error:'Nota não encontrada.'};if(!state.notes[name])status=404;break;
          case '/thumbnail':result=state.notes[name]?.files[0]||null;break;
          case '/save-sync': {
            if(!name.trim()||!name.toLowerCase().endsWith('.md')){status=400;result={error:'Informe um nome de arquivo terminado em .md.'};break;}
            const previous=state.notes[name];
            if(previous&&previous.version!==body.version&&body.baseVersion!==previous.version){status=409;result={error:'Esta nota mudou em outra aba. Salve uma cópia ou reabra a nota.',conflict:{name,kind:body.version?'modified':'exists',currentVersion:previous.version}};break;}
            const version=crypto.randomUUID();state.notes[name]={name,value:body.value,version,modifiedAt:new Date().toISOString(),files:(body.files||[]).map((file:any)=>({...file,mime:/\.png$/i.test(file.path)?'image/png':/\.webp$/i.test(file.path)?'image/webp':/\.gif$/i.test(file.path)?'image/gif':'image/jpeg'}))};result={version,synced:true};break;
          }
          default:status=400;result={error:'Esta função requer a versão local do Scriba.'};
        }
        store.put(state,'state');
      };
      tx.oncomplete=()=>resolve(Response.json(result,{status}));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    if(url.pathname==='/save-sync'&&response.ok){const result=await response.json();try{await saveToDeviceFolder(body);}catch(error){return Response.json({...result,synced:false,error:error instanceof Error?error.message:String(error)});}return Response.json(result);}
    return response;
  } catch {return Response.json({error:'Não foi possível acessar o armazenamento deste navegador. Exporte suas notas para preservar uma cópia.'},{status:500});}
}
