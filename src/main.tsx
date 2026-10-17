import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderGit2, FolderOpen, Save, Upload, Sun, Moon, FilePlus2, Settings, X } from 'lucide-react';
import { MarkdownWorkbench } from './components/Markdown/MarkdownWorkbench';
import { EditorDialog } from './components/Markdown/EditorDialog';
import type { MarkdownAsset } from './lib/markdown/assets';
import './tokens.css';
import './style.css';

declare global { interface Window { /** Per-process local API capability injected by the server. */ __MARKDOWN_TOKEN__: string } }
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
async function api<T>(route: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${window.__MARKDOWN_TOKEN__}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}
async function encodeAsset(asset: MarkdownAsset) {
  const bytes = new Uint8Array(await asset.file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { path: asset.path, data: btoa(binary) };
}
function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repository, setRepository] = useState<RepositoryInfo>({ repository: null, branch: '', status: '' });
  const [directory, setDirectory] = useState('');
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('documento.md');
  const [loadedName, setLoadedName] = useState('documento.md');
  const [value, setValue] = useState('# Meu documento\n\nComece a escrever.\n');
  const [baseline, setBaseline] = useState('# Meu documento\n\nComece a escrever.\n');
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
  async function refresh() {
    const info = await api<RepositoryInfo>('repository'); setRepository(info);
    setFiles(info.repository ? await api<string[]>('files') : []);
    return info;
  }
  useEffect(() => { void Promise.all([refresh(), api<SavePreferences>('preferences')]).then(([info, saved]) => { if (!info.repository) setSettingsOpen(true); setPreferences(saved); setPreferenceDraft(saved); }).catch(cause => { setError(cause.message); setSettingsOpen(true); }); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function run(action: () => Promise<void>) {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
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
    setPendingSync(false); setAssets([]); setInitialAssets(attached); setDocumentId(id => id + 1); setSaveRevision(0);
  }
  async function save(note: string) {
    const result = await api<SaveResult>('save-sync', { name, value, message: note, version: name === loadedName ? version : null, files: await Promise.all(assets.map(encodeAsset)) });
    setVersion(result.version); setBaseline(value); setLoadedName(name); setSaveRevision(revision => revision + 1);
    setPendingSync(!result.synced);
    await refresh();
    if (result.synced) setNotice('Arquivo salvo, commit criado e enviado ao remoto.');
    else setError(`Arquivo salvo localmente. ${result.stage === 'commit' ? 'Commit pendente' : 'Push pendente'}: ${result.error} Use Salvar novamente para tentar sincronizar.`);
  }
  function requestSave(automatic = false) {
    if (operationLock.current || busy || commitNoteOpen || !repository.repository) return;
    if (preferences.askCommitNote) {
      setCommitNote(''); setSettingsOpen(false); setCommitNoteOpen(true);
    } else void run(() => save(`${automatic ? 'Auto-save' : 'Update'} ${name}`));
  }
  autoSaveAction.current = () => {
    if ((dirty || pendingSync) && !busy && !settingsOpen && !commitNoteOpen) requestSave(true);
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
    {settingsOpen && <EditorDialog title="Configurações" onClose={() => setSettingsOpen(false)}>
    <div className="settings-content">
    <div className="settings-theme"><span>Aparência</span><button aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}Tema {theme === 'dark' ? 'claro' : 'escuro'}</button></div>
    <details className="repository" open={!repository.repository || undefined}>
      <summary><FolderGit2 size={20}/><span>{repository.repository || 'Configurar repositório'}{repository.branch && ` · ${repository.branch}`}</span></summary>
      <fieldset disabled={busy}><form onSubmit={event => { event.preventDefault(); if (!discard()) return; void run(async () => { const info = await api<RepositoryInfo>('connect', { directory }); setRepository(info); resetDocument(); await refresh(); setSettingsOpen(false); setNotice('Repositório conectado.'); }); }}><label>Pasta local do repositório<input placeholder="Clique em Selecionar pasta" value={directory} onChange={event => setDirectory(event.target.value)} required/></label><button type="button" className="primary" onClick={() => void chooseRepository()}><FolderOpen size={18}/>Selecionar pasta</button><button>Conectar caminho</button></form>
      <details><summary>Clonar um repositório por URL</summary><form onSubmit={event => { event.preventDefault(); if (!discard()) return; void run(async () => { const info = await api<RepositoryInfo>('clone', { url, destination }); setRepository(info); resetDocument(); await refresh(); setSettingsOpen(false); setNotice('Repositório clonado e conectado.'); }); }}><label>URL HTTPS ou SSH<input placeholder="git@github.com:usuario/repositorio.git" value={url} onChange={event => setUrl(event.target.value)} required/></label><label>Nova pasta local (caminho absoluto)<input placeholder="/Users/seu-nome/Documentos/meu-repo" value={destination} onChange={event => setDestination(event.target.value)} required/></label><button type="button" onClick={() => void chooseCloneDestination()}><FolderOpen size={18}/>Selecionar onde clonar</button><button>Clonar e conectar</button></form></details>
      <p>Usa o Git, o agente SSH e o gerenciador de credenciais do seu Mac. Configure a identidade Git e as credenciais antes de clonar ou enviar.</p>
      {repository.status && <pre aria-label="Alterações no repositório">{repository.status}</pre>}</fieldset>
    </details>
    <fieldset className="document-controls" disabled={busy}>
      <div className="row"><label className="grow">Arquivos do repositório<select aria-label="Arquivos do repositório" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Selecione um Markdown</option>{files.map(file => <option key={file} value={file}>{file}</option>)}</select></label><button disabled={!selected || !repository.repository} onClick={() => { if (!discard()) return; void run(async () => { const doc = await api<LoadedDocument>(`document?name=${encodeURIComponent(selected)}`); const attached = doc.files.map(file => ({ path: file.path, file: new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, { type: file.mime }) })); resetDocument(doc.value, selected, doc.version, attached); setSettingsOpen(false); setNotice(doc.warnings.length ? `Aberto com avisos: ${doc.warnings.join('; ')}` : 'Documento aberto.'); }); }}>Abrir do repositório</button><button onClick={() => { if (discard()) { resetDocument(); setSettingsOpen(false); } }}><FilePlus2 size={18}/>Novo</button></div>
      <div className="row"><label className="grow">Caminho do arquivo no repositório<input value={name} onChange={event => setName(event.target.value)} placeholder="notas/documento.md"/></label><button disabled={!repository.repository} onClick={() => requestSave()}><Save size={18}/>Salvar no repositório</button></div>
      {pendingSync && <button disabled={!repository.repository} onClick={() => requestSave()}><Upload size={18}/>Tentar sincronizar novamente</button>}
      <p>{busy ? 'Salvando e sincronizando…' : pendingSync ? 'Arquivo local salvo; sincronização pendente.' : dirty ? 'Há alterações não salvas.' : 'Documento salvo.'} Salvar grava o arquivo, cria o commit e envia ao remoto.</p>
    </fieldset>
    <section className="save-preferences" aria-label="Preferências de salvamento">
      <h3>Salvamento e sincronização</h3>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await api<SavePreferences>('preferences', preferenceDraft); setPreferences(saved); setPreferenceDraft(saved); setNotice('Preferências de salvamento atualizadas.'); }); }}>
        <fieldset disabled={busy}>
          <label className="check-option"><input type="checkbox" checked={preferenceDraft.askCommitNote} onChange={event => setPreferenceDraft({ ...preferenceDraft, askCommitNote: event.target.checked })}/>Perguntar nota do commit a cada salvamento</label>
          <label className="check-option"><input type="checkbox" checked={preferenceDraft.autoSave} onChange={event => setPreferenceDraft({ ...preferenceDraft, autoSave: event.target.checked })}/>Ativar salvamento automático</label>
          <label>Intervalo (minutos)<input type="number" min="1" max="1440" step="1" required value={preferenceDraft.intervalMinutes} onChange={event => setPreferenceDraft({ ...preferenceDraft, intervalMinutes: Number(event.target.value) })}/></label>
          <p>O automático salva, cria o commit e envia ao remoto enquanto esta aba estiver aberta. Se pedir nota estiver ligado, aguarda a confirmação antes de salvar.</p>
          <button type="submit">Salvar preferências</button>
        </fieldset>
      </form>
    </section>
    {statusMessages}
    </div></EditorDialog>}
    {commitNoteOpen && <EditorDialog title="Nota do commit" onClose={() => setCommitNoteOpen(false)}>
      <form onSubmit={event => { event.preventDefault(); if (!commitNote.trim()) return; setCommitNoteOpen(false); void run(() => save(commitNote.trim())); }}>
        <label>Nota do commit<textarea autoFocus required maxLength={1000} value={commitNote} onChange={event => setCommitNote(event.target.value)} placeholder="Descreva o que mudou"/></label>
        <footer><button type="button" onClick={() => setCommitNoteOpen(false)}>Cancelar</button><button type="submit" disabled={!commitNote.trim()}>Salvar, commit e push</button></footer>
      </form>
    </EditorDialog>}
    {!settingsOpen && statusMessages}
    <fieldset disabled={busy} className="editor-container"><MarkdownWorkbench key={documentId} value={value} onChange={setValue} fileName={name} onFileNameChange={newName => { setName(newName); setVersion(null); setLoadedName(''); }} initialAssets={initialAssets} onAssetsChange={setAssets} saveRevision={saveRevision} readOnly={busy} actions={<>
      {repository.repository && <button type="button" disabled={busy} aria-label="Salvar no repositório" title="Salvar no repositório (⌘S)" onClick={() => requestSave()}><Save size={18}/></button>}
      <button type="button" aria-label="Configurações" title="Configurações" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings size={18}/></button>
    </>}/></fieldset>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
