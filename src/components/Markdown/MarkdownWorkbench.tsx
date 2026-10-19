import { lazy, Suspense, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Download, FileUp, FileText, Package, Type, ArrowLeft, Info, MoreVertical, Pencil, Check, SquareCode, X, ListTree } from 'lucide-react';
import { readMarkdownFile, downloadMarkdown, downloadBlob } from '@/lib/markdown/files';
import { createMarkdownPackage, prepareImages, readMarkdownPackage } from '@/lib/markdown/assets';
import { parseEditableTable, type EditableTable } from '@/lib/markdown/tables';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import { MarkdownReadingView } from './MarkdownReadingView';
import { EditingToolbar } from './EditingToolbar';
import { EditorDialog } from './EditorDialog';
import { TableEditorDialog } from './TableEditorDialog';
import { useMarkdownAssets } from './useMarkdownAssets';
import { SelectionStatistics, type SelectionStatisticsHandle } from './SelectionStatistics';
import type { MarkdownAsset } from '@/lib/markdown/assets';
import type { MarkdownCommand, SourceRange } from './editorCommands';
import styles from './MarkdownWorkbench.module.css';
import type { RichMarkdownEditorHandle } from './RichMarkdownEditor';
import { VisualEditorBoundary } from './VisualEditorBoundary';
import { DocumentOutline } from './DocumentOutline';
import type { OutlineHeading } from '@/lib/markdown/outline';
import { ExcalidrawEditor } from './ExcalidrawEditor';
import { EMPTY_EXCALIDRAW, replaceExcalidrawFence } from '@/lib/markdown/excalidrawScene';

const RichMarkdownEditor = lazy(() => import('./RichMarkdownEditor'));

export type MarkdownMode = 'live' | 'source' | 'split' | 'read';
export interface MarkdownWorkbenchHandle {
  /** Reuse the native chooser; reload requires the original filename and preserves the view mode. */
  openFile: (reloadOriginal?: boolean) => void;
  /** File/package operations must finish before the host saves or closes the note. */
  isBusy: () => boolean;
}
export interface MarkdownWorkbenchProps {
  /** Storage destination and filename namespace diagram presentation preferences. */
  diagramScope?: string;
  /** Host commands reuse the workbench's file input and operation guards. */
  ref?: Ref<MarkdownWorkbenchHandle>;
  /** Markdown owned by the consuming screen. */
  value: string;
  /** Receives source edits and successful local file imports. */
  onChange: (value: string) => void;
  /** Controlled download filename. */
  fileName: string;
  /** Receives the name of a successfully imported file. */
  onFileNameChange: (name: string) => void;
  /** Record the original source and distinguish explicit disk reloads from normal imports. */
  onImport?: (source: string, name: string, reloaded?: boolean) => Promise<void>;
  /** Initial display mode, read once at mount. */
  initialMode?: MarkdownMode;
  /** Preserve the document reading position across a source refresh. */
  initialScrollTop?: number;
  /** Host actions displayed alongside the document's existing toolbar controls. */
  actions?: ReactNode;
  /** Compact host status shown only when the open source changes externally. */
  sourceStatus?: ReactNode;
  /** Reports mode changes so a source reload preserves the selected presentation. */
  onModeChange?: (mode: MarkdownMode) => void;
  /** Compact standalone layout with formatting available on demand. */
  compact?: boolean;
  /** Optional gesture for revealing an individual Markdown source block. */
  doubleClickToEdit?: boolean;
  /** Files loaded from the configured repository, applied on mount. */
  initialAssets?: {path: string; file: File}[];
  /** Reports attached files so the host can persist the complete document. */
  onAssetsChange?: (assets: MarkdownAsset[]) => void;
  /** Incremented after a successful repository save. */
  saveRevision?: number;
  /** Prevent document changes and imports. */
  readOnly?: boolean;
  /** Standalone hosts can own the complete text/image/pending-sync unload guard. */
  warnBeforeUnload?: boolean;
  /** Optional document-close command, separate from closing a browser tab. */
  onClose?: () => void;
}

const modes = [['live', 'Escrever'], ['source', 'Fonte'], ['split', 'Visão'], ['read', 'Ler']] as const;

/** File operations and presentation around the reusable controlled editor. */
export function MarkdownWorkbench({ ref, value, onChange, fileName, onFileNameChange, onImport, initialMode = 'live', initialScrollTop = 0, actions, sourceStatus, onModeChange, compact = false, readOnly = false, warnBeforeUnload = true, onClose, doubleClickToEdit = true, initialAssets, onAssetsChange, saveRevision = 0, diagramScope = fileName }: MarkdownWorkbenchProps) {
  const [mode, setMode] = useState<MarkdownMode>(initialMode);
  const [readingEditable, setReadingEditable] = useState(false);
  const visualEditor = useRef<RichMarkdownEditorHandle>(null);
  useEffect(() => { onModeChange?.(mode); }, [mode,onModeChange]);
  const workbench = useRef<HTMLElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  useEffect(() => {const frame=requestAnimationFrame(()=>{if(pages.current)pages.current.scrollTop=initialScrollTop;});return()=>cancelAnimationFrame(frame);}, []);
  const [activeBlock,setActiveBlock] = useState<SourceRange|null>(null);
  const pendingBlock = useRef<SourceRange|null>(null);
  const blockFromReading = useRef(false);
  const [baseline, setBaseline] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [documentId, setDocumentId] = useState(0);
  const [linkRange, setLinkRange] = useState<SourceRange | null>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState('');
  const [tableEdit, setTableEdit] = useState<{ range: SourceRange; table: EditableTable } | null>(null);
  const [newDrawing, setNewDrawing] = useState<SourceRange | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reloadImport = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageRange = useRef<SourceRange>({ from: 0, to: 0 });
  const editor = useRef<MarkdownEditorHandle>(null);
  const statistics = useRef<SelectionStatisticsHandle>(null);
  function chooseFile(reloadOriginal = false) {
    if (readOnly || busy) return;
    reloadImport.current = reloadOriginal;setError('');input.current?.click();
  }
  useImperativeHandle(ref, () => ({openFile: chooseFile, isBusy: () => busy || !!document.querySelector('dialog[data-scriba-canvas][open]') || !!workbench.current?.querySelector('dialog[open]')}));
  const { assets, replace: replaceAssets, append: appendAssets } = useMarkdownAssets();
  useEffect(() => { if (initialAssets) replaceAssets(initialAssets); }, []);
  useEffect(() => { onAssetsChange?.(assets); }, [assets, onAssetsChange]);
  useEffect(() => { if (saveRevision) setBaseline(value); }, [saveRevision]);
  const dirty = baseline !== value;
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;

  useEffect(() => {
    if (!dirty || !warnBeforeUnload) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, warnBeforeUnload]);

  async function open(file?: File) {
    const reloadOriginal = reloadImport.current;reloadImport.current = false;
    if (!file || readOnly || busy) return;
    const importedName = file.name.replace(/\.(zip|bear)$/i, '.md');
    const expectedName = fileName.split(/[\\/]/).at(-1);
    if (reloadOriginal && importedName !== expectedName) {setError(`Selecione o arquivo original ${expectedName} para recarregar esta nota.`);return;}
    if (dirty && !window.confirm(reloadOriginal ? 'Recarregar substituirá as alterações não salvas desta nota. Continuar?' : 'Abrir outro arquivo substituirá as alterações desta sessão. Continuar?')) return;
    setError(''); setBusy(true);
    try {
      const packaged = /\.(zip|bear)$/i.test(file.name) ? await readMarkdownPackage(file) : null;
      const source = packaged?.value ?? await readMarkdownFile(file);
      replaceAssets(packaged?.files ?? []);
      const name = importedName;
      onChange(source); onFileNameChange(name); setBaseline(source); setDocumentId(id => id + 1);
      await onImport?.(source, name, reloadOriginal);
      blockFromReading.current=false;
      setReadingEditable(false);
      if (!reloadOriginal) {setMode('read');setReadingActionsOpen(false);}
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o arquivo.');
    } finally { setBusy(false); }
  }

  function command(action: MarkdownCommand) {
    if (readOnly || busy) return;
    if (readingEditable) { visualEditor.current?.command(action); return; }
    if (mode === 'read') setMode('live');
    editor.current?.command(action);
  }

  async function insertImages(files: File[], range: SourceRange) {
    if (!files.length || readOnly || busy) return;
    setError(''); setBusy(true);
    try {
      const prepared = await prepareImages(files, assets);
      appendAssets(prepared);
      if (readingEditable && visualEditor.current) {
        visualEditor.current.insertMarkdown(prepared.map(asset => `![${asset.file.name.replace(/\.[^.]+$/, '').replace(/[\[\]\\\r\n]/g, ' ')}](${asset.path})`).join('\n\n'));
        return;
      }
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

  function editBlock(range:SourceRange) {
    if(readOnly||busy)return;
    setReadingEditable(false);
    // mdast offsets refer to the original string; CodeMirror normalizes CRLF/CR to LF.
    const sourceRange={from:value.slice(0,range.from).replace(/\r\n?/g,'\n').length,to:value.slice(0,range.to).replace(/\r\n?/g,'\n').length};
    blockFromReading.current=mode==='read';
    if(mode==='live')editor.current?.editBlock(sourceRange);
    else {pendingBlock.current=sourceRange;setMode('live');}
  }
  useEffect(()=>{if(mode==='live'&&pendingBlock.current){const range=pendingBlock.current;pendingBlock.current=null;editor.current?.editBlock(range);}},[mode]);
  function blockChanged(range:SourceRange|null,finished:boolean) {
    setActiveBlock(range);
    if(finished&&blockFromReading.current){blockFromReading.current=false;setMode('read');}
  }
  function toggleBlock() {
    if(activeBlock)editor.current?.finishBlock();
    else if(mode==='live')editor.current?.editBlock();
    else {pendingBlock.current=editor.current?.selection()||{from:0,to:0};blockFromReading.current=mode==='read';setMode('live');}
  }
  function changeMode(next:MarkdownMode) {blockFromReading.current=false;setReadingEditable(false);setMode(next);}
  function startVisualEditing() {
    if (readOnly || busy) return;
    blockFromReading.current = false;
    setMode('read'); setReadingEditable(true); setReadingActionsOpen(false);
  }
  function insertDrawing() {
    if (readOnly || busy) return;
    setNewDrawing(mode === 'read' ? { from: value.length, to: value.length } : editor.current?.selection() || { from: value.length, to: value.length });
  }
  function applyNewDrawing(source: string) {
    if (!newDrawing) return;
    const newline = value.includes('\r\n') ? '\r\n' : '\n';
    const fence = '\n\n```excalidraw\n' + source + '\n```\n\n';
    if (readingEditable) visualEditor.current?.insertMarkdown(fence);
    else if (mode === 'read') onChange(value.slice(0, newDrawing.from) + fence.replace(/\n/g, newline) + value.slice(newDrawing.to));
    else editor.current?.replace(fence, newDrawing);
    setNewDrawing(null);
  }
  useEffect(()=>{
    if(!activeBlock)return;
    const finish=(event:KeyboardEvent)=>{
      const element=workbench.current,target=event.target;
      if(event.key!=='Escape'||event.defaultPrevented||!element||element.closest('[hidden],[inert]')||document.querySelector('dialog[open]'))return;
      // Safari may leave focus on body after a toolbar click; modal/settings shortcuts keep priority.
      if(target instanceof Element&&target!==document.body&&!element.contains(target))return;
      event.preventDefault();editor.current?.finishBlock();
    };
    window.addEventListener('keydown',finish);return()=>window.removeEventListener('keydown',finish);
  },[activeBlock]);

  function editTable(range: SourceRange) {
    if (readOnly || busy) return;
    try { setTableEdit({ range, table: parseEditableTable(value.slice(range.from, range.to)) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível editar a tabela.'); }
  }

  const [formattingOpen, setFormattingOpen] = useState(false);
  const [readingActionsOpen, setReadingActionsOpen] = useState(false);
  const [noteInfoOpen, setNoteInfoOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const outlineId = useId(), outlineToggle = useRef<HTMLButtonElement | null>(null);
  const toggleOutline = (button: HTMLButtonElement) => { outlineToggle.current = button; setOutlineOpen(open => !open); };
  const closeOutline = () => {
    setOutlineOpen(false);
    requestAnimationFrame(() => {
      // A rotation can replace the visible toolbar while the outline is open.
      const previous = outlineToggle.current;
      const visible = previous?.getClientRects().length ? previous : [...workbench.current?.querySelectorAll<HTMLButtonElement>('[data-outline-toggle]') || []].find(button => button.getClientRects().length);
      visible?.focus({ preventScroll: true });
    });
  };
  function headingElement(heading: OutlineHeading) {
    return pages.current?.querySelector<HTMLElement>(`article [id="${CSS.escape(heading.id)}"]`) || pages.current?.querySelectorAll<HTMLElement>('article :is(h1,h2,h3,h4,h5,h6)')[heading.ordinal];
  }
  function navigateHeading(heading: OutlineHeading, dismiss: boolean) {
    const navigate = () => {
      if (readingEditable) visualEditor.current?.revealHeading(heading.ordinal);
      else {
        if (mode !== 'read') editor.current?.revealPosition(value.slice(0, heading.from).replace(/\r\n?/g, '\n').length, mode !== 'split');
        if (mode === 'read' || mode === 'split') { const element = headingElement(heading); element?.scrollIntoView({ block: 'start', inline: 'nearest' }); element?.focus({ preventScroll: true }); }
      }
    };
    if (dismiss) { setOutlineOpen(false); requestAnimationFrame(navigate); } else navigate();
  }
  function currentHeading(headings: OutlineHeading[]) {
    const root = pages.current;
    if (!root) return;
    if (mode === 'source' || mode === 'live') {
      const line = editor.current?.visibleLine(root.getBoundingClientRect().top) ?? 1;
      return headings.filter(heading => heading.line <= line).at(-1)?.id;
    }
    const viewport = mode === 'split' ? root.querySelector('article') || root : root;
    const top = viewport.getBoundingClientRect().top + 36;
    return headings.filter(heading => { const element = headingElement(heading); return element && element.getBoundingClientRect().top <= top; }).at(-1)?.id;
  }
  return <section ref={workbench} className={`${styles.workbench} ${compact ? styles.compact : ''}`} data-mode={mode} data-reading-editable={readingEditable} data-formatting-open={formattingOpen} data-block-editing={!!activeBlock} data-reading-actions={readingActionsOpen} aria-label="Bancada Markdown" aria-busy={busy}>
    {compact && <div className={styles.mobileReadingBar}><button type="button" aria-label="Voltar às notas" onClick={() => window.dispatchEvent(new Event('scriba:show-notes'))}><ArrowLeft size={22}/></button><div><button type="button" aria-label={outlineOpen ? "Ocultar outline" : "Mostrar outline"} data-outline-toggle title="Índice da nota" aria-expanded={outlineOpen} aria-controls={outlineId} onClick={event => toggleOutline(event.currentTarget)}><ListTree size={19}/></button><button type="button" aria-label="Informações da nota" onClick={() => setNoteInfoOpen(true)}><Info size={21}/></button><button type="button" disabled={readOnly || busy} aria-label={readingEditable ? 'Concluir edição' : 'Editar nota'} aria-pressed={readingEditable} onClick={() => readingEditable ? setReadingEditable(false) : startVisualEditing()}>{readingEditable ? <Check size={20}/> : <Pencil size={20}/>}</button>{readingEditable && <button type="button" aria-label={formattingOpen ? 'Ocultar formatação' : 'Mostrar formatação'} aria-expanded={formattingOpen} onClick={() => setFormattingOpen(!formattingOpen)}><Type size={20}/></button>}<button type="button" aria-label="Mais opções da nota" aria-expanded={readingActionsOpen} onClick={() => setReadingActionsOpen(!readingActionsOpen)}><MoreVertical size={22}/></button></div></div>}
    {noteInfoOpen && <EditorDialog title="Informações da nota" onClose={() => setNoteInfoOpen(false)}><p>{fileName}</p><p>{words} palavras · {value.length} caracteres</p><p>Leitura estimada: {Math.max(1, Math.ceil(words / 200))} min</p><p>Markdown · UTF-8</p></EditorDialog>}
    <header className={styles.toolbar}>
      <div className={styles.filename}><FileText size={16} aria-hidden="true"/><span title={fileName}>{fileName}</span>{dirty && <span className={styles.dot} aria-label="Documento alterado"/>}{onClose && <button type="button" disabled={readOnly || busy} aria-label="Fechar nota" aria-keyshortcuts="Meta+W Control+W" title="Fechar nota (⌘W / Ctrl+W, quando disponível no navegador)" onClick={onClose}><X size={16} aria-hidden="true"/></button>}</div>
      <div className={styles.modes} role="group" aria-label="Modo de edição">
        {modes.map(([key, label]) => <button type="button" key={key} aria-pressed={key === 'live' ? readingEditable : mode === key && !readingEditable} onClick={() => key === 'live' ? startVisualEditing() : changeMode(key)}>{label}</button>)}
        <button type="button" aria-label="Editar blocos Markdown" title="Editar blocos Markdown" aria-pressed={mode === 'live'} onClick={() => changeMode('live')}><SquareCode size={16}/></button>
        {readingEditable && <button type="button" onClick={() => setReadingEditable(false)} aria-label="Concluir edição" title="Concluir edição"><Check size={16}/></button>}
      </div>
      <div className={styles.actions}>
        <button type="button" aria-label={outlineOpen ? "Ocultar outline" : "Mostrar outline"} data-outline-toggle title="Índice da nota" aria-expanded={outlineOpen} aria-controls={outlineId} onClick={event => toggleOutline(event.currentTarget)}><ListTree size={19}/></button>
        <button type="button" disabled={readOnly || busy} aria-label="Abrir .md / ZIP" aria-keyshortcuts="Meta+O Control+O" title="Abrir .md / ZIP (⌘O / Ctrl+O)" onClick={() => chooseFile()}><FileUp size={15} aria-hidden="true"/><span className={styles.actionLabel}>Abrir .md / ZIP</span></button>
        <button type="button" className={`${styles.download} ${styles.desktopExport}`} aria-label="Baixar .md" title="Baixar .md" onClick={() => downloadMarkdown(value, fileName)}><Download size={15} aria-hidden="true"/><span className={styles.actionLabel}>Baixar .md</span></button>
        <button type="button" className={`${styles.download} ${styles.desktopExport}`} disabled={busy} aria-label="Baixar pacote" title="Baixar pacote" onClick={() => void downloadPackage()}><Package size={15} aria-hidden="true"/><span className={styles.actionLabel}>Baixar pacote</span></button>
        {compact && <details className={styles.exportMenu} onKeyDown={event => {if(event.key==='Escape'&&event.currentTarget.open){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
          <summary aria-label="Exportar nota" title="Exportar nota"><Download size={18} aria-hidden="true"/></summary>
          <div role="group" aria-label="Exportar nota"><button type="button" onClick={event => {downloadMarkdown(value,fileName);event.currentTarget.closest('details')?.removeAttribute('open');}}><Download size={16} aria-hidden="true"/>Baixar .md</button><button type="button" disabled={busy} onClick={event => {void downloadPackage();event.currentTarget.closest('details')?.removeAttribute('open');}}><Package size={16} aria-hidden="true"/>Baixar pacote</button></div>
        </details>}
        {compact && <button type="button" aria-label={formattingOpen ? 'Ocultar formatação' : 'Mostrar formatação'} title="Formatação" aria-expanded={formattingOpen} onClick={() => setFormattingOpen(open => !open)}><Type size={18}/></button>}
        {actions}
      </div>
      <input ref={input} type="file" hidden aria-label="Arquivo Markdown" disabled={readOnly || busy} accept=".md,.markdown,.mdown,.zip,.bear,text/markdown,application/zip" onChange={event => { void open(event.target.files?.[0]); event.target.value = ''; }}/>
      <input ref={imageInput} type="file" hidden multiple aria-label="Arquivos de imagem" disabled={readOnly || busy} accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => { void insertImages(Array.from(event.target.files ?? []), imageRange.current); event.target.value = ''; }}/>
    </header>
    {sourceStatus}
    {(!compact || formattingOpen) && <EditingToolbar onExcalidraw={insertDrawing} onEditBlock={readingEditable ? undefined : toggleBlock} blockEditing={!!activeBlock} disabled={readOnly || busy} onCommand={command} onLink={() => { const range = editor.current?.selection() ?? { from: 0, to: 0 }; setLinkRange(range); setLinkText(readingEditable ? visualEditor.current?.selectedText() || '' : value.slice(range.from, range.to)); setLinkUrl('https://'); setLinkError(''); }} onImage={() => { imageRange.current = editor.current?.selection() ?? { from: value.length, to: value.length }; imageInput.current?.click(); }}/>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {assets.length > 0 && <p className={styles.assetHint}>{assets.length} imagem(ns) anexada(s). Use <strong>Baixar pacote</strong> para levar o Markdown e as imagens juntos.</p>}
    <div className={styles.modeHint}>{readingEditable ? 'Edite diretamente no texto. A formatação permanece visível; Concluir volta à leitura.' : mode === 'live' ? 'Markdown do bloco em edição. Escape volta à leitura.' : mode === 'source' ? 'Markdown original, com todos os marcadores visíveis.' : mode === 'split' ? 'Edite o Markdown e acompanhe a prévia de leitura.' : 'Prévia de leitura. Use Editar para escrever diretamente no texto.'}</div>
    <div className={styles.documentArea}>
    <div ref={pages} data-document-scroll className={`${styles.pages} ${mode === 'split' ? styles.split : ''}`}>
      <div className={styles.source} hidden={mode === 'read'}>
        <MarkdownEditor key={documentId} ref={editor} diagramScope={diagramScope} value={value} onChange={onChange} onSelectionChange={characters => statistics.current?.setEditorSelection(characters)} livePreview={mode === 'live'} doubleClickToEdit={doubleClickToEdit} onBlockEditChange={blockChanged} readOnly={readOnly || busy} assets={assets} onImageFiles={(files, range) => { void insertImages(files, range); }}/>
      </div>
      {readingEditable ? <VisualEditorBoundary onRead={() => changeMode('read')} onSource={() => changeMode('source')}><Suspense fallback={<p role="status" className={styles.reading}>Preparando edição…</p>}><RichMarkdownEditor key={documentId} ref={visualEditor} value={value} onChange={onChange} assets={assets} diagramScope={diagramScope} disabled={readOnly || busy} onEditDiagram={editBlock} onImageFiles={files => { void insertImages(files, { from: value.length, to: value.length }); }}/></Suspense></VisualEditorBoundary> : (mode === 'split' || mode === 'read') && <MarkdownReadingView diagramScope={diagramScope} value={value} assets={assets} doubleClickToEdit={doubleClickToEdit} onEditBlock={!readOnly && !busy ? editBlock : undefined} onEditTable={!readOnly && !busy ? editTable : undefined} onToggleTask={!readOnly && !busy ? range => {
        const source = value.slice(range.from, range.to);
        const marker = source.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/);
        if (marker) editor.current?.replace(marker[2] === ' ' ? 'x' : ' ', { from: range.from + marker[1].length, to: range.from + marker[1].length + 1 });
      } : undefined} onChangeDiagram={!readOnly && !busy ? (range, source) => {
        onChange(value.slice(0, range.from) + replaceExcalidrawFence(value.slice(range.from, range.to), source) + value.slice(range.to));
      } : undefined}/>}
    </div>
    {outlineOpen && <DocumentOutline id={outlineId} source={value} scrollContainer={pages} viewKey={`${mode}:${readingEditable}`} currentHeading={currentHeading} onNavigate={navigateHeading} onClose={closeOutline}/>}
    </div>
    <output className={styles.blockStatus} aria-live="polite">{activeBlock?'Markdown do bloco em edição. Escape conclui; clique em outro bloco para continuar.':''}</output>
    <footer className={styles.footer} aria-label="Estatísticas do documento"><SelectionStatistics ref={statistics} container={pages} resetKey={`${mode}:${documentId}`} words={words} characters={value.length}/><span>{readOnly ? 'Somente leitura' : dirty ? 'Alterações nesta sessão' : 'Documento carregado'}</span><span>UTF-8 · .md</span></footer>
    {linkRange && <EditorDialog title="Inserir link" onClose={() => setLinkRange(null)}>
      {linkError && <p role="alert">{linkError}</p>}<form onSubmit={event => {
        event.preventDefault();
        try {
          const url = new URL(linkUrl, 'https://local.invalid');
          if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('invalid');
          const text = (linkText || linkUrl).replace(/[\[\]\\\r\n]/g, ' ');
          const target = linkUrl.replace(/[\s<>]/g, char => encodeURIComponent(char));
          if (readingEditable) visualEditor.current?.insertLink(text, target);
          else { if (mode === 'read') setMode('live'); editor.current?.replace(`[${text}](<${target}>)`, linkRange); }
          setLinkRange(null);
        } catch { setLinkError('Use um link HTTP, HTTPS, e-mail ou âncora do documento.'); }
      }}><label>Texto do link<input value={linkText} onChange={event => setLinkText(event.target.value)}/></label><label>Endereço<input required value={linkUrl} onChange={event => setLinkUrl(event.target.value)}/></label><footer><button type="button" onClick={() => setLinkRange(null)}>Cancelar</button><button type="submit">Inserir link</button></footer></form>
    </EditorDialog>}
    {tableEdit && <TableEditorDialog initial={tableEdit.table} onClose={() => setTableEdit(null)} onSave={source => { editor.current?.replace(source, tableEdit.range); setTableEdit(null); }}/>}
    {newDrawing && <ExcalidrawEditor source={EMPTY_EXCALIDRAW} identity={`new:${diagramScope}`} isNew dark={document.documentElement.dataset.theme !== 'light'} onClose={() => setNewDrawing(null)} onApply={applyNewDrawing}/>}
  </section>;
}
