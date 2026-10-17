import { useEffect, useState } from 'react';
interface InstallEvent extends Event {
  /** Browser-owned installation UI, only invoked from an explicit click. */
  prompt: () => Promise<void>;
  /** User choice returned by the browser's installation dialog. */
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}
/** Register the shell without reloading the editor or forcing a waiting update. */
export function usePwa() {
  const [installEvent,setInstallEvent]=useState<InstallEvent | null>(null);
  const [ready,setReady]=useState(false);
  const [updateAvailable,setUpdateAvailable]=useState(false);
  const [standalone,setStandalone]=useState(()=>window.matchMedia('(display-mode: standalone)').matches);
  useEffect(()=>{
    const beforeInstall=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallEvent);};
    const installed=()=>{setStandalone(true);setInstallEvent(null);};
    window.addEventListener('beforeinstallprompt',beforeInstall);window.addEventListener('appinstalled',installed);
    if('serviceWorker' in navigator)void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>{
      if(registration.waiting)setUpdateAvailable(true);
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdateAvailable(true);});});
      return navigator.serviceWorker.ready;
    }).then(()=>setReady(true)).catch(()=>setReady(false));
    return()=>{window.removeEventListener('beforeinstallprompt',beforeInstall);window.removeEventListener('appinstalled',installed);};
  },[]);
  async function install(){if(!installEvent)return;void navigator.storage?.persist?.().catch(()=>false);await installEvent.prompt();await installEvent.userChoice;setInstallEvent(null);}
  return {ready,standalone,canInstall:!!installEvent,install,updateAvailable};
}
