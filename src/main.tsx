import {RepositorySwitch, type RepositorySwitchResult} from './RepositorySwitch';
import {GitHubSettings} from './GitHubSettings';
import {githubSelection,setGitHubSelection,libraryKey} from './lib/github';
import {canChooseFolder, chooseDeviceFolder, folderLabel, disconnectFolder, authorizeDeviceFolder, saveToDeviceFolder} from './lib/deviceFolder';
import {browserMode} from './lib/browserStore';
import {isIosApp, iosBridge} from './lib/ios';
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FolderGit2, FolderOpen, Save, Upload, Sun, Moon, FilePlus2, Settings, X, Download, CloudOff, PanelLeft, FileText, RefreshCw, Search, Pin, PinOff, ArrowLeft, CircleCheck, CircleAlert, ArrowRightLeft, Unplug, RotateCw } from 'lucide-react';
import { MarkdownWorkbench, type MarkdownMode, type MarkdownWorkbenchHandle } from './components/Markdown/MarkdownWorkbench';
import { NoteThumbnail } from './NoteThumbnail';
import { noteGroup, shortNoteDate } from './lib/noteDates';
import { useDocumentReload } from './useDocumentReload';
import { usePwa } from './usePwa';
import { authorizedFetch } from './lib/session';
import { loadDraft, persistDraft, type DraftSnapshot } from './lib/drafts';
import { EditorDialog } from './components/Markdown/EditorDialog';
import type { MarkdownAsset } from './lib/markdown/assets';
import './tokens.css';
import './style.css';

declare global { interface Window { /** Per-process local API capability injected by the server. */ __MARKDOWN_TOKEN__: string } }
interface RecentNote {
  /** Safe repository-relative path used when opening a note. */
  name: string;
  /** File modification time in ISO format, newest first. */
  modifiedAt: string;
  /** Markdown heading and short plain-text preview for the note list. */
  title?: string;
  preview?: string;
  /** Whether the note contains a local image eligible for a lazy thumbnail. */
  hasImage?: boolean;
}
interface NoteLibrary {
  /** Manually ordered pinned notes for the current checkout. */
  pinned: RecentNote[];
  /** Latest 100 non-pinned notes, newest first. */
  recent: RecentNote[];
  /** Initial guide synchronization may require a Git retry. */
  synchronization?: SaveResult;
}
const brandIcon = '/icons/profile-v3/scribe-64.png';
interface RepositoryInfo {
  /** Absolute checkout root on this Mac, or null before configuration. */
  repository: string | null;
  /** Active branch; empty for a detached HEAD. */
  branch: string;
  /** Human-readable Git short status. */
  status: string;
  /** Public GitHub URL derived from the checkout origin, without credentials. */
  githubUrl?: string;
  /** Last local checkout remains available after disconnecting, without automatic writes. */
  previousRepository?: string | null;
}
type DocumentAction = 'close' | 'new';
interface SavePreferences {
  /** Ask for a commit note before each manual or scheduled save. */
  askCommitNote: boolean;
  /** Enable scheduled save/commit/push while the editor is open. */
  autoSave: boolean;
  /** Reveal the clicked source block without switching the whole document to raw mode. */
  doubleClickToEdit: boolean;
  /** Schedule interval in whole minutes, between 1 and 1440. */
  intervalMinutes: number;
}
interface SaveResult {
  /** Hash of the content successfully written to disk, even if Git failed. */
  version: string | null;
  /** Whether the saved document has been committed and pushed. */
  synced: boolean;
  /** Git operation that remains pending after a partial failure. */
  stage?: 'commit' | 'push';
  /** Readable Git failure returned with a successful local save. */
  error?: string;
}
const defaultPreferences: SavePreferences = { askCommitNote: false, autoSave: false, intervalMinutes: 1, doubleClickToEdit: true };
interface DocumentFile {
  /** Document-relative image path. */
  path: string;
  /** Base64 encoded raster bytes. */
  data: string;
  /** Validated raster MIME type. */
  mime: string;
}
interface LoadedDocument {
  /** Cached GitHub changes remain pending until a successful remote save. */
  pendingSync?: boolean;
  /** Canonical UTF-8 Markdown source. */
  value: string;
  /** Content hash used for optimistic concurrency. */
  version: string | null;
  /** Attached local images. */
  files: DocumentFile[];
  /** References that could not be loaded. */
  warnings: string[];
}
interface DocumentConflict {
  /** Relative destination that failed optimistic concurrency validation. */
  name: string;
  /** Distinguishes a pre-existing file, a newer revision or an external deletion. */
  kind: 'exists' | 'modified' | 'deleted';
  /** Observed disk revision; a resolution must still match it when writing. */
  currentVersion: string | null;
}
class LocalApiError extends Error {
  /** Structured conflict details returned by the local server, when present. */
  conflict?: DocumentConflict;
  constructor(message: string, conflict?: DocumentConflict) { super(message); this.conflict = conflict; }
}
async function api<T>(route: string, body?: unknown): Promise<T> {
  const response = await authorizedFetch(route, body);
  const result = await response.json();
  if (!response.ok) throw new LocalApiError(result.error || 'Não foi possível concluir a operação.', result.conflict);
  return result;
}
async function encodeAsset(asset: MarkdownAsset) {
  const bytes = new Uint8Array(await asset.file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { path: asset.path, data: btoa(binary) };
}
/** Translate Git porcelain codes into local file states, without implying a successful push. */
function describeRepositoryChanges(status: string): string {
  return status.split('\n').filter(Boolean).map(line => {
    // The local Git helper trims the first line, so accept one or two status columns.
    const match = line.match(/^([ MADRCU?!T]{1,2}) (.+)$/);
    if (!match) return 'Há alterações locais no repositório.';
    const [, code, file] = match;
    const label = code === '??' ? 'Ainda não versionado'
      : code === '!!' ? 'Ignorado pelo Git'
      : code.includes('U') || code === 'AA' || code === 'DD' ? 'Conflito a resolver'
      : code.includes('D') ? 'Exclusão local pendente'
      : code.includes('R') ? 'Renomeação local pendente'
      : code.includes('C') ? 'Cópia local pendente'
      : code.includes('A') ? 'Adicionado; commit pendente'
      : 'Alteração local pendente';
    return `${label}: ${file}`;
  }).join('\n');
}
function assetIdentity(items: {path:string;file:File}[]) {return JSON.stringify(items.map(({path,file})=>[path,file.name,file.size,file.type,file.lastModified]));}
function App() {
  const pwa = usePwa();
  useEffect(() => {
    if(!isIosApp)return;
    const externalLink = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.('a[href]');
      if(!link)return;
      const url = new URL(link.getAttribute('href')!, location.href);
      if(url.protocol !== 'https:')return;
      event.preventDefault();
      void iosBridge.openExternal({url:url.href}).catch(error=>window.alert(error.message));
    };
    document.addEventListener('click',externalLink);
    return()=>document.removeEventListener('click',externalLink);
  },[]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [deviceFolder, setDeviceFolder] = useState('');
  useEffect(() => {if(browserMode)void folderLabel().then(setDeviceFolder);}, []);
  async function importDeviceNotes() {await api('folder/import',{});await refresh();return (await api<string[]>('files')).length;}
  async function syncDeviceNotes() {for(const file of await api<string[]>('files')){const note=await api<LoadedDocument>(`document?name=${encodeURIComponent(file)}`);await saveToDeviceFolder({name:file,...note});}}
  useEffect(() => {
    // iOS visual viewport shrinks for the keyboard even when layout viewport/dvh does not.
    const viewport = window.visualViewport;
    const resize = () => {
      if (!viewport || viewport.scale !== 1) return;
      document.documentElement.style.setProperty('--workspace-height', `${viewport.height}px`);
    };
    resize(); viewport?.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); document.documentElement.style.removeProperty('--workspace-height'); };
  }, []);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [draftReady, setDraftReady] = useState(false);
  const [draftId] = useState(() => {
    // The native app has one window; its draft identity must survive process termination.
    const storage = isIosApp ? localStorage : sessionStorage;
    const id = storage.getItem('ab-markdown-draft-id') || crypto.randomUUID();
    storage.setItem('ab-markdown-draft-id', id); return id;
  });
  const latestDraft = useRef<DraftSnapshot | null>(null);
  const restoringAssets = useRef(false);
  const handleAssets = useCallback((items: MarkdownAsset[]) => {
    if (restoringAssets.current && !items.length) return;
    restoringAssets.current = false; setAssets(items);
  }, []);
  const [settingsOpen, setSettingsOpenState] = useState(() => location.hash === '#settings' || new URLSearchParams(location.search).has('github'));
  const settingsTitle = useRef<HTMLHeadingElement>(null);
  const settingsWasOpen = useRef(false);
  function setSettingsOpen(open: boolean) {
    if(open && location.hash !== '#settings') history.pushState({scribaSettings:true}, '', `${location.pathname}${location.search}#settings`);
    if(!open && location.hash === '#settings') history.replaceState(null, '', `${location.pathname}${location.search}`);
    setSettingsOpenState(open);
  }
  function backToEditor() {
    if(history.state?.scribaSettings) history.back(); else setSettingsOpen(false);
  }
  useEffect(() => {const url=new URL(location.href);if(url.searchParams.has('github')){url.searchParams.delete('github');url.hash='settings';history.replaceState(null,'',url.pathname+url.search+url.hash);}}, []);
  useEffect(() => {const navigate=()=>setSettingsOpenState(location.hash === '#settings');window.addEventListener('popstate',navigate);window.addEventListener('hashchange',navigate);return()=>{window.removeEventListener('popstate',navigate);window.removeEventListener('hashchange',navigate);};}, []);
  useEffect(() => {if(settingsOpen)settingsTitle.current?.focus();else if(settingsWasOpen.current)document.querySelector<HTMLButtonElement>('button[aria-label="Configurações"]')?.focus();settingsWasOpen.current=settingsOpen;},[settingsOpen]);
  useEffect(() => {const showNotes=()=>setNotesOpen(true);window.addEventListener('scriba:show-notes',showNotes);return()=>window.removeEventListener('scriba:show-notes',showNotes);}, []);
  const [repository, setRepository] = useState<RepositoryInfo>({ repository: null, branch: '', status: '' });
  const [repositoryConnected, setRepositoryConnected] = useState(false);
  const [switchRepositoryOpen, setSwitchRepositoryOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<RecentNote[]>([]);
  const [dateClock, setDateClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setDateClock(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const [noteSearch, setNoteSearch] = useState('');
  const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const query = normalizeSearch(noteSearch.trim());
  const matchesNote = (note: RecentNote) => !query || normalizeSearch(`${note.name} ${note.title || ''} ${note.preview || ''}`).includes(query);
  const visibleNotes = recentNotes.filter(matchesNote);
  const visiblePinned = pinnedNotes.filter(matchesNote);
  const noteGroups = [{label:'Fixadas', notes:visiblePinned, pinned:true}, ...['Hoje', 'Ontem', 'Últimos 7 dias', 'Mais antigas'].map(label => ({label, notes:visibleNotes.filter(note => noteGroup(note.modifiedAt, dateClock) === label), pinned:false}))].filter(group => group.notes.length);
  const [notesOpen, setNotesOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const [selected, setSelected] = useState('');
  const workbenchRef = useRef<MarkdownWorkbenchHandle>(null);
  const [documentClosed, setDocumentClosed] = useState(false);
  const [documentConfirmation, setDocumentConfirmation] = useState<DocumentAction | null>(null);
  const [afterCommitAction, setAfterCommitAction] = useState<DocumentAction | null>(null);
  const closingDocument = useRef(false);
  const preparingNewNote = useRef(false), focusNewNote = useRef(false);
  const emptyTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (documentClosed) emptyTitle.current?.focus(); }, [documentClosed]);
  const [name, setName] = useState('documento.md');
  const [loadedName, setLoadedName] = useState('documento.md');
  const [value, setValue] = useState('# Meu documento\n\nComece a escrever.\n');
  const [baseline, setBaseline] = useState('# Meu documento\n\nComece a escrever.\n');
  const [importedVersion, setImportedVersion] = useState<{name: string; version: string} | null>(null);
  const [conflict, setConflict] = useState<DocumentConflict | null>(null);
  const [copyName, setCopyName] = useState('');
  const lastSaveNote = useRef('');
  const [version, setVersion] = useState<string | null>(null);
  const [assets, setAssets] = useState<MarkdownAsset[]>([]);
  const [baselineAssets, setBaselineAssets] = useState('[]');
  const [initialAssets, setInitialAssets] = useState<{path: string; file: File}[]>([]);
  const [documentId, setDocumentId] = useState(0);
  const [saveRevision, setSaveRevision] = useState(0);
  const reloadScrollTop = useRef(0);
  const [reloadMode, setReloadMode] = useState<MarkdownMode | null>(null);
  const currentMode = useRef<MarkdownMode>('live');
  const reportMode = useCallback((mode: MarkdownMode) => {currentMode.current=mode;}, []);
  const [finderSourceId, setFinderSourceId] = useState<string | null>(null);
  const [openedScope, setOpenedScope] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<SavePreferences>(defaultPreferences);
  const [preferenceDraft, setPreferenceDraft] = useState<SavePreferences>(defaultPreferences);
  const [commitNoteOpen, setCommitNoteOpen] = useState(false);
  const [commitTarget, setCommitTarget] = useState<'document' | 'repository'>('document');
  const [repositorySyncing, setRepositorySyncing] = useState(false);
  const [repositorySyncFeedback, setRepositorySyncFeedback] = useState<{message: string; state: 'syncing' | 'success' | 'error'} | null>(null);
  const [commitNote, setCommitNote] = useState('');
  const [pendingSync, setPendingSync] = useState(false);
  const [autoSavePaused, setAutoSavePaused] = useState(false);
  const operationLock = useRef(false);
  const autoSaveAction = useRef<() => void>(() => {});
  const autoSaveCommit = useRef<() => void>(() => {});
  const autoSaveChecking = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!focusNewNote.current || !draftReady || busy || documentClosed || settingsOpen) return;
    const frame = requestAnimationFrame(() => { workbenchRef.current?.focus(); focusNewNote.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [documentId, draftReady, busy, documentClosed, settingsOpen]);
  const [theme, setTheme] = useState(() => localStorage.getItem('ab-markdown-theme') || 'dark');
  const assetsDirty = assetIdentity(assets) !== baselineAssets;
  const dirty = value !== baseline || name !== loadedName || assetsDirty;
  useEffect(() => {
    document.documentElement.dataset.theme = theme; localStorage.setItem('ab-markdown-theme', theme);
    if(isIosApp){const channels=getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number)||[0,0,0];void iosBridge.appearance({dark:theme==='dark',red:channels[0],green:channels[1],blue:channels[2]}).catch(()=>{});}
  }, [theme]);
  async function refreshLibrary() {
    const library = await api<NoteLibrary>('library/initialize', {});
    setRecentNotes(library.recent); setPinnedNotes(library.pinned);
    if(browserMode && githubSelection())setFiles(await api<string[]>('files'));
    if (library.synchronization && !library.synchronization.synced) setError(`Sincronização pendente: ${library.synchronization.error}`);
  }
  async function togglePin(note: RecentNote, pinned: boolean) {
    await run(async () => {
      const library = await api<NoteLibrary>('pin', {name:note.name, pinned});
      setRecentNotes(library.recent); setPinnedNotes(library.pinned);
    });
  }
  async function refresh() {
    if(browserMode && !githubSelection() && await folderLabel()) await api('folder/import',{});
    let info: RepositoryInfo;
    try { info = await api<RepositoryInfo>('repository'); }
    catch (cause) { setRepositoryConnected(false); throw cause; }
    setRepository(info); setRepositoryConnected(!!info.repository);
    setFiles(info.repository ? await api<string[]>('files') : []);
    if (info.repository) await refreshLibrary(); else { setRecentNotes([]); setPinnedNotes([]); }
    return info;
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      let restored: DraftSnapshot | null = null;
      try { restored = await loadDraft(draftId); } catch { /* Continue online if browser storage is unavailable. */ }
      if (!active) return;
      if (restored) {
        setDocumentClosed(!!restored.documentClosed);
        setRepository(restored.repository); setName(restored.name); setLoadedName(restored.loadedName);
        setValue(restored.value); setBaseline(restored.baseline); setVersion(restored.version);
        setImportedVersion(restored.importedVersion); setPendingSync(restored.pendingSync); setAutoSavePaused(!!restored.autoSavePaused); setFinderSourceId(restored.finderSourceId || null);
        setPreferences({...defaultPreferences,...restored.preferences}); setPreferenceDraft({...defaultPreferences,...restored.preferences});
        restoringAssets.current = restored.assets.length > 0;
        setAssets(restored.assets.map(asset => ({ ...asset, url: '' })));
        setBaselineAssets(restored.assetsDirty ? 'unsaved' : assetIdentity(restored.assets));
        setInitialAssets(restored.assets); setDocumentId(id => id + 1);
      }
      try {
        const [info, saved] = await Promise.all([api<RepositoryInfo>('repository'), api<SavePreferences>('preferences')]);
        if (!active) return;
        if (restored?.repository.repository && restored.repository.repository !== info.repository) {
          setError('O rascunho pertence a outro repositório. Reconecte a pasta nas configurações antes de salvar.');
          setSettingsOpen(true);
        } else {
          setOpenedScope(browserMode ? libraryKey() : info.repository);
          setRepository(info); setRepositoryConnected(!!info.repository); setFiles(info.repository ? await api<string[]>('files') : []);
          if (info.repository) await refreshLibrary(); else { setRecentNotes([]); setPinnedNotes([]); }
          if (!info.repository) {setSettingsOpen(true);setSwitchRepositoryOpen(true);}
        }
        if (!active) return;
        setPreferences(saved); setPreferenceDraft(saved); setOffline(false);
      } catch (cause) {
        if (!active) return;
        setRepositoryConnected(false);
        if (cause instanceof LocalApiError) { setError(cause.message); setSettingsOpen(true); setOffline(false); }
        else setOffline(true);
        if (restored) setNotice('Rascunho recuperado no navegador. Continue editando offline; o Git sincroniza quando o aplicativo local voltar.');
        else setNotice('Modo offline. Abra ou escreva um Markdown; seu rascunho fica neste navegador.');
      } finally {
        try {
        const finderId = !browserMode && new URLSearchParams(location.search).get('finder');
        if (finderId) {
          const doc = await api<LoadedDocument & {name:string;inRepository:boolean;repository:string|null}>(`finder-document?id=${encodeURIComponent(finderId)}`);
          if (!active) return;
          const attached = doc.files.map(file => ({path:file.path,file:new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, {type:file.mime})}));
          resetDocument(doc.value, doc.name, doc.inRepository ? doc.version : null, attached);setOpenedScope(doc.repository);
          if(!doc.inRepository && doc.version) {setImportedVersion({name:doc.name,version:doc.version});setFinderSourceId(finderId);}
          history.replaceState(null, '', location.pathname);
          setError('');setSettingsOpen(false);setNotice(doc.inRepository ? 'Documento do Finder aberto no repositório.' : 'Documento do Finder importado. Salvar usará o repositório configurado; o original fica preservado.');
        }
        } catch(cause) {if(active)setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o arquivo do Finder.');}
        if (active) setDraftReady(true);
      }
    })();
    return () => { active = false; };
  }, [draftId]);
  useEffect(() => {
    if (!draftReady) return;
    const snapshot: DraftSnapshot = {id: draftId, documentClosed, repository, name, loadedName, value, baseline, version, importedVersion, pendingSync, autoSavePaused, finderSourceId, assetsDirty, assets: assets.map(({path,file}) => ({path,file})), preferences, updatedAt: Date.now()};
    latestDraft.current = snapshot;
    void persistDraft(snapshot).catch(() => setError('Não foi possível guardar o rascunho no navegador. Baixe o Markdown ou pacote para preservar suas alterações.'));
  }, [draftReady, draftId, documentClosed, repository, name, loadedName, value, baseline, version, importedVersion, pendingSync, autoSavePaused, finderSourceId, assetsDirty, assets, preferences]);
  useEffect(() => {
    const flush = () => { if (latestDraft.current) void persistDraft(latestDraft.current).catch(() => {}); };
    const online = () => setOffline(false), disconnected = () => setOffline(true);
    window.addEventListener('pagehide', flush); window.addEventListener('online', online); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('pagehide', flush); window.removeEventListener('online', online); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (documentClosed || !dirty && !pendingSync) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pendingSync, documentClosed]);
  async function run(action: () => Promise<unknown>) {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (cause instanceof LocalApiError && cause.conflict) {
        setConflict(cause.conflict); setCopyName(cause.conflict.name.replace(/\.(md|markdown|mdown)$/i, '-copia.md')); setSettingsOpen(false);
      } else if (cause instanceof TypeError) { setOffline(true); setPendingSync(true); setNotice('Rascunho preservado no navegador. Reabra o aplicativo local para salvar no repositório e sincronizar o Git.'); }
      else setError(cause instanceof Error ? cause.message : String(cause));
    }
    finally { operationLock.current = false; setBusy(false); }
  }
  async function disconnectRepository() {
    await run(async () => {
      const info = await api<RepositoryInfo>('disconnect', {repository: repository.repository});
      setRepository(info); setRepositoryConnected(false); setFiles([]); setRecentNotes([]); setPinnedNotes([]);
      setSwitchRepositoryOpen(false); setRepositorySyncFeedback(null);
      setNotice('Repositório desconectado. Seus arquivos locais e o documento aberto estão preservados.');
    });
  }
  async function completeRepositorySwitch(result: RepositorySwitchResult) {
    setAutoSavePaused(!result.carriedFiles);
    if (result.carriedFiles) {
      setOpenedScope(browserMode ? libraryKey() : result.info.repository);setFinderSourceId(null);
      if (result.folder) {setName(current => `${result.folder}/${current}`); setLoadedName(current => current ? `${result.folder}/${current}` : current);setImportedVersion(current => current ? {...current,name:`${result.folder}/${current.name}`} : null);}
    } else {setVersion(null); setImportedVersion(null); setLoadedName('');}
    setRepository(result.info); setRepositoryConnected(!!result.info.repository); setSwitchRepositoryOpen(false);
    setRepositorySyncFeedback(result.synchronization ? {message:result.synchronization.synced ? 'Repositório sincronizado com o remoto.' : `Arquivos preservados localmente. Envio pendente: ${result.synchronization.error}`, state:result.synchronization.synced ? 'success' : 'error'} : null);
    await refresh();
    setNotice(`Destino alterado.${result.copied ? ` ${result.copied} arquivos copiados; originais preservados.` : ''} O documento aberto continua no editor.${!result.carriedFiles ? ' O automático desse rascunho fica pausado até salvá-lo manualmente ou abrir outra nota.' : ''}`);
  }
  const discard = () => !dirty || window.confirm('Há alterações não salvas. Deseja substituí-las?');
  function resetDocument(text = '', fileName = 'documento.md', hash: string | null = null, attached: {path: string; file: File}[] = []) {
    setDocumentClosed(false);
    reloadScrollTop.current=0;setReloadMode(null);setFinderSourceId(null);setOpenedScope(browserMode ? libraryKey() : repository.repository);
    setValue(text); setBaseline(text);setBaselineAssets(assetIdentity(attached)); setName(fileName); setLoadedName(fileName); setVersion(hash);
    setImportedVersion(null); setConflict(null); setPendingSync(false); setAutoSavePaused(false); restoringAssets.current = attached.length > 0; setAssets(attached.map(asset => ({...asset,url:''}))); setInitialAssets(attached); setDocumentId(id => id + 1); setSaveRevision(0);
  }
  async function finishDocument(action: DocumentAction) {
    if (closingDocument.current) return;
    closingDocument.current = true;
    const ownsLock = !operationLock.current;
    if (ownsLock) {operationLock.current = true;setBusy(true);}
    const previous = latestDraft.current;
    // Persist the replacement before exposing it, so an immediate reload cannot resurrect a discarded note.
    const snapshot: DraftSnapshot = {id:draftId,documentClosed:action === 'close',repository,name:'documento.md',loadedName:'documento.md',value:'',baseline:'',version:null,importedVersion:null,pendingSync:false,assets:[],preferences,updatedAt:Date.now()};
    latestDraft.current = snapshot;
    try {
      await persistDraft(snapshot);
      // Closing a note never deletes its saved file. Only this tab's working copy is reset.
      focusNewNote.current = action === 'new';
      resetDocument(); setDocumentClosed(action === 'close'); setSelected(''); setDocumentConfirmation(null);
      if (action === 'new' && window.matchMedia('(max-width: 899px)').matches) setNotesOpen(false);
      setAfterCommitAction(null); setNotice(action === 'close' ? 'Nota fechada.' : 'Nova nota criada.');
    } catch {
      latestDraft.current = previous;
      setDocumentConfirmation(null);setError('Não foi possível registrar a troca de nota no navegador. A nota atual continua aberta; tente novamente.');
    } finally {
      closingDocument.current = false;
      if (ownsLock) {operationLock.current = false;setBusy(false);}
    }
  }
  function requestClose() {
    if (!draftReady || documentClosed || operationLock.current || busy || workbenchRef.current?.isBusy() || sourceReload.reloading || document.querySelector('dialog[open]')) return;
    setSettingsOpen(false);
    if (dirty || pendingSync) setDocumentConfirmation('close'); else void finishDocument('close');
  }
  function requestOpen() {
    if (!draftReady || operationLock.current || busy || sourceReload.reloading || document.querySelector('dialog[open]')) return;
    // Keep the chooser in the original user gesture; awaiting here loses activation in Safari.
    if (settingsOpen) flushSync(() => setSettingsOpen(false));
    workbenchRef.current?.openFile();
  }
  async function openNote(fileName: string) {
    if (!discard()) return;
    await run(async () => {
      const doc = await api<LoadedDocument>(`document?name=${encodeURIComponent(fileName)}`);
      const attached = doc.files.map(file => ({ path: file.path, file: new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, { type: file.mime }) }));
      resetDocument(doc.value, fileName, doc.version, attached); setReloadMode('read'); setPendingSync(!!doc.pendingSync); setSelected(fileName); setSettingsOpen(false);
      if (window.matchMedia('(max-width: 899px)').matches) setNotesOpen(false);
      setNotice(doc.warnings.length ? `Aberto com avisos: ${doc.warnings.join('; ')}` : 'Documento aberto.');
    });
  }
  const sourceScope = browserMode ? libraryKey() : repository.repository;
  // Browser file inputs expose a snapshot, not a reusable path to the selected original.
  const reloadFromPicker = !!importedVersion && !finderSourceId && !version && name === loadedName && !autoSavePaused;
  const canReloadSource = !!finderSourceId || !!version && !!repository.repository && sourceScope === openedScope && !autoSavePaused;
  const reloadLabel = reloadFromPicker || finderSourceId || !browserMode || deviceFolder && !githubSelection() ? 'Recarregar do disco' : githubSelection() ? 'Recarregar do GitHub' : 'Recarregar nota';
  const reloadTitle = sourceReloadTitle();
  function sourceReloadTitle() {
    if (name !== loadedName) return 'Salve o novo nome do arquivo antes de recarregar.';
    if (reloadFromPicker) return 'Recarregar do disco: selecione novamente o arquivo original. A leitura não grava nem sincroniza.';
    if (!canReloadSource) return 'Abra um arquivo salvo para poder recarregar da origem.';
    return reloadLabel;
  }
  const sourceQuery = `name=${encodeURIComponent(loadedName)}&folder=${encodeURIComponent(deviceFolder)}&${browserMode ? `scope=${encodeURIComponent(sourceScope || '')}` : `repository=${encodeURIComponent(repository.repository || '')}`}`;
  const sourceReload = useDocumentReload<LoadedDocument>({
    identity: JSON.stringify([sourceScope,deviceFolder,loadedName,version,documentId,finderSourceId]),
    enabled: draftReady && !documentClosed && name === loadedName && !autoSavePaused && (!!finderSourceId || !!version && !!repository.repository && sourceScope === openedScope),
    blocked: busy || settingsOpen || commitNoteOpen || !!documentConfirmation || !!conflict || aboutOpen,
    isBlocked: () => !!document.querySelector('dialog[open]') || !!workbenchRef.current?.isBusy(),
    dirty, pending: pendingSync && !finderSourceId,
    version: finderSourceId ? importedVersion?.version || null : version,
    interval: browserMode && githubSelection() ? 60000 : 5000,
    probe: () => api(finderSourceId ? `finder-document-version?id=${encodeURIComponent(finderSourceId)}` : `document-version?${sourceQuery}`),
    load: () => api(finderSourceId ? `finder-document?id=${encodeURIComponent(finderSourceId)}&fresh=1` : `document?${sourceQuery}&fresh=1`),
    apply: (doc,automatic) => {
      const mode = currentMode.current;
      const scrollTop=document.querySelector('[data-document-scroll]')?.scrollTop || 0;
      const sourceId = finderSourceId;
      const attached = doc.files.map(file => ({path:file.path,file:new File([Uint8Array.from(atob(file.data),character=>character.charCodeAt(0))],file.path.split('/').at(-1)!,{type:file.mime})}));
      resetDocument(doc.value,loadedName,sourceId ? null : doc.version,attached);
      reloadScrollTop.current=scrollTop;setReloadMode(mode);setPendingSync(!!doc.pendingSync);
      if(sourceId){setFinderSourceId(sourceId);setImportedVersion({name:loadedName,version:doc.version!});}
      setNotice(automatic ? 'Nota atualizada a partir da origem.' : 'Nota recarregada.');
      void api<NoteLibrary>('library').then(library=>{setRecentNotes(library.recent);setPinnedNotes(library.pinned);}).catch(()=>{});
    },
  });
  const newNoteState = useRef({ id: documentId, name, scope: sourceScope, needsSave: dirty || pendingSync, blocked: true });
  newNoteState.current = { id: documentId, name, scope: sourceScope, needsSave: !documentClosed && (dirty || pendingSync), blocked: !draftReady || busy || settingsOpen || commitNoteOpen || !!documentConfirmation || !!conflict || aboutOpen || sourceReload.reloading || sourceReload.manualLock || sourceReload.confirmation };
  async function requestNewNote() {
    const original = newNoteState.current;
    if (original.blocked || operationLock.current || preparingNewNote.current || document.querySelector('dialog[open]')) return;
    preparingNewNote.current = true;
    try {
      if (!documentClosed && !await workbenchRef.current?.flushInput()) return;
      // Canvas text can publish a new source while blurring. Read the committed host state next frame.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const current = newNoteState.current;
      if (current.id !== original.id || current.name !== original.name || current.scope !== original.scope || current.blocked || operationLock.current || workbenchRef.current?.isBusy() || document.querySelector('dialog[open]')) return;
      if (current.needsSave) setDocumentConfirmation('new'); else await finishDocument('new');
    } finally { preparingNewNote.current = false; }
  }
  async function registerImport(source: string, fileName: string, reloaded = false) {
    await run(async () => {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      const originalVersion = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
      setDocumentClosed(false);setSettingsOpen(false);setFinderSourceId(null);setImportedVersion({ name: fileName, version: originalVersion });
      setBaseline(source); setLoadedName(fileName); setVersion(null); setPendingSync(true); setConflict(null);
      if (reloaded) setNotice('Arquivo relido do disco.');
    });
  }
  async function save(note: string, target?: {name: string; version: string | null; backupBeforeReplace?: boolean}) {
    lastSaveNote.current = note;
    const targetName = target?.name ?? name;
    const expected = target ? target.version : name === loadedName ? version : null;
    const baseVersion = !target && importedVersion?.name === name ? importedVersion.version : undefined;
    const result = await api<SaveResult>('save-sync', { repository: repository.repository, name: targetName, value, message: note, version: expected, baseVersion, backupBeforeReplace: target?.backupBeforeReplace, files: await Promise.all(assets.map(encodeAsset)) });
    setOffline(false); setName(targetName); setVersion(result.version); setBaseline(value); setLoadedName(targetName); setSaveRevision(revision => revision + 1);
    setBaselineAssets(assetIdentity(assets));setImportedVersion(null); setConflict(null); setPendingSync(!result.synced); setAutoSavePaused(false);setFinderSourceId(null);setOpenedScope(browserMode ? libraryKey() : repository.repository);
    await refresh();
    if (result.synced) setNotice(browserMode ? (githubSelection() ? 'Nota e imagens salvas no GitHub em um commit.' : deviceFolder ? `Nota salva em ${deviceFolder}.` : isIosApp ? 'Nota salva neste aplicativo.' : 'Nota salva neste navegador.') : 'Arquivo salvo, commit criado e enviado ao remoto.');
    else if(browserMode) setError(`Nota preservada no navegador; ${githubSelection() ? 'envio ao GitHub' : 'cópia na pasta'} pendente. ${result.error}`);
    else setError(`Arquivo salvo localmente. ${result.stage === 'commit' ? 'Commit pendente' : 'Push pendente'}: ${result.error} Use Salvar novamente para tentar sincronizar.`);
    return result.synced;
  }
  async function syncRepository(message: string) {
    setRepositorySyncing(true); setRepositorySyncFeedback({message: 'Sincronizando…', state: 'syncing'});
    try {
      const result = await api<Pick<SaveResult, 'synced' | 'stage' | 'error'>>('sync', { repository: repository.repository, message });
      await refresh();
      setRepositorySyncFeedback({message: result.synced ? 'Repositório sincronizado com o remoto.' : `${result.stage === 'commit' ? 'Commit' : 'Envio'} pendente: ${result.error}`, state: result.synced ? 'success' : 'error'});
    } catch (cause) {
      setRepositorySyncFeedback({message: cause instanceof Error ? cause.message : 'Não foi possível sincronizar. Tente novamente.', state: 'error'});
    } finally { setRepositorySyncing(false); }
  }
  function requestRepositorySync() {
    if (operationLock.current || busy || !repository.repository) return;
    if (preferences.askCommitNote) {
      setCommitTarget('repository'); setCommitNote(''); setCommitNoteOpen(true);
    } else void run(() => syncRepository('Synchronize local notes'));
  }
  function requestSave(automatic = false, afterSave: DocumentAction | null = null) {
    if (!draftReady || documentClosed || operationLock.current || busy || workbenchRef.current?.isBusy() || sourceReload.reloading || sourceReload.confirmation || commitNoteOpen || conflict || !repository.repository) return;
    setDocumentConfirmation(null);
    if (preferences.askCommitNote) {
      setAfterCommitAction(afterSave);setCommitTarget('document'); setCommitNote(''); setSettingsOpen(false); setCommitNoteOpen(true);
    } else void saveDocument(`${automatic ? 'Auto-save' : 'Update'} ${name}`, afterSave);
  }
  async function saveDocument(message: string, afterSave: DocumentAction | null = null) {
    await run(async () => {
      const synced = await save(message);
      // Failed writes, conflicts and pending pushes keep the document open for recovery.
      if (synced && afterSave) await finishDocument(afterSave);
    });
  }
  const canAutoSave = draftReady && !documentClosed && !documentConfirmation && !autoSavePaused && !sourceReload.change && !sourceReload.confirmation && !sourceReload.reloading && (!offline || browserMode) && (dirty || pendingSync) && !busy && !settingsOpen && !commitNoteOpen && !conflict;
  autoSaveCommit.current = () => {
    if (canAutoSave) requestSave(true);
  };
  autoSaveAction.current = () => {
    if(!canAutoSave||autoSaveChecking.current)return;
    autoSaveChecking.current=true;
    void sourceReload.allowAutoSave().then(allowed=>{if(allowed)autoSaveCommit.current();}).finally(()=>{autoSaveChecking.current=false;});
  };
  useEffect(() => {
    if (!preferences.autoSave || !repository.repository) return;
    const interval = window.setInterval(() => autoSaveAction.current(), preferences.intervalMinutes * 60000);
    return () => window.clearInterval(interval);
  }, [preferences.autoSave, preferences.intervalMinutes, repository.repository]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const newShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;
      // Capture before CodeMirror, natural editing or Excalidraw consumes the Enter combination.
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat && !settingsOpen && !document.querySelector('dialog[open]')) void requestNewNote();
    };
    window.addEventListener('keydown', newShortcut, true);
    return () => window.removeEventListener('keydown', newShortcut, true);
  });
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (!['o', 's', 'w'].includes(key)) return;
      event.preventDefault();
      if (event.repeat || document.querySelector('dialog[open]')) return;
      if (key === 'o') requestOpen();
      else if (key === 's') requestSave();
      else requestClose();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  const statusMessages = <>{error && <div role="alert" className="error toast">{error}<button aria-label="Dispensar erro" onClick={() => setError('')}><X size={18}/></button></div>}{notice && <p role="status" className="notice toast">{notice}</p>}</>;
  return <main aria-busy={busy} className="editor-app">
    {aboutOpen && <EditorDialog title="Sobre o Scriba" onClose={() => setAboutOpen(false)}><div className="about-scriba"><img src="/icons/profile-v3/scribe-180.png" width="96" height="96" alt="Escriba egípcio, símbolo do Scriba"/><h1>Scriba</h1><p className="about-subtitle">AB Markdown Editor</p><p>Scriba vem do latim e significa escriba: quem registra e preserva a palavra escrita. O escriba egípcio da nossa marca representa esse cuidado com suas ideias — agora em notas Markdown que continuam suas.</p><dl><div><dt>Versão</dt><dd>{__APP_VERSION__}</dd></div><div><dt>Compilação</dt><dd><time dateTime={__BUILD_DATE__}>{new Date(__BUILD_DATE__).toLocaleDateString('pt-BR')}</time></dd></div><div><dt>Edição</dt><dd>{isIosApp ? 'iPhone / iPad' : browserMode ? 'Web / PWA' : 'Local para Mac'}</dd></div><div><dt>Desenvolvido por</dt><dd>Aeon Bridge Co.</dd></div></dl><p>Powered by Aeon Bridge Co. — offered to community.</p><a href="https://github.com/ab-orbit/ab-markdow-editor" target="_blank" rel="noopener noreferrer">Código-fonte e documentação</a><p><a href="https://scriba.aeonbridge.app/privacy.html" target="_blank" rel="noopener noreferrer">Privacidade</a> · <a href="https://scriba.aeonbridge.app/support.html" target="_blank" rel="noopener noreferrer">Suporte</a></p></div></EditorDialog>}
    {settingsOpen && <section className="settings-page" id="settings-page" aria-labelledby="settings-title">
    <header className="settings-page-header"><div><button type="button" onClick={backToEditor} aria-label="Voltar ao editor"><ArrowLeft size={20}/><span>Editor</span></button><h1 id="settings-title" ref={settingsTitle} tabIndex={-1}>Configurações</h1></div></header>
    <div className="settings-content">
    <section className="pwa-settings" aria-label="Aplicativo PWA">
      <div className="pwa-brand"><img src={brandIcon} width="64" height="64" alt="Escriba egípcio do AB Markdown"/><div><h3>Scriba · AB Markdown Editor</h3><p>{pwa.standalone ? 'Aplicativo instalado' : 'Aplicativo web instalável'} · {pwa.ready ? 'Disponível offline' : 'Preparando modo offline'}</p></div></div>
      {pwa.canInstall && <button type="button" onClick={() => void pwa.install()}><Download size={18}/>Instalar aplicativo</button>}
      {!pwa.canInstall && !pwa.standalone && <p>Use a opção de instalar aplicativo do navegador. No Safari do Mac, use Arquivo → Adicionar ao Dock.</p>}
      <p>{isIosApp ? 'Notas e rascunhos ficam neste aplicativo. Você pode escolher uma pasta em Files ou conectar um repositório GitHub. Ao desinstalar o Scriba, as cópias privadas do aplicativo são removidas; os arquivos exportados para Files e GitHub continuam no destino escolhido.' : browserMode ? 'Sem integração, notas e imagens ficam neste navegador. Ao conectar GitHub, as notas são enviadas ao repositório escolhido pelo serviço de sincronização. Limpar os dados do site remove as cópias locais; exporte ZIPs para backup. Google Drive está previsto.' : 'Rascunhos e imagens ficam neste navegador. Para gravar na pasta e sincronizar o Git, o aplicativo local precisa estar em execução.'}</p>
      {pwa.updateAvailable && <p>Atualização pronta. Seus rascunhos estão preservados; feche as janelas do editor e abra novamente quando terminar.</p>}
    </section>
    {browserMode && <GitHubSettings canSwitch={discard} onChange={async () => {resetDocument();await refresh();setNotice('Destino atualizado. Suas notas anteriores continuam preservadas separadamente.');}}/>}
    {browserMode && <section className="storage-settings" aria-label="Pasta de notas"><h3>Onde guardar suas notas</h3><p>{deviceFolder ? `Pasta selecionada: ${deviceFolder}` : isIosApp ? 'Armazenamento privado neste aplicativo' : 'Armazenamento privado neste navegador'}</p>{githubSelection() && <p>Repositório: <a href={`https://github.com/${githubSelection()!.fullName}`} target="_blank" rel="noopener noreferrer">{githubSelection()!.fullName}</a></p>}{canChooseFolder() ? <div className="settings-actions"><button disabled={busy} onClick={() => {if(!discard())return;void run(async () => {const label=await chooseDeviceFolder();setGitHubSelection(null);resetDocument();setDeviceFolder(label);const count=await importDeviceNotes();await syncDeviceNotes();setSettingsOpen(false);setNotesOpen(true);setNotice(`${count} notas carregadas. Pasta: ${label}.`);});}}><FolderOpen size={18}/>Selecionar pasta em Files</button>{deviceFolder && <><button disabled={busy} onClick={() => void run(async () => {await authorizeDeviceFolder();const count=await importDeviceNotes();await syncDeviceNotes();setSettingsOpen(false);setNotesOpen(true);setNotice(`Pasta lida: ${count} notas disponíveis na lista.`);})}>Autorizar pasta e carregar notas</button><button onClick={() => void run(async () => {await disconnectFolder();setGitHubSelection(null);resetDocument();await refresh();setDeviceFolder('');})}>{isIosApp ? 'Usar somente aplicativo' : 'Usar somente navegador'}</button></>}</div> : <p>Este navegador não oferece acesso de gravação a pastas do Files. Suas notas ficam neste navegador; use Baixar pacote para salvar um ZIP em Files. No iPhone/iPad, o acesso contínuo a pastas exige um aplicativo nativo.</p>}<p>Escolha a pasta principal: o Scriba cria uma subpasta scriba e copia as notas salvas e imagens para ela. Rascunhos continuam protegidos no navegador. Arquivos alterados fora do editor não são sobrescritos. GitHub está disponível na seção acima; Google Drive está previsto.</p></section>}
    {browserMode && !isIosApp && <section className="repository" aria-label="Sincronização com GitHub e Git"><h3><FolderGit2 size={20}/> GitHub / repositório Git</h3><p>Use um repositório local ou clone uma URL Git. Na versão local, cada salvamento grava o arquivo, cria um commit e faz push usando suas credenciais.</p><div className="settings-actions"><a className="settings-action" href="http://127.0.0.1:43127/" target="_blank" rel="noopener noreferrer">Abrir editor local com Git</a><a className="settings-action" href="https://github.com/ab-orbit/ab-markdow-editor#readme" target="_blank" rel="noopener noreferrer">Instalar no Mac</a></div><p>Abra o aplicativo Scriba no Mac antes de conectar. No editor local, abra Configurações para selecionar a pasta ou clonar o repositório. As notas deste site continuam separadas; use Baixar pacote e importe no editor local para transferi-las.</p><p>No celular e tablet, use a seção GitHub acima para conectar sua conta e selecionar um repositório. O armazenamento no navegador e a pasta do dispositivo continuam como alternativas.</p></section>}
    {!browserMode && <details className="repository" open={!repository.repository || undefined}>
      <summary className="repository-summary"><span className="repository-summary-content"><span className="repository-path"><FolderGit2 size={20}/><span>{repository.repository || 'Configurar repositório'}{repository.branch && ` · ${repository.branch}`}</span></span>{repository.repository && <span className="connection-status" data-state={repositoryConnected ? 'connected' : 'pending'}>{repositoryConnected ? <CircleCheck size={16} aria-hidden="true"/> : <CircleAlert size={16} aria-hidden="true"/>}{repositoryConnected ? 'Pasta conectada' : draftReady ? 'Conexão indisponível' : 'Verificando conexão…'}</span>}</span></summary>
      {repository.githubUrl && <p>Repositório: <a href={repository.githubUrl} target="_blank" rel="noopener noreferrer">{repository.githubUrl.replace('https://github.com/', '')}</a></p>}
      <fieldset disabled={busy}>
      {repository.repository && <div className="settings-actions repository-management"><button type="button" onClick={() => setSwitchRepositoryOpen(true)}><ArrowRightLeft size={18}/>Trocar repositório</button><button type="button" onClick={() => void disconnectRepository()}><Unplug size={18}/>Desconectar</button></div>}
      {!repository.repository && <p>Sem repositório conectado. {repository.previousRepository ? `Seus arquivos continuam em ${repository.previousRepository}.` : 'Selecione uma pasta ou clone um repositório para começar.'} O documento aberto pode ser editado e exportado.</p>}
      {!repository.repository && !switchRepositoryOpen && <button type="button" onClick={() => setSwitchRepositoryOpen(true)}><FolderOpen size={18}/>Conectar repositório</button>}
      {switchRepositoryOpen && <RepositorySwitch key={repository.repository || 'disconnected'} repository={repository.repository} source={repository.repository || repository.previousRepository || null} busy={busy} run={run} request={api} askCommitNote={preferences.askCommitNote} onComplete={completeRepositorySwitch} onCancel={() => setSwitchRepositoryOpen(false)}/>}
      {repository.repository && <><div className="repository-sync"><p aria-label="Alterações no repositório">{repository.status ? describeRepositoryChanges(repository.status) : 'Nenhuma alteração local pendente.'}</p><button type="button" disabled={busy} aria-label="Sincronizar repositório" title="Sincronizar todas as alterações locais: criar commit e enviar ao remoto" aria-busy={repositorySyncing} onClick={requestRepositorySync}><RefreshCw size={18}/></button></div>{repositorySyncFeedback && <p role="status" className="repository-sync-feedback" data-state={repositorySyncFeedback.state}>{repositorySyncFeedback.state === 'success' ? <CircleCheck size={18} aria-hidden="true"/> : repositorySyncFeedback.state === 'error' ? <CircleAlert size={18} aria-hidden="true"/> : <RefreshCw size={18} aria-hidden="true"/>}<span>{repositorySyncFeedback.message}</span></p>}</>}</fieldset>
    </details>}
    <section className="save-preferences" aria-label="Preferências de salvamento">
      <h3>Edição, salvamento e sincronização</h3>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await api<SavePreferences>('preferences', preferenceDraft); setPreferences(saved); setPreferenceDraft(saved); setNotice('Preferências de salvamento atualizadas.'); }); }}>
        <fieldset disabled={busy}>
          <label className="check-option"><input type="checkbox" checked={preferenceDraft.doubleClickToEdit} onChange={event => setPreferenceDraft({ ...preferenceDraft, doubleClickToEdit: event.target.checked })}/>Editar blocos com duplo clique</label>
          {(!browserMode || !!githubSelection()) && <label className="check-option"><input type="checkbox" checked={preferenceDraft.askCommitNote} onChange={event => setPreferenceDraft({ ...preferenceDraft, askCommitNote: event.target.checked })}/>Perguntar nota do commit a cada salvamento</label>}
          <label className="check-option"><input type="checkbox" checked={preferenceDraft.autoSave} onChange={event => setPreferenceDraft({ ...preferenceDraft, autoSave: event.target.checked })}/>Ativar salvamento automático</label>
          <label>Intervalo (minutos)<input type="number" min="1" max="1440" step="1" required value={preferenceDraft.intervalMinutes} onChange={event => setPreferenceDraft({ ...preferenceDraft, intervalMinutes: Number(event.target.value) })}/></label>
          <p>{browserMode ? 'O automático salva no destino selecionado enquanto esta aba estiver aberta. Se houver conexão GitHub, envia as alterações em um commit.' : 'O automático salva, cria o commit e envia ao remoto enquanto esta aba estiver aberta. Se pedir nota estiver ligado, aguarda a confirmação antes de salvar.'}</p>
          <button type="submit">Salvar preferências</button>
        </fieldset>
      </form>
    </section>
    {statusMessages}
    </div></section>}
    {conflict && <EditorDialog title="Resolver versões do arquivo" onClose={() => setConflict(null)}>
      <p><strong>{conflict.name}</strong></p>
      <p>{conflict.kind === 'exists' ? 'Já existe um arquivo com esse nome na pasta.' : conflict.kind === 'deleted' ? 'O arquivo foi removido do disco desde a abertura.' : 'A nota mudou desde a abertura.'} Seu texto continua intacto no editor.</p>
      <p>{browserMode ? 'Salve uma cópia para manter as duas versões ou confirme a substituição da nota neste navegador.' : 'Salve uma cópia para manter os dois arquivos ou confirme a substituição. Antes de substituir, a versão do disco será guardada em Application Support/AB Markdown/conflict-backups.'}</p>
      <form onSubmit={event => { event.preventDefault(); void run(() => save(lastSaveNote.current, {name: copyName, version: null})); }}>
        <label>Nome da cópia<input required value={copyName} onChange={event => setCopyName(event.target.value)}/></label>
        <footer><button type="button" onClick={() => setConflict(null)}>Continuar editando</button><button type="submit" disabled={busy}>Salvar uma cópia</button></footer>
      </form>
      <button type="button" disabled={busy} onClick={() => void run(() => save(lastSaveNote.current, {name: conflict.name, version: conflict.currentVersion, backupBeforeReplace: true}))}>Substituir arquivo existente</button>
    </EditorDialog>}
    {documentConfirmation && <EditorDialog title={documentConfirmation === 'new' ? 'Salvar antes de criar uma nova nota?' : 'Salvar antes de fechar?'} className="close-document-dialog" onClose={() => setDocumentConfirmation(null)}>
      <p><strong>{name}</strong> tem {dirty ? 'alterações não salvas' : 'uma sincronização pendente'}.</p>
      <p>{documentConfirmation === 'new' ? 'Salvar e criar' : 'Salvar e fechar'} conclui o salvamento no destino configurado{!browserMode || githubSelection() ? ', incluindo commit e envio ao repositório' : ''}. {documentConfirmation === 'new' ? 'Descartar e criar' : 'Fechar sem salvar'} descarta o rascunho desta aba; o arquivo já salvo é preservado.</p>
      {!repository.repository && <p>Conecte um destino nas configurações para salvar. Você também pode cancelar e baixar a nota pela barra de ferramentas.</p>}
      <footer><button type="button" autoFocus onClick={() => setDocumentConfirmation(null)}>Cancelar</button><button type="button" onClick={() => void finishDocument(documentConfirmation)}>{documentConfirmation === 'new' ? 'Descartar e criar' : 'Fechar sem salvar'}</button><button type="button" className="primary" disabled={!repository.repository} onClick={() => requestSave(false, documentConfirmation)}><Save size={16} aria-hidden="true"/>{documentConfirmation === 'new' ? 'Salvar e criar' : 'Salvar e fechar'}</button></footer>
    </EditorDialog>}
    {commitNoteOpen && <EditorDialog title="Nota do commit" onClose={() => {setCommitNoteOpen(false);setAfterCommitAction(null);}}>
      <form onSubmit={event => { event.preventDefault(); if (!commitNote.trim()) return; setCommitNoteOpen(false); setAfterCommitAction(null); if(commitTarget === 'repository')void run(() => syncRepository(commitNote.trim()));else void saveDocument(commitNote.trim(), afterCommitAction); }}>
        <label>Nota do commit<textarea autoFocus required maxLength={1000} value={commitNote} onChange={event => setCommitNote(event.target.value)} placeholder="Descreva o que mudou"/></label>
        <footer><button type="button" onClick={() => {setCommitNoteOpen(false);setAfterCommitAction(null);}}>Cancelar</button><button type="submit" disabled={!commitNote.trim()}>{commitTarget === 'repository' ? 'Commit e push' : afterCommitAction === 'new' ? 'Salvar, sincronizar e criar' : afterCommitAction === 'close' ? 'Salvar, sincronizar e fechar' : 'Salvar, commit e push'}</button></footer>
      </form>
    </EditorDialog>}
    {sourceReload.confirmation && <EditorDialog title={reloadLabel} onClose={sourceReload.cancel}><p>Há edições ou uma sincronização pendente. Recarregar substitui a versão mantida neste editor pela versão da origem.</p><footer className="reload-confirmation"><button type="button" onClick={sourceReload.cancel}>Continuar editando</button><button type="button" onClick={event => {
      // Release only this confirmation before the reload checks for other open dialogs.
      event.currentTarget.closest<HTMLDialogElement>('dialog')?.close();
      sourceReload.confirm();
    }}>Recarregar e descartar rascunho</button></footer></EditorDialog>}
    {!settingsOpen && statusMessages}
    <div className="editor-layout" hidden={settingsOpen} inert={settingsOpen || undefined}>
    {notesOpen && <aside id="recent-notes" className="notes-sidebar" aria-label="Notas recentes">
      <div className="notes-heading"><button type="button" className="about-trigger" aria-label="Sobre o Scriba" title="Sobre o Scriba" onClick={() => setAboutOpen(true)}><img className="notes-logo" src={brandIcon} width="24" height="24" alt=""/></button><div><h2>Notas recentes</h2><p>{query ? `${visibleNotes.length + visiblePinned.length} resultados` : `${recentNotes.length + pinnedNotes.length} notas`}</p></div><button type="button" className="close-notes" aria-label="Fechar lista de notas" onClick={() => setNotesOpen(false)}><X size={18}/></button><button type="button" aria-label="Atualizar notas recentes" disabled={busy || !repository.repository || (offline && !browserMode)} onClick={() => void run(async () => { await refresh(); })}><RefreshCw size={18}/></button></div>
      <label className="notes-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Buscar nas notas recentes" placeholder="Buscar notas…" value={noteSearch} onChange={event => setNoteSearch(event.target.value)}/></label>
      {query && !visibleNotes.length && !visiblePinned.length && <p className="notes-empty">Nenhuma nota encontrada.</p>}
      <button className="new-note" type="button" disabled={busy || !draftReady} aria-keyshortcuts="Meta+Shift+Enter Control+Shift+Enter" title="Nova nota (⌘⇧Enter / Ctrl+Shift+Enter)" onClick={() => void requestNewNote()}><FilePlus2 size={18}/>Nova nota</button>
      {!repository.repository && <p className="notes-empty">Conecte um repositório nas configurações para listar suas notas.</p>}
      {repository.repository && !recentNotes.length && !pinnedNotes.length && <p className="notes-empty">{offline ? 'Abra o aplicativo local para carregar a lista.' : 'Nenhuma nota Markdown encontrada.'}</p>}
      <nav aria-label="100 notas mais recentes">{noteGroups.map(group => <section className="note-group" key={group.label} aria-label={group.label}><h3>{group.label}</h3><ol>{group.notes.map(note => <li className="note-row" key={note.name} data-note={note.name}>
        <button className="open-note" type="button" disabled={busy || !draftReady || (offline && !browserMode)} aria-current={name === note.name && version ? 'page' : undefined} title={note.name} aria-label={note.name} onClick={() => void openNote(note.name)}><span><strong>{note.title || note.name.split('/').at(-1)}</strong>{note.preview && <span className="note-preview">{note.preview}</span>}{note.hasImage && <NoteThumbnail repository={repository.repository} name={note.name} modifiedAt={note.modifiedAt}/>}<time dateTime={note.modifiedAt} title={new Date(note.modifiedAt).toLocaleString('pt-BR')}>{group.pinned && <Pin size={11} aria-label="Nota fixada"/>}{shortNoteDate(note.modifiedAt, dateClock)}</time></span></button>
        <button className="pin-note" type="button" disabled={busy || (offline && !browserMode)} aria-label={`${group.pinned ? 'Desafixar' : 'Fixar'} ${note.name}`} title={group.pinned ? 'Desafixar nota' : 'Fixar nota'} onClick={() => void togglePin(note, !group.pinned)}>{group.pinned ? <PinOff size={14}/> : <Pin size={14}/>}</button>
      </li>)}</ol></section>)}</nav>
    </aside>}
    <fieldset disabled={!draftReady || busy || sourceReload.manualLock} className="editor-container">
    {documentClosed && <section className="empty-document" aria-label="Nenhuma nota aberta">
      <div className="empty-document-toolbar"><button type="button" aria-controls="recent-notes" aria-expanded={notesOpen} aria-label={notesOpen ? 'Ocultar notas recentes' : 'Mostrar notas recentes'} title="Notas recentes" onClick={() => setNotesOpen(open => !open)}><PanelLeft size={18}/></button><button type="button" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title="Alternar tema" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button type="button" aria-label="Configurações" title="Configurações" onClick={() => setSettingsOpen(true)}><Settings size={18}/></button></div>
      <div className="empty-document-content"><img src={brandIcon} width="64" height="64" alt=""/><h1 ref={emptyTitle} tabIndex={-1}>Nenhuma nota aberta</h1><p>Escolha uma nota na lista, abra um arquivo ou comece uma nova.</p><div><button type="button" className="primary" aria-keyshortcuts="Meta+O Control+O" onClick={requestOpen}><FolderOpen size={18}/>Abrir arquivo <kbd>⌘O</kbd></button><button type="button" aria-keyshortcuts="Meta+Shift+Enter Control+Shift+Enter" title="Nova nota (⌘⇧Enter / Ctrl+Shift+Enter)" onClick={() => void requestNewNote()}><FilePlus2 size={18}/>Nova nota <kbd>⌘⇧Enter</kbd></button></div></div>
    </section>}
    <div className="workbench-container" hidden={documentClosed}><MarkdownWorkbench ref={workbenchRef} diagramScope={`${repository.repository || "browser"}:${finderSourceId || name}`} warnBeforeUnload={false} onClose={requestClose} onSave={() => requestSave()} compact initialScrollTop={reloadScrollTop.current} initialMode={reloadMode || (version || importedVersion || finderSourceId ? 'read' : 'live')} doubleClickToEdit={preferences.doubleClickToEdit} onModeChange={reportMode} key={documentId} value={value} onChange={setValue} fileName={name} onFileNameChange={newName => { setDocumentClosed(false);setFinderSourceId(null);setName(newName); setVersion(null); setLoadedName(''); setImportedVersion(null); }} onImport={registerImport} initialAssets={initialAssets} onAssetsChange={handleAssets} saveRevision={saveRevision} readOnly={!draftReady || busy || sourceReload.manualLock} sourceStatus={sourceReload.change && <div className="source-change" role="status"><CircleAlert size={18} aria-hidden="true"/><span>{sourceReload.change.kind === 'deleted' ? 'O arquivo foi removido da origem. Seu texto continua no editor.' : sourceReload.change.kind === 'error' ? `Não foi possível recarregar: ${sourceReload.change.message}` : dirty || pendingSync ? 'A nota mudou fora do Scriba. Suas edições foram mantidas.' : sourceReload.reloading ? 'Carregando atualização da origem…' : 'Há uma versão mais recente na origem.'}</span>{sourceReload.change.kind !== 'deleted' && <button type="button" disabled={sourceReload.reloading} onClick={sourceReload.request}>{reloadLabel}</button>}</div>} actions={<>
      <button type="button" aria-controls="recent-notes" aria-expanded={notesOpen} aria-label={notesOpen ? 'Ocultar notas recentes' : 'Mostrar notas recentes'} title="Notas recentes" onClick={() => setNotesOpen(open => !open)}><PanelLeft size={18}/></button>
      {offline && <span className="offline-indicator" aria-label="Modo offline"><CloudOff size={16}/><span>Offline</span></span>}
      <button type="button" aria-label={reloadLabel} title={`${reloadTitle}${sourceReload.change ? ' — alteração externa detectada' : ''}`} className={sourceReload.change ? 'source-reload-pending' : undefined} disabled={busy || sourceReload.reloading || name !== loadedName || !canReloadSource && !reloadFromPicker} aria-busy={sourceReload.reloading} onClick={() => reloadFromPicker ? workbenchRef.current?.openFile(true) : sourceReload.request()}><RotateCw size={18}/></button>
      {repository.repository && <button type="button" disabled={busy} aria-keyshortcuts="Meta+S Control+S" aria-label={browserMode ? "Salvar nota" : "Salvar no repositório"} title={browserMode ? "Salvar nota (⌘S)" : "Salvar no repositório (⌘S)"} onClick={() => requestSave()}><Save size={18}/></button>}
      <button type="button" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
      <button type="button" aria-label="Configurações" title="Configurações" aria-controls="settings-page" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings size={18}/></button>
    </>}/></div></fieldset>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
