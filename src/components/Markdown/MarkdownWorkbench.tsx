import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, FileUp, FileText, Package, Type } from 'lucide-react';
import { readMarkdownFile, downloadMarkdown, downloadBlob } from '@/lib/markdown/files';
import { createMarkdownPackage, prepareImages, readMarkdownPackage } from '@/lib/markdown/assets';
import { parseEditableTable, type EditableTable } from '@/lib/markdown/tables';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import { MarkdownReadingView } from './MarkdownReadingView';
import { EditingToolbar } from './EditingToolbar';
import { EditorDialog } from './EditorDialog';
import { TableEditorDialog } from './TableEditorDialog';
import { useMarkdownAssets } from './useMarkdownAssets';
import type { MarkdownAsset } from '@/lib/markdown/assets';
import type { MarkdownCommand, SourceRange } from './editorCommands';
import styles from './MarkdownWorkbench.module.css';

export type MarkdownMode = 'live' | 'source' | 'split' | 'read';
export interface MarkdownWorkbenchProps {
  /** Markdown owned by the consuming screen. */
  value: string;
  /** Receives source edits and successful local file imports. */
  onChange: (value: string) => void;
  /** Controlled download filename. */
  fileName: string;
  /** Receives the name of a successfully imported file. */
  onFileNameChange: (name: string) => void;
  /** Record the original imported source before the user starts editing it. */
  onImport?: (source: string, name: string) => Promise<void>;
  /** Initial display mode, read once at mount. */
  initialMode?: MarkdownMode;
  /** Host actions displayed alongside the document's existing toolbar controls. */
  actions?: ReactNode;
  /** Compact standalone layout with formatting available on demand. */
  compact?: boolean;
  /** Files loaded from the configured repository, applied on mount. */
  initialAssets?: {path: string; file: File}[];
  /** Reports attached files so the host can persist the complete document. */
  onAssetsChange?: (assets: MarkdownAsset[]) => void;
  /** Incremented after a successful repository save. */
  saveRevision?: number;
  /** Prevent document changes and imports. */
  readOnly?: boolean;
}

const modes = [['live', 'Escrever'], ['source', 'Fonte'], ['split', 'Visão'], ['read', 'Ler']] as const;

/** File operations and presentation around the reusable controlled editor. */
export function MarkdownWorkbench({ value, onChange, fileName, onFileNameChange, onImport, initialMode = 'live', actions, compact = false, readOnly = false, initialAssets, onAssetsChange, saveRevision = 0 }: MarkdownWorkbenchProps) {
  const [mode, setMode] = useState<MarkdownMode>(initialMode);
  const [baseline, setBaseline] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [documentId, setDocumentId] = useState(0);
  const [linkRange, setLinkRange] = useState<SourceRange | null>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState('');
  const [tableEdit, setTableEdit] = useState<{ range: SourceRange; table: EditableTable } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageRange = useRef<SourceRange>({ from: 0, to: 0 });
  const editor = useRef<MarkdownEditorHandle>(null);
  const { assets, replace: replaceAssets, append: appendAssets } = useMarkdownAssets();
  useEffect(() => { if (initialAssets) replaceAssets(initialAssets); }, []);
  useEffect(() => { onAssetsChange?.(assets); }, [assets, onAssetsChange]);
  useEffect(() => { if (saveRevision) setBaseline(value); }, [saveRevision]);
  const dirty = baseline !== value;
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function open(file?: File) {
    if (!file || readOnly || busy) return;
    if (dirty && !window.confirm('Abrir outro arquivo substituirá as alterações desta sessão. Continuar?')) return;
    setError(''); setBusy(true);
    try {
      const packaged = /\.(zip|bear)$/i.test(file.name) ? await readMarkdownPackage(file) : null;
      const source = packaged?.value ?? await readMarkdownFile(file);
      replaceAssets(packaged?.files ?? []);
      const name = file.name.replace(/\.(zip|bear)$/i, '.md');
      onChange(source); onFileNameChange(name); setBaseline(source); setDocumentId(id => id + 1);
      await onImport?.(source, name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o arquivo.');
    } finally { setBusy(false); }
  }

  function command(action: MarkdownCommand) {
    if (readOnly || busy) return;
    if (mode === 'read') setMode('live');
    editor.current?.command(action);
  }

  async function insertImages(files: File[], range: SourceRange) {
    if (!files.length || readOnly || busy) return;
    setError(''); setBusy(true);
    try {
      const prepared = await prepareImages(files, assets);
      appendAssets(prepared);
      const before = value.slice(0, range.from).match(/\n*$/)![0].length;
      const after = value.slice(range.to).match(/^\n*/)![0].length;
      const prefix = range.from === 0 ? '' : '\n'.repeat(Math.max(0, 2 - before));
      const suffix = '\n'.repeat(Math.max(0, 2 - after));
      const source = prefix + prepared.map(asset => `![${asset.file.name.replace(/\.[^.]+$/, '').replace(/[\[\]\\\r\n]/g, ' ')}](${asset.path})`).join('\n\n') + suffix;
      if (mode === 'read') setMode('live');
      editor.current?.replace(source, range);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível inserir a imagem.'); }
    finally { setBusy(false); }
  }

  async function downloadPackage() {
    setError(''); setBusy(true);
    try {
      const bytes = await createMarkdownPackage(value, assets);
      downloadBlob(new Blob([Uint8Array.from(bytes)], { type: 'application/zip' }), `${fileName.replace(/\.[^.]+$/, '') || 'documento'}.zip`);
    } catch { setError('Não foi possível preparar o pacote.'); }
    finally { setBusy(false); }
  }

  function editTable(range: SourceRange) {
    if (readOnly || busy) return;
    try { setTableEdit({ range, table: parseEditableTable(value.slice(range.from, range.to)) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível editar a tabela.'); }
  }

  const [formattingOpen, setFormattingOpen] = useState(false);
  return <section className={`${styles.workbench} ${compact ? styles.compact : ''}`} aria-label="Bancada Markdown" aria-busy={busy}>
    <header className={styles.toolbar}>
      <div className={styles.filename}><FileText size={16} aria-hidden="true"/><span title={fileName}>{fileName}</span>{dirty && <span className={styles.dot} aria-label="Documento alterado"/>}</div>
      <div className={styles.modes} role="group" aria-label="Modo de edição">
        {modes.map(([key, label]) => <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>)}
      </div>
      <div className={styles.actions}>
        <button type="button" disabled={readOnly || busy} aria-label="Abrir .md / ZIP" title="Abrir .md / ZIP" onClick={() => input.current?.click()}><FileUp size={15} aria-hidden="true"/><span className={styles.actionLabel}>Abrir .md / ZIP</span></button>
        <button type="button" className={styles.download} aria-label="Baixar .md" title="Baixar .md" onClick={() => downloadMarkdown(value, fileName)}><Download size={15} aria-hidden="true"/><span className={styles.actionLabel}>Baixar .md</span></button>
        <button type="button" className={styles.download} disabled={busy} aria-label="Baixar pacote" title="Baixar pacote" onClick={() => void downloadPackage()}><Package size={15} aria-hidden="true"/><span className={styles.actionLabel}>Baixar pacote</span></button>
        {compact && <button type="button" aria-label={formattingOpen ? 'Ocultar formatação' : 'Mostrar formatação'} title="Formatação" aria-expanded={formattingOpen} onClick={() => setFormattingOpen(open => !open)}><Type size={18}/></button>}
        {actions}
      </div>
      <input ref={input} type="file" hidden aria-label="Arquivo Markdown" disabled={readOnly || busy} accept=".md,.markdown,.mdown,.zip,.bear,text/markdown,application/zip" onChange={event => { void open(event.target.files?.[0]); event.target.value = ''; }}/>
      <input ref={imageInput} type="file" hidden multiple aria-label="Arquivos de imagem" disabled={readOnly || busy} accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => { void insertImages(Array.from(event.target.files ?? []), imageRange.current); event.target.value = ''; }}/>
    </header>
    {(!compact || formattingOpen) && <EditingToolbar disabled={readOnly || busy} onCommand={command} onLink={() => { const range = editor.current?.selection() ?? { from: 0, to: 0 }; setLinkRange(range); setLinkText(value.slice(range.from, range.to)); setLinkUrl('https://'); setLinkError(''); }} onImage={() => { imageRange.current = editor.current?.selection() ?? { from: value.length, to: value.length }; imageInput.current?.click(); }}/>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {assets.length > 0 && <p className={styles.assetHint}>{assets.length} imagem(ns) anexada(s). Use <strong>Baixar pacote</strong> para levar o Markdown e as imagens juntos.</p>}
    <div className={styles.modeHint}>{mode === 'live' ? 'Os marcadores aparecem na linha selecionada. Clique no texto para editar.' : mode === 'source' ? 'Markdown original, com todos os marcadores visíveis.' : mode === 'split' ? 'Edite o Markdown e acompanhe a prévia de leitura.' : 'Prévia de leitura. Volte a Escrever para editar.'}</div>
    <div className={`${styles.pages} ${mode === 'split' ? styles.split : ''}`}>
      <div className={styles.source} hidden={mode === 'read'}>
        <MarkdownEditor key={documentId} ref={editor} value={value} onChange={onChange} livePreview={mode === 'live'} readOnly={readOnly || busy} assets={assets} onImageFiles={(files, range) => { void insertImages(files, range); }}/>
      </div>
      {(mode === 'split' || mode === 'read') && <MarkdownReadingView value={value} assets={assets} onEditTable={!readOnly && !busy ? editTable : undefined} onToggleTask={!readOnly && !busy ? range => {
        const source = value.slice(range.from, range.to);
        const marker = source.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/);
        if (marker) editor.current?.replace(marker[2] === ' ' ? 'x' : ' ', { from: range.from + marker[1].length, to: range.from + marker[1].length + 1 });
      } : undefined}/>}
    </div>
    <footer className={styles.footer}><span>{words} palavras · {value.length} caracteres</span><span>{readOnly ? 'Somente leitura' : dirty ? 'Alterações nesta sessão' : 'Documento carregado'}</span><span>UTF-8 · .md</span></footer>
    {linkRange && <EditorDialog title="Inserir link" onClose={() => setLinkRange(null)}>
      {linkError && <p role="alert">{linkError}</p>}<form onSubmit={event => {
        event.preventDefault();
        try {
          const url = new URL(linkUrl, 'https://local.invalid');
          if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('invalid');
          const text = (linkText || linkUrl).replace(/[\[\]\\\r\n]/g, ' ');
          const target = linkUrl.replace(/[\s<>]/g, char => encodeURIComponent(char));
          if (mode === 'read') setMode('live');
          editor.current?.replace(`[${text}](<${target}>)`, linkRange); setLinkRange(null);
        } catch { setLinkError('Use um link HTTP, HTTPS, e-mail ou âncora do documento.'); }
      }}><label>Texto do link<input value={linkText} onChange={event => setLinkText(event.target.value)}/></label><label>Endereço<input required value={linkUrl} onChange={event => setLinkUrl(event.target.value)}/></label><footer><button type="button" onClick={() => setLinkRange(null)}>Cancelar</button><button type="submit">Inserir link</button></footer></form>
    </EditorDialog>}
    {tableEdit && <TableEditorDialog initial={tableEdit.table} onClose={() => setTableEdit(null)} onSave={source => { editor.current?.replace(source, tableEdit.range); setTableEdit(null); }}/>}
  </section>;
}
