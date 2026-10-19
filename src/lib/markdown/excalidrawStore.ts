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
