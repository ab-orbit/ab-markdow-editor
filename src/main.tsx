import {canChooseFolder, chooseDeviceFolder, folderLabel, disconnectFolder, authorizeDeviceFolder, saveToDeviceFolder} from './lib/deviceFolder';
import {browserMode} from './lib/browserStore';
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderGit2, FolderOpen, Save, Upload, Sun, Moon, FilePlus2, Settings, X, Download, CloudOff, PanelLeft, FileText, RefreshCw, Search, Pin, PinOff } from 'lucide-react';
import { MarkdownWorkbench } from './components/Markdown/MarkdownWorkbench';
import { NoteThumbnail } from './NoteThumbnail';
import { noteGroup, shortNoteDate } from './lib/noteDates';
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
}
interface SavePreferences {
  /** Ask for a commit note before each manual or scheduled save. */
  askCommitNote: boolean;
  /** Enable scheduled save/commit/push while the editor is open. */
  autoSave: boolean;
  /** Schedule interval in whole minutes, between 1 and 1440. */
  intervalMinutes: number;
}
interface SaveResult {
  /** Hash of the content successfully written to disk, even if Git failed. */
  version: string;
  /** Whether the saved document has been committed and pushed. */
  synced: boolean;
  /** Git operation that remains pending after a partial failure. */
  stage?: 'commit' | 'push';
  /** Readable Git failure returned with a successful local save. */
  error?: string;
}
const defaultPreferences: SavePreferences = { askCommitNote: false, autoSave: false, intervalMinutes: 1 };
interface DocumentFile {
  /** Document-relative image path. */
  path: string;
  /** Base64 encoded raster bytes. */
  data: string;
  /** Validated raster MIME type. */
  mime: string;
}
interface LoadedDocument {
  /** Canonical UTF-8 Markdown source. */
  value: string;
  /** Content hash used for optimistic concurrency. */
  version: string;
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
function App() {
  const pwa = usePwa();
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
    const id = sessionStorage.getItem('ab-markdown-draft-id') || crypto.randomUUID();
    sessionStorage.setItem('ab-markdown-draft-id', id); return id;
  });
  const latestDraft = useRef<DraftSnapshot | null>(null);
  const restoringAssets = useRef(false);
  const handleAssets = useCallback((items: MarkdownAsset[]) => {
    if (restoringAssets.current && !items.length) return;
    restoringAssets.current = false; setAssets(items);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {const showNotes=()=>setNotesOpen(true);window.addEventListener('scriba:show-notes',showNotes);return()=>window.removeEventListener('scriba:show-notes',showNotes);}, []);
  const [repository, setRepository] = useState<RepositoryInfo>({ repository: null, branch: '', status: '' });
  const [directory, setDirectory] = useState('');
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');
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
  const [initialAssets, setInitialAssets] = useState<{path: string; file: File}[]>([]);
  const [documentId, setDocumentId] = useState(0);
  const [saveRevision, setSaveRevision] = useState(0);
  const [preferences, setPreferences] = useState<SavePreferences>(defaultPreferences);
  const [preferenceDraft, setPreferenceDraft] = useState<SavePreferences>(defaultPreferences);
  const [commitNoteOpen, setCommitNoteOpen] = useState(false);
  const [commitNote, setCommitNote] = useState('');
  const [pendingSync, setPendingSync] = useState(false);
  const operationLock = useRef(false);
  const autoSaveAction = useRef<() => void>(() => {});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ab-markdown-theme') || 'dark');
  const dirty = value !== baseline || name !== loadedName;
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ab-markdown-theme', theme); }, [theme]);
  async function refreshLibrary() {
    const library = await api<NoteLibrary>('library/initialize', {});
    setRecentNotes(library.recent); setPinnedNotes(library.pinned);
    if (library.synchronization && !library.synchronization.synced) setError(`Guia criado localmente; sincronização pendente: ${library.synchronization.error}`);
  }
  async function togglePin(note: RecentNote, pinned: boolean) {
    await run(async () => {
      const library = await api<NoteLibrary>('pin', {name:note.name, pinned});
      setRecentNotes(library.recent); setPinnedNotes(library.pinned);
    });
  }
  async function refresh() {
    if(browserMode && await folderLabel()) await api('folder/import',{});
    const info = await api<RepositoryInfo>('repository'); setRepository(info);
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
        setRepository(restored.repository); setName(restored.name); setLoadedName(restored.loadedName);
        setValue(restored.value); setBaseline(restored.baseline); setVersion(restored.version);
        setImportedVersion(restored.importedVersion); setPendingSync(restored.pendingSync);
        setPreferences(restored.preferences); setPreferenceDraft(restored.preferences);
        restoringAssets.current = restored.assets.length > 0;
        setAssets(restored.assets.map(asset => ({ ...asset, url: '' })));
        setInitialAssets(restored.assets); setDocumentId(id => id + 1);
      }
      try {
        const [info, saved] = await Promise.all([api<RepositoryInfo>('repository'), api<SavePreferences>('preferences')]);
        if (!active) return;
        if (restored?.repository.repository && restored.repository.repository !== info.repository) {
          setError('O rascunho pertence a outro repositório. Reconecte a pasta nas configurações antes de salvar.');
          setSettingsOpen(true);
        } else {
          setRepository(info); setFiles(info.repository ? await api<string[]>('files') : []);
          if (info.repository) await refreshLibrary(); else { setRecentNotes([]); setPinnedNotes([]); }
          if (!info.repository) setSettingsOpen(true);
        }
        if (!active) return;
        const finderId = !browserMode && new URLSearchParams(location.search).get('finder');
        if (finderId) {
          const doc = await api<LoadedDocument & {name:string;inRepository:boolean}>(`finder-document?id=${encodeURIComponent(finderId)}`);
          if (!active) return;
          const attached = doc.files.map(file => ({path:file.path,file:new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, {type:file.mime})}));
          resetDocument(doc.value, doc.name, doc.inRepository ? doc.version : null, attached);
          if(!doc.inRepository) setImportedVersion({name:doc.name,version:doc.version});
          history.replaceState(null, '', location.pathname);
          setSettingsOpen(false);setNotice(doc.inRepository ? 'Documento do Finder aberto no repositório.' : 'Documento do Finder importado. Salvar usará o repositório configurado; o original fica preservado.');
        }
        setPreferences(saved); setPreferenceDraft(saved); setOffline(false);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof LocalApiError) { setError(cause.message); setSettingsOpen(true); setOffline(false); }
        else setOffline(true);
        if (restored) setNotice('Rascunho recuperado no navegador. Continue editando offline; o Git sincroniza quando o aplicativo local voltar.');
        else setNotice('Modo offline. Abra ou escreva um Markdown; seu rascunho fica neste navegador.');
      } finally { if (active) setDraftReady(true); }
    })();
    return () => { active = false; };
  }, [draftId]);
  useEffect(() => {
    if (!draftReady) return;
    const snapshot: DraftSnapshot = {id: draftId, repository, name, loadedName, value, baseline, version, importedVersion, pendingSync, assets: assets.map(({path,file}) => ({path,file})), preferences, updatedAt: Date.now()};
    latestDraft.current = snapshot;
    void persistDraft(snapshot).catch(() => setError('Não foi possível guardar o rascunho no navegador. Baixe o Markdown ou pacote para preservar suas alterações.'));
  }, [draftReady, draftId, repository, name, loadedName, value, baseline, version, importedVersion, pendingSync, assets, preferences]);
  useEffect(() => {
    const flush = () => { if (latestDraft.current) void persistDraft(latestDraft.current).catch(() => {}); };
    const online = () => setOffline(false), disconnected = () => setOffline(true);
    window.addEventListener('pagehide', flush); window.addEventListener('online', online); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('pagehide', flush); window.removeEventListener('online', online); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function run(action: () => Promise<void>) {
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
  async function chooseRepository() {
    if (!discard()) return;
    await run(async () => {
      const picked = await api<{directory: string | null}>('pick-folder', {});
      if (!picked.directory) return;
      setDirectory(picked.directory);
      const info = await api<RepositoryInfo>('connect', { directory: picked.directory });
      setRepository(info); resetDocument(); await refresh(); setSettingsOpen(false); setNotice('Repositório conectado.');
    });
  }
  async function chooseCloneDestination() {
    await run(async () => {
      const picked = await api<{directory: string | null}>('pick-folder', {});
      if (!picked.directory) return;
      const repositoryName = url.trim().split('/').at(-1)?.replace(/\.git$/, '').replace(/[^a-zA-Z0-9._-]/g, '-') || 'meu-repositorio';
      setDestination(`${picked.directory.replace(/\/$/, '')}/${repositoryName}`);
      setNotice('Pasta de destino selecionada. Clique em Clonar e conectar.');
    });
  }
  const discard = () => !dirty || window.confirm('Há alterações não salvas. Deseja substituí-las?');
  function resetDocument(text = '', fileName = 'documento.md', hash: string | null = null, attached: {path: string; file: File}[] = []) {
    setValue(text); setBaseline(text); setName(fileName); setLoadedName(fileName); setVersion(hash);
    setImportedVersion(null); setConflict(null); setPendingSync(false); restoringAssets.current = attached.length > 0; setAssets(attached.map(asset => ({...asset,url:''}))); setInitialAssets(attached); setDocumentId(id => id + 1); setSaveRevision(0);
  }
  async function openNote(fileName: string) {
    if (!discard()) return;
    await run(async () => {
      const doc = await api<LoadedDocument>(`document?name=${encodeURIComponent(fileName)}`);
      const attached = doc.files.map(file => ({ path: file.path, file: new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, { type: file.mime }) }));
      resetDocument(doc.value, fileName, doc.version, attached); setSelected(fileName); setSettingsOpen(false);
      if (window.matchMedia('(max-width: 899px)').matches) setNotesOpen(false);
      setNotice(doc.warnings.length ? `Aberto com avisos: ${doc.warnings.join('; ')}` : 'Documento aberto.');
    });
  }
  async function registerImport(source: string, fileName: string) {
    await run(async () => {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      const originalVersion = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
      setImportedVersion({ name: fileName, version: originalVersion });
      setBaseline(source); setLoadedName(fileName); setVersion(null); setPendingSync(true); setConflict(null);
    });
  }
  async function save(note: string, target?: {name: string; version: string | null; backupBeforeReplace?: boolean}) {
    lastSaveNote.current = note;
    const targetName = target?.name ?? name;
    const expected = target ? target.version : name === loadedName ? version : null;
    const baseVersion = !target && importedVersion?.name === name ? importedVersion.version : undefined;
    const result = await api<SaveResult>('save-sync', { repository: repository.repository, name: targetName, value, message: note, version: expected, baseVersion, backupBeforeReplace: target?.backupBeforeReplace, files: await Promise.all(assets.map(encodeAsset)) });
    setOffline(false); setName(targetName); setVersion(result.version); setBaseline(value); setLoadedName(targetName); setSaveRevision(revision => revision + 1);
    setImportedVersion(null); setConflict(null); setPendingSync(!result.synced);
    await refresh();
    if (result.synced) setNotice(browserMode ? (deviceFolder ? `Nota salva em ${deviceFolder}.` : 'Nota salva neste navegador.') : 'Arquivo salvo, commit criado e enviado ao remoto.');
    else if(browserMode) setError(`Nota preservada no navegador; cópia na pasta pendente. ${result.error}`);
    else setError(`Arquivo salvo localmente. ${result.stage === 'commit' ? 'Commit pendente' : 'Push pendente'}: ${result.error} Use Salvar novamente para tentar sincronizar.`);
  }
  function requestSave(automatic = false) {
    if (!draftReady || operationLock.current || busy || commitNoteOpen || conflict || !repository.repository) return;
    if (preferences.askCommitNote) {
      setCommitNote(''); setSettingsOpen(false); setCommitNoteOpen(true);
    } else void run(() => save(`${automatic ? 'Auto-save' : 'Update'} ${name}`));
  }
  autoSaveAction.current = () => {
    if (draftReady && (!offline || browserMode) && (dirty || pendingSync) && !busy && !settingsOpen && !commitNoteOpen && !conflict) requestSave(true);
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
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (repository.repository && !busy) requestSave();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  const statusMessages = <>{error && <div role="alert" className="error toast">{error}<button aria-label="Dispensar erro" onClick={() => setError('')}><X size={18}/></button></div>}{notice && <p role="status" className="notice toast">{notice}</p>}</>;
  return <main aria-busy={busy} className="editor-app">
    {aboutOpen && <EditorDialog title="Sobre o Scriba" onClose={() => setAboutOpen(false)}><div className="about-scriba"><img src="/icons/profile-v3/scribe-180.png" width="96" height="96" alt="Escriba egípcio, símbolo do Scriba"/><h1>Scriba</h1><p className="about-subtitle">AB Markdown Editor</p><p>Scriba vem do latim e significa escriba: quem registra e preserva a palavra escrita. O escriba egípcio da nossa marca representa esse cuidado com suas ideias — agora em notas Markdown que continuam suas.</p><dl><div><dt>Versão</dt><dd>{__APP_VERSION__}</dd></div><div><dt>Compilação</dt><dd><time dateTime={__BUILD_DATE__}>{new Date(__BUILD_DATE__).toLocaleDateString('pt-BR')}</time></dd></div><div><dt>Edição</dt><dd>{browserMode ? 'Web / PWA' : 'Local para Mac'}</dd></div><div><dt>Desenvolvido por</dt><dd>Aeon Bridge Co.</dd></div></dl><p>Powered by Aeon Bridge Co. — offered to community.</p><a href="https://github.com/ab-orbit/ab-markdow-editor" target="_blank" rel="noopener noreferrer">Código-fonte e documentação</a></div></EditorDialog>}
    {settingsOpen && <EditorDialog title="Configurações" onClose={() => setSettingsOpen(false)}>
    <div className="settings-content">
    <section className="pwa-settings" aria-label="Aplicativo PWA">
      <div className="pwa-brand"><img src={brandIcon} width="64" height="64" alt="Escriba egípcio do AB Markdown"/><div><h3>Scriba · AB Markdown Editor</h3><p>{pwa.standalone ? 'Aplicativo instalado' : 'Aplicativo web instalável'} · {pwa.ready ? 'Disponível offline' : 'Preparando modo offline'}</p></div></div>
      {pwa.canInstall && <button type="button" onClick={() => void pwa.install()}><Download size={18}/>Instalar aplicativo</button>}
      {!pwa.canInstall && !pwa.standalone && <p>Use a opção de instalar aplicativo do navegador. No Safari do Mac, use Arquivo → Adicionar ao Dock.</p>}
      <p>{browserMode ? 'Notas e imagens ficam somente neste navegador e dispositivo, sem envio ao servidor. Limpar os dados do site remove as notas. Exporte ZIPs para backup. Git remoto por usuário e Google Drive estão previstos; a versão local para Mac já oferece Git.' : 'Rascunhos e imagens ficam neste navegador. Para gravar na pasta e sincronizar o Git, o aplicativo local precisa estar em execução.'}</p>
      {pwa.updateAvailable && <p>Atualização pronta. Seus rascunhos estão preservados; feche as janelas do editor e abra novamente quando terminar.</p>}
    </section>
    {browserMode && <section className="storage-settings" aria-label="Pasta de notas"><h3>Onde guardar suas notas</h3><p>{deviceFolder ? `Pasta selecionada: ${deviceFolder}` : 'Armazenamento privado neste navegador'}</p>{canChooseFolder() ? <div className="settings-actions"><button disabled={busy} onClick={() => {void run(async () => {const label=await chooseDeviceFolder();setDeviceFolder(label);const count=await importDeviceNotes();await syncDeviceNotes();setSettingsOpen(false);setNotesOpen(true);setNotice(`${count} notas carregadas. Pasta: ${label}.`);});}}><FolderOpen size={18}/>Selecionar pasta em Files</button>{deviceFolder && <><button disabled={busy} onClick={() => void run(async () => {await authorizeDeviceFolder();const count=await importDeviceNotes();await syncDeviceNotes();setSettingsOpen(false);setNotesOpen(true);setNotice(`Pasta lida: ${count} notas disponíveis na lista.`);})}>Autorizar pasta e carregar notas</button><button onClick={() => void run(async () => {await disconnectFolder();setDeviceFolder('');})}>Usar somente navegador</button></>}</div> : <p>Este navegador não oferece acesso de gravação a pastas do Files. Suas notas ficam neste navegador; use Baixar pacote para salvar um ZIP em Files. No iPhone/iPad, o acesso contínuo a pastas exige um aplicativo nativo.</p>}<p>Escolha a pasta principal: o Scriba cria uma subpasta scriba e copia as notas salvas e imagens para ela. Rascunhos continuam protegidos no navegador. Arquivos alterados fora do editor não são sobrescritos. Git remoto e Google Drive serão opções adicionais.</p></section>}
    <div className="settings-theme"><span>Aparência</span><button aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}Tema {theme === 'dark' ? 'claro' : 'escuro'}</button></div>
    {browserMode && <section className="repository" aria-label="Sincronização com GitHub e Git"><h3><FolderGit2 size={20}/> GitHub / repositório Git</h3><p>Use um repositório local ou clone uma URL Git. Na versão local, cada salvamento grava o arquivo, cria um commit e faz push usando suas credenciais.</p><div className="settings-actions"><a className="settings-action" href="http://127.0.0.1:43127/" target="_blank" rel="noopener noreferrer">Abrir editor local com Git</a><a className="settings-action" href="https://github.com/ab-orbit/ab-markdow-editor#readme" target="_blank" rel="noopener noreferrer">Instalar no Mac</a></div><p>Abra o aplicativo AB Markdown no Mac antes de conectar. No editor local, abra Configurações para selecionar a pasta ou clonar o repositório. As notas deste site continuam separadas; use Baixar pacote e importe no editor local para transferi-las.</p><p>No celular e tablet, a conexão direta com GitHub por usuário ainda está em desenvolvimento. A pasta do dispositivo e o armazenamento no navegador continuam disponíveis conforme o suporte do navegador.</p></section>}
    {!browserMode && <details className="repository" open={!repository.repository || undefined}>
      <summary><FolderGit2 size={20}/><span>{repository.repository || 'Configurar repositório'}{repository.branch && ` · ${repository.branch}`}</span></summary>
      <fieldset disabled={busy}><form onSubmit={event => { event.preventDefault(); if (!discard()) return; void run(async () => { const info = await api<RepositoryInfo>('connect', { directory }); setRepository(info); resetDocument(); await refresh(); setSettingsOpen(false); setNotice('Repositório conectado.'); }); }}><label>Pasta local do repositório<input placeholder="Clique em Selecionar pasta" value={directory} onChange={event => setDirectory(event.target.value)} required/></label><button type="button" className="primary" onClick={() => void chooseRepository()}><FolderOpen size={18}/>Selecionar pasta</button><button>Conectar caminho</button></form>
      <details><summary>Clonar um repositório por URL</summary><form onSubmit={event => { event.preventDefault(); if (!discard()) return; void run(async () => { const info = await api<RepositoryInfo>('clone', { url, destination }); setRepository(info); resetDocument(); await refresh(); setSettingsOpen(false); setNotice('Repositório clonado e conectado.'); }); }}><label>URL HTTPS ou SSH<input placeholder="git@github.com:usuario/repositorio.git" value={url} onChange={event => setUrl(event.target.value)} required/></label><label>Nova pasta local (caminho absoluto)<input placeholder="/Users/seu-nome/Documentos/meu-repo" value={destination} onChange={event => setDestination(event.target.value)} required/></label><button type="button" onClick={() => void chooseCloneDestination()}><FolderOpen size={18}/>Selecionar onde clonar</button><button>Clonar e conectar</button></form></details>
      <p>Usa o Git, o agente SSH e o gerenciador de credenciais do seu Mac. Configure a identidade Git e as credenciais antes de clonar ou enviar.</p>
      {repository.status && <pre aria-label="Alterações no repositório">{repository.status}</pre>}</fieldset>
    </details>}
    <fieldset className="document-controls" disabled={busy}>
      <div className="row"><label className="grow">Notas salvas<select aria-label={browserMode ? "Notas salvas" : "Arquivos do repositório"} value={selected} onChange={event => setSelected(event.target.value)}><option value="">Selecione um Markdown</option>{files.map(file => <option key={file} value={file}>{file}</option>)}</select></label><button disabled={!selected || !repository.repository} onClick={() => void openNote(selected)}>Abrir nota</button><button onClick={() => { if (discard()) { resetDocument(); setSettingsOpen(false); } }}><FilePlus2 size={18}/>Novo</button></div>
      <div className="row"><label className="grow">Nome do arquivo<input value={name} onChange={event => setName(event.target.value)} placeholder="notas/documento.md"/></label><button disabled={!repository.repository} onClick={() => requestSave()}><Save size={18}/>{browserMode ? "Salvar nota" : "Salvar no repositório"}</button></div>
      {pendingSync && <button disabled={!repository.repository} onClick={() => requestSave()}><Upload size={18}/>Tentar sincronizar novamente</button>}
      <p>{busy ? 'Salvando e sincronizando…' : pendingSync ? 'Arquivo local salvo; sincronização pendente.' : dirty ? 'Há alterações não salvas.' : 'Documento salvo.'} {browserMode ? 'Salvar guarda a nota neste navegador.' : 'Salvar grava o arquivo, cria o commit e envia ao remoto.'}</p>
    </fieldset>
    <section className="save-preferences" aria-label="Preferências de salvamento">
      <h3>Salvamento e sincronização</h3>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await api<SavePreferences>('preferences', preferenceDraft); setPreferences(saved); setPreferenceDraft(saved); setNotice('Preferências de salvamento atualizadas.'); }); }}>
        <fieldset disabled={busy}>
          {!browserMode && <label className="check-option"><input type="checkbox" checked={preferenceDraft.askCommitNote} onChange={event => setPreferenceDraft({ ...preferenceDraft, askCommitNote: event.target.checked })}/>Perguntar nota do commit a cada salvamento</label>}
          <label className="check-option"><input type="checkbox" checked={preferenceDraft.autoSave} onChange={event => setPreferenceDraft({ ...preferenceDraft, autoSave: event.target.checked })}/>Ativar salvamento automático</label>
          <label>Intervalo (minutos)<input type="number" min="1" max="1440" step="1" required value={preferenceDraft.intervalMinutes} onChange={event => setPreferenceDraft({ ...preferenceDraft, intervalMinutes: Number(event.target.value) })}/></label>
          <p>{browserMode ? 'O automático guarda suas notas neste navegador enquanto esta aba estiver aberta.' : 'O automático salva, cria o commit e envia ao remoto enquanto esta aba estiver aberta. Se pedir nota estiver ligado, aguarda a confirmação antes de salvar.'}</p>
          <button type="submit">Salvar preferências</button>
        </fieldset>
      </form>
    </section>
    {statusMessages}
    </div></EditorDialog>}
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
    {commitNoteOpen && <EditorDialog title="Nota do commit" onClose={() => setCommitNoteOpen(false)}>
      <form onSubmit={event => { event.preventDefault(); if (!commitNote.trim()) return; setCommitNoteOpen(false); void run(() => save(commitNote.trim())); }}>
        <label>Nota do commit<textarea autoFocus required maxLength={1000} value={commitNote} onChange={event => setCommitNote(event.target.value)} placeholder="Descreva o que mudou"/></label>
        <footer><button type="button" onClick={() => setCommitNoteOpen(false)}>Cancelar</button><button type="submit" disabled={!commitNote.trim()}>Salvar, commit e push</button></footer>
      </form>
    </EditorDialog>}
    {!settingsOpen && statusMessages}
    <div className="editor-layout">
    {notesOpen && <aside id="recent-notes" className="notes-sidebar" aria-label="Notas recentes">
      <div className="notes-heading"><button type="button" className="about-trigger" aria-label="Sobre o Scriba" title="Sobre o Scriba" onClick={() => setAboutOpen(true)}><img className="notes-logo" src={brandIcon} width="24" height="24" alt=""/></button><div><h2>Notas recentes</h2><p>{query ? `${visibleNotes.length + visiblePinned.length} resultados` : `${recentNotes.length + pinnedNotes.length} notas`}</p></div><button type="button" className="close-notes" aria-label="Fechar lista de notas" onClick={() => setNotesOpen(false)}><X size={18}/></button><button type="button" aria-label="Atualizar notas recentes" disabled={busy || !repository.repository || (offline && !browserMode)} onClick={() => void run(async () => { await refresh(); })}><RefreshCw size={18}/></button></div>
      <label className="notes-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Buscar nas notas recentes" placeholder="Buscar notas…" value={noteSearch} onChange={event => setNoteSearch(event.target.value)}/></label>
      {query && !visibleNotes.length && !visiblePinned.length && <p className="notes-empty">Nenhuma nota encontrada.</p>}
      <button className="new-note" type="button" disabled={busy || !draftReady} onClick={() => { if (discard()) { resetDocument(); if (window.matchMedia('(max-width: 899px)').matches) setNotesOpen(false); } }}><FilePlus2 size={18}/>Nova nota</button>
      {!repository.repository && <p className="notes-empty">Conecte um repositório nas configurações para listar suas notas.</p>}
      {repository.repository && !recentNotes.length && !pinnedNotes.length && <p className="notes-empty">{offline ? 'Abra o aplicativo local para carregar a lista.' : 'Nenhuma nota Markdown encontrada.'}</p>}
      <nav aria-label="100 notas mais recentes">{noteGroups.map(group => <section className="note-group" key={group.label} aria-label={group.label}><h3>{group.label}</h3><ol>{group.notes.map(note => <li className="note-row" key={note.name} data-note={note.name}>
        <button className="open-note" type="button" disabled={busy || !draftReady || (offline && !browserMode)} aria-current={name === note.name && version ? 'page' : undefined} title={note.name} aria-label={note.name} onClick={() => void openNote(note.name)}><span><strong>{note.title || note.name.split('/').at(-1)}</strong>{note.preview && <span className="note-preview">{note.preview}</span>}{note.hasImage && <NoteThumbnail repository={repository.repository} name={note.name} modifiedAt={note.modifiedAt}/>}<time dateTime={note.modifiedAt} title={new Date(note.modifiedAt).toLocaleString('pt-BR')}>{group.pinned && <Pin size={11} aria-label="Nota fixada"/>}{shortNoteDate(note.modifiedAt, dateClock)}</time></span></button>
        <button className="pin-note" type="button" disabled={busy || (offline && !browserMode)} aria-label={`${group.pinned ? 'Desafixar' : 'Fixar'} ${note.name}`} title={group.pinned ? 'Desafixar nota' : 'Fixar nota'} onClick={() => void togglePin(note, !group.pinned)}>{group.pinned ? <PinOff size={14}/> : <Pin size={14}/>}</button>
      </li>)}</ol></section>)}</nav>
    </aside>}
    <fieldset disabled={!draftReady || busy} className="editor-container"><MarkdownWorkbench compact initialMode={window.matchMedia('(max-width: 899px)').matches && version ? 'read' : 'live'} key={documentId} value={value} onChange={setValue} fileName={name} onFileNameChange={newName => { setName(newName); setVersion(null); setLoadedName(''); setImportedVersion(null); }} onImport={registerImport} initialAssets={initialAssets} onAssetsChange={handleAssets} saveRevision={saveRevision} readOnly={!draftReady || busy} actions={<>
      <button type="button" aria-controls="recent-notes" aria-expanded={notesOpen} aria-label={notesOpen ? 'Ocultar notas recentes' : 'Mostrar notas recentes'} title="Notas recentes" onClick={() => setNotesOpen(open => !open)}><PanelLeft size={18}/></button>
      {offline && <span className="offline-indicator" aria-label="Modo offline"><CloudOff size={16}/><span>Offline</span></span>}
      {repository.repository && <button type="button" disabled={busy} aria-label={browserMode ? "Salvar nota" : "Salvar no repositório"} title={browserMode ? "Salvar nota (⌘S)" : "Salvar no repositório (⌘S)"} onClick={() => requestSave()}><Save size={18}/></button>}
      <button type="button" aria-label="Configurações" title="Configurações" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings size={18}/></button>
    </>}/></fieldset>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
