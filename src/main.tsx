import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderGit2, FolderOpen, Save, GitCommitHorizontal, Upload, Sun, Moon, FilePlus2 } from 'lucide-react';
import { MarkdownWorkbench } from './components/Markdown/MarkdownWorkbench';
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
  const [repository, setRepository] = useState<RepositoryInfo>({ repository: null, branch: '', status: '' });
  const [directory, setDirectory] = useState('');
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('documento.md');
  const [loadedName, setLoadedName] = useState('');
  const [value, setValue] = useState('# Meu documento\n\nComece a escrever.\n');
  const [baseline, setBaseline] = useState('');
  const [version, setVersion] = useState<string | null>(null);
  const [assets, setAssets] = useState<MarkdownAsset[]>([]);
  const [initialAssets, setInitialAssets] = useState<{path: string; file: File}[]>([]);
  const [documentId, setDocumentId] = useState(0);
  const [saveRevision, setSaveRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ab-markdown-theme') || 'dark');
  const dirty = value !== baseline || name !== loadedName;
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ab-markdown-theme', theme); }, [theme]);
  async function refresh() {
    const info = await api<RepositoryInfo>('repository'); setRepository(info);
    setFiles(info.repository ? await api<string[]>('files') : []);
  }
  useEffect(() => { void refresh().catch(cause => setError(cause.message)); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  async function chooseRepository() {
    if (!discard()) return;
    await run(async () => {
      const picked = await api<{directory: string | null}>('pick-folder', {});
      if (!picked.directory) return;
      setDirectory(picked.directory);
      const info = await api<RepositoryInfo>('connect', { directory: picked.directory });
      setRepository(info); resetDocument(); await refresh(); setNotice('Repositório conectado.');
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
    setValue(text); setBaseline(text); setName(fileName); setLoadedName(hash ? fileName : ''); setVersion(hash);
    setAssets([]); setInitialAssets(attached); setDocumentId(id => id + 1); setSaveRevision(0);
  }
  async function save() {
    const result = await api<{version: string}>('save', { name, value, version: name === loadedName ? version : null, files: await Promise.all(assets.map(encodeAsset)) });
    setVersion(result.version); setBaseline(value); setLoadedName(name); setSaveRevision(revision => revision + 1);
    await refresh(); setNotice('Documento e imagens salvos no repositório local.');
  }
  return <main aria-busy={busy}>
    <header className="app-header"><div><p className="eyebrow">AB / MARKDOWN</p><h1>O texto é o documento.</h1><p>Seu editor local, conectado ao seu repositório Git.</p></div><button aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button></header>
    <details className="repository" open={!repository.repository || undefined}>
      <summary><FolderGit2 size={20}/><span>{repository.repository || 'Configurar repositório'}{repository.branch && ` · ${repository.branch}`}</span></summary>
      <fieldset disabled={busy}><form onSubmit={event => { event.preventDefault(); if (!discard()) return; void run(async () => { const info = await api<RepositoryInfo>('connect', { directory }); setRepository(info); resetDocument(); await refresh(); setNotice('Repositório conectado.'); }); }}><label>Pasta local do repositório<input placeholder="Clique em Selecionar pasta" value={directory} onChange={event => setDirectory(event.target.value)} required/></label><button type="button" className="primary" onClick={() => void chooseRepository()}><FolderOpen size={18}/>Selecionar pasta</button><button>Conectar caminho</button></form>
      <details><summary>Clonar um repositório por URL</summary><form onSubmit={event => { event.preventDefault(); if (!discard()) return; void run(async () => { const info = await api<RepositoryInfo>('clone', { url, destination }); setRepository(info); resetDocument(); await refresh(); setNotice('Repositório clonado e conectado.'); }); }}><label>URL HTTPS ou SSH<input placeholder="git@github.com:usuario/repositorio.git" value={url} onChange={event => setUrl(event.target.value)} required/></label><label>Nova pasta local (caminho absoluto)<input placeholder="/Users/seu-nome/Documentos/meu-repo" value={destination} onChange={event => setDestination(event.target.value)} required/></label><button type="button" onClick={() => void chooseCloneDestination()}><FolderOpen size={18}/>Selecionar onde clonar</button><button>Clonar e conectar</button></form></details>
      <p>Usa o Git, o agente SSH e o gerenciador de credenciais do seu Mac. Configure a identidade Git e as credenciais antes de clonar ou enviar.</p>
      {repository.status && <pre aria-label="Alterações no repositório">{repository.status}</pre>}</fieldset>
    </details>
    <fieldset className="document-controls" disabled={busy}>
      <div className="row"><label className="grow">Arquivos do repositório<select aria-label="Arquivos do repositório" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Selecione um Markdown</option>{files.map(file => <option key={file} value={file}>{file}</option>)}</select></label><button disabled={!selected || !repository.repository} onClick={() => { if (!discard()) return; void run(async () => { const doc = await api<LoadedDocument>(`document?name=${encodeURIComponent(selected)}`); const attached = doc.files.map(file => ({ path: file.path, file: new File([Uint8Array.from(atob(file.data), char => char.charCodeAt(0))], file.path.split('/').at(-1)!, { type: file.mime }) })); resetDocument(doc.value, selected, doc.version, attached); setNotice(doc.warnings.length ? `Aberto com avisos: ${doc.warnings.join('; ')}` : 'Documento aberto.'); }); }}>Abrir do repositório</button><button onClick={() => { if (discard()) resetDocument(); }}><FilePlus2 size={18}/>Novo</button></div>
      <div className="row"><label className="grow">Caminho do arquivo no repositório<input value={name} onChange={event => setName(event.target.value)} placeholder="notas/documento.md"/></label><button disabled={!repository.repository} onClick={() => void run(save)}><Save size={18}/>Salvar no repositório</button></div>
      <div className="row"><label className="grow">Mensagem de commit<input value={message} onChange={event => setMessage(event.target.value)} placeholder="Atualiza notas de pesquisa"/></label><button disabled={!repository.repository || dirty || !message.trim()} onClick={() => void run(async () => { await api('commit', { name, message, assets: assets.map(asset => asset.path) }); await refresh(); setNotice('Commit criado. Use Enviar para publicar no remoto.'); })}><GitCommitHorizontal size={18}/>Criar commit</button><button disabled={!repository.repository} onClick={() => void run(async () => { await api('push', {}); await refresh(); setNotice('Commits enviados ao remoto.'); })}><Upload size={18}/>Enviar (push)</button></div>
      <p>{busy ? 'Operação em andamento… Se abriu o seletor do macOS, escolha uma pasta ou cancele.' : dirty ? 'Há alterações não salvas no repositório.' : 'Documento salvo.'} Salvar grava na pasta local; commit registra a versão; push envia os commits da branch.</p>
    </fieldset>
    {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    <fieldset disabled={busy} className="editor-container"><MarkdownWorkbench key={documentId} value={value} onChange={setValue} fileName={name} onFileNameChange={newName => { setName(newName); setVersion(null); setLoadedName(''); }} initialAssets={initialAssets} onAssetsChange={setAssets} saveRevision={saveRevision} readOnly={busy}/></fieldset>
    <footer className="app-footer">AB Markdown · arquivos locais · sem serviço de nuvem · Cmd+B / Cmd+I para formatar</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
