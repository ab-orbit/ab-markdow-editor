/** Private, origin-local canvas drafts and reusable shape libraries; nothing leaves this device. */
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('scriba-excalidraw', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('private');
    request.onsuccess = () => resolve(request.result); request.onerror = () => { database = undefined; reject(request.error); };
  });
}
export async function readCanvasState<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => { const tx = db.transaction('private', 'readonly'), read = tx.objectStore('private').get(key); tx.oncomplete = () => resolve(read.result); tx.onerror = () => reject(tx.error); });
}
export async function writeCanvasState(key: string, value?: unknown) {
  const db = await open();
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('private', 'readwrite'), store = tx.objectStore('private'); if (value === undefined) store.delete(key); else store.put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

/** Seed bundled symbols once; user edits, deletions and library clearing are never undone. */
export async function initialCanvasLibrary() {
  const db=await open(), marker='bundled-libraries-v1';
  const existing=await readCanvasState<import('@excalidraw/excalidraw/types').LibraryItems>('library');
  if(await readCanvasState<boolean>(marker))return existing;
  const [{loadLibraryFromBlob},catalog]=await Promise.all([import('@excalidraw/excalidraw'),fetch(`${import.meta.env.BASE_URL}excalidraw-libraries/catalog.json`).then(response=>{if(!response.ok)throw new Error('Unable to load bundled drawing libraries.');return response.json() as Promise<{id:string;file:string}[]>;})]);
  // Parse one collection at a time so large symbol packs yield between SDK restores.
  let defaults:import('@excalidraw/excalidraw/types').LibraryItems=[];
  for(const collection of catalog) {
    const response=await fetch(`${import.meta.env.BASE_URL}excalidraw-libraries/${collection.file}`);
    if(!response.ok)throw new Error('Unable to load bundled drawing libraries.');
    const items=await loadLibraryFromBlob(await response.blob(),'published');
    defaults=[...defaults,...items.map((item,index)=>({...item,id:`scriba:${collection.id}:${index}`}))];
    await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return new Promise<import('@excalidraw/excalidraw/types').LibraryItems>((resolve,reject)=>{
    const tx=db.transaction('private','readwrite'),store=tx.objectStore('private'),read=store.get(marker);
    let result:import('@excalidraw/excalidraw/types').LibraryItems=[];
    read.onsuccess=()=>{
      const done=!!read.result,current=store.get('library');
      current.onsuccess=()=>{
        result=current.result || [];
        if(!done){const ids=new Set(result.map(item=>item.id));result=[...result,...defaults.filter(item=>!ids.has(item.id))];store.put(result,'library');store.put(true,marker);}
      };
    };
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
