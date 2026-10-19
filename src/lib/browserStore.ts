import {githubSelection, githubRequest, libraryKey} from './github';
import {isIosApp} from './ios';
import {saveToDeviceFolder, readDeviceNotes, folderLabel, deviceDocumentVersion, readDeviceDocument, textVersion} from './deviceFolder';
import diagramManual from '../../docs/Scriba-Diagramas.md?raw';
import {extendDiagramManual} from '../../server/diagram-manual.mjs';
import welcomeUrl from '../../server/assets/escriba-welcome-v1.jpg?url';
/** Public builds keep all user content in this origin's IndexedDB, never on the VPS. */
export const browserMode = import.meta.env.VITE_STORAGE_MODE === 'browser';
interface Note { name: string; value: string; version: string | null; title?: string; cached?: boolean; pending?: boolean; modifiedAt: string; files: {path:string;data:string;mime:string}[] }
interface State { notes: Record<string,Note>; pins: string[];
  /** Seed metadata persists user decisions to edit, unpin or remove a reference. */
  diagramManualVersion?: number;
  diagramManualName?: string;
  /** Append the ZenUML reference once, respecting subsequent edits and removal. */
  diagramManualZenUmlVersion?: number;
  /** Append the Excalidraw reference once without restoring user-removed sections. */
  diagramManualExcalidrawVersion?: number;
 preferences: {askCommitNote:boolean;autoSave:boolean;intervalMinutes:number;
  /** Gesture preference is private to this destination, alongside its existing save settings. */
  doubleClickToEdit:boolean;
} }
const initial = ():State => ({notes:{},pins:[],preferences:{askCommitNote:false,autoSave:true,intervalMinutes:1,doubleClickToEdit:true}});
let database: Promise<IDBDatabase>;
function db() {
  return database ||= new Promise((resolve,reject)=>{const request=indexedDB.open('scriba-private-notes',1);request.onupgradeneeded=()=>request.result.createObjectStore('library');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
function library(state:State) {
  const summary=(note:Note)=>({name:note.name,modifiedAt:note.modifiedAt,title:note.value.match(/^#\s+(.+)$/m)?.[1]||note.title||note.name,preview:note.value.replace(/<!--[\s\S]*?-->/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/[#*`>\[\]]/g,'').replace(/\s+/g,' ').slice(0,160),hasImage:note.files.length>0});
  return {pinned:state.pins.filter(name=>state.notes[name]).map(name=>summary(state.notes[name])),recent:Object.values(state.notes).filter(note=>!state.pins.includes(note.name)).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)).slice(0,100).map(summary)};
}
/** Read outside a write transaction: GitHub requests must never keep IndexedDB locked. */
async function snapshot(database:IDBDatabase,key:string):Promise<State> {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('library','readonly'),request=tx.objectStore('library').get(key);
    tx.oncomplete=()=>resolve(request.result||initial());tx.onerror=()=>reject(tx.error);
  });
}
/** Prepare a normal, destination-scoped note, adopting owned copies and avoiding user files. */
interface PreparedManual {note:Note;created:boolean;updated?:boolean;extensionDone?:boolean;baseVersion?:string|null;baseValue?:string;baseRemoteVersion?:string|null}
async function prepareDiagramManual(database:IDBDatabase,key:string,remote:any,hasGitHub:boolean):Promise<PreparedManual|undefined> {
  const state=await snapshot(database,key);
  const known=new Map<string,any>((remote?.notes||[]).map((note:Note)=>[note.name,note]));
  const owned=(value:string)=>value.includes('<!-- scriba-reference:diagram-manual version=');
  async function extend(note:Note,created=false):Promise<PreparedManual> {
    const extensions = [!state.diagramManualZenUmlVersion && 'zenuml-v1', !state.diagramManualExcalidrawVersion && 'excalidraw-v1'].filter((value): value is string => !!value);
    const previous=state.notes[note.name],value=extendDiagramManual(note.value,diagramManual,extensions);
    if(value===null)return {note,created,extensionDone:true};
    const updated:Note={...note,value,cached:true,version:hasGitHub?note.version:crypto.randomUUID(),modifiedAt:new Date().toISOString(),pending:hasGitHub};
    if(hasGitHub&&remote) {
      try {
        const response=await githubRequest('save',{...updated,scope:key,message:'Extend Scriba diagram manual reference sections'}),result=await response.json();
        if(response.ok){updated.version=result.version;updated.pending=false;}
        else return {note,created}; // A remote conflict never replaces local or remote annotations.
      }catch{/* Preserve the appended section privately for a later explicit save. */}
    }
    return {note:updated,created,updated:true,extensionDone:true,baseVersion:previous?.version,baseValue:previous?.value,baseRemoteVersion:note.version};
  }
  if(state.diagramManualVersion) {
    if(state.diagramManualZenUmlVersion&&state.diagramManualExcalidrawVersion||!state.diagramManualName)return undefined;
    const name=state.diagramManualName;let note=state.notes[name];
    if(hasGitHub&&remote&&known.has(name)&&!note?.pending) {
      try {
        const response=await githubRequest(`document?name=${encodeURIComponent(name)}&scope=${encodeURIComponent(key)}`),doc=await response.json();
        if(!response.ok)return undefined;
        note={...doc,name,cached:true,pending:false,modifiedAt:known.get(name).modifiedAt||new Date().toISOString()};
      }catch{return undefined;}
    }
    if(!note?.value||!owned(note.value))return undefined;
    return extend(note);
  }
  for(let suffix=1;suffix<1000;suffix++) {
    if(key!==libraryKey())throw new Error('O destino mudou. Reabra a biblioteca.');
    const name=`Scriba-Diagramas${suffix===1?'':`-${suffix}`}.md`;
    const local=state.notes[name];
    if(local&&owned(local.value))return extend(local);
    if(local||known.has(name)) {
      if(hasGitHub&&known.has(name)) {
        try {
          const response=await githubRequest(`document?name=${encodeURIComponent(name)}&scope=${encodeURIComponent(key)}`),doc=await response.json();
          if(response.ok&&owned(doc.value))return extend({...doc,name,cached:true,pending:false,modifiedAt:known.get(name).modifiedAt||new Date().toISOString()} as Note);
        }catch{/* An unknown remote file is never replaced by a bundled example. */}
      }
      continue;
    }
    const note:Note={name,value:diagramManual,version:hasGitHub?null:crypto.randomUUID(),cached:true,pending:hasGitHub,modifiedAt:new Date().toISOString(),files:[]};
    if(hasGitHub) {
      try {
        const response=await githubRequest('save',{...note,scope:key,message:'Add Scriba diagram reference v1.2.0'}),result=await response.json();
        if(response.ok){note.version=result.version;note.pending=false;}
        else if(response.status===409&&result.conflict){known.set(name,{});suffix--;continue;}
      }catch{/* The complete source remains available privately offline for a later save. */}
    }
    return {note,created:true,extensionDone:true};
  }
  throw new Error('Não foi possível escolher um nome livre para o manual de diagramas.');
}
/** Transactions serialize cross-tab edits and reject stale document revisions. */
export async function browserFetch(route:string, body?:any):Promise<Response> {
  try {
    const database=await db();
    const url=new URL(route,'https://browser.invalid/');
    const selection=githubSelection();const key=libraryKey();
    const folder=!selection ? await folderLabel() : '';
    if(url.searchParams.has('scope') && url.searchParams.get('scope')!==key || url.searchParams.has('folder') && !selection && url.searchParams.get('folder')!==folder)return Response.json({error:'O destino mudou. Reabra a nota.'},{status:409});
    let disk:any=null;
    if(folder && (url.pathname==='/document-version'||url.pathname==='/document'&&url.searchParams.get('fresh')==='1')) {
      try {disk=await (url.pathname==='/document-version' ? deviceDocumentVersion(url.searchParams.get('name')||'') : readDeviceDocument(url.searchParams.get('name')||''));}
      catch(error){return Response.json({error:error instanceof Error?error.message:'Não foi possível ler a pasta.'},{status:400});}
      if(folder!==await folderLabel()||key!==libraryKey())return Response.json({error:'O destino mudou. Reabra a nota.'},{status:409});
    }
    const savedVersion=folder&&url.pathname==='/save-sync' ? await textVersion(body.value) : null;
    let remote:any=null, syncError='', syncResponse:Response|undefined;
    if(selection && ['library/initialize','library','recent','document','document-version','save-sync'].includes(url.pathname.slice(1))){
      try {
        const remoteRoute=url.pathname==='/save-sync'?'save':['/document','/document-version'].includes(url.pathname)?`${url.pathname.slice(1)}${url.search}`:'library';
        syncResponse=await githubRequest(remoteRoute,url.pathname==='/save-sync'?{...body,scope:key}:undefined);
        remote=await syncResponse.json();
        if(!syncResponse.ok){if(url.pathname==='/save-sync'&&syncResponse.status===409)return Response.json(remote,{status:409});syncError=remote.error||'Conexão GitHub indisponível.';remote=null;}
      }catch{syncError='Sem conexão com o GitHub. Alterações preservadas neste navegador.';}
    }
    if(selection && (url.pathname==='/document-version'||url.pathname==='/document'&&url.searchParams.get('fresh')==='1') && !remote)return Response.json({error:syncError||'Não foi possível ler o GitHub.'},{status:syncResponse?.status||503});
    if(selection && key!==libraryKey())return Response.json({error:'O destino mudou. Reabra a nota.'},{status:409});
    if(url.pathname==='/document-version'&&(remote||disk))return Response.json(remote||disk);
    const imported = url.pathname === '/folder/import' ? await readDeviceNotes() : [];
    let guide:Note|undefined;
    if(url.pathname==='/library/initialize'&&!selection) {
      const image=await fetch(welcomeUrl); const bytes=new Uint8Array(await image.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      guide={name:'Boas-vindas.md',version:crypto.randomUUID(),modifiedAt:new Date().toISOString(),value:'# Bem-vindo ao Scriba\n\n![Escriba egípcio](assets/boas-vindas.jpg)\n\nEscreva, organize e guarde suas notas Markdown neste navegador.\n\n## Comece aqui\n\nCrie uma nota, escreva e pressione Salvar ou ⌘S. Busque e fixe notas na lateral. Importe Markdown e ZIP e exporte suas notas com imagens.\n\n## Privacidade e armazenamento\n\nSuas notas ficam somente neste navegador e dispositivo. Não são enviadas ao nosso servidor. Limpar os dados do site remove as notas; exporte pacotes ZIP para backup. Não há sincronização automática entre dispositivos.\n\nRascunhos são preservados durante a edição. O salvamento automático da biblioteca vem ativado a cada 1 minuto e pode ser ajustado nas configurações.\n\n## Manual de diagramas\n\nAbra a nota fixada Scriba — Manual contextual de diagramas para explorar exemplos editáveis de processos, dados, arquitetura, planejamento e análise. Compare os motores no seletor de cada desenho.\n\n## Git e roadmap\n\nA versão local para Mac já permite selecionar um repositório e salvar com commit e push. Na versão pública, conecte GitHub nas configurações para selecionar um repositório e sincronizar notas também no celular. Google Drive e novos temas seguem no roadmap, ainda sem data.\n\n[Baixar versão local](https://github.com/ab-orbit/ab-markdow-editor)\n\nPowered by **Aeon Bridge Co.** — offered to community.',files:[{path:'assets/boas-vindas.jpg',data:btoa(binary),mime:'image/jpeg'}]};
    }
    if(guide && isIosApp)guide.value = '# Bem-vindo ao Scriba\n\n![Escriba egípcio](assets/boas-vindas.jpg)\n\nEscreva, organize e guarde suas notas Markdown neste aplicativo, mesmo sem internet.\n\n## Comece aqui\n\nCrie uma nota, escreva e toque em Salvar. Você pode editar diretamente no texto formatado ou abrir o código Markdown. Busque e fixe notas na lateral e use o outline para navegar pelos títulos.\n\n## Escolha onde guardar\n\nSuas notas começam no armazenamento privado do aplicativo. Nas configurações, use **Selecionar pasta em Files** para escolher uma pasta: o Scriba lê os Markdown existentes e cria uma subpasta scriba para as novas cópias. Os arquivos originais da pasta principal são preservados. Uma alteração externa bloqueia a sobrescrita; recarregue a nota ou salve uma cópia.\n\nVocê também pode conectar seu GitHub e escolher um repositório para compartilhar notas entre dispositivos. A sincronização exige conexão e acontece enquanto o aplicativo está aberto. Google Drive segue previsto, sem data.\n\n## Desenhe e compartilhe\n\nA nota fixada **Scriba — Manual contextual de diagramas** apresenta exemplos editáveis de Mermaid, ZenUML e Excalidraw. Os motores e as fontes já estão incluídos no aplicativo. Exporte Markdown, ZIP, SVG, PNG ou um desenho editável pelo menu de compartilhamento do sistema.\n\n## Cuide das suas notas\n\nDesinstalar o Scriba remove as cópias privadas e os rascunhos do aplicativo. Arquivos exportados para Files ou sincronizados com GitHub continuam no destino escolhido. Faça backups em ZIP. Repositórios públicos tornam públicos os arquivos enviados.\n\n[Privacidade](https://scriba.aeonbridge.app/privacy.html) · [Suporte](https://scriba.aeonbridge.app/support.html)\n\nPowered by **Aeon Bridge Co.** — offered to community.';
    const reference=url.pathname==='/library/initialize' ? await prepareDiagramManual(database,key,remote,!!selection) : undefined;
    if(key!==libraryKey())return Response.json({error:'O destino mudou. Reabra a biblioteca.'},{status:409});
    let referenceApplied=false;
    const response = await new Promise<Response>((resolve,reject)=>{
      const readOnly=url.pathname==='/document-version';
      const tx=database.transaction('library',readOnly?'readonly':'readwrite'),store=tx.objectStore('library'),request=store.get(key);let result:unknown;let status=200;
      request.onsuccess=()=>{
        const state:State=request.result||initial();
        state.preferences={...initial().preferences,...state.preferences};
        if(selection && remote?.notes){for(const item of remote.notes){const old=state.notes[item.name];state.notes[item.name]={...item,value:old?.value||'',files:old?.files||[],version:old?.cached?old.version:item.version,cached:old?.cached||false,pending:old?.pending||false};}}
        const name=body?.name||url.searchParams.get('name')||'';
        switch(url.pathname) {
          case '/folder/import':for(const note of imported){const existing=state.notes[note.name];if(!existing)state.notes[note.name]={...note,version:crypto.randomUUID()};}result=library(state);break;
          case '/repository':result={repository:selection?`GitHub: ${selection.fullName}/${selection.folder}`:'Notas neste navegador',branch:selection?.branch||'',status:''};break;
          case '/preferences':if(body)state.preferences={doubleClickToEdit:typeof body.doubleClickToEdit==='boolean'?body.doubleClickToEdit:state.preferences.doubleClickToEdit,askCommitNote:!!selection&&!!body.askCommitNote,autoSave:!!body.autoSave,intervalMinutes:Math.max(1,Math.min(1440,Number(body.intervalMinutes)||1))};result=state.preferences;break;
          case '/files':result=Object.keys(state.notes).sort();break;
          case '/library/initialize': {
            if(guide&&!state.notes[guide.name]){state.notes[guide.name]=guide;state.pins.unshift(guide.name);}
            if(reference&&state.diagramManualVersion&&(!state.diagramManualZenUmlVersion||!state.diagramManualExcalidrawVersion)) {
              const existing=state.notes[reference.note.name];
              // Recheck the snapshot after network I/O: another tab may have edited meanwhile.
              if(!reference.updated||(existing?.version===reference.baseVersion&&existing?.value===reference.baseValue||reference.baseVersion===undefined&&!existing?.cached&&!existing?.value&&existing?.version===reference.baseRemoteVersion)) {
                if(reference.updated){state.notes[reference.note.name]=reference.note;referenceApplied=true;}
                if(reference.extensionDone){state.diagramManualZenUmlVersion=1;state.diagramManualExcalidrawVersion=1;}
              }
            }
            if(reference&&!state.diagramManualVersion) {
              const existing=state.notes[reference.note.name];
              // Recheck after async preparation: another tab may have saved or seeded meanwhile.
              if((!existing||(!existing.cached&&!existing.value&&existing.version===reference.note.version)||existing.value.includes('<!-- scriba-reference:diagram-manual version='))&&(!reference.updated||(existing?.version===reference.baseVersion&&existing?.value===reference.baseValue||reference.baseVersion===undefined&&!existing?.cached&&!existing?.value&&existing?.version===reference.baseRemoteVersion))) {
                state.notes[reference.note.name]=existing?.cached&&!reference.updated?existing:reference.note;
                referenceApplied=state.notes[reference.note.name]===reference.note&&(reference.created||!!reference.updated);
                const guideIndex=guide?state.pins.indexOf(guide.name):-1;
                if(!state.pins.includes(reference.note.name))state.pins.splice(guideIndex<0?0:guideIndex+1,0,reference.note.name);
                state.diagramManualVersion=1;state.diagramManualName=reference.note.name;
                if(reference.extensionDone){state.diagramManualZenUmlVersion=1;state.diagramManualExcalidrawVersion=1;}
              }
            }
            const pending=!!reference?.note.pending;
            result={...library(state),synchronization:pending||selection&&syncError?{synced:false,error:syncError||'Manual disponível neste navegador; salve-o para enviar ao GitHub.'}:undefined};break;
          }
          case '/library':case '/recent':result=library(state);break;
          case '/pin':state.pins=state.pins.filter(item=>item!==name);if(body.pinned&&state.notes[name])state.pins.push(name);result=library(state);break;
          case '/document-version':result=selection?remote:disk||{version:state.notes[name]?.version??null};break;
          case '/document':if(disk)state.notes[name]={...disk,cached:true};if(selection&&remote&&(!state.notes[name]?.pending||url.searchParams.get('fresh')==='1'))state.notes[name]={...remote,name,modifiedAt:state.notes[name]?.modifiedAt||new Date().toISOString(),cached:true};if(selection&&!remote&&!state.notes[name]?.cached){status=400;result={error:syncError||'Abra esta nota online antes de usá-la offline.'};break;}result=state.notes[name]?{...state.notes[name],pendingSync:!!state.notes[name]?.pending,warnings:state.notes[name]?.pending?['Alterações locais aguardam envio ao GitHub.']:[]}:{error:'Nota não encontrada.'};if(!state.notes[name])status=404;break;
          case '/thumbnail':result=state.notes[name]?.files[0]||null;break;
          case '/save-sync': {
            if(!name.trim()||!/\.(md|markdown|mdown)$/i.test(name)){status=400;result={error:'Informe um nome de arquivo Markdown (.md, .markdown ou .mdown).'};break;}
            const previous=state.notes[name];
            if(!selection&&previous&&previous.version!==body.version&&body.baseVersion!==previous.version){status=409;result={error:'Esta nota mudou em outra aba. Salve uma cópia ou reabra a nota.',conflict:{name,kind:body.version?'modified':'exists',currentVersion:previous.version}};break;}
            const version=selection?(remote?.version??body.version??null):savedVersion||crypto.randomUUID();state.notes[name]={name,value:body.value,version,cached:true,pending:!!selection&&!remote,modifiedAt:new Date().toISOString(),files:(body.files||[]).map((file:any)=>({...file,mime:/\.png$/i.test(file.path)?'image/png':/\.webp$/i.test(file.path)?'image/webp':/\.gif$/i.test(file.path)?'image/gif':'image/jpeg'}))};result={version,synced:!selection||!!remote,error:syncError||undefined};break;
          }
          default:status=400;result={error:'Esta função requer a versão local do Scriba.'};
        }
        if(!readOnly)store.put(state,key);
      };
      tx.oncomplete=()=>resolve(Response.json(result,{status}));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    if(!selection&&folder&&reference&&referenceApplied&&response.ok) {
      try{await saveToDeviceFolder(reference.note);}
      catch(error){const result=await response.json();return Response.json({...result,synchronization:{synced:false,error:error instanceof Error?error.message:String(error)}});}
    }
    if(!selection&&url.pathname==='/save-sync'&&response.ok){const result=await response.json();try{await saveToDeviceFolder(body);}catch(error){return Response.json({...result,synced:false,error:error instanceof Error?error.message:String(error)});}return Response.json(result);}
    return response;
  } catch {return Response.json({error:'Não foi possível acessar o armazenamento deste navegador. Exporte suas notas para preservar uma cópia.'},{status:500});}
}
