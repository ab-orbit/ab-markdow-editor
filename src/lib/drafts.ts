import type { MarkdownAsset } from './markdown/assets';

export interface DraftSnapshot {
  /** Per-tab stable draft id; new windows receive their own copy of the latest draft. */
  id: string;
  /** Checkout identity retained for offline editing and safe reconnection. */
  repository: {repository: string | null; branch: string; status: string};
  /** Current document-relative filename. */
  name: string;
  /** Last destination associated with the on-disk version. */
  loadedName: string;
  /** Exact current source, including unsaved edits. */
  value: string;
  /** Source last successfully saved on disk. */
  baseline: string;
  /** Original disk hash, used again after reconnecting. */
  version: string | null;
  /** Original browser-import hash, when the file has not been saved yet. */
  importedVersion: {name: string; version: string} | null;
  /** Whether commit/push still needs to be completed. */
  pendingSync: boolean;
  /** Durable image bytes; temporary object URLs are deliberately omitted. */
  assets: Pick<MarkdownAsset, 'path' | 'file'>[];
  /** Offline copy of the non-secret save preferences. */
  preferences: {askCommitNote: boolean; autoSave: boolean; intervalMinutes: number};
  /** Last edit time for restoration into a new window. */
  updatedAt: number;
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return connection ??= new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('ab-markdown-drafts',1);
    request.onupgradeneeded=()=>{const store=request.result.createObjectStore('drafts',{keyPath:'id'});store.createIndex('updatedAt','updatedAt');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function loadDraft(id: string): Promise<DraftSnapshot | null> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('drafts','readonly');const store=transaction.objectStore('drafts');const request=store.get(id);
    request.onsuccess=()=>{if(request.result){resolve(request.result);return;}const latest=store.index('updatedAt').openCursor(null,'prev');latest.onsuccess=()=>resolve(latest.result?.value ?? null);latest.onerror=()=>reject(latest.error);};
    request.onerror=()=>reject(request.error);
  });
}
export async function persistDraft(draft: DraftSnapshot): Promise<void> {
  const db=await database();
  return new Promise((resolve,reject)=>{const transaction=db.transaction('drafts','readwrite');transaction.objectStore('drafts').put(draft);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
}
