import { PoweredBy } from './components/Brand/PoweredBy';
import welcomeNames from '../server/welcome-texts.json';
import { rememberInteractionControl } from './components/ui/interactionFocus';
import { handleDetailsMenu, closeOtherDetailsMenus, dismissDetailsMenus } from './components/ui/actionMenu';
import { DocumentLoading } from './components/Brand/DocumentLoading';
import { afterPaint } from './lib/afterPaint';
import { extractedConversionMarkdown, conversionCopyName } from './lib/markdown/conversionExport';
import { UpdateNotice } from './UpdateNotice';
import { t, useLanguage, currentLanguage, languagePreference, setLanguage, currentLocale, type LanguagePreference } from './i18n';
import { newNoteName } from './lib/markdown/noteName';
import { EMPTY_EXCALIDRAW } from './lib/markdown/excalidrawScene';
import {RepositorySwitch, type RepositorySwitchResult} from './RepositorySwitch';
import {StorageSettings} from './StorageSettings';
import {githubSelection,libraryKey} from './lib/github';
import {chooseDeviceFolder, folderLabel, disconnectFolder, saveToDeviceFolder} from './lib/deviceFolder';
import {browserMode} from './lib/browserStore';
import {isIosApp, iosBridge} from './lib/ios';
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FolderGit2, FolderOpen, Save, Upload, Sun, Moon, FilePlus2, Settings, X, Download, CloudOff, PanelLeft, FileText, RefreshCw, Search, Pin, PinOff, ArrowLeft, CircleCheck, CircleAlert, ArrowRightLeft, Unplug, RotateCw, SquarePen, PenTool, ChevronDown } from 'lucide-react';
import { MarkdownWorkbench, type MarkdownMode, type MarkdownWorkbenchHandle } from './components/Markdown/MarkdownWorkbench';
import { NoteThumbnail } from './NoteThumbnail';
import { noteGroup, shortNoteDate } from './lib/noteDates';
import { useDocumentReload } from './useDocumentReload';
import { usePwa } from './usePwa';
import { authorizedFetch } from './lib/session';
import { loadDraft, persistDraft, type DraftSnapshot } from './lib/drafts';
import { EditorDialog } from './components/Markdown/EditorDialog';
import type { MarkdownAsset } from './lib/markdown/assets';
import type {SavedFileTarget} from './lib/savedFile';
import './tokens.css';
import './style.css';
import './ui.css';

declare global { interface Window { /** Per-process local API capability injected by the server. */ __MARKDOWN_TOKEN__: string } }
interface RecentNote {
  /** Safe repository-relative path used when opening a note. */
  name: string;
  /** File modification time in ISO format, newest first. */
  modifiedAt: string;
  /** Actual creation timestamp when provided by the storage backend. */
  createdAt?: string;
  /** Markdown heading and short plain-text preview for the note list. */
  title?: string;
  preview?: string;
  /** Whether the note contains a local image eligible for a lazy thumbnail. */
  hasImage?: boolean;
}
interface NoteLibrary {
  /** Seeded welcome for the active locale; first launch can open it without guessing filenames. */
  welcomeName?: string;
  /** Manually ordered pinned notes for the current checkout. */
  pinned: RecentNote[];
  /** Latest 100 non-pinned notes, newest first. */
  recent: RecentNote[];
  /** Initial guide synchronization may require a Git retry. */
  synchronization?: SaveResult;
}
const brandIcon = '/icons/profile-v4/scribe-64.png';
interface RepositoryInfo {
  /** Stable browser-library identity, independent of translated display labels. */
  scope?: string;
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
type DocumentAction = 'close' | 'new' | 'whiteboard';
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
  /** Destination can change when an integrated conflict preserves a separate local copy. */
  name?: string;
  /** Whether incoming remote commits were integrated during this save. */
  integrated?: boolean;
  /** Conflicting notes preserved as separately readable local versions. */
  copies?: {source: string; name: string}[];
  /** Hash of the content successfully written to disk, even if Git failed. */
  version: string | null;
  /** Whether the saved document has been committed and pushed. */
  synced: boolean;
  /** Git operation that remains pending after a partial failure. */
  stage?: 'commit' | 'push';
  /** Readable Git failure returned with a successful local save. */
  error?: string;
}
const defaultPreferences: SavePreferences = { askCommitNote: false, autoSave: true, intervalMinutes: 1, doubleClickToEdit: true };
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
  if (!response.ok) throw new LocalApiError(t(result.error || t("Não foi possível concluir a operação.")), result.conflict);
  return result;
}
async function encodeAsset(asset: Pick<MarkdownAsset, "path" | "file">) {
  const bytes = new Uint8Array(await asset.file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { path: asset.path, data: btoa(binary) };
}
/** Translate Git porcelain codes into local file states, without implying a successful push. */
function describeRepositoryChanges(status: string): string {
  return status.split('\n').filter(Boolean).map(line => {
    // The local Git helper trims the first line, so accept one or two status columns.
    const match = line.match(/^([ MADRCU?!T]{1,2}) (.+)$/);
    if (!match) return t("Há alterações locais no repositório.");
    const [, code, file] = match;
    const label = code === '??' ? t("Ainda não versionado")
      : code === '!!' ? t("Ignorado pelo Git")
      : code.includes("U") || code === 'AA' || code === 'DD' ? t("Conflito a resolver")
      : code.includes('D') ? t("Exclusão local pendente")
      : code.includes('R') ? t("Renomeação local pendente")
      : code.includes('C') ? t("Cópia local pendente")
      : code.includes('A') ? t("Adicionado; commit pendente")
      : t("Alteração local pendente");
    return `${label}: ${file}`;
  }).join('\n');
}
function assetIdentity(items: {path:string;file:File}[]) {return JSON.stringify(items.map(({path,file})=>[path,file.name,file.size,file.type,file.lastModified]));}
function App() {
  useEffect(() => { document.documentElement.dataset.platform=isIosApp ? "ios" : "web"; }, []);
  const language = useLanguage();
  const pwa = usePwa();
  useEffect(() => {
    if(!isIosApp)return;
    const externalLink = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const link = (event.target as Element)?.closest?.('a[href]');
      if(!link)return;
      const url = new URL(link.getAttribute('href')!, location.href);
      if(url.protocol !== 'https:')return;
      event.preventDefault();
      void iosBridge.openExternal({url:url.href}).catch(error=>window.alert(t(error.message)));
    };
    document.addEventListener('click',externalLink);
    return()=>document.removeEventListener('click',externalLink);
  },[]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [deviceFolder, setDeviceFolder] = useState("");
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
    if(open && location.hash !== '#settings') history.pushState({scribaSettings:true}, "", `${location.pathname}${location.search}#settings`);
    if(!open && location.hash === '#settings') history.replaceState(null, "", `${location.pathname}${location.search}`);
    setSettingsOpenState(open);
  }
  function backToEditor() {
    if(history.state?.scribaSettings) history.back(); else setSettingsOpen(false);
  }
  useEffect(() => {const url=new URL(location.href);if(url.searchParams.has('github')){url.searchParams.delete('github');url.hash='settings';history.replaceState(null,"",url.pathname+url.search+url.hash);}}, []);
  useEffect(() => {const navigate=()=>setSettingsOpenState(location.hash === '#settings');window.addEventListener('popstate',navigate);window.addEventListener('hashchange',navigate);return()=>{window.removeEventListener('popstate',navigate);window.removeEventListener('hashchange',navigate);};}, []);
  useEffect(() => {if(settingsOpen)settingsTitle.current?.focus();else if(settingsWasOpen.current)document.querySelector<HTMLButtonElement>('button[aria-controls="settings-page"]')?.focus();settingsWasOpen.current=settingsOpen;},[settingsOpen]);
  useEffect(() => {const showNotes=()=>setNotesOpen(true);window.addEventListener('scriba:show-notes',showNotes);return()=>window.removeEventListener('scriba:show-notes',showNotes);}, []);
  const [repository, setRepository] = useState<RepositoryInfo>({ repository: null, branch: "", status: "" });
  const [repositoryConnected, setRepositoryConnected] = useState(false);
  const [switchRepositoryOpen, setSwitchRepositoryOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<RecentNote[]>([]);
  const [dateClock, setDateClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setDateClock(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteSearchOpen, setNoteSearchOpen] = useState(true);
  const noteSearchInput = useRef<HTMLInputElement>(null);
  const notesImportInput = useRef<HTMLInputElement>(null);
  const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase('pt-BR');
  const query = normalizeSearch(noteSearch.trim());
  const matchesNote = (note: RecentNote) => !query || normalizeSearch(`${note.name} ${note.title || ""} ${note.preview || ""}`).includes(query);
  const visibleNotes = recentNotes.filter(matchesNote);
  const visiblePinned = pinnedNotes.filter(matchesNote);
  const noteGroups = [{label:t("Fixadas"), notes:visiblePinned, pinned:true}, ...[t("Hoje"), t("Ontem"), t("Últimos 7 dias"), t("Mais antigas")].map(label => ({label, notes:visibleNotes.filter(note => noteGroup(note.modifiedAt, dateClock) === label), pinned:false}))].filter(group => group.notes.length);
  const [notesOpen, setNotesOpen] = useState(() => window.matchMedia("(min-width: 900px) and (pointer: fine)").matches);
  useEffect(() => {
    // A touch device opens the library explicitly; the document always gets priority.
    const compact = window.matchMedia('(max-width: 899px), (pointer: coarse)');
    const closeOverlay = () => { if (compact.matches) setNotesOpen(false); };
    const focusDocument = (event: Event) => {
      const target = event.target as Element;
      if (target?.closest?.('.workbench-container') && !target.closest('[aria-controls="recent-notes"]')) closeOverlay();
    };
    document.addEventListener('focusin', focusDocument);
    document.addEventListener('pointerdown', focusDocument);
    compact.addEventListener('change', closeOverlay);
    window.addEventListener('orientationchange', closeOverlay);
    return () => {
      document.removeEventListener('focusin', focusDocument);
      document.removeEventListener('pointerdown', focusDocument);
      compact.removeEventListener('change', closeOverlay);
      window.removeEventListener('orientationchange', closeOverlay);
    };
  }, []);
  const [selected, setSelected] = useState("");
  const workbenchRef = useRef<MarkdownWorkbenchHandle>(null);
  const [documentClosed, setDocumentClosed] = useState(false);
  const [documentConfirmation, setDocumentConfirmation] = useState<DocumentAction | null>(null);
  const [afterCommitAction, setAfterCommitAction] = useState<DocumentAction | null>(null);
  const closingDocument = useRef(false);
  const preparingNewNote = useRef(false), focusNewNote = useRef(false), automaticNoteName = useRef(false), newDocumentCreatedAt = useRef(new Date());
  const emptyTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (documentClosed) emptyTitle.current?.focus(); }, [documentClosed]);
  const [name, setName] = useState(t("documento.md"));
  const [loadedName, setLoadedName] = useState(t("documento.md"));
  const [value, setValue] = useState('# Meu documento\n\nComece a escrever.\n');
  const [baseline, setBaseline] = useState('# Meu documento\n\nComece a escrever.\n');
  const [importedVersion, setImportedVersion] = useState<{name: string; version: string} | null>(null);
  const [conflict, setConflict] = useState<DocumentConflict | null>(null);
  const [copyName, setCopyName] = useState("");
  const lastSaveNote = useRef("");
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
  const [savedFileLocation,setSavedFileLocation] = useState<string|null>(null);
  const [openedScope, setOpenedScope] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<SavePreferences>(defaultPreferences);
  const [preferenceDraft, setPreferenceDraft] = useState<SavePreferences>(defaultPreferences);
  const [commitNoteOpen, setCommitNoteOpen] = useState(false);
  const [commitTarget, setCommitTarget] = useState<'document' | 'repository'>('document');
  const [repositorySyncing, setRepositorySyncing] = useState(false);
  const [repositorySyncFeedback, setRepositorySyncFeedback] = useState<{message: string; state: 'syncing' | 'success' | 'error'} | null>(null);
  const [commitNote, setCommitNote] = useState("");
  const [pendingSync, setPendingSync] = useState(false);
  const [autoSavePaused, setAutoSavePaused] = useState(false);
  const operationLock = useRef(false);
  const autoSaveAction = useRef<() => void>(() => {});
  const autoSaveCommit = useRef<() => void>(() => {});
  const autoSaveChecking = useRef(false);
  const prepareImportAction = useRef<() => Promise<boolean>>(async () => false);
  const lastAutoSaveAttempt = useRef(0);
  const lastBackgroundError = useRef("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [openingDocument, setOpeningDocument] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!focusNewNote.current || !draftReady || busy || documentClosed || settingsOpen) return;
    const frame = requestAnimationFrame(() => { workbenchRef.current?.focus(); focusNewNote.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [documentId, draftReady, busy, documentClosed, settingsOpen]);
  const [themePreference, setTheme] = useState(() => localStorage.getItem('ab-markdown-theme') || 'dark');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = themePreference === 'auto' ? (systemDark ? 'dark' : 'light') : themePreference;
  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(system.matches);
    system.addEventListener('change', update); return () => system.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const showAppearance = () => {
      setSettingsOpen(true);
      requestAnimationFrame(() => document.getElementById('appearance-setting')?.scrollIntoView({block:'center'}));
    };
    window.addEventListener('scriba:show-appearance', showAppearance);
    return () => window.removeEventListener('scriba:show-appearance', showAppearance);
  }, []);
  const assetsDirty = assetIdentity(assets) !== baselineAssets;
  const dirty = value !== baseline || name !== loadedName || assetsDirty;
  useEffect(() => {
    document.documentElement.dataset.theme = theme; localStorage.setItem('ab-markdown-theme', themePreference);
    if(isIosApp){const channels=getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number)||[0,0,0];void iosBridge.appearance({dark:theme==='dark',automatic:themePreference==='auto',red:channels[0],green:channels[1],blue:channels[2]}).catch(()=>{});}
  }, [theme, themePreference]);
  useEffect(()=>{
    if(!isIosApp)return;
    const update=()=>{void iosBridge.accessibilityPreferences().then(preferences=>{
      document.documentElement.dataset.reduceTransparency=String(preferences.reduceTransparency || preferences.increaseContrast);
    }).catch(()=>{document.documentElement.dataset.reduceTransparency='true';});};
    update();document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);
  async function refreshLibrary() {
    const library = await api<NoteLibrary>('library/initialize', {language:currentLanguage()});
    setRecentNotes(library.recent); setPinnedNotes(library.pinned);
    if(browserMode && githubSelection())setFiles(await api<string[]>('files'));
    if (library.synchronization && !library.synchronization.synced) setError(t("Sincronização pendente: {0}", t(library.synchronization.error || "")));
    return library;
  }
  const followWelcomeLanguage = useRef(false);
  async function changeInterfaceLanguage(preference: LanguagePreference) {
    const basename=name.split('/').at(-1) || '';
    const welcomeOpen=Object.values(welcomeNames).some(file=>basename===file || basename.startsWith(file.slice(0,-3)+' (')) || ['Boas-vindas.md','Bem-vindo ao Scriba.md'].includes(basename);
    if(operationLock.current || busy)return;
    try {
      if(welcomeOpen && (dirty || pendingSync)) {
        operationLock.current=true;setBusy(true);
        if(!await save('Save welcome before changing language',undefined,true))return;
      }
      followWelcomeLanguage.current=welcomeOpen;
      setLanguage(preference);
    } catch(cause) {setError(cause instanceof Error?t(cause.message):String(cause));}
    finally {operationLock.current=false;setBusy(false);}
  }
  useEffect(()=>{document.title=`Scriba — ${t('Suas ideias em Markdown')}`;},[language]);
  const libraryLanguage=useRef(language);
  useEffect(()=>{
    if(libraryLanguage.current===language)return;
    libraryLanguage.current=language;
    if(draftReady&&repository.repository)void (async()=>{
      const follow=followWelcomeLanguage.current;followWelcomeLanguage.current=false;
      const library=await refreshLibrary();
      if(!follow || !library.welcomeName || currentLanguage()!==language)return;
      const doc=await api<LoadedDocument>(`document?name=${encodeURIComponent(library.welcomeName)}`);
      if(currentLanguage()!==language)return;
      const attached=doc.files.map(file=>({path:file.path,file:new File([Uint8Array.from(atob(file.data),char=>char.charCodeAt(0))],file.path.split('/').at(-1)!,{type:file.mime})}));
      resetDocument(doc.value,library.welcomeName,doc.version,attached);setReloadMode('read');setSelected(library.welcomeName);setPendingSync(!!doc.pendingSync);
    })().catch(cause=>setError(cause instanceof Error?t(cause.message):String(cause)));
  },[language,draftReady,repository.repository]);
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
        // An existing draft always wins, including one restored after an application upgrade.
        try { localStorage.setItem('scriba-welcome-opened', '1'); } catch { /* Draft restoration remains available without localStorage. */ }
        const extracted = extractedConversionMarkdown(restored.value);
        if (extracted !== null) {
          const copyName = conversionCopyName(restored.name);
          restored = {...restored, name:copyName, loadedName:copyName, value:extracted, baseline:'', version:null, importedVersion:null, pendingSync:true, autoSavePaused:false, finderSourceId:null, savedFileLocation:null};
          setReloadMode('read');
          setNotice(t("Conteúdo Markdown extraído do JSON. O arquivo original foi preservado; a cópia usa outro nome."));
        }
        setDocumentClosed(!!restored.documentClosed);
        setRepository(restored.repository); setName(restored.name); setLoadedName(restored.loadedName);
        setValue(restored.value); setBaseline(restored.baseline); setVersion(restored.version);
        setImportedVersion(restored.importedVersion); setPendingSync(restored.pendingSync); setAutoSavePaused(!!restored.autoSavePaused); setFinderSourceId(restored.finderSourceId || null);setSavedFileLocation(restored.savedFileLocation || null);
        setPreferences({...defaultPreferences,...restored.preferences}); setPreferenceDraft({...defaultPreferences,...restored.preferences});
        restoringAssets.current = restored.assets.length > 0;
        setAssets(restored.assets.map(asset => ({ ...asset, url: "" })));
        setBaselineAssets(restored.assetsDirty ? 'unsaved' : assetIdentity(restored.assets));
        setInitialAssets(restored.assets); setDocumentId(id => id + 1);
      }
      try {
        const [info, saved] = await Promise.all([api<RepositoryInfo>('repository'), api<SavePreferences>('preferences')]);
        if (!active) return;
        const legacyPrivateLabels=['Notas neste navegador','Notes in this browser','Notizen in diesem Browser','Notes dans ce navigateur'];
        const destinationChanged=restored?.repository.scope ? restored.repository.scope!==info.scope : restored?.repository.repository!==info.repository && !(browserMode&&info.scope==='state'&&legacyPrivateLabels.includes(restored?.repository.repository || ''));
        if (restored?.repository.repository && destinationChanged && !restored.savedFileLocation) {
          setError(t("O rascunho pertence a outro repositório. Reconecte a pasta nas configurações antes de salvar."));
          setSettingsOpen(true);
        } else {
          setOpenedScope(browserMode ? libraryKey() : info.repository);
          setRepository(info); setRepositoryConnected(!!info.repository); setFiles(info.repository ? await api<string[]>('files') : []);
          const library = info.repository ? await refreshLibrary() : null;
          if (!info.repository) { setRecentNotes([]); setPinnedNotes([]); }
          let welcomeOpened=false;
          try { welcomeOpened=localStorage.getItem('scriba-welcome-opened')==='1'; } catch { /* The persisted draft also prevents a repeated welcome. */ }
          if (!restored && !welcomeOpened && library?.welcomeName && library.pinned.some(note=>note.name===library.welcomeName) && !new URLSearchParams(location.search).has('finder')) {
            const doc=await api<LoadedDocument>(`document?name=${encodeURIComponent(library.welcomeName)}`);
            if (!active) return;
            const attached=doc.files.map(file=>({path:file.path,file:new File([Uint8Array.from(atob(file.data),char=>char.charCodeAt(0))],file.path.split('/').at(-1)!,{type:file.mime})}));
            resetDocument(doc.value,library.welcomeName,doc.version,attached);
            setOpenedScope(browserMode?libraryKey():info.repository);setReloadMode('read');setSelected(library.welcomeName);setPendingSync(!!doc.pendingSync);
            if (window.matchMedia('(max-width: 899px), (pointer: coarse)').matches) setNotesOpen(false);
            try { localStorage.setItem('scriba-welcome-opened','1'); } catch { /* A restored draft takes precedence on subsequent launches. */ }
          }
          if (!info.repository && !restored?.savedFileLocation) {setSettingsOpen(true);setSwitchRepositoryOpen(true);}
        }
        if (!active) return;
        setPreferences(saved); setPreferenceDraft(saved); setOffline(false);
      } catch (cause) {
        if (!active) return;
        setRepositoryConnected(false);
        if (cause instanceof LocalApiError) { setError(t(cause.message)); setSettingsOpen(true); setOffline(false); }
        else setOffline(true);
        if (restored) setNotice(t("Rascunho recuperado no navegador. Continue editando offline; o Git sincroniza quando o aplicativo local voltar."));
        else setNotice(t("Modo offline. Abra ou escreva um Markdown; seu rascunho fica neste navegador."));
      } finally {
        try {
        const finderId = !browserMode && new URLSearchParams(location.search).get('finder');
        if (finderId) {
          const doc = await api<LoadedDocument & {name:string;inRepository:boolean;repository:string|null}>(`finder-document?id=${encodeURIComponent(finderId)}`);
          if (!active) return;
          const attached = doc.files.map(file => ({path:file.path,file:new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, {type:file.mime})}));
          const extracted = resetDocument(doc.value, doc.name, doc.inRepository ? doc.version : null, attached);setOpenedScope(doc.repository);
          if(!extracted && !doc.inRepository && doc.version) {setImportedVersion({name:doc.name,version:doc.version});setFinderSourceId(finderId);}
          history.replaceState(null, "", location.pathname);
          setError("");setSettingsOpen(false);setNotice(extracted ? t("Conteúdo Markdown extraído do JSON. O arquivo original foi preservado; a cópia usa outro nome.") : doc.inRepository ? t("Documento do Finder aberto no repositório.") : t("Documento do Finder importado. Salvar usará o repositório configurado; o original fica preservado."));
        }
        } catch(cause) {if(active)setError(cause instanceof Error ? t(cause.message) : t("Não foi possível abrir o arquivo do Finder."));}
        if (active) setDraftReady(true);
      }
    })();
    return () => { active = false; };
  }, [draftId]);
  useEffect(() => {
    if (browserMode || !draftReady) return;
    let active = true, checking = false, connected = repositoryConnected;
    async function checkConnection() {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const health = await fetch('/health', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        if (!health.ok || (await health.json()).app !== 'ab-markdown-editor') throw new Error(t("Local service unavailable"));
        if (!active) return;
        if (!connected) {
          const info = await api<RepositoryInfo>('repository');
          if (!active) return;
          // Reconnection must never move an existing draft into another checkout.
          if (repository.repository && info.repository !== repository.repository) {
            setOffline(false); setRepositoryConnected(false);
            setError(t("O serviço voltou com outra pasta. Reconecte a pasta original nas configurações antes de salvar."));
            return;
          }
          setRepository(info); setOpenedScope(info.repository);
          setRepositoryConnected(!!info.repository); setOffline(false);
          connected = true;
          setFiles(info.repository ? await api<string[]>('files') : []);
          if (active && info.repository) await refreshLibrary();
          if (active) setNotice(t("Serviço local reconectado. O texto aberto e o rascunho foram preservados."));
        }
      } catch {
        if (active) { connected = false; setRepositoryConnected(false); setOffline(true); }
      } finally { checking = false; }
    }
    const wake = () => { void checkConnection(); };
    wake();
    const timer = window.setInterval(wake, 5000);
    window.addEventListener('focus', wake); window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [draftReady, repository.repository]);
  useEffect(() => {
    if (!draftReady) return;
    const snapshot: DraftSnapshot = {id: draftId, documentClosed, repository, name, loadedName, value, baseline, version, importedVersion, pendingSync, autoSavePaused, finderSourceId, savedFileLocation, assetsDirty, assets: assets.map(({path,file}) => ({path,file})), preferences, updatedAt: Date.now()};
    latestDraft.current = snapshot;
    void persistDraft(snapshot).catch(() => setError(t("Não foi possível guardar o rascunho no navegador. Baixe o Markdown ou pacote para preservar suas alterações.")));
  }, [draftReady, draftId, documentClosed, repository, name, loadedName, value, baseline, version, importedVersion, pendingSync, autoSavePaused, finderSourceId, savedFileLocation, assetsDirty, assets, preferences]);
  useEffect(() => {
    const flush = () => { if (latestDraft.current) void persistDraft(latestDraft.current).catch(() => {}); };
    const online = () => setOffline(false), disconnected = () => setOffline(true);
    window.addEventListener('pagehide', flush); window.addEventListener('online', online); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('pagehide', flush); window.removeEventListener('online', online); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (documentClosed || !dirty && !pendingSync) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pendingSync, documentClosed]);
  function reportOperationError(message: string, background: boolean) {
    const key = `${repository.repository}:${name}:${message}`;
    // Dismissing an unchanged background failure must survive automatic retries.
    if (!background || lastBackgroundError.current !== key) setError(message);
    lastBackgroundError.current = key;
  }
  async function run(action: () => Promise<unknown>, background = false) {
    if (operationLock.current) return;
    operationLock.current = true;
    if (!background) {setBusy(true);setError("");setNotice("");lastBackgroundError.current="";}
    try { await action(); } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (cause instanceof LocalApiError && cause.conflict) {
        if (background && browserMode && githubSelection()) {
          const preservedName = name.replace(/(\.(?:md|markdown|mdown))$/i, ` (local ${new Date().toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,8)})$1`);
          try {
            // Keep the incoming remote note and publish our edits as a separate readable note.
            const synced = await save(`Preserve concurrent note ${name}`, {name:preservedName,version:null}, true);
            if (synced) setNotice(t("Documentos sincronizados e integrados. As versões diferentes foram preservadas em cópias locais."));
            return;
          } catch { /* Leave the original draft intact and offer the ordinary copy dialog. */ }
        }
        setConflict(cause.conflict); setCopyName(cause.conflict.name.replace(/\.(md|markdown|mdown)$/i, '-copia.md')); setSettingsOpen(false);
      } else if (cause instanceof TypeError) { setOffline(true); setPendingSync(true); setNotice(t("Rascunho preservado no navegador. Reabra o aplicativo local para salvar no repositório e sincronizar o Git.")); }
      else reportOperationError(cause instanceof Error ? t(cause.message) : String(cause), background);
    }
    finally { operationLock.current = false; if (!background) setBusy(false); }
  }
  async function disconnectRepository() {
    await run(async () => {
      const info = await api<RepositoryInfo>('disconnect', {repository: repository.repository});
      setRepository(info); setRepositoryConnected(false); setFiles([]); setRecentNotes([]); setPinnedNotes([]);
      setSwitchRepositoryOpen(false); setRepositorySyncFeedback(null);
      setNotice(t("Repositório desconectado. Seus arquivos locais e o documento aberto estão preservados."));
    });
  }
  async function completeRepositorySwitch(result: RepositorySwitchResult) {
    if (!savedFileLocation) {
    setAutoSavePaused(!result.carriedFiles);
    if (result.carriedFiles) {
      setOpenedScope(browserMode ? libraryKey() : result.info.repository);setFinderSourceId(null);
      if (result.folder) {setName(current => `${result.folder}/${current}`); setLoadedName(current => current ? `${result.folder}/${current}` : current);setImportedVersion(current => current ? {...current,name:`${result.folder}/${current.name}`} : null);}
    } else {setVersion(null); setImportedVersion(null); setLoadedName("");}
    }
    setRepository(result.info); setRepositoryConnected(!!result.info.repository); setSwitchRepositoryOpen(false);
    setRepositorySyncFeedback(result.synchronization ? {message:result.synchronization.synced ? t("Repositório sincronizado com o remoto.") : t("Arquivos preservados localmente. Envio pendente: {0}", t(result.synchronization.error || "")), state:result.synchronization.synced ? 'success' : 'error'} : null);
    await refresh();
    setNotice(t("Destino alterado.{0} O documento aberto continua no editor.{1}", result.copied ? t(" {0} arquivos copiados; originais preservados.", result.copied) : '', !result.carriedFiles ? t(" O automático desse rascunho fica pausado até salvá-lo manualmente ou abrir outra nota.") : ''));
  }
  const discard = () => !dirty || window.confirm(t("Há alterações não salvas. Deseja substituí-las?"));
  function resetDocument(text = "", fileName = t("documento.md"), hash: string | null = null, attached: {path: string; file: File}[] = []) {
    lastAutoSaveAttempt.current=0;
    const extracted = extractedConversionMarkdown(text);
    if (extracted !== null) { text = extracted; fileName = conversionCopyName(fileName, files); hash = null; }
    automaticNoteName.current = false;
    setSavedFileLocation(null);
    setDocumentClosed(false);
    reloadScrollTop.current=0;setReloadMode(extracted !== null ? 'read' : null);setFinderSourceId(null);setOpenedScope(browserMode ? libraryKey() : repository.repository);
    setValue(text); setBaseline(text);setBaselineAssets(assetIdentity(attached)); setName(fileName); setLoadedName(fileName); setVersion(hash);
    setImportedVersion(null); setConflict(null); setPendingSync(extracted !== null); setAutoSavePaused(false); restoringAssets.current = attached.length > 0; setAssets(attached.map(asset => ({...asset,url:""}))); setInitialAssets(attached); setDocumentId(id => id + 1); setSaveRevision(0);
    return extracted !== null;
  }
  async function finishDocument(action: DocumentAction) {
    if (closingDocument.current) return;
    closingDocument.current = true;
    const ownsLock = !operationLock.current;
    if (ownsLock) {operationLock.current = true;setBusy(true);}
    const previous = latestDraft.current;
    // Persist the replacement before exposing it, so an immediate reload cannot resurrect a discarded note.
    const initialSource = action === 'whiteboard' ? '```excalidraw\n' + EMPTY_EXCALIDRAW + '\n```\n' : action === 'new' ? '# ' : "";
    const createdAt = new Date();
    const initialName = newNoteName(action === "whiteboard" ? "# Whiteboard" : initialSource, files, createdAt);
    const snapshot: DraftSnapshot = {id:draftId,documentClosed:action === 'close',repository,name:initialName,loadedName:initialName,value:initialSource,baseline:initialSource,version:null,importedVersion:null,pendingSync:false,assets:[],preferences,updatedAt:Date.now()};
    latestDraft.current = snapshot;
    try {
      await persistDraft(snapshot);
      // Closing a note never deletes its saved file. Only this tab's working copy is reset.
      focusNewNote.current = action === 'new';
      resetDocument(initialSource, initialName); automaticNoteName.current = action === 'new'; newDocumentCreatedAt.current = createdAt; setReloadMode(action === 'whiteboard' ? 'whiteboard' : 'live'); setDocumentClosed(action === 'close'); setSelected(""); setDocumentConfirmation(null);
      if (action !== 'close' && window.matchMedia("(max-width: 899px), (pointer: coarse)").matches) setNotesOpen(false);
      setAfterCommitAction(null); setNotice(action === 'close' ? t("Nota fechada.") : action === 'whiteboard' ? t("Novo whiteboard criado.") : t("Nova nota criada."));
    } catch {
      latestDraft.current = previous;
      setDocumentConfirmation(null);setError(t("Não foi possível registrar a troca de nota no navegador. A nota atual continua aberta; tente novamente."));
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
    setOpeningDocument(true);
    try { await run(async () => {
      await afterPaint();
      const doc = await api<LoadedDocument>(`document?name=${encodeURIComponent(fileName)}`);
      const attached = doc.files.map(file => ({ path: file.path, file: new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, { type: file.mime }) }));
      const extracted = resetDocument(doc.value, fileName, doc.version, attached); setReloadMode('read'); setPendingSync(extracted || !!doc.pendingSync); setSelected(fileName); setSettingsOpen(false);
      if (window.matchMedia("(max-width: 899px), (pointer: coarse)").matches) setNotesOpen(false);
      setNotice(extracted ? t("Conteúdo Markdown extraído do JSON. O arquivo original foi preservado; a cópia usa outro nome.") : doc.warnings.length ? t("Aberto com avisos: {0}", doc.warnings.map(warning => t(warning)).join("; ")) : t("Documento aberto."));
    }); } finally { setOpeningDocument(false); }
  }
  const sourceScope = browserMode ? libraryKey() : repository.repository;
  // Browser file inputs expose a snapshot, not a reusable path to the selected original.
  const reloadFromPicker = !!importedVersion && !finderSourceId && !version && name === loadedName && !autoSavePaused;
  const canReloadSource = !!finderSourceId || !!version && !!repository.repository && sourceScope === openedScope && !autoSavePaused;
  const reloadLabel = reloadFromPicker || finderSourceId || !browserMode || deviceFolder && !githubSelection() ? t("Recarregar do disco") : githubSelection() ? t("Recarregar do GitHub") : t("Recarregar nota");
  const reloadTitle = sourceReloadTitle();
  function sourceReloadTitle() {
    if (name !== loadedName) return t("Salve o novo nome do arquivo antes de recarregar.");
    if (reloadFromPicker) return t("Recarregar do disco: selecione novamente o arquivo original. A leitura não grava nem sincroniza.");
    if (!canReloadSource) return t("Abra um arquivo salvo para poder recarregar da origem.");
    return reloadLabel;
  }
  const sourceQuery = `name=${encodeURIComponent(loadedName)}&folder=${encodeURIComponent(deviceFolder)}&${browserMode ? `scope=${encodeURIComponent(sourceScope || "")}` : `repository=${encodeURIComponent(repository.repository || "")}`}`;
  const sourceReload = useDocumentReload<LoadedDocument>({
    identity: JSON.stringify([sourceScope,deviceFolder,loadedName,version,documentId,finderSourceId]),
    enabled: draftReady && !documentClosed && name === loadedName && !autoSavePaused && (!!finderSourceId || !!version && !!repository.repository && sourceScope === openedScope),
    blocked: busy || settingsOpen || commitNoteOpen || !!documentConfirmation || !!conflict || aboutOpen,
    // Background saves hold the synchronous lock without setting the visible busy state.
    isBlocked: () => operationLock.current || !!document.querySelector('dialog[open]') || !!workbenchRef.current?.isBusy(),
    dirty, pending: pendingSync && !finderSourceId,
    version: finderSourceId ? importedVersion?.version || null : version,
    interval: !savedFileLocation && browserMode && githubSelection() ? 60000 : 5000,
    probe: () => api(finderSourceId ? `finder-document-version?id=${encodeURIComponent(finderSourceId)}` : `document-version?${sourceQuery}`),
    load: () => api(finderSourceId ? `finder-document?id=${encodeURIComponent(finderSourceId)}&fresh=1` : `document?${sourceQuery}&fresh=1`),
    apply: (doc,automatic) => {
      const mode = currentMode.current;
      const scrollTop=document.querySelector('[data-document-scroll]')?.scrollTop || 0;
      const sourceId = finderSourceId;
      const location = savedFileLocation;
      const attached = doc.files.map(file => ({path:file.path,file:new File([Uint8Array.from(atob(file.data),character=>character.charCodeAt(0))],file.path.split('/').at(-1)!,{type:file.mime})}));
      resetDocument(doc.value,loadedName,sourceId ? null : doc.version,attached);
      reloadScrollTop.current=scrollTop;setReloadMode(mode);setPendingSync(!!doc.pendingSync);
      if(sourceId){setFinderSourceId(sourceId);setSavedFileLocation(location);setImportedVersion({name:loadedName,version:doc.version!});}
      setNotice(automatic ? t("Nota atualizada a partir da origem.") : t("Nota recarregada."));
      void api<NoteLibrary>('library').then(library=>{setRecentNotes(library.recent);setPinnedNotes(library.pinned);}).catch(()=>{});
    },
  });
  const newNoteState = useRef({ id: documentId, name, scope: sourceScope, needsSave: dirty || pendingSync, blocked: true });
  newNoteState.current = { id: documentId, name, scope: sourceScope, needsSave: !documentClosed && (dirty || pendingSync), blocked: !draftReady || busy || settingsOpen || commitNoteOpen || !!documentConfirmation || !!conflict || aboutOpen || sourceReload.reloading || sourceReload.manualLock || sourceReload.confirmation };
  async function requestNewNote(action: 'new' | 'whiteboard' = 'new') {
    const original = newNoteState.current;
    if (original.blocked || operationLock.current || preparingNewNote.current || document.querySelector('dialog[open]')) return;
    preparingNewNote.current = true;
    try {
      if (!documentClosed && !await workbenchRef.current?.flushInput()) return;
      // Canvas text can publish a new source while blurring. Read the committed host state next frame.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const current = newNoteState.current;
      if (current.id !== original.id || current.name !== original.name || current.scope !== original.scope || current.blocked || operationLock.current || workbenchRef.current?.isBusy() || document.querySelector('dialog[open]')) return;
      if (current.needsSave) setDocumentConfirmation(action); else await finishDocument(action);
    } finally { preparingNewNote.current = false; }
  }
  async function importNotes(selected: File[]) {
    if (!selected.length) return;
    if (!documentClosed && !await workbenchRef.current?.flushInput()) return;
    await afterPaint();
    if (!await prepareImportAction.current()) return;
    await run(async () => {
      const existing = new Set(await api<string[]>('files'));
      let imported = 0;
      let unsynced = 0;
      let lastImported: {name:string;value:string;version:string|null;pending:boolean} | null = null;
      try {
        for (const file of selected) {
          if (!/\.(md|markdown|mdown)$/i.test(file.name)) throw new Error(t("Selecione arquivos Markdown (.md, .markdown ou .mdown)."));
          const stem = file.name.replace(/\.(md|markdown|mdown)$/i, '');
          let target = `${stem}.md`;
          let suffix = 2;
          // Reserve a distinct destination for every file; never replace an existing note.
          while (existing.has(target)) target = `${stem} (${suffix++}).md`;
          const original = await file.text();
          const source = extractedConversionMarkdown(original) ?? original;
          const result = await api<SaveResult>('save-sync', {
            repository: repository.repository, name: target, value: source,
            version: null, files: [], message: t("Import notes with Scriba"),
          });
          existing.add(target);
          lastImported={name:result.name || target,value:source,version:result.version,pending:!result.synced};
          imported++;
          if (!result.synced) unsynced++;
        }
      } finally {
        // Refresh even when a later file fails: earlier imports are already preserved.
        await refresh();
        if(lastImported){resetDocument(lastImported.value,lastImported.name,lastImported.version);setPendingSync(lastImported.pending);setReloadMode('read');setSelected(lastImported.name);setSettingsOpen(false);if(window.matchMedia('(max-width: 899px), (pointer: coarse)').matches)setNotesOpen(false);}
        if (imported) setNotice(unsynced
          ? t("{0} notas importadas. {1} aguardam sincronização.", imported, unsynced)
          : t("{0} notas importadas.", imported));
      }
    });
  }
  async function registerImport(source: string, fileName: string, reloaded = false) {
    lastAutoSaveAttempt.current=0;
    await run(async () => {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      const originalVersion = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join("");
      setDocumentClosed(false);setSettingsOpen(false);setFinderSourceId(null);setSavedFileLocation(null);setImportedVersion({ name: fileName, version: originalVersion });
      setBaseline(source); setLoadedName(fileName); setVersion(null); setPendingSync(true); setConflict(null);setSelected(fileName);
      if(!reloaded && window.matchMedia('(max-width: 899px), (pointer: coarse)').matches)setNotesOpen(false);
      if (reloaded) setNotice(t("Arquivo relido do disco."));
    });
  }
  async function save(note: string, target?: {name: string; version: string | null; backupBeforeReplace?: boolean}, background = false) {
    lastSaveNote.current = note;
    if(savedFileLocation && finderSourceId) {
      const result=await api<SaveResult>('finder-save',{id:finderSourceId,value,version:target?target.version:importedVersion?.version??null,backupBeforeReplace:target?.backupBeforeReplace,files:await Promise.all(assets.map(encodeAsset))});
      setBaseline(value);setBaselineAssets(assetIdentity(assets));setLoadedName(name);setImportedVersion({name,version:result.version!});setSaveRevision(revision=>revision+1);setConflict(null);setPendingSync(false);setAutoSavePaused(false);if (!background) setNotice(t("Arquivo salvo em {0}.", savedFileLocation));
      return true;
    }
    const targetName = target?.name ?? (automaticNoteName.current ? newNoteName(value, await api<string[]>('files'), newDocumentCreatedAt.current) : name);
    const expected = target ? target.version : name === loadedName ? version : null;
    const baseVersion = !target && importedVersion?.name === name ? importedVersion.version : undefined;
    const result = await api<SaveResult>('save-sync', { repository: repository.repository, name: targetName, value, message: note, version: expected, baseVersion, backupBeforeReplace: target?.backupBeforeReplace, files: await Promise.all(assets.map(encodeAsset)) });
    automaticNoteName.current = false;
    const savedName = result.name || targetName;
    setOffline(false); setName(savedName); setVersion(result.version); setBaseline(value); setLoadedName(savedName); setSaveRevision(revision => revision + 1);
    setBaselineAssets(assetIdentity(assets));setImportedVersion(null); setConflict(null); setPendingSync(!result.synced); setAutoSavePaused(false);setFinderSourceId(null);setOpenedScope(browserMode ? libraryKey() : repository.repository);
    await refresh();
    if (result.synced) { if(background && lastBackgroundError.current){const previous=lastBackgroundError.current;setError(current => current && previous.endsWith(`:${current}`) ? "" : current);} lastBackgroundError.current=""; if (!background) setNotice(browserMode ? (githubSelection() ? t("Documentos sincronizados e integrados.") : deviceFolder ? t("Nota salva em {0}.", deviceFolder) : isIosApp ? t("Nota salva neste aplicativo.") : t("Nota salva neste navegador.")) : t("Documentos sincronizados e integrados.")); }
    else if(browserMode) reportOperationError(t("Nota preservada no navegador; {0} pendente. {1}", githubSelection() ? t("envio ao GitHub") : t("cópia na pasta"), t(result.error || "")), background);
    else reportOperationError(t("Arquivo salvo localmente. {0}: {1} Use Salvar novamente para tentar sincronizar.", result.stage === 'commit' ? t("Commit pendente") : t("Push pendente"), t(result.error || "")), background);
    if (result.synced && result.integrated) setNotice(result.copies?.length
      ? t("Documentos sincronizados e integrados. As versões diferentes foram preservadas em cópias locais.")
      : t("Documentos sincronizados e integrados."));
    return result.synced;
  }
  const latestSave = useRef(save); latestSave.current = save;
  const copyingDocument = useRef(false);
  /** Flush and save the original before creating a separately versioned document. */
  async function duplicateDocument() {
    if(copyingDocument.current || operationLock.current || busy)return;
    copyingDocument.current=true;
    try {
      await afterPaint();
      if(!(await workbenchRef.current?.flushInput()))throw new Error(t("Aguarde a operação atual terminar."));
      await afterPaint();
      await run(async()=>{
        if(!(await latestSave.current(`Update ${latestDraft.current?.name || name}`,undefined,true)))throw new Error(t("Não foi possível salvar a nota original. A cópia não foi criada; suas edições continuam abertas."));
        await afterPaint();
        const original=latestDraft.current;
        if(!original)throw new Error(t("Aguarde a operação atual terminar."));
        const folder=original.name.slice(0,original.name.lastIndexOf('/')+1);
        const title=original.name.split('/').at(-1)!.replace(/\.(md|markdown|mdown)$/i,'');
        const names=await api<string[]>('files');
        const copy=folder+newNoteName('# '+t("Cópia de {0}",title),names.filter(file=>file.startsWith(folder)).map(file=>file.slice(folder.length)));
        const result=await api<SaveResult>('save-sync',{repository:repository.repository,name:copy,value:original.value,message:`Copy ${original.name}`,version:null,files:await Promise.all(original.assets.map(encodeAsset))});
        const mode=currentMode.current;
        resetDocument(original.value,result.name||copy,result.version,original.assets);
        setReloadMode(mode==='whiteboard'?'whiteboard':'read');setSelected(result.name||copy);setPendingSync(!result.synced);setNotesOpen(false);
        await refresh();setNotice(t("Cópia criada e aberta. A nota original foi salva."));
        if(result.error)setError(t(result.error));
      });
    } catch(cause) {setError(cause instanceof Error?t(cause.message):t("Não foi possível criar a cópia. A nota original continua aberta."));}
    finally {copyingDocument.current=false;}
  }
  /** Save the latest canvas/text before moving its name within the same storage destination. */
  async function renameDocument(newName: string) {
    if(operationLock.current || savedFileLocation)throw new Error(t("Aguarde a operação atual terminar."));
    operationLock.current=true;setBusy(true);
    const originalName=name, originalScope=sourceScope;
    try {
      automaticNoteName.current=false;
      if(dirty || pendingSync || !version) {
        const synced=await save(`Update ${name}`,undefined,true);
        if(!synced)throw new Error(t("Sincronize a nota antes de renomear. Seu conteúdo foi preservado."));
      }
      await afterPaint();
      if(originalScope!==newNoteState.current.scope)throw new Error(t("O destino mudou. Reabra a nota."));
      const revision={version:latestDraft.current?.name === originalName ? latestDraft.current.version : version};
      const result=await api<{name:string;version:string;synced:boolean;error?:string}>('rename',{name:originalName,newName,version:revision.version,repository:repository.repository,scope:browserMode?libraryKey():undefined});
      setName(result.name);setLoadedName(result.name);setVersion(result.version);setImportedVersion(null);setSelected(result.name);setPendingSync(!result.synced);setFinderSourceId(null);
      await refresh();
      setNotice(t("Arquivo renomeado para {0}.",result.name));
      if(result.error)setError(t(result.error));
    } finally {operationLock.current=false;setBusy(false);}
  }
  async function syncRepository(message: string) {
    setRepositorySyncing(true); setRepositorySyncFeedback({message: 'Sincronizando…', state: 'syncing'});
    try {
      const result = await api<Pick<SaveResult, 'synced' | 'stage' | 'error'>>('sync', { repository: repository.repository, message });
      await refresh();
      setRepositorySyncFeedback({message: result.synced ? t("Repositório sincronizado com o remoto.") : t("{0}: {1}", result.stage === "commit" ? t("Commit pendente") : t("Push pendente"), t(result.error || "")), state: result.synced ? 'success' : 'error'});
    } catch (cause) {
      setRepositorySyncFeedback({message: cause instanceof Error ? t(cause.message) : t("Não foi possível sincronizar. Tente novamente."), state: 'error'});
    } finally { setRepositorySyncing(false); }
  }
  function requestRepositorySync() {
    if (operationLock.current || busy || !repository.repository) return;
    if (preferences.askCommitNote) {
      setCommitTarget('repository'); setCommitNote(""); setCommitNoteOpen(true);
    } else void run(() => syncRepository(t("Synchronize local notes")));
  }
  function requestSave(automatic = false, afterSave: DocumentAction | null = null) {
    if (!draftReady || documentClosed || operationLock.current || busy || workbenchRef.current?.isBusy() || sourceReload.reloading || sourceReload.confirmation || commitNoteOpen || conflict || !repository.repository && !savedFileLocation) return;
    setDocumentConfirmation(null);
    if (preferences.askCommitNote && !savedFileLocation && !automatic) {
      setAfterCommitAction(afterSave);setCommitTarget('document'); setCommitNote(""); setSettingsOpen(false); setCommitNoteOpen(true);
    } else void saveDocument(`${automatic ? 'Auto-save' : 'Update'} ${name}`, afterSave, automatic);
  }
  async function saveDocument(message: string, afterSave: DocumentAction | null = null, background = false) {
    await run(async () => {
      const synced = await save(message, undefined, background);
      // Failed writes, conflicts and pending pushes keep the document open for recovery.
      if (synced) lastBackgroundError.current="";
      if (synced && afterSave) await finishDocument(afterSave);
    }, background);
  }
  function adoptSavedFile(target:SavedFileTarget,source:string,attached:MarkdownAsset[]) {
    const mode=currentMode.current;
    resetDocument(source,target.name,null,attached);
    setReloadMode(mode);setFinderSourceId(target.id);setSavedFileLocation(target.location);setImportedVersion({name:target.name,version:target.version!});setSelected("");setNotice(t("Salvo como {0}. Os próximos salvamentos usarão este arquivo local.", target.location));setError("");
  }
  prepareImportAction.current = async () => {
    if(operationLock.current || conflict || sourceReload.confirmation || sourceReload.manualLock) return false;
    if(documentClosed || !dirty && !pendingSync) return true;
    if(!repository.repository && !savedFileLocation){setError(t("Conecte um destino para salvar a nota atual antes de importar outra."));return false;}
    let preserved=false;
    await run(async()=>{await save(`Save before importing ${name}`,undefined,true);preserved=true;},true);
    return preserved;
  };
  const canAutoSave = draftReady && !documentClosed && !documentConfirmation && !autoSavePaused && !sourceReload.change && !sourceReload.confirmation && !sourceReload.reloading && (!offline || browserMode || !!savedFileLocation) && (dirty || pendingSync) && !busy && !settingsOpen && !commitNoteOpen && !conflict;
  autoSaveCommit.current = () => {
    if (canAutoSave) {lastAutoSaveAttempt.current=Date.now();requestSave(true);}
  };
  autoSaveAction.current = () => {
    if(!canAutoSave||autoSaveChecking.current)return;
    // New edits still save immediately; unchanged pending synchronization retries less often.
    if(!dirty && pendingSync && Date.now()-lastAutoSaveAttempt.current<60000)return;
    autoSaveChecking.current=true;
    void sourceReload.allowAutoSave().then(allowed=>{if(allowed)autoSaveCommit.current();}).finally(()=>{autoSaveChecking.current=false;});
  };
  // Every platform saves in the background; legacy opt-out preferences are ignored.
  useEffect(() => {
    if (!repository.repository && !savedFileLocation) return;
    const interval = window.setInterval(() => autoSaveAction.current(), 5000);
    return () => window.clearInterval(interval);
  }, [repository.repository, savedFileLocation]);
  useEffect(() => {
    if (!canAutoSave || !repository.repository && !savedFileLocation) return;
    const timer = window.setTimeout(() => autoSaveAction.current(), 1000);
    return () => window.clearTimeout(timer);
  }, [canAutoSave, value, name, assets, repository.repository, savedFileLocation]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4500);
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
    const saveAsShortcut = (event:KeyboardEvent) => {
      if(event.isComposing || event.altKey || !event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase()!=='s')return;
      event.preventDefault();event.stopPropagation();
      if(!event.repeat && draftReady && !documentClosed && !busy && !settingsOpen && !operationLock.current && !document.querySelector('dialog[open]'))workbenchRef.current?.saveAs();
    };
    window.addEventListener('keydown',saveAsShortcut,true);return()=>window.removeEventListener('keydown',saveAsShortcut,true);
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
  const statusMessages = <>{error && <div role="alert" className="error toast"><CircleAlert className="toast-icon" size={20} aria-hidden="true"/><span className="toast-message">{error}</span><button data-ui="dismiss" type="button" aria-label={t("Dispensar erro")} onClick={() => setError("")}><X size={18} aria-hidden="true"/></button></div>}{notice && !error && <p role="status" className="notice toast"><CircleCheck className="toast-icon" size={20} aria-hidden="true"/><span className="toast-message">{notice}</span></p>}</>;
  async function prepareForAppUpdate() {
    if (!draftReady || operationLock.current || busy) return false;
    if (workbenchRef.current && !await workbenchRef.current.flushInput()) return false;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!latestDraft.current) return false;
    await persistDraft(latestDraft.current);
    return true;
  }
  return <main onPointerDownCapture={event=>{rememberInteractionControl(event);dismissDetailsMenus(event.target);}} onKeyDownCapture={rememberInteractionControl} aria-busy={busy} className="editor-app">{(!draftReady || openingDocument) && <DocumentLoading label={t("Abrindo documento…")}/>}<UpdateNotice webUpdate={pwa.updateAvailable} applyWebUpdate={pwa.applyUpdate} beforeUpdate={prepareForAppUpdate}/>{aboutOpen && <EditorDialog title={t("Sobre o Scriba")} onClose={() => setAboutOpen(false)}><div className="about-scriba"><img src="/icons/profile-v4/scribe-180.png" width="96" height="96" alt={t("Escriba egípcio, símbolo do Scriba")}/><h1>{t("Scriba")}</h1><p className="about-subtitle">{t("Suas ideias em Markdown")}</p><p>{t("Scriba vem do latim e significa escriba: quem registra e preserva a palavra escrita. O escriba egípcio da nossa marca representa esse cuidado com suas ideias — agora em notas Markdown que continuam suas.")}</p><dl><div><dt>{t("Versão")}</dt><dd>{__APP_VERSION__}</dd></div><div><dt>{t("Compilação")}</dt><dd><time dateTime={__BUILD_DATE__}>{new Date(__BUILD_DATE__).toLocaleDateString(currentLocale())}</time></dd></div><div><dt>{t("Edição")}</dt><dd>{isIosApp ? t("iPhone / iPad") : browserMode ? t("Web / PWA") : t("Local para Mac")}</dd></div><div><dt>{t("Desenvolvido por")}</dt><dd>{t("Aeon Bridge Co.")}</dd></div></dl><PoweredBy/><p className="about-links"><a href="https://github.com/ab-orbit/ab-markdow-editor" target="_blank" rel="noopener noreferrer" className="github-source" aria-label={t("Código-fonte e documentação")} title={t("Código-fonte e documentação")}><img src="/brand/github-mark.svg" width="23" height="23" alt=""/></a><a href="https://scriba.aeonbridge.app/privacy.html" target="_blank" rel="noopener noreferrer">{t("Privacidade")}</a> · <a href="https://scriba.aeonbridge.app/support.html" target="_blank" rel="noopener noreferrer">{t("Suporte")}</a></p></div></EditorDialog>}{settingsOpen && <section className="settings-page" id="settings-page" aria-labelledby="settings-title"><header className="settings-page-header"><div><button type="button" onClick={backToEditor} aria-label={t("Voltar ao editor")}><ArrowLeft size={20}/><span>{t("Editor")}</span></button><h1 id="settings-title" ref={settingsTitle} tabIndex={-1}>{t("Configurações")}</h1></div></header><div className="settings-content">
    <section className="repository" id="appearance-setting" aria-label={t('Aparência')}><h3>{t('Aparência')}</h3><label htmlFor="interface-appearance">{t('Tema')}</label><select id="interface-appearance" value={themePreference} onChange={event=>setTheme(event.target.value)}><option value="light">{t('Claro')}</option><option value="dark">{t('Escuro')}</option><option value="auto">{t('Automático (aparência do sistema)')}</option></select></section>
    <section className="repository" aria-label={t('Idioma da interface')}><h3>{t('Idioma da interface')}</h3><label htmlFor="interface-language">{t('Idioma')}</label><select id="interface-language" value={languagePreference()} onChange={event => {void changeInterfaceLanguage(event.target.value as LanguagePreference);}}><option value="auto">{t('Automático (idioma do dispositivo)')}</option><option value="pt">Português</option><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option></select><p>{t('A escolha do idioma altera apenas a interface. Suas notas e desenhos permanecem como foram escritos.')}</p></section>{browserMode && <StorageSettings folder={deviceFolder} busy={busy} canSwitch={discard}
      onChooseFolder={() => {if(!discard() || githubSelection())return;void run(async () => {const label=await chooseDeviceFolder();resetDocument();setDeviceFolder(label);const count=await importDeviceNotes();await syncDeviceNotes();setNotice(t("{0} notas carregadas. Pasta: {1}.", count, label));});}}
      onDisconnectFolder={() => {if(!discard())return;void run(async () => {await disconnectFolder();setDeviceFolder("");resetDocument();await refresh();});}}
      onGitHubChange={async () => {await disconnectFolder();setDeviceFolder("");resetDocument();await refresh();setNotice(t("Destino atualizado. Suas notas anteriores continuam preservadas separadamente."));}}/>}{browserMode && !isIosApp && <details className="repository desktop-git-help" aria-label={t("Sincronização com GitHub e Git")}><summary><FolderGit2 size={20}/>{' '}{t("GitHub / repositório Git")}</summary><p>{t("Use um repositório local ou clone uma URL Git. Na versão local, cada salvamento grava o arquivo, cria um commit e faz push usando suas credenciais.")}</p><div className="settings-actions"><a className="settings-action" href="http://127.0.0.1:43127/" target="_blank" rel="noopener noreferrer">{t("Abrir editor local com Git")}</a><a className="settings-action" href="https://github.com/ab-orbit/ab-markdow-editor#readme" target="_blank" rel="noopener noreferrer">{t("Instalar no Mac")}</a></div><p>{t("Abra o aplicativo Scriba no Mac antes de conectar. No editor local, abra Configurações para selecionar a pasta ou clonar o repositório. As notas deste site continuam separadas; use Baixar pacote e importe no editor local para transferi-las.")}</p><p>{t("No celular e tablet, use a seção GitHub acima para conectar sua conta e selecionar um repositório. O armazenamento no navegador e a pasta do dispositivo continuam como alternativas.")}</p></details>}{!browserMode && <details className="repository" open={!repository.repository || undefined}><summary className="repository-summary"><span className="repository-summary-content"><span className="repository-path"><FolderGit2 size={20}/><span>{repository.repository || t("Configurar repositório")}{repository.branch && ` · ${repository.branch}`}</span></span>{repository.repository && <span className="connection-status" data-state={repositoryConnected ? 'connected' : 'pending'}>{repositoryConnected ? <CircleCheck size={16} aria-hidden="true"/> : <CircleAlert size={16} aria-hidden="true"/>}{repositoryConnected ? t("Pasta conectada") : draftReady ? t("Serviço local indisponível") : t("Verificando conexão…")}</span>}</span></summary>{repository.repository && !repositoryConnected && draftReady && <p role="status">{t("O editor está aberto, mas o serviço de arquivos não respondeu. Seu rascunho está preservado. A reconexão é automática; se continuar indisponível, abra Scriba em Aplicativos.")}</p>}{repository.githubUrl && <p>{t("Repositório:")}{' '}<a href={repository.githubUrl} target="_blank" rel="noopener noreferrer">{repository.githubUrl.replace('https://github.com/', "")}</a></p>}<fieldset disabled={busy}>{repository.repository && <div className="settings-actions repository-management"><button type="button" onClick={() => setSwitchRepositoryOpen(true)}><ArrowRightLeft size={18}/>{t("Trocar repositório")}</button><button type="button" onClick={() => void disconnectRepository()}><Unplug size={18}/>{t("Desconectar")}</button></div>}{!repository.repository && <p>{t("Sem repositório conectado.")}{' '}{repository.previousRepository ? `Seus arquivos continuam em ${repository.previousRepository}.` : t("Selecione uma pasta ou clone um repositório para começar.")}{' '}{t("O documento aberto pode ser editado e exportado.")}</p>}{!repository.repository && !switchRepositoryOpen && <button type="button" onClick={() => setSwitchRepositoryOpen(true)}><FolderOpen size={18}/>{t("Conectar repositório")}</button>}{switchRepositoryOpen && <RepositorySwitch key={repository.repository || 'disconnected'} repository={repository.repository} source={repository.repository || repository.previousRepository || null} busy={busy} run={run} request={api} askCommitNote={preferences.askCommitNote} onComplete={completeRepositorySwitch} onCancel={() => setSwitchRepositoryOpen(false)}/>}{repository.repository && <><div className="repository-sync"><p aria-label={t("Alterações no repositório")}>{repository.status ? describeRepositoryChanges(repository.status) : t("Nenhuma alteração local pendente.")}</p><button type="button" disabled={busy} aria-label={t("Sincronizar repositório")} title={t("Sincronizar todas as alterações locais: criar commit e enviar ao remoto")} aria-busy={repositorySyncing} onClick={requestRepositorySync}><RefreshCw size={18}/></button></div>{repositorySyncFeedback && <p role="status" className="repository-sync-feedback" data-state={repositorySyncFeedback.state}>{repositorySyncFeedback.state === 'success' ? <CircleCheck size={18} aria-hidden="true"/> : repositorySyncFeedback.state === 'error' ? <CircleAlert size={18} aria-hidden="true"/> : <RefreshCw size={18} aria-hidden="true"/>}<span>{repositorySyncFeedback.message}</span></p>}</>}</fieldset></details>}<section className="save-preferences" aria-label={t("Preferências de salvamento")}><h3>{t("Edição, salvamento e sincronização")}</h3><form onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await api<SavePreferences>('preferences', preferenceDraft); setPreferences(saved); setPreferenceDraft(saved); setNotice(t("Preferências de salvamento atualizadas.")); }); }}><fieldset disabled={busy}><label className="check-option"><input type="checkbox" checked={preferenceDraft.doubleClickToEdit} onChange={event => setPreferenceDraft({ ...preferenceDraft, doubleClickToEdit: event.target.checked })}/>{t("Editar blocos com duplo clique")}</label>{(!browserMode || !!githubSelection()) && <label className="check-option"><input type="checkbox" checked={preferenceDraft.askCommitNote} onChange={event => setPreferenceDraft({ ...preferenceDraft, askCommitNote: event.target.checked })}/>{t("Perguntar nota do commit a cada salvamento")}</label>}<label className="check-option"><input type="checkbox" disabled checked={true} onChange={event => setPreferenceDraft({ ...preferenceDraft, autoSave: event.target.checked })}/>{t("Ativar salvamento automático")}</label><p>{browserMode ? t("O automático salva no destino selecionado enquanto esta aba estiver aberta. Se houver conexão GitHub, envia as alterações em um commit.") : t("O automático salva, cria o commit e envia ao remoto enquanto esta aba estiver aberta. Se pedir nota estiver ligado, aguarda a confirmação antes de salvar.")}</p><button type="submit">{t("Salvar preferências")}</button></fieldset></form></section><details className="pwa-settings"><summary>{t("Sobre o Scriba")}</summary><div className="pwa-brand"><img src={brandIcon} width="64" height="64" alt={t("Escriba egípcio do AB Markdown")}/><div><h3>{t("Scriba · Suas ideias em Markdown")}</h3><p>{isIosApp ? t("iPhone / iPad") : <>{pwa.standalone ? t("Aplicativo instalado") : t("Aplicativo web instalável")} · {pwa.ready ? t("Disponível offline") : t("Preparando modo offline")}</>}</p></div></div>{!isIosApp && pwa.canInstall && <button type="button" onClick={() => void pwa.install()}><Download size={18}/>{t("Instalar aplicativo")}</button>}{!isIosApp && !pwa.canInstall && !pwa.standalone && <p>{t("Use a opção de instalar aplicativo do navegador. No Safari do Mac, use Arquivo → Adicionar ao Dock.")}</p>}<p>{isIosApp ? t("Notas e rascunhos ficam neste aplicativo. Você pode escolher uma pasta em Files ou conectar um repositório GitHub. Ao desinstalar o Scriba, as cópias privadas do aplicativo são removidas; os arquivos exportados para Files e GitHub continuam no destino escolhido.") : browserMode ? t("Sem integração, notas e imagens ficam neste navegador. Ao conectar GitHub, as notas são enviadas ao repositório escolhido pelo serviço de sincronização. Limpar os dados do site remove as cópias locais; exporte ZIPs para backup. Google Drive está previsto.") : t("Rascunhos e imagens ficam neste navegador. No Mac, o Scriba mantém o serviço de arquivos ativo automaticamente após a instalação. O editor reconecta quando o serviço volta; enviar ao GitHub também exige conexão com a internet.")}</p>{pwa.updateAvailable && <p>{t("Uma atualização do Scriba está pronta.")}</p>}</details>{statusMessages}</div></section>}{conflict && <EditorDialog title={t("Resolver versões do arquivo")} className="file-conflict-dialog" onClose={() => setConflict(null)}><p><strong>{conflict.name}</strong></p><p>{conflict.kind === 'exists' ? t("Já existe um arquivo com esse nome na pasta.") : conflict.kind === 'deleted' ? t("O arquivo foi removido do disco desde a abertura.") : t("A nota mudou desde a abertura.")}{' '}{t("Seu texto continua intacto no editor.")}</p><p>{savedFileLocation ? t("Use Salvar como para manter as duas versões em locais diferentes. A substituição explícita guarda uma cópia de recuperação privada antes de gravar.") : browserMode ? t("Salve uma cópia para manter as duas versões ou confirme a substituição da nota neste navegador.") : t("Salve uma cópia para manter os dois arquivos ou confirme a substituição. Antes de substituir, a versão do disco será guardada em Application Support/AB Markdown/conflict-backups.")}</p>{savedFileLocation ? <footer><button type="button" onClick={() => setConflict(null)}>{t("Continuar editando")}</button><button type="button" onClick={event => {event.currentTarget.closest<HTMLDialogElement>('dialog')?.close();setConflict(null);workbenchRef.current?.saveAs();}}>{t("Salvar como…")}</button><button type="button" disabled={busy} onClick={() => void run(() => save(lastSaveNote.current, {name: conflict.name, version: conflict.currentVersion, backupBeforeReplace: true}))}>{t("Substituir arquivo existente")}</button></footer> : <form onSubmit={event => { event.preventDefault(); void run(() => save(lastSaveNote.current, {name: copyName, version: null})); }}><label>{t("Nome da cópia")}<input required value={copyName} onChange={event => setCopyName(event.target.value)}/></label><footer><button type="button" onClick={() => setConflict(null)}>{t("Continuar editando")}</button><button type="submit" disabled={busy}>{t("Salvar uma cópia")}</button><button type="button" disabled={busy} onClick={() => void run(() => save(lastSaveNote.current, {name: conflict.name, version: conflict.currentVersion, backupBeforeReplace: true}))}>{t("Substituir arquivo existente")}</button></footer></form>}</EditorDialog>}{documentConfirmation && <EditorDialog title={documentConfirmation === 'whiteboard' ? t("Salvar antes de criar um whiteboard?") : documentConfirmation === 'new' ? t("Salvar antes de criar uma nova nota?") : t("Salvar antes de fechar?")} className="close-document-dialog" onClose={() => setDocumentConfirmation(null)}><p><strong>{name}</strong>{' '}{t("tem")}{' '}{dirty ? t("alterações não salvas") : t("uma sincronização pendente")}.</p><p>{documentConfirmation !== 'close' ? t("Salvar e criar") : t("Salvar e fechar")}{' '}{t("conclui o salvamento no destino configurado")}{!savedFileLocation && (!browserMode || githubSelection()) ? t(", incluindo commit e envio ao repositório") : ""}. {documentConfirmation !== 'close' ? t("Descartar e criar") : t("Fechar sem salvar")}{' '}{t("descarta o rascunho desta aba; o arquivo já salvo é preservado.")}</p>{!repository.repository && !savedFileLocation && <p>{t("Conecte um destino nas configurações para salvar. Você também pode cancelar e baixar a nota pela barra de ferramentas.")}</p>}<footer><button type="button" autoFocus onClick={() => setDocumentConfirmation(null)}>{t("Cancelar")}</button><button type="button" onClick={() => void finishDocument(documentConfirmation)}>{documentConfirmation !== 'close' ? t("Descartar e criar") : t("Fechar sem salvar")}</button><button type="button" className="primary" disabled={!repository.repository && !savedFileLocation} onClick={() => requestSave(false, documentConfirmation)}><Save size={16} aria-hidden="true"/>{documentConfirmation !== 'close' ? t("Salvar e criar") : t("Salvar e fechar")}</button></footer></EditorDialog>}{commitNoteOpen && <EditorDialog title={t("Nota do commit")} onClose={() => {setCommitNoteOpen(false);setAfterCommitAction(null);}}><form onSubmit={event => { event.preventDefault(); if (!commitNote.trim()) return; setCommitNoteOpen(false); setAfterCommitAction(null); if(commitTarget === 'repository')void run(() => syncRepository(commitNote.trim()));else void saveDocument(commitNote.trim(), afterCommitAction); }}><label>{t("Nota do commit")}<textarea autoFocus required maxLength={1000} value={commitNote} onChange={event => setCommitNote(event.target.value)} placeholder={t("Descreva o que mudou")}/></label><footer><button type="button" onClick={() => {setCommitNoteOpen(false);setAfterCommitAction(null);}}>{t("Cancelar")}</button><button type="submit" disabled={!commitNote.trim()}>{commitTarget === 'repository' ? t("Commit e push") : afterCommitAction && afterCommitAction !== 'close' ? t("Salvar, sincronizar e criar") : afterCommitAction === 'close' ? t("Salvar, sincronizar e fechar") : t("Salvar, commit e push")}</button></footer></form></EditorDialog>}{sourceReload.confirmation && <EditorDialog title={reloadLabel} onClose={sourceReload.cancel}><p>{t("Há edições ou uma sincronização pendente. Recarregar substitui a versão mantida neste editor pela versão da origem.")}</p><footer className="reload-confirmation"><button type="button" onClick={sourceReload.cancel}>{t("Continuar editando")}</button><button type="button" onClick={event => {
      // Release only this confirmation before the reload checks for other open dialogs.
      event.currentTarget.closest<HTMLDialogElement>('dialog')?.close();
      sourceReload.confirm();
    }}>{t("Recarregar e descartar rascunho")}</button></footer></EditorDialog>}{!settingsOpen && statusMessages}<div className="editor-layout" hidden={settingsOpen} inert={settingsOpen || undefined}>{notesOpen && <aside id="recent-notes" className="notes-sidebar" aria-label={t("Notas recentes")}><div className="notes-heading notes-commandbar"><details className="notes-menu" data-ui-menu onKeyDown={handleDetailsMenu} onToggle={event=>closeOtherDetailsMenus(event.currentTarget)}><summary>{t("Notas")}<ChevronDown size={14} aria-hidden="true"/></summary><div className="notes-menu-content" data-ui="action-menu"><p>{query ? t("{0} resultados", visibleNotes.length + visiblePinned.length) : t("{0} notas", recentNotes.length + pinnedNotes.length)}</p><input ref={notesImportInput} type="file" hidden multiple accept=".md,.markdown,.mdown,text/markdown" aria-label={t("Arquivos de notas")} disabled={busy || !draftReady || !repository.repository || (offline && !browserMode)} onChange={event => { const selected = Array.from(event.target.files ?? []); event.target.value = ''; void importNotes(selected); }}/><button type="button" disabled={busy || !draftReady || !repository.repository || (offline && !browserMode)} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); notesImportInput.current?.click(); }}><Upload size={16} aria-hidden="true"/>{t("Importar notas")}</button><button type="button" aria-label={t("Atualizar notas recentes")} disabled={busy || !repository.repository || (offline && !browserMode)} onClick={() => void run(async () => { await refresh(); })}><RefreshCw size={16}/>{t("Atualizar notas")}</button><button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');window.dispatchEvent(new Event('scriba:show-appearance'));}}><Sun size={16}/>{t("Aparência")}</button><button type="button" aria-label={t("Sobre o Scriba")} onClick={() => setAboutOpen(true)}><img src={brandIcon} width="18" height="18" alt={""}/>{t("Sobre o Scriba")}</button></div></details><div className="notes-header-actions"><button type="button" disabled={busy || !draftReady} aria-label={t("Nova nota")} aria-keyshortcuts="Meta+Shift+Enter Control+Shift+Enter" title={t("Nova nota (⌘⇧Enter / Ctrl+Shift+Enter)")} onClick={() => void requestNewNote()}><SquarePen size={18}/></button><button type="button" disabled={busy || !draftReady} aria-label={t("Novo whiteboard")} title={t("Novo whiteboard")} onClick={() => void requestNewNote('whiteboard')}><PenTool size={18}/></button><button type="button" aria-label={noteSearchOpen ? t("Ocultar busca de notas") : t("Mostrar busca de notas")} title={t("Buscar notas")} aria-expanded={noteSearchOpen} onClick={() => { setNoteSearchOpen(!noteSearchOpen); if (!noteSearchOpen) requestAnimationFrame(() => noteSearchInput.current?.focus()); }}><Search size={18}/></button><button data-ui="dismiss" type="button" className="close-notes" aria-label={t("Fechar lista de notas")} onClick={() => setNotesOpen(false)}><X size={18}/></button></div></div>{noteSearchOpen && <label className="notes-search"><Search size={16} aria-hidden="true"/><input ref={noteSearchInput} type="search" aria-label={t("Buscar nas notas recentes")} placeholder={t("Buscar notas…")} value={noteSearch} onChange={event => setNoteSearch(event.target.value)}/></label>}{query && !visibleNotes.length && !visiblePinned.length && <p className="notes-empty">{t("Nenhuma nota encontrada.")}</p>}{!repository.repository && <p className="notes-empty">{t("Conecte um repositório nas configurações para listar suas notas.")}</p>}{repository.repository && !recentNotes.length && !pinnedNotes.length && <p className="notes-empty">{offline ? t("Abra o aplicativo local para carregar a lista.") : t("Nenhuma nota Markdown encontrada.")}</p>}<nav aria-label={t("100 notas mais recentes")}>{noteGroups.map(group => <section className="note-group" key={group.label} aria-label={group.label}><h3>{group.label}</h3><ol>{group.notes.map(note => <li className="note-row" key={note.name} data-note={note.name}><button className="open-note" type="button" disabled={busy || !draftReady || (offline && !browserMode)} aria-current={name === note.name && version ? 'page' : undefined} title={note.name} aria-label={note.name} onClick={() => void openNote(note.name)}><span><strong>{note.title || note.name.split('/').at(-1)}</strong>{note.preview && <span className="note-preview">{note.preview}</span>}{note.hasImage && <NoteThumbnail repository={repository.repository} name={note.name} modifiedAt={note.modifiedAt}/>}<time dateTime={note.modifiedAt} title={new Date(note.modifiedAt).toLocaleString(currentLocale())}>{group.pinned && <Pin size={11} aria-label={t("Nota fixada")}/>}{shortNoteDate(note.modifiedAt, dateClock)}</time></span></button><button className="pin-note" type="button" disabled={busy || (offline && !browserMode)} aria-label={`${group.pinned ? t("Desafixar") : t("Fixar")} ${note.name}`} title={group.pinned ? t("Desafixar nota") : t("Fixar nota")} onClick={() => void togglePin(note, !group.pinned)}>{group.pinned ? <PinOff size={14}/> : <Pin size={14}/>}</button></li>)}</ol></section>)}</nav></aside>}<fieldset disabled={!draftReady || busy || sourceReload.manualLock} className="editor-container">{documentClosed && <section className="empty-document" aria-label={t("Nenhuma nota aberta")}><div className="empty-document-toolbar"><button type="button" aria-controls="recent-notes" aria-expanded={notesOpen} aria-label={notesOpen ? t("Ocultar notas recentes") : t("Mostrar notas recentes")} title={t("Notas recentes")} onClick={() => setNotesOpen(open => !open)}><PanelLeft size={18}/></button><button type="button" aria-label={theme === 'dark' ? t("Usar tema claro") : t("Usar tema escuro")} title={t("Alternar tema")} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button type="button" aria-label={t("Configurações")} title={t("Configurações")} onClick={() => setSettingsOpen(true)}><Settings size={18}/></button></div><div className="empty-document-content"><img src={brandIcon} width="64" height="64" alt={""}/><h1 ref={emptyTitle} tabIndex={-1}>{t("Nenhuma nota aberta")}</h1><p>{t("Escolha uma nota na lista, abra um arquivo ou comece uma nova.")}</p><div><button type="button" className="primary" aria-keyshortcuts="Meta+O Control+O" onClick={requestOpen}><FolderOpen size={18}/>{t("Abrir arquivo")}{' '}<kbd>{t("⌘O")}</kbd></button><button type="button" aria-keyshortcuts="Meta+Shift+Enter Control+Shift+Enter" title={t("Nova nota (⌘⇧Enter / Ctrl+Shift+Enter)")} onClick={() => void requestNewNote()}><FilePlus2 size={18}/>{t("Nova nota")}{' '}<kbd>{t("⌘⇧Enter")}</kbd></button></div></div></section>}<div className="workbench-container" hidden={documentClosed}><MarkdownWorkbench onBeforeImport={() => prepareImportAction.current()} existingFileNames={files} onOpenSettings={()=>setSettingsOpen(true)} modifiedAt={version ? [...pinnedNotes,...recentNotes].find(note=>note.name===loadedName)?.modifiedAt : undefined} createdAt={version ? [...pinnedNotes,...recentNotes].find(note=>note.name===loadedName)?.createdAt : undefined} ref={workbenchRef} diagramScope={`${repository.repository || "browser"}:${finderSourceId || name}`} warnBeforeUnload={false} onClose={requestClose} onSave={() => requestSave()} onDuplicate={duplicateDocument} onRename={!savedFileLocation ? renameDocument : undefined} onSaveAs={adoptSavedFile} sourceId={finderSourceId} savedFileLocation={savedFileLocation} compact initialScrollTop={reloadScrollTop.current} initialMode={reloadMode || (version || importedVersion || finderSourceId ? 'read' : 'live')} doubleClickToEdit={preferences.doubleClickToEdit} onModeChange={reportMode} key={documentId} value={value} onChange={source => {setValue(source);if(automaticNoteName.current)setName(newNoteName(source, files, newDocumentCreatedAt.current));}} fileName={name} onFileNameChange={newName => { automaticNoteName.current=false; setDocumentClosed(false);setFinderSourceId(null);setSavedFileLocation(null);setName(newName); setVersion(null); setLoadedName(""); setImportedVersion(null); }} onImport={registerImport} initialAssets={initialAssets} onAssetsChange={handleAssets} saveRevision={saveRevision} readOnly={!draftReady || busy || sourceReload.manualLock} sourceStatus={sourceReload.change && <div className="source-change" role="status"><CircleAlert size={18} aria-hidden="true"/><span>{sourceReload.change.kind === 'deleted' ? t("O arquivo foi removido da origem. Seu texto continua no editor.") : sourceReload.change.kind === 'error' ? t("Não foi possível recarregar: {0}", sourceReload.change.message) : dirty || pendingSync ? t("A nota mudou fora do Scriba. Suas edições foram mantidas.") : sourceReload.reloading ? t("Carregando atualização da origem…") : t("Há uma versão mais recente na origem.")}</span>{sourceReload.change.kind !== 'deleted' && <button type="button" disabled={sourceReload.reloading} onClick={sourceReload.request}>{reloadLabel}</button>}</div>} actions={<><button type="button" aria-controls="recent-notes" aria-expanded={notesOpen} aria-label={notesOpen ? t("Ocultar notas recentes") : t("Mostrar notas recentes")} title={t("Notas recentes")} onClick={() => setNotesOpen(open => !open)}><PanelLeft size={18}/></button>{offline && <span className="offline-indicator" aria-label={t("Modo offline")}><CloudOff size={16}/><span>{t("Offline")}</span></span>}<button type="button" aria-label={reloadLabel} title={t("{0}{1}", reloadTitle, sourceReload.change ? t(" — alteração externa detectada") : '')} className={sourceReload.change ? 'source-reload-pending' : undefined} disabled={busy || sourceReload.reloading || name !== loadedName || !canReloadSource && !reloadFromPicker} aria-busy={sourceReload.reloading} onClick={() => reloadFromPicker ? workbenchRef.current?.openFile(true) : sourceReload.request()}><RotateCw size={18}/></button></>} saveAction={<>{(repository.repository || savedFileLocation) && <button type="button" disabled={busy} aria-keyshortcuts="Meta+S Control+S" aria-label={savedFileLocation ? t("Salvar arquivo local") : browserMode ? t("Salvar nota") : t("Salvar no repositório")} title={savedFileLocation ? t("Salvar em {0} (⌘S)", savedFileLocation) : browserMode ? t("Salvar nota (⌘S)") : t("Salvar no repositório (⌘S)")} onClick={() => requestSave()}><Save size={18}/></button>}</>} appearanceActions={<><button type="button" aria-label={theme === 'dark' ? t("Usar tema claro") : t("Usar tema escuro")} title={theme === 'dark' ? t("Usar tema claro") : t("Usar tema escuro")} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button type="button" aria-label={t("Configurações")} title={t("Configurações")} aria-controls="settings-page" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings size={18}/></button></>}/></div></fieldset></div></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
