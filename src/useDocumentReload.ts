import {useEffect, useRef, useState} from 'react';

interface Options<T extends {version: string | null}> {
  /** Identity changes invalidate replies for a previous document, checkout or revision. */
  identity: string;
  /** Only previously saved/opened files have a source that can be reloaded. */
  enabled: boolean;
  /** Pause while another operation, modal or settings page owns the document. */
  blocked: boolean;
  /** Read modal/editor locks at request and response time, including nested canvas drafts. */
  isBlocked?: () => boolean;
  /** Edited text, attachments and pending offline writes must never be replaced automatically. */
  dirty: boolean;
  pending: boolean;
  /** Version of the currently accepted source. */
  version: string | null;
  /** Local checks are frequent; remote checks use a longer interval. */
  interval: number;
  probe: () => Promise<{version: string | null}>;
  load: () => Promise<T>;
  apply: (document: T, automatic: boolean) => void;
}
export interface SourceChange {
  /** Deleted sources remain visible in memory rather than becoming empty documents. */
  kind: 'modified' | 'deleted' | 'error';
  /** Most recent source revision, without changing the editor's accepted revision. */
  version: string | null;
  /** Explicit reload failures are shown inline; transient background checks remain quiet. */
  message?: string;
}
/** Probe read-only metadata and reject late replies or edits made while a load is in flight. */
export function useDocumentReload<T extends {version: string | null}>(options: Options<T>) {
  const latest=useRef(options);latest.current=options;
  const sequence=useRef(0), probing=useRef<object|null>(null), loading=useRef<number|null>(null);
  const [change,setChange]=useState<SourceChange|null>(null);
  const [confirmation,setConfirmation]=useState(false);
  const [reloading,setReloading]=useState(false);
  const [manualLock,setManualLock]=useState(false);
  useEffect(()=>{sequence.current++;probing.current=null;loading.current=null;setChange(null);setConfirmation(false);setReloading(false);setManualLock(false);},[options.identity]);
  useEffect(()=>()=>{sequence.current++;probing.current=null;loading.current=null;},[]);
  async function load(automatic: boolean, discard=false) {
    const snapshot=latest.current;
    if(!snapshot.enabled||snapshot.blocked||snapshot.isBlocked?.()||loading.current)return;
    if(!automatic&&!discard&&(snapshot.dirty||snapshot.pending)){setConfirmation(true);return;}
    const ticket=++sequence.current;
    loading.current=ticket;setReloading(true);setManualLock(!automatic);setConfirmation(false);
    try {
      const document=await snapshot.load();const current=latest.current;
      if(ticket!==sequence.current||current.identity!==snapshot.identity||!current.enabled||current.blocked||current.isBlocked?.())return;
      if(automatic&&(current.dirty||current.pending)){setChange({kind:'modified',version:document.version});return;}
      setChange(null);current.apply(document,automatic);
    }catch(error){if(ticket===sequence.current&&latest.current.identity===snapshot.identity)setChange({kind:'error',version:null,message:error instanceof Error?error.message:'Não foi possível recarregar. Seu texto continua no editor.'});}
    finally{if(loading.current===ticket){loading.current=null;setReloading(false);setManualLock(false);}}
  }
  const reload=useRef(load);reload.current=load;
  useEffect(()=>{
    let active=true;
    const check=async()=>{
      const snapshot=latest.current;
      if(!active||!snapshot.enabled||snapshot.blocked||snapshot.isBlocked?.()||document.visibilityState==='hidden'||probing.current||loading.current)return;
      const ticket=sequence.current,probeTicket={};probing.current=probeTicket;
      try {
        const revision=await snapshot.probe(),current=latest.current;
        if(!active||ticket!==sequence.current||current.identity!==snapshot.identity||current.blocked||current.isBlocked?.())return;
        if(revision.version===current.version){setChange(null);return;}
        setChange({kind:revision.version===null?'deleted':'modified',version:revision.version});
        if(revision.version!==null&&!current.dirty&&!current.pending)await reload.current(true);
      }catch{/* Offline checks never discard a draft or generate repeated error toasts. */}
      finally{if(probing.current===probeTicket)probing.current=null;}
    };
    const visible=()=>{if(document.visibilityState==='visible')void check();};
    const timer=window.setInterval(()=>void check(),options.interval);
    window.addEventListener('focus',check);document.addEventListener('visibilitychange',visible);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',visible);};
  },[options.interval,options.identity]);
  /** Check again before scheduled writes, which may race the remote polling interval. */
  async function allowAutoSave() {
    const snapshot=latest.current,ticket=sequence.current;
    if(!snapshot.enabled)return true;
    if(snapshot.blocked||snapshot.isBlocked?.()||loading.current)return false;
    try {
      const revision=await snapshot.probe(),current=latest.current;
      if(ticket!==sequence.current||current.identity!==snapshot.identity||current.blocked||current.isBlocked?.())return false;
      if(revision.version!==current.version){setChange({kind:revision.version===null?'deleted':'modified',version:revision.version});return false;}
      return true;
    }catch{
      // Offline writes may still be queued locally; the storage backend retains revision checks.
      return ticket===sequence.current&&latest.current.identity===snapshot.identity&&!latest.current.blocked&&!latest.current.isBlocked?.();
    }
  }
  return {allowAutoSave,change,confirmation,reloading,manualLock,request:()=>void load(false),confirm:()=>void load(false,true),cancel:()=>setConfirmation(false)};
}
