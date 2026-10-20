import type { MarkdownAsset } from './markdown/assets';

export interface DraftSnapshot {
  /** Per-tab stable draft id; new windows receive their own copy of the latest draft. */
  id: string;
  /** Explicit document closure restores an empty workspace instead of a discarded note. */
  documentClosed?: boolean;
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
  /** Keep a retained draft from automatically publishing to a different checkout. */
  autoSavePaused?: boolean;
  /** Private native Finder handle for reloading an external original without writing to it. */
  finderSourceId?: string | null;
  /** Explicit Save As binding; normal Finder imports retain their read-only original. */
  savedFileLocation?: string | null;
  /** Attachment changes require the same reload confirmation as unsaved text. */
  assetsDirty?: boolean;
  /** Durable image bytes; temporary object URLs are deliberately omitted. */
  assets: Pick<MarkdownAsset, 'path' | 'file'>[];
  /** Offline copy of the non-secret save preferences. */
  preferences: {askCommitNote: boolean; autoSave: boolean; intervalMinutes: number;
    /** Missing in older snapshots; the host supplies the enabled default. */
    doubleClickToEdit?: boolean;
  };
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
interface StoredAsset {
  /** Repository-relative image path. */
  path: string;
  /** Original filename and MIME type restore a browser File on load. */
  name: string;
  type: string;
  /** Original file time retained when reconstructing the image. */
  lastModified: number;
  /** Binary bytes avoid Safari IndexedDB Blob/File persistence failures. */
  bytes: ArrayBuffer;
}
type StoredDraft = Omit<DraftSnapshot, 'assets'> & {assets: (StoredAsset | Pick<MarkdownAsset, 'path' | 'file'>)[]};
const imageBytes = new WeakMap<File, Promise<ArrayBuffer>>();
let writeQueue: Promise<void> = Promise.resolve();
export async function loadDraft(id: string): Promise<DraftSnapshot | null> {
  const db=await database();
  const stored = await new Promise<StoredDraft | null>((resolve,reject)=>{
    const transaction=db.transaction('drafts','readonly');const store=transaction.objectStore('drafts');const request=store.get(id);
    request.onsuccess=()=>{if(request.result){resolve(request.result);return;}const latest=store.index('updatedAt').openCursor(null,'prev');latest.onsuccess=()=>resolve(latest.result?.value ?? null);latest.onerror=()=>reject(latest.error);};
    request.onerror=()=>reject(request.error);
  });
  if (!stored) return null;
  // Existing drafts that stored native File objects remain readable after this upgrade.
  return {...stored, assets:stored.assets.map(asset => 'bytes' in asset ? {path:asset.path,file:new File([asset.bytes],asset.name,{type:asset.type,lastModified:asset.lastModified})} : asset)};
}
export function persistDraft(draft: DraftSnapshot): Promise<void> {
  const write = async () => {
    const assets: StoredAsset[] = await Promise.all(draft.assets.map(async ({path,file}) => {
      let bytes=imageBytes.get(file);if(!bytes){bytes=file.arrayBuffer();imageBytes.set(file,bytes);}
      return {path,name:file.name,type:file.type,lastModified:file.lastModified,bytes:await bytes};
    }));
    const db=await database();
    await new Promise<void>((resolve,reject)=>{
      const transaction=db.transaction('drafts','readwrite');
      transaction.objectStore('drafts').put({...draft,assets});
      transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
    });
  };
  // Encoding image bytes is asynchronous; serialize writes so older text cannot replace a newer draft.
  const pending=writeQueue.then(write);writeQueue=pending.catch(()=>{});return pending;
}
