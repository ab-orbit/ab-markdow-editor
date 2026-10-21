import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { isIosApp } from './lib/ios';
interface InstallEvent extends Event {
  /** Browser-owned installation UI, only invoked from an explicit click. */
  prompt: () => Promise<void>;
  /** User choice returned by the browser's installation dialog. */
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}
declare global { interface Window { /** Shared early registration, without forcing an update during editing. */ scribaPwaRegistration?: Promise<ServiceWorkerRegistration> } }
/** Register the shell without reloading the editor or forcing a waiting update. */
export function usePwa() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [installEvent,setInstallEvent]=useState<InstallEvent | null>(null);
  const [ready,setReady]=useState(false);
  const [updateAvailable,setUpdateAvailable]=useState(false);
  const [standalone,setStandalone]=useState(()=>window.matchMedia("(display-mode: standalone)").matches);
  useEffect(()=>{
    if(isIosApp){setReady(true);setStandalone(true);return;}
    let lastCheck=Date.now();
    const check=()=>{if(document.visibilityState==='hidden'||Date.now()-lastCheck<300000)return;lastCheck=Date.now();void registrationRef.current?.update().catch(()=>{});};
    const timer=window.setInterval(check,3600000);
    window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
    const beforeInstall=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallEvent);};
    const installed=()=>{setStandalone(true);setInstallEvent(null);};
    window.addEventListener('beforeinstallprompt',beforeInstall);window.addEventListener('appinstalled',installed);
    if('serviceWorker' in navigator)void (window.scribaPwaRegistration || navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})).then(registration=>{
      registrationRef.current=registration;
      if(registration.waiting)setUpdateAvailable(true);
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdateAvailable(true);});});
      return navigator.serviceWorker.ready;
    }).then(()=>setReady(true)).catch(()=>setReady(false));
    return()=>{clearInterval(timer);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);window.removeEventListener('beforeinstallprompt',beforeInstall);window.removeEventListener('appinstalled',installed);};
  },[]);
  async function install(){if(!installEvent)return;void navigator.storage?.persist?.().catch(()=>false);await installEvent.prompt();await installEvent.userChoice;setInstallEvent(null);}
  async function applyUpdate() {
    const waiting=registrationRef.current?.waiting;
    if(!waiting)throw new Error('No installed update is waiting');
    await new Promise<void>((resolve,reject)=>{
      const changed=()=>{clearTimeout(timer);resolve();location.reload();};
      const timer=window.setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(new Error('Update activation timed out'));},15000);
      navigator.serviceWorker.addEventListener('controllerchange',changed,{once:true});
      waiting.postMessage({type:'SCRIBA_APPLY_UPDATE'});
    });
  }
  return {ready,standalone,canInstall:!!installEvent,install,updateAvailable,applyUpdate};
}
