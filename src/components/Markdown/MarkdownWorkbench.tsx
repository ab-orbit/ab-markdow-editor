import { DocumentLoading } from '../Brand/DocumentLoading';
import { afterPaint } from '@/lib/afterPaint';
import { extractedConversionMarkdown, conversionCopyName } from '@/lib/markdown/conversionExport';
import { MobileNoteInformation } from './MobileNoteInformation';
import { handleDetailsMenu, closeOtherDetailsMenus } from '../ui/actionMenu';
import { t } from '../../i18n';
import { lazy, Suspense, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Download, Copy, FileImage, FileUp, FileText, FileDown, Type, ArrowLeft, Info, Settings, MoreVertical, Pencil, Check, SquareCode, Code2, Columns2, BookOpen, X, ListTree, PenTool, Sun, Plus, Save, SaveAll } from 'lucide-react';
import {authorizedFetch} from '@/lib/session';
import type {SavedFileTarget} from '@/lib/savedFile';
import {isIosApp, iosBridge, shareNativeBlob, type NativeWorkspaceCommand} from '@/lib/ios';
import {useNativeWorkspace, useNativeWorkspaceCommands} from '@/lib/useNativeWorkspace';
import {useReadingContinuity} from './useReadingContinuity';
import { readMarkdownFile, downloadMarkdown, downloadBlob } from '@/lib/markdown/files';
import { createMarkdownPackage, prepareImages, readMarkdownPackage } from '@/lib/markdown/assets';
import { parseEditableTable, type EditableTable } from '@/lib/markdown/tables';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import { MarkdownReadingView } from './MarkdownReadingView';
import { documentOutline, collapsedOutlineIds } from '@/lib/markdown/outline';
import { useSplitScroll } from './useSplitScroll';
import { IconGallery } from './IconGallery';
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
import { WhiteboardSource } from '@/lib/markdown/whiteboard';
import type { WhiteboardEditorHandle } from './WhiteboardEditor';

const RichMarkdownEditor = lazy(() => import('./RichMarkdownEditor'));
const WhiteboardEditor = lazy(() => import('./WhiteboardEditor'));

export type MarkdownMode = 'live' | 'source' | 'split' | 'read' | 'whiteboard';
export interface MarkdownWorkbenchHandle {
  /** Reuse the native chooser; reload requires the original filename and preserves the view mode. */
  openFile: (reloadOriginal?: boolean) => void;
  /** File/package operations must finish before the host saves or closes the note. */
  isBusy: () => boolean;
  /** Commit active canvas text before the host decides whether a new note needs confirmation. */
  flushInput: () => Promise<boolean>;
  /** Select a new file destination, retaining the current file on cancellation or failure. */
  saveAs: () => void;
  /** Place the caret in a newly created source note without changing its content. */
  focus: () => void;
}
export interface MarkdownWorkbenchProps {
  /** UIKit owns document chrome only while this workbench is the active screen. */
  nativeChromeActive?: boolean;
  nativeLibraryOpen?: boolean;
  nativeReloadLabel?: string;
  nativeReloadEnabled?: boolean;
  nativeDocumentStatus?: string;
  /** Storage destination and filename namespace diagram presentation preferences. */
  diagramScope?: string;
  /** Host commands reuse the workbench's file input and operation guards. */
  ref?: Ref<MarkdownWorkbenchHandle>;
  /** Markdown owned by the consuming screen. */
  value: string;
  /** Receives source edits and successful local file imports. */
  onChange: (value: string) => void;
  /** Existing destinations keep extracted converter content separate from every saved original. */
  existingFileNames?: readonly string[];
  /** Controlled download filename. */
  fileName: string;
  /** Receives the name of a successfully imported file. */
  onFileNameChange: (name: string) => void;
  /** Record the original source and distinguish explicit disk reloads from normal imports. */
  /** Preserve the active note before replacing it with a validated import. */
  onBeforeImport?: () => Promise<boolean>;
  onImport?: (source: string, name: string, reloaded?: boolean) => Promise<void>;
  /** Initial display mode, read once at mount. */
  initialMode?: MarkdownMode;
  /** Preserve the document reading position across a source refresh. */
  initialScrollTop?: number;
  /** Host actions displayed alongside the document's existing toolbar controls. */
  actions?: ReactNode;
  /** Host save command kept beside Save As. */
  saveAction?: ReactNode;
  /** Mobile settings action belongs to the consuming application. */
  onOpenSettings?: () => void;
  /** Persisted dates when the current document has known metadata. */
  createdAt?: string;
  modifiedAt?: string;
  /** Appearance and settings follow the document outline control. */
  appearanceActions?: ReactNode;
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
  /** The canvas commits active text input before invoking the host's save action. */
  onSave?: () => void;
  /** Adopt a successfully written file as the active save/reload destination. */
  /** Rename the current note in its actual storage destination rather than downloading a copy. */
  onRename?: (name:string) => Promise<void>;
  /** Save the original and open a new independent stored copy. */
  onDuplicate?: () => Promise<void>;
  onSaveAs?: (target:SavedFileTarget,source:string,assets:MarkdownAsset[]) => void;
  /** Private capability used only to suggest the current native directory. */
  sourceId?: string | null;
  /** Explicit destination of a file saved outside the note library. */
  savedFileLocation?: string | null;
}



/** File operations and presentation around the reusable controlled editor. */
export function MarkdownWorkbench({ ref, nativeChromeActive = true, nativeLibraryOpen = false, nativeReloadLabel, nativeReloadEnabled = false, nativeDocumentStatus, value, onChange, fileName, existingFileNames = [], onFileNameChange, onImport, onBeforeImport, initialMode = 'live', initialScrollTop = 0, actions, saveAction, onOpenSettings, createdAt, modifiedAt, appearanceActions, sourceStatus, onModeChange, compact = false, readOnly = false, warnBeforeUnload = true, onClose, onSave, onSaveAs, onRename, onDuplicate, sourceId, savedFileLocation, doubleClickToEdit = true, initialAssets, onAssetsChange, saveRevision = 0, diagramScope = fileName }: MarkdownWorkbenchProps) {
  const nativeWorkspace = useNativeWorkspace();
  const modes = [
    ['live', t("Escrever"), Pencil, t("Edição visual")],
    ['source', t("Fonte"), Code2, t("Código Markdown completo")],
    ['split', t("Visão"), Columns2, t("Código e prévia lado a lado")],
    ['read', t("Ler"), BookOpen, t("Leitura formatada")],
  ] as const;
  const whiteboardSource = useRef(new WhiteboardSource());
  const [initialBoards] = useState(() => whiteboardSource.current.read(value));
  const whiteboard = useRef<WhiteboardEditorHandle>(null);
  const [selectedBoard, setSelectedBoard] = useState(() => {
    try { const index = Number(localStorage.getItem(`scriba-whiteboard-scene:${diagramScope}`)); return Number.isInteger(index) && index >= 0 && index < initialBoards.length ? index : 0; } catch { return 0; }
  }), [boardCount, setBoardCount] = useState(0);
  const [mode, setMode] = useState<MarkdownMode>(() => {
    let preferred: string | null = null;
    try { preferred = localStorage.getItem(`scriba-document-format:${diagramScope}`); } catch { /* Source remains usable if presentation preferences are unavailable. */ }
    return initialMode === 'whiteboard' || preferred === 'whiteboard' && initialBoards.length > 0 || preferred === null && whiteboardSource.current.standalone ? 'whiteboard' : initialMode === 'live' ? 'read' : initialMode;
  });
  // Ordinary note typing does not invoke another full-document Markdown parser.
  const boards = mode === 'whiteboard' ? whiteboardSource.current.read(value) : initialBoards;
  const [readingEditable, setReadingEditable] = useState(initialMode === 'live');
  const [writeAfterBoard,setWriteAfterBoard]=useState<number>();
  const visualEditor = useRef<RichMarkdownEditorHandle>(null);
  useEffect(() => { onModeChange?.(mode); }, [mode,onModeChange]);
  useEffect(() => { if (!readOnly) try { localStorage.setItem(`scriba-document-format:${diagramScope}`, mode === 'whiteboard' ? 'whiteboard' : 'note'); } catch { /* A layout preference never prevents editing. */ } }, [mode,diagramScope,readOnly]);
  useEffect(() => { if (!readOnly && mode === 'whiteboard') try { localStorage.setItem(`scriba-whiteboard-scene:${diagramScope}`, String(selectedBoard)); } catch { /* Scene navigation remains available without persistent preferences. */ } }, [selectedBoard,mode,diagramScope,readOnly]);
  const workbench = useRef<HTMLElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!nativeWorkspace.nativeChrome || !workbench.current) return;
    const root=workbench.current;
    const update=()=>{
      root.dataset.lowHeight=String(root.clientHeight<420);
      const area=pages.current;
      if (!area || mode!=='split') return;
      const box=area.getBoundingClientRect(), fold=nativeWorkspace.division;
      root.dataset.splitAxis=box.width>=660?'column':'row';
      root.style.removeProperty('--duo-split-first');root.style.setProperty('--duo-split-gap','0px');
      if (fold && fold.height>=nativeWorkspace.height*.6) {
        root.dataset.splitAxis='column';
        root.style.setProperty('--duo-split-first',`${Math.max(0,Math.min(box.width,fold.x-box.left))}px`);
        root.style.setProperty('--duo-split-gap',`${Math.max(12,fold.width)}px`);
      } else if (fold && fold.width>=nativeWorkspace.width*.6) {
        root.dataset.splitAxis='row';
        root.style.setProperty('--duo-split-first',`${Math.max(0,Math.min(box.height,fold.y-box.top))}px`);
        root.style.setProperty('--duo-split-gap',`${Math.max(12,fold.height)}px`);
      }
    };
    const observer=new ResizeObserver(update);observer.observe(root);if(pages.current)observer.observe(pages.current);update();
    return()=>observer.disconnect();
  }, [nativeWorkspace, mode]);
  useEffect(() => {const frame=requestAnimationFrame(()=>{if(pages.current)pages.current.scrollTop=initialScrollTop;});return()=>cancelAnimationFrame(frame);}, []);
  const [activeBlock,setActiveBlock] = useState<SourceRange|null>(null);
  const pendingBlock = useRef<SourceRange|null>(null);
  const blockFromReading = useRef(false);
  const [baseline, setBaseline] = useState(value);
  const [busy, setBusy] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const saveAsOperation = useRef(false);
  const [saveCopyName,setSaveCopyName] = useState<string|null>(null);
  const [copyNotice,setCopyNotice] = useState("");
  const [error, setError] = useState("");
  const [documentId, setDocumentId] = useState(0);
  useReadingContinuity(pages, nativeWorkspace.nativeChrome && mode === 'read', documentId);
  const documentContext = useRef({ id: documentId, scope: diagramScope });
  documentContext.current = { id: documentId, scope: diagramScope };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const sameDocument = (snapshot: typeof documentContext.current) => mounted.current && snapshot.id === documentContext.current.id && snapshot.scope === documentContext.current.scope;
  const [linkRange, setLinkRange] = useState<SourceRange | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState("");
  const [tableEdit, setTableEdit] = useState<{ range: SourceRange; table: EditableTable } | null>(null);
  const [newDrawing, setNewDrawing] = useState<SourceRange | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reloadImport = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const nativePickerOpen = useRef(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const iconRange = useRef<SourceRange>({ from: 0, to: 0 });
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<string>>(() => new Set());
  function toggleHeading(id: string) { setCollapsedHeadings(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  const inlineEditor = useRef<MarkdownEditorHandle>(null);
  const imageRange = useRef<SourceRange>({ from: 0, to: 0 });
  const editor = useRef<MarkdownEditorHandle>(null);
  const statistics = useRef<SelectionStatisticsHandle>(null);
  function chooseFile(reloadOriginal = false) {
    if (readOnly || busy || saveAsOperation.current || nativePickerOpen.current) return;
    reloadImport.current = reloadOriginal;setError("");
    if (!nativeWorkspace.nativeChrome) { input.current?.click(); return; }
    const original=documentContext.current;nativePickerOpen.current=true;setBusy(true);
    void iosBridge.openNote().then(async result=>{
      nativePickerOpen.current=false;setBusy(false);
      if ('cancelled' in result || !sameDocument(original)) return;
      const bytes=Uint8Array.from(atob(result.data),character=>character.charCodeAt(0));
      await open(new File([bytes],result.name,{type:/\.(zip|bear)$/i.test(result.name)?'application/zip':'text/markdown'}));
    }).catch(cause=>{if(sameDocument(original))setError(cause instanceof Error?t(cause.message):t('Não foi possível abrir o arquivo.'));}).finally(()=>{nativePickerOpen.current=false;if(mounted.current)setBusy(false);});
  }
  const [renameName,setRenameName]=useState<string|null>(null),[renameError,setRenameError]=useState(""),[renaming,setRenaming]=useState(false);
  async function requestRename() {
    setReadingActionsOpen(false);
    if(!onRename || readOnly || busy)return;
    if(mode==='whiteboard' && whiteboard.current && !await whiteboard.current.flush())return;
    await afterPaint();setRenameError("");setRenameName(fileName.split('/').at(-1)!);
  }
  async function applyRename() {
    if(!onRename || renameName===null || renaming)return;
    const leaf=renameName.trim();
    if(!leaf || /[<>:"/\\|?*\u0000-\u001f]/.test(leaf) || leaf.startsWith('.') || /[. ]$/.test(leaf)){setRenameError(t("Informe um nome de arquivo válido, sem barras."));return;}
    const fullName=fileName.slice(0,fileName.lastIndexOf('/')+1)+( /\.(md|markdown|mdown)$/i.test(leaf)?leaf:leaf+'.md');
    setRenaming(true);setRenameError("");
    try{await onRename(fullName);setRenameName(null);}catch(error){setRenameError(error instanceof Error?t(error.message):t("Não foi possível renomear o arquivo."));}finally{setRenaming(false);}
  }
  useImperativeHandle(ref, () => ({
    openFile: chooseFile,
    isBusy: () => busy || nativePickerOpen.current || saveAsOperation.current || mode === 'whiteboard' && !!whiteboard.current?.isBusy() || !!document.querySelector('dialog[data-scriba-canvas][open]') || !!workbench.current?.querySelector('dialog[open]'),
    flushInput: async () => {
      if (readOnly || busy || document.querySelector('dialog[open]')) return false;
      if (mode === 'whiteboard') return whiteboard.current ? whiteboard.current.flush() : false;
      return true;
    },
    focus: () => { if (readingEditable) visualEditor.current?.focus(); else editor.current?.revealPosition(0, true); },
    saveAs: () => {void saveAs();},
  }));
  const { assets, replace: replaceAssets, append: appendAssets } = useMarkdownAssets();
  const pdfOperation = useRef<AbortController | null>(null);
  const [pdfProgress, setPdfProgress] = useState("");
  const exportInput = useRef({ value, assets, fileName, diagramScope, busy, readOnly });
  exportInput.current = { value, assets, fileName, diagramScope, busy, readOnly };
  useEffect(() => () => pdfOperation.current?.abort(), []);
  useEffect(() => { if (initialAssets) replaceAssets(initialAssets); }, []);
  useEffect(() => { onAssetsChange?.(assets); }, [assets, onAssetsChange]);
  useEffect(() => { if (saveRevision) setBaseline(value); }, [saveRevision]);
  const dirty = baseline !== value;
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;

  useEffect(() => {
    if (!dirty || !warnBeforeUnload) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, warnBeforeUnload]);

  async function open(file?: File) {
    const reloadOriginal = reloadImport.current;reloadImport.current = false;
    if (!file || readOnly || busy) return;
    // A native file read can finish after the user selects another library note.
    const importingDocument = documentContext.current;
    const importedName = file.name.replace(/\.(zip|bear)$/i, '.md');
    const expectedName = fileName.split(/[\\/]/).at(-1);
    if (reloadOriginal && importedName !== expectedName) {setError(t("Selecione o arquivo original {0} para recarregar esta nota.", expectedName));return;}
    if (dirty && (reloadOriginal || !onBeforeImport) && !window.confirm(reloadOriginal ? t("Recarregar substituirá as alterações não salvas desta nota. Continuar?") : t("Abrir outro arquivo substituirá as alterações desta sessão. Continuar?"))) return;
    if (!reloadOriginal && mode === 'whiteboard' && !await whiteboard.current?.flush()) return;
    if (!sameDocument(importingDocument)) return;
    setError(""); setBusy(true); setOpeningFile(true);
    await afterPaint();
    try {
      const packaged = /\.(zip|bear)$/i.test(file.name) ? await readMarkdownPackage(file) : null;
      const original = packaged?.value ?? await readMarkdownFile(file);
      if (!sameDocument(importingDocument)) return;
      const extracted = extractedConversionMarkdown(original);
      const source = extracted ?? original;
      if (!reloadOriginal && onBeforeImport && !await onBeforeImport()) return;
      if (!sameDocument(importingDocument)) return;
      replaceAssets(packaged?.files ?? []);
      const name = extracted !== null ? conversionCopyName(importedName, existingFileNames) : importedName;
      blockFromReading.current=false;setReadingEditable(false);
      if (!reloadOriginal) setMode('read');
      if (!reloadOriginal) {whiteboardSource.current.read(source);setSelectedBoard(0);setMode(whiteboardSource.current.standalone ? 'whiteboard' : 'read');setReadingActionsOpen(false);}
      onChange(source); onFileNameChange(name); setBaseline(source); setDocumentId(id => id + 1);
      await onImport?.(source, name, reloadOriginal);
      if (!mounted.current) return;
      if (!reloadOriginal) requestAnimationFrame(() => { if(mounted.current && pages.current)pages.current.scrollTop=0; });
      if (extracted !== null) setCopyNotice(t("Conteúdo Markdown extraído do JSON. O arquivo original foi preservado; a cópia usa outro nome."));
      blockFromReading.current=false;
      setReadingEditable(false);
    } catch (cause) {
      if (sameDocument(importingDocument)) setError(cause instanceof Error ? t(cause.message) : t("Não foi possível abrir o arquivo."));
    } finally { if (mounted.current) {setBusy(false); setOpeningFile(false);} }
  }

  function command(action: MarkdownCommand) {
    if (readOnly || busy) return;
    if (inlineEditor.current) { inlineEditor.current.command(action); return; }
    if (readingEditable) { visualEditor.current?.command(action); return; }
    if (mode === 'read') setMode('live');
    editor.current?.command(action);
  }

  async function insertImages(files: File[], range: SourceRange) {
    if (!files.length || readOnly || busy) return;
    setError(""); setBusy(true);
    try {
      const prepared = await prepareImages(files, assets);
      appendAssets(prepared);
      if (readingEditable && visualEditor.current) {
        visualEditor.current.insertMarkdown(prepared.map(asset => `![${asset.file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\\\r\n]/g, ' ')}](${asset.path})`).join('\n\n'));
        return;
      }
      const before = value.slice(0, range.from).match(/\n*$/)![0].length;
      const after = value.slice(range.to).match(/^\n*/)![0].length;
      const prefix = range.from === 0 ? "" : '\n'.repeat(Math.max(0, 2 - before));
      const suffix = '\n'.repeat(Math.max(0, 2 - after));
      const source = prefix + prepared.map(asset => `![${asset.file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\\\r\n]/g, ' ')}](${asset.path})`).join('\n\n') + suffix;
      if (mode === 'read') setMode('live');
      editor.current?.replace(source, range);
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Não foi possível inserir a imagem.")); }
    finally { setBusy(false); }
  }

  async function downloadPackage() {
    setError(""); setBusy(true);
    try {
      const bytes = await createMarkdownPackage(value, assets);
      downloadBlob(new Blob([Uint8Array.from(bytes)], { type: 'application/zip' }), `${fileName.replace(/\.[^.]+$/, "") || t("documento")}.zip`);
    } catch { setError(t("Não foi possível preparar o pacote.")); }
    finally { setBusy(false); }
  }

  async function exportPdf() {
    if (busy || pdfOperation.current) return;
    const operation = new AbortController(), original = documentContext.current;
    pdfOperation.current = operation;
    let ownsBusy = false;
    try {
      if (mode === 'whiteboard' && !await whiteboard.current?.flush()) return;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!sameDocument(original) || exportInput.current.busy || operation.signal.aborted) return;
      const snapshot = exportInput.current;
      ownsBusy = true; setBusy(true); setError(""); setPdfProgress(t("Preparando PDF…"));
      const { createMarkdownPdf } = await import('@/lib/markdown/pdf');
      const blob = await createMarkdownPdf({ ...snapshot, signal: operation.signal, onProgress: setPdfProgress });
      if (!operation.signal.aborted && sameDocument(original)) downloadBlob(blob, `${snapshot.fileName.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/, "") || t("documento")}.pdf`);
    } catch (cause) {
      if (mounted.current && !operation.signal.aborted) setError(cause instanceof Error ? t(cause.message) : t("Não foi possível exportar o PDF."));
    } finally {
      if (pdfOperation.current === operation) pdfOperation.current = null;
      if (mounted.current && ownsBusy) { setBusy(false); setPdfProgress(""); }
    }
  }

  async function fileRequest<T>(route:string,body:unknown):Promise<T> {
    const response=await authorizedFetch(route,body),result=await response.json();
    if(!response.ok)throw new Error(result.error||t("Não foi possível salvar o arquivo."));
    return result;
  }
  async function saveAs() {
    if(!onSaveAs||readOnly||busy||saveAsOperation.current||document.querySelector('dialog[open]'))return;
    const original=documentContext.current;saveAsOperation.current=true;setBusy(true);setError("");setCopyNotice("");
    try {
      // Reach the browser picker synchronously inside the click/keyboard gesture, before processing bytes.
      const target=await fileRequest<SavedFileTarget|null|{unsupported:true}>('pick-save-as',{name:fileName,hasAssets:assets.length>0,id:sourceId});
      if(!target||!sameDocument(original))return;
      if('unsupported' in target){setSaveCopyName(fileName.split(/[\\/]/).at(-1)!);return;}
      if(mode==='whiteboard'&&!await whiteboard.current?.flush())return;
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(!sameDocument(original))return;
      const snapshot=exportInput.current;
      const files=await Promise.all(snapshot.assets.map(async asset=>{const bytes=new Uint8Array(await asset.file.arrayBuffer());let binary="";for(let index=0;index<bytes.length;index+=8192)binary+=String.fromCharCode(...bytes.subarray(index,index+8192));return {path:asset.path,data:btoa(binary),mime:asset.file.type};}));
      const result=await fileRequest<{version:string}>('finder-save',{id:target.id,value:snapshot.value,version:target.version,files});
      if(sameDocument(original))onSaveAs({...target,version:result.version},snapshot.value,snapshot.assets);
    }catch(cause){if(mounted.current)setError(cause instanceof Error?t(cause.message):t("Não foi possível salvar como."));}
    finally{saveAsOperation.current=false;if(mounted.current)setBusy(false);}
  }
  async function exportCopy() {
    if(!saveCopyName||busy)return;
    const selectedName=saveCopyName.replace(/[\\/]/g,'-').trim();if(!selectedName)return;
    setSaveCopyName(null);setBusy(true);setError("");
    try {
      if(mode==='whiteboard'&&!await whiteboard.current?.flush())return;
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      const snapshot=exportInput.current,packaged=snapshot.assets.length>0;
      const name=selectedName.replace(/\.(md|markdown|mdown|zip)$/i,"")+(packaged?'.zip':'.md');
      const blob=packaged?new Blob([Uint8Array.from(await createMarkdownPackage(snapshot.value,snapshot.assets))],{type:'application/zip'}):new Blob([snapshot.value],{type:'text/markdown;charset=utf-8'});
      if(isIosApp)await shareNativeBlob(blob,name);else downloadBlob(blob,name);
      setCopyNotice(t("Cópia preparada. O destino de salvamento da nota aberta continua o mesmo."));
    }catch(cause){setError(cause instanceof Error?t(cause.message):t("Não foi possível preparar a cópia."));}
    finally{if(mounted.current)setBusy(false);}
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
    setMode('read'); setReadingEditable(true); setFormattingOpen(true); setReadingActionsOpen(false);
  }
  function updateWhiteboard(source: string) {
    const next = whiteboardSource.current.replace(selectedBoard, source);
    if (next !== value) onChange(next);
  }
  async function selectFormat(format: 'note' | 'whiteboard') {
    if (busy || readOnly) return false;
    const snapshot = documentContext.current;
    const applied = mode !== 'whiteboard' || format !== 'note' || !whiteboard.current || await whiteboard.current.flush();
    if (!sameDocument(snapshot)) return false;
    if (!applied && !window.confirm(t("Há alterações no quadro que não puderam ser aplicadas. Voltar à nota e descartar essas alterações do quadro?"))) return false;
    if (format === 'whiteboard') {
      const current = whiteboardSource.current.read(value);
      if (!current.length) { onChange(whiteboardSource.current.append()); setSelectedBoard(0); }
      else setSelectedBoard(index => Math.min(index, current.length - 1));
    }
    blockFromReading.current = false; setReadingEditable(format === 'note' && mode === 'whiteboard'); setWriteAfterBoard(format === 'note' && mode === 'whiteboard' ? selectedBoard : undefined); setOutlineOpen(false); setReadingActionsOpen(false);
    setMode(format === 'whiteboard' ? 'whiteboard' : 'read');
    return true;
  }
  async function selectWhiteboard(index: number) {
    const snapshot = documentContext.current;
    if (readOnly || busy || !await whiteboard.current?.flush() || !sameDocument(snapshot)) return;
    setSelectedBoard(index); setBoardCount(0);
  }
  async function newWhiteboard() {
    const snapshot = documentContext.current;
    if (readOnly || busy || !await whiteboard.current?.flush() || !sameDocument(snapshot)) return;
    const index = boards.length;
    onChange(whiteboardSource.current.append()); setSelectedBoard(index); setBoardCount(0);
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
    catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Não foi possível editar a tabela.")); }
  }

  const [formattingOpen, setFormattingOpen] = useState(false);
  const [smallScreen,setSmallScreen]=useState(()=>matchMedia('(max-width: 899px), (max-height: 600px) and (pointer: coarse)').matches);
  useEffect(()=>{const media=matchMedia('(max-width: 899px), (max-height: 600px) and (pointer: coarse)'),update=()=>setSmallScreen(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const [mobileExportOpen,setMobileExportOpen]=useState(false);
  const [mobileFormattingOpen, setMobileFormattingOpen] = useState(false);
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
  useEffect(() => { if (mode === 'split') setCollapsedHeadings(new Set()); }, [mode]);
  useSplitScroll(pages, editor, mode === 'split', value, () => { if (collapsedHeadings.size) setCollapsedHeadings(new Set()); });

  function headingElement(heading: OutlineHeading) {
    return pages.current?.querySelector<HTMLElement>(`article [id="${CSS.escape(heading.id)}"]`) || pages.current?.querySelectorAll<HTMLElement>("article :is(h1,h2,h3,h4,h5,h6)")[heading.ordinal];
  }
  function navigateHeading(heading: OutlineHeading, dismiss: boolean) {
    setCollapsedHeadings(previous => {
      const next = new Set(previous), ancestors: OutlineHeading[] = [];
      for (const item of documentOutline(value)) {
        while (ancestors.length && ancestors.at(-1)!.level >= item.level) ancestors.pop();
        if (item.id === heading.id) { ancestors.forEach(parent => next.delete(parent.id)); break; }
        ancestors.push(item);
      }
      return next;
    });
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
    return headings.filter(heading => { const element = headingElement(heading); return element && element.getClientRects().length > 0 && element.getBoundingClientRect().top <= top; }).at(-1)?.id;
  }
  useNativeWorkspaceCommands(id => {
    if (!nativeChromeActive || readOnly || busy || document.querySelector('dialog[open]')) return;
    if (id === 'notes' && mode === 'split') changeMode('read');
    else if (id === 'edit') {
      if (mode === 'whiteboard') void selectFormat('note');
      else if (readingEditable || mode !== 'read') { changeMode('read'); setFormattingOpen(false); (document.activeElement as HTMLElement)?.blur?.(); }
      else startVisualEditing();
    } else if (id.startsWith('mode:')) {
      const selected = id.slice(5);
      if (selected === 'whiteboard') void selectFormat('whiteboard');
      else if (['live','read','source','split','blocks'].includes(selected)) {
        const snapshot=documentContext.current;
        const apply=()=>{if(selected==='live')startVisualEditing();else changeMode(selected==='blocks'?'live':selected as MarkdownMode);};
        if (mode === 'whiteboard') void selectFormat('note').then(applied => {if(applied && sameDocument(snapshot))apply();});
        else apply();
      }
    } else if (id === 'outline') setOutlineOpen(open => !open);
    else if (id === 'info') setNoteInfoOpen(true);
    else if (id === 'formatting') { setFormattingOpen(open => !open); if (!readingEditable) startVisualEditing(); }
    else if (id === 'export:pdf') void exportPdf();
    else if (id === 'export:markdown') { if (assets.length) void downloadPackage(); else downloadMarkdown(value,fileName); }
    else if (id === 'save-as') void saveAs();
    else if (id === 'rename') void requestRename();
    else if (id === 'duplicate') void onDuplicate?.();
  });
  const nativeCommand = (id: string, title: string, symbol: string, extra: Partial<NativeWorkspaceCommand> = {}): NativeWorkspaceCommand => ({id,title,symbol,enabled:!readOnly && !busy,...extra});
  const nativeLibraryCommand=nativeCommand('notes',nativeLibraryOpen?t('Ocultar notas recentes'):t('Notas recentes'),'sidebar.left',{priority:'high',selected:nativeLibraryOpen});
  const nativeEditCommand=nativeCommand('edit',mode==='whiteboard'?t('Voltar à nota'):readingEditable || mode!=='read'?t('Concluir'):t('Editar'),mode==='whiteboard'?'doc.text':readingEditable || mode!=='read'?'checkmark':'pencil',{priority:'high'});
  const nativeChrome = JSON.stringify({
    title: fileName.split('/').at(-1) || fileName,
    // A compact vertical bar retains its first action when the keyboard compresses it.
    navigation: readingEditable || mode!=='read' ? [nativeEditCommand,nativeLibraryCommand] : [nativeLibraryCommand,nativeEditCommand],
    toolbar: [
      nativeCommand('new',t('Nova nota'),'square.and.pencil',{priority:'high'}),nativeCommand('open',t('Abrir .md / ZIP'),'folder'),
      nativeCommand('view',t('Modo de edição'),'rectangle.split.2x1',{priority:'high',children:[...modes.map(([key,label])=>nativeCommand(`mode:${key}`,label,key==='live'?'pencil':key==='source'?'chevron.left.forwardslash.chevron.right':key==='split'?'rectangle.split.2x1':'book',{selected:key==='live'?readingEditable:mode===key&&!readingEditable})),nativeCommand('mode:blocks',t('Blocos'),'square.dashed',{selected:mode==='live'&&!readingEditable}),nativeCommand('mode:whiteboard',t('Whiteboard'),'pencil.tip.crop.circle',{selected:mode==='whiteboard'})]}),
      nativeCommand('outline',t('Índice da nota'),'list.bullet.indent',{enabled:mode!=='whiteboard'&&!busy,selected:outlineOpen}),
      nativeCommand('export',t('Exportar'),'square.and.arrow.up',{children:[nativeCommand('export:markdown',t('Markdown (.md)'),'doc.text'),nativeCommand('export:pdf',t('PDF (.pdf)'),'doc.richtext'),...(onSaveAs?[nativeCommand('save-as',t('Salvar como…'),'externaldrive')]:[])]}),
      nativeCommand('save',t('Salvar nota'),'square.and.arrow.down',{priority:'high'})
    ],
    overflow: [nativeCommand('info',t('Informações da nota'),'info.circle'),nativeCommand('formatting',t('Formatação'),'textformat',{enabled:mode!=='whiteboard'&&!readOnly&&!busy,selected:formattingOpen}),nativeCommand('reload',nativeReloadLabel || t('Recarregar nota'),'arrow.clockwise',{enabled:nativeReloadEnabled&&!readOnly&&!busy}),...(onRename?[nativeCommand('rename',t('Renomear arquivo'),'pencil.line')]:[]),...(onDuplicate?[nativeCommand('duplicate',t('Criar uma cópia'),'doc.on.doc')]:[]),nativeCommand('theme',t('Aparência'),'circle.lefthalf.filled'),nativeCommand('settings',t('Configurações'),'gearshape'),nativeCommand('close',t('Fechar nota'),'xmark')]
  });
  useEffect(() => {
    if (nativeWorkspace.nativeChrome && nativeChromeActive) void iosBridge.workspaceChrome(JSON.parse(nativeChrome)).catch(() => {});
  }, [nativeWorkspace.nativeChrome, nativeChromeActive, nativeChrome]);
  return <section ref={workbench} data-markdown-workbench className={`${styles.workbench} ${compact ? styles.compact : ""}`} data-mode={mode} data-reading-editable={readingEditable} data-mobile-formatting={mobileFormattingOpen} data-formatting-open={formattingOpen} data-block-editing={!!activeBlock} data-reading-actions={readingActionsOpen} aria-label={t("Bancada Markdown")} aria-busy={busy}>{openingFile && <DocumentLoading label={t("Abrindo documento…")}/>}{compact && <div data-ui="toolbar" className={styles.mobileReadingBar}><button type="button" aria-label={t("Voltar às notas")} onClick={() => window.dispatchEvent(new Event('scriba:show-notes'))}><ArrowLeft size={22}/></button><button className={styles.mobileDocumentFormat} type="button" disabled={readOnly||busy} aria-label={mode==='whiteboard'?t("Voltar à nota"):t("Abrir whiteboard")} onClick={()=>void selectFormat(mode==='whiteboard'?'note':'whiteboard')}>{mode==='whiteboard'?<FileText size={18}/>:<PenTool size={18}/>}<span>{mode==='whiteboard'?t("Nota"):t("Whiteboard")}</span></button><div>{mode !== 'whiteboard' && <button className={styles.formattingToggle} type="button" disabled={readOnly||busy} aria-label={t('Formatação')} aria-expanded={formattingOpen} onClick={()=>{setFormattingOpen(open=>!open);if(!readingEditable)startVisualEditing();}}><span><b>B</b><i>I</i><u>U</u></span></button>}<button type="button" aria-label={t('Informações da nota')} aria-expanded={noteInfoOpen} onClick={()=>setNoteInfoOpen(open=>!open)}><Info size={20}/></button>{mode!=='whiteboard'&&<button type="button" aria-label={outlineOpen?t('Ocultar outline'):t('Mostrar outline')} title={t('Índice da nota')} aria-expanded={outlineOpen} aria-controls={outlineId} onClick={event=>toggleOutline(event.currentTarget)}><ListTree size={20}/></button>}<button type="button" aria-label={t("Mais opções da nota")} aria-expanded={readingActionsOpen} onClick={() => setReadingActionsOpen(!readingActionsOpen)}><MoreVertical size={22}/></button></div></div>}{saveCopyName !== null && <EditorDialog title={t("Salvar uma cópia")} onClose={() => setSaveCopyName(null)}><p>{t("Este navegador não permite manter acesso direto a um arquivo escolhido. Baixe ou compartilhe uma cópia e escolha onde guardá-la. A nota aberta continua no destino atual.")}</p>{assets.length > 0 && <p>{t("O arquivo ZIP leva o Markdown e suas imagens juntos.")}</p>}<form className={styles.saveCopyForm} onSubmit={event => {event.preventDefault();event.currentTarget.closest<HTMLDialogElement>('dialog')?.close();void exportCopy();}}><label>{t("Nome da cópia")}<input autoFocus required value={saveCopyName} onChange={event => setSaveCopyName(event.target.value)}/></label><footer><button type="button" onClick={() => setSaveCopyName(null)}>{t("Cancelar")}</button><button type="submit">{isIosApp ? t("Compartilhar cópia") : t("Baixar cópia")}</button></footer></form></EditorDialog>}{readingActionsOpen && <EditorDialog title={t('Mais opções da nota')} className={styles.mobileMenu} variant="menu" dismissOnOutside onClose={()=>setReadingActionsOpen(false)}><div role="menu" aria-label={t('Mais opções da nota')} onClickCapture={event=>{if((event.target as Element).closest('button'))event.currentTarget.closest<HTMLDialogElement>('dialog')?.close();}}>
      {mode !== 'whiteboard' && <div className={styles.contextSection}>{modes.map(([key,label,Icon])=><button role="menuitemradio" type="button" key={key} aria-checked={key==='live'?readingEditable:mode===key&&!readingEditable} onClick={()=>{setReadingActionsOpen(false);if(key==='live')startVisualEditing();else changeMode(key);}}><Icon size={18}/><span>{label}</span>{(key==='live'?readingEditable:mode===key&&!readingEditable)&&<Check size={16}/>}</button>)}<button role="menuitemradio" type="button" aria-checked={mode==='live'&&!readingEditable} onClick={()=>{setReadingActionsOpen(false);changeMode('live');}}><SquareCode size={18}/>{t('Blocos')}{mode==='live'&&!readingEditable&&<Check size={16}/>}</button></div>}
      <div className={styles.contextSection}><div className={styles.contextCommands} onClick={event=>{if((event.target as Element).closest('button'))setReadingActionsOpen(false);}}>{actions}{saveAction}</div>
      {onSaveAs && <button role="menuitem" type="button" disabled={readOnly||busy} onClick={()=>{setReadingActionsOpen(false);void saveAs();}}><SaveAll size={18}/>{t('Salvar como…')}</button>}
      {mode!=='whiteboard'&&<button role="menuitem" type="button" onClick={()=>{setReadingActionsOpen(false);setOutlineOpen(open=>!open);}}><ListTree size={18}/>{t('Índice da nota')}</button>}</div>
      <button role="menuitem" type="button" disabled={readOnly||busy} onClick={()=>{setReadingActionsOpen(false);if(mode==='whiteboard')whiteboard.current?.openImport();else chooseFile();}}>{mode==='whiteboard'?<FileImage size={18}/>:<FileUp size={18}/>} {mode==='whiteboard'?t('Importar desenho'):t('Importar notas')}</button>
      <button role="menuitem" type="button" disabled={busy} onClick={()=>{setReadingActionsOpen(false);setMobileExportOpen(true);}}><Download size={18}/>{t('Exportar')}</button>
      {onDuplicate && <button role="menuitem" type="button" disabled={readOnly||busy} onClick={()=>{setReadingActionsOpen(false);void onDuplicate();}}><Copy size={18}/>{t('Criar uma cópia')}</button>}
      {onRename && <button role="menuitem" type="button" disabled={readOnly||busy} onClick={event=>{event.currentTarget.closest<HTMLDialogElement>('dialog')?.close();setReadingActionsOpen(false);void requestRename();}}><Pencil size={18}/>{t('Renomear arquivo')}</button>}
      <button role="menuitem" type="button" onClick={()=>{setReadingActionsOpen(false);window.dispatchEvent(new Event('scriba:show-appearance'));}}><Sun size={18}/>{t('Aparência')}</button>
      <button role="menuitem" type="button" disabled={!onOpenSettings} onClick={()=>{setReadingActionsOpen(false);onOpenSettings?.();}}><Settings size={18}/>{t('Configurações')}</button>
    </div></EditorDialog>}
    {renameName!==null && <EditorDialog title={t("Renomear arquivo")} onClose={()=>{if(!renaming)setRenameName(null);}}><form onSubmit={event=>{event.preventDefault();void applyRename();}}><label>{t("Nome do arquivo")}<input autoFocus required maxLength={200} value={renameName} disabled={renaming} onChange={event=>setRenameName(event.target.value)}/></label>{renameError && <p role="alert">{renameError}</p>}<footer><button type="button" disabled={renaming} onClick={()=>setRenameName(null)}>{t("Cancelar")}</button><button className="primary" type="submit" disabled={renaming}>{renaming?t("Renomeando…"):t("Renomear")}</button></footer></form></EditorDialog>}
    {mobileExportOpen && <EditorDialog title={t('Exportar nota')} className={styles.mobileMenu} variant="menu" dismissOnOutside onClose={()=>setMobileExportOpen(false)}><div role="group" aria-label={t('Formatos de exportação')}><button data-menu-item type="button" disabled={busy} onClick={()=>{setMobileExportOpen(false);if(assets.length)void downloadPackage();else downloadMarkdown(value,fileName);}}><FileText size={18} aria-hidden="true"/><span>{t('Markdown (.md)')}{assets.length>0&&<small>{t('ZIP com imagens anexadas')}</small>}</span></button><button data-menu-item type="button" disabled={busy} onClick={()=>{setMobileExportOpen(false);void exportPdf();}}><FileDown size={18} aria-hidden="true"/><span>{t('PDF (.pdf)')}</span></button></div></EditorDialog>}
    {noteInfoOpen && <MobileNoteInformation source={value} words={words} createdAt={createdAt} modifiedAt={modifiedAt} onClose={()=>setNoteInfoOpen(false)} outline={{collapsed:collapsedHeadings,onToggle:toggleHeading,onExpandAll:()=>setCollapsedHeadings(new Set()),onCollapseAll:()=>setCollapsedHeadings(collapsedOutlineIds(documentOutline(value))),scrollContainer:pages,viewKey:`${documentId}:${mode}:${readingEditable}`,currentHeading,onNavigate:heading=>{setNoteInfoOpen(false);navigateHeading(heading,true);}}}/>}
    <header data-ui="toolbar" className={styles.toolbar}><div className={styles.filename}><FileText size={16} aria-hidden="true"/>{onRename ? <button className={styles.renameButton} type="button" title={fileName} aria-label={t("Renomear arquivo")} disabled={readOnly||busy} onClick={()=>void requestRename()}>{fileName}</button> : <span title={fileName}>{fileName}</span>}{dirty && <span className={styles.dot} aria-label={t("Documento alterado")}/>}{onClose && <button data-ui="dismiss" type="button" disabled={readOnly || busy} aria-label={t("Fechar nota")} aria-keyshortcuts="Meta+W Control+W" title={t("Fechar nota (⌘W / Ctrl+W, quando disponível no navegador)")} onClick={onClose}><X size={16} aria-hidden="true"/></button>}</div><div className={styles.formats} data-ui="format-segments" role="group" aria-label={t("Formato do documento")}><button type="button" aria-pressed={mode !== 'whiteboard'} disabled={readOnly || busy} onClick={() => { void selectFormat('note'); }}><FileText size={15} aria-hidden="true"/>{t("Nota")}</button><button type="button" aria-pressed={mode === 'whiteboard'} disabled={readOnly || busy} onClick={() => { void selectFormat('whiteboard'); }}><PenTool size={15} aria-hidden="true"/>{t("Whiteboard")}</button></div>{!compact && mode !== 'whiteboard' && <div className={styles.modes} role="group" aria-label={t("Modo de edição")}>{modes.map(([key, label, Icon, description]) => <button type="button" key={key} title={description} aria-pressed={key === 'live' ? readingEditable : mode === key && !readingEditable} onClick={() => key === 'live' ? startVisualEditing() : changeMode(key)}><Icon size={16} aria-hidden="true"/><span>{label}</span></button>)}<button type="button" aria-label={t("Editar blocos Markdown")} title={t("Markdown com blocos renderizados")} aria-pressed={mode === 'live' && !readingEditable} onClick={() => changeMode('live')}><SquareCode size={16} aria-hidden="true"/><span>{t("Blocos")}</span></button></div>}<div className={styles.actions}>{compact ? <div className={styles.quickActions}>
      {mode!=='whiteboard'&&<button className={styles.formattingToggle} type="button" disabled={readOnly||busy} aria-label={t('Formatação')} aria-expanded={formattingOpen} onClick={()=>{setFormattingOpen(open=>!open);if(!readingEditable)startVisualEditing();}}><span><b>B</b><i>I</i><u>U</u></span></button>}
      <button type="button" aria-label={t('Informações da nota')} aria-expanded={noteInfoOpen} onClick={()=>setNoteInfoOpen(open=>!open)}><Info size={20}/></button>
      {mode!=='whiteboard'&&<button type="button" aria-label={outlineOpen?t('Ocultar outline'):t('Mostrar outline')} title={t('Índice da nota')} aria-expanded={outlineOpen} aria-controls={outlineId} onClick={event=>toggleOutline(event.currentTarget)}><ListTree size={20}/></button>}
      <button type="button" aria-label={t('Mais opções da nota')} aria-expanded={readingActionsOpen} onClick={()=>setReadingActionsOpen(open=>!open)}><MoreVertical size={20}/></button>
    </div> : <><button type="button" disabled={readOnly || busy} aria-label={t("Abrir .md / ZIP")} aria-keyshortcuts="Meta+O Control+O" title={t("Abrir .md / ZIP (⌘O / Ctrl+O)")} onClick={() => chooseFile()}><FileUp size={15} aria-hidden="true"/><span className={styles.actionLabel}>{t("Abrir .md / ZIP")}</span></button><details data-ui-menu onToggle={event=>closeOtherDetailsMenus(event.currentTarget)} className={styles.exportMenu} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }} onKeyDown={handleDetailsMenu}><summary aria-label={t("Exportar nota")} title={t("Exportar nota")}><Download size={18} aria-hidden="true"/></summary><div data-ui="action-menu" role="group" aria-label={t("Formatos de exportação")}><button data-menu-item type="button" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={event => {if(assets.length) void downloadPackage(); else downloadMarkdown(value,fileName);event.currentTarget.closest('details')?.removeAttribute('open');}}><FileText size={16} aria-hidden="true"/><span>{t("Markdown (.md)")}{assets.length > 0 && <small>{t("ZIP com imagens anexadas")}</small>}</span></button><button data-menu-item type="button" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={event => {void exportPdf();event.currentTarget.closest('details')?.removeAttribute('open');}}><FileDown size={16} aria-hidden="true"/>{t("PDF (.pdf)")}</button></div></details>{compact && mode !== 'whiteboard' && <button type="button" aria-label={formattingOpen ? t("Ocultar formatação") : t("Mostrar formatação")} title={t("Formatação")} aria-expanded={formattingOpen} onClick={() => setFormattingOpen(open => !open)}><Type size={18}/></button>}{actions}{saveAction}{onSaveAs && <button type="button" disabled={readOnly || busy} aria-label={t("Salvar como")} aria-keyshortcuts="Meta+Shift+S Control+Shift+S" title={t("Salvar como… (⌘⇧S / Ctrl+Shift+S)")} onClick={() => void saveAs()}><SaveAll size={17} aria-hidden="true"/><span className={styles.actionLabel}>{t("Salvar como…")}</span></button>}{mode !== 'whiteboard' && <button type="button" aria-label={outlineOpen ? t("Ocultar outline") : t("Mostrar outline")} data-outline-toggle title={t("Índice da nota")} aria-expanded={outlineOpen} aria-controls={outlineId} onClick={event => toggleOutline(event.currentTarget)}><ListTree size={19}/></button>}{appearanceActions}</>}</div><input ref={input} type="file" hidden aria-label={t("Arquivo Markdown")} disabled={readOnly || busy} accept=".md,.markdown,.mdown,.zip,.bear,text/markdown,application/zip" onChange={event => { void open(event.target.files?.[0]); event.target.value = ""; }}/><input ref={imageInput} type="file" hidden multiple aria-label={t("Arquivos de imagem")} disabled={readOnly || busy} accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => { void insertImages(Array.from(event.target.files ?? []), imageRange.current); event.target.value = ""; }}/></header>{savedFileLocation && <p className={styles.savedDestination} aria-label={t("Destino do arquivo")}><Save size={14} aria-hidden="true"/><span>{t("Arquivo local ·")}{' '}<strong>{savedFileLocation}</strong></span><span>{t("⌘S salva aqui")}</span></p>}{sourceStatus}{copyNotice && <p role="status" className={styles.assetHint}>{copyNotice}</p>}{iconsOpen && <IconGallery onClose={() => setIconsOpen(false)} onInsert={name => {
      const markup = `<i data-lucide="${name}" style="font-size:24px"></i>`;
      if (readingEditable) visualEditor.current?.insertIcon(name);
      else { if (mode === 'read' && !inlineEditor.current) setMode('live'); (inlineEditor.current || editor.current)?.replace(markup, iconRange.current); }
      setIconsOpen(false);
    }}/>}{mode !== 'whiteboard' && (!compact || formattingOpen) && <EditingToolbar onHide={()=>setFormattingOpen(false)} onIcon={() => { iconRange.current = (inlineEditor.current || editor.current)?.selection() ?? { from: value.length, to: value.length }; setIconsOpen(true); }} onExcalidraw={insertDrawing} onEditBlock={readingEditable ? undefined : toggleBlock} blockEditing={!!activeBlock} disabled={readOnly || busy} onCommand={command} onLink={() => { const range = editor.current?.selection() ?? { from: 0, to: 0 }; setLinkRange(range); setLinkText(readingEditable ? visualEditor.current?.selectedText() || "" : value.slice(range.from, range.to)); setLinkUrl('https://'); setLinkError(""); }} onImage={() => { imageRange.current = editor.current?.selection() ?? { from: value.length, to: value.length }; imageInput.current?.click(); }}/>}{error && <p role="alert" className={styles.error}>{error}</p>}{pdfProgress && <div className={styles.pdfProgress} role="status"><span>{pdfProgress}</span><button type="button" onClick={() => pdfOperation.current?.abort()}>{t("Cancelar exportação")}</button></div>}{mode !== 'whiteboard' && assets.length > 0 && <p className={styles.assetHint}>{assets.length}{' '}{t("imagem(ns) anexada(s). A exportação Markdown inclui as imagens em um arquivo ZIP.")}</p>}{mode !== 'whiteboard' && <div className={styles.modeHint}>{readingEditable ? t("Edite diretamente no texto. A formatação permanece visível; Concluir volta à leitura.") : mode === 'live' ? t("Markdown do bloco em edição. Escape volta à leitura.") : mode === 'source' ? t("Markdown original, com todos os marcadores visíveis.") : mode === 'split' ? t("Edite o Markdown e acompanhe a prévia de leitura.") : t("Prévia de leitura. Use Editar para escrever diretamente no texto.")}</div>}<div className={styles.documentArea}><div ref={pages} data-document-scroll className={`${styles.pages} ${mode === 'split' ? styles.split : ""}`} hidden={mode === 'whiteboard'}><div className={styles.source} hidden={mode === 'read'}><MarkdownEditor key={documentId} ref={editor} diagramScope={diagramScope} value={value} onChange={onChange} onSelectionChange={characters => statistics.current?.setEditorSelection(characters)} livePreview={mode === 'live'} doubleClickToEdit={doubleClickToEdit} onBlockEditChange={blockChanged} readOnly={readOnly || busy} assets={assets} onImageFiles={(files, range) => { void insertImages(files, range); }}/></div>{readingEditable ? <VisualEditorBoundary onRead={() => changeMode('read')} onSource={() => changeMode('source')}><Suspense fallback={<p role="status" className={styles.reading}>{t("Preparando edição…")}</p>}><RichMarkdownEditor writeAfterDiagram={writeAfterBoard} autoFocus={writeAfterBoard===undefined && initialMode === 'live'} key={documentId} ref={visualEditor} value={value} onChange={onChange} assets={assets} diagramScope={diagramScope} disabled={readOnly || busy} onEditDiagram={editBlock} onImageFiles={files => { void insertImages(files, { from: value.length, to: value.length }); }}/></Suspense></VisualEditorBoundary> : (mode === 'split' || mode === 'read') && <MarkdownReadingView collapsedHeadings={collapsedHeadings} onToggleHeading={toggleHeading} inlineEditorRef={inlineEditor} onChangeBlock={!readOnly && !busy ? (range, source) => onChange(value.slice(0, range.from) + source + value.slice(range.to)) : undefined} diagramScope={diagramScope} value={value} assets={assets} doubleClickToEdit={doubleClickToEdit} onEditBlock={!readOnly && !busy ? editBlock : undefined} onEditTable={!readOnly && !busy ? editTable : undefined} onToggleTask={!readOnly && !busy ? range => {
        const source = value.slice(range.from, range.to);
        const marker = source.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/);
        if (marker) editor.current?.replace(marker[2] === ' ' ? 'x' : ' ', { from: range.from + marker[1].length, to: range.from + marker[1].length + 1 });
      } : undefined} onChangeDiagram={!readOnly && !busy ? (range, source) => {
        onChange(value.slice(0, range.from) + replaceExcalidrawFence(value.slice(range.from, range.to), source) + value.slice(range.to));
      } : undefined}/>}</div>{mode === 'whiteboard' && <Suspense fallback={<p role="status" className={styles.whiteboardLoading}>{t("Carregando Whiteboard…")}</p>}><WhiteboardEditor key={`${diagramScope}:${documentId}:${selectedBoard}`} ref={whiteboard} source={boards[selectedBoard]?.source || EMPTY_EXCALIDRAW} disabled={readOnly || busy} onChange={updateWhiteboard} onCount={count => setBoardCount(current => current === count ? current : count)} onSave={onSave} onOpen={() => chooseFile()} onClose={onClose} navigation={<><label className={styles.boardPicker}><span>{t("Quadro")}</span><select aria-label={t("Quadro da nota")} value={selectedBoard} disabled={readOnly || busy} onChange={event => { void selectWhiteboard(Number(event.target.value)); }}>{boards.map((board, index) => <option key={index} value={index}>{index + 1}{board.title ? ` · ${board.title}` : ""}</option>)}</select></label><button type="button" aria-label={t("Novo quadro")} title={t("Adicionar outro quadro à nota")} disabled={readOnly || busy} onClick={() => { void newWhiteboard(); }}><Plus size={17} aria-hidden="true"/></button></>}/></Suspense>}{mode !== 'whiteboard' && outlineOpen && <DocumentOutline collapsed={collapsedHeadings} onToggle={toggleHeading} onExpandAll={() => setCollapsedHeadings(new Set())} onCollapseAll={() => setCollapsedHeadings(collapsedOutlineIds(documentOutline(value)))} id={outlineId} source={value} scrollContainer={pages} viewKey={`${mode}:${readingEditable}`} currentHeading={currentHeading} onNavigate={navigateHeading} onClose={closeOutline}/>}</div><output className={styles.blockStatus} aria-live="polite">{activeBlock?t("Markdown do bloco em edição. Escape conclui; clique em outro bloco para continuar."):""}</output><footer className={styles.footer} aria-label={t("Estatísticas do documento")}>{mode === 'whiteboard' ? <span>{boardCount}{' '}{' '}{boardCount === 1 ? t("objeto") : t("objetos")}{' '}{t("· Quadro")}{' '}{selectedBoard + 1}{' '}{t("de")}{' '}{Math.max(1, boards.length)}</span> : <SelectionStatistics ref={statistics} container={pages} resetKey={`${mode}:${documentId}`} words={words} characters={value.length}/>}<span className={styles.documentSaveStatus} role={nativeWorkspace.nativeChrome ? "status" : undefined}>{nativeWorkspace.nativeChrome && nativeDocumentStatus ? nativeDocumentStatus : readOnly ? t("Somente leitura") : dirty ? t("Alterações nesta sessão") : t("Documento carregado")}</span><span>{t("UTF-8 · .md")}</span></footer>{linkRange && <EditorDialog title={t("Inserir link")} onClose={() => setLinkRange(null)}>{linkError && <p role="alert">{linkError}</p>}<form onSubmit={event => {
        event.preventDefault();
        try {
          const url = new URL(linkUrl, 'https://local.invalid');
          if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('invalid');
          const text = (linkText || linkUrl).replace(/[\[\]\\\r\n]/g, ' ');
          const target = linkUrl.replace(/[\s<>]/g, char => encodeURIComponent(char));
          if (readingEditable) visualEditor.current?.insertLink(text, target);
          else { if (mode === 'read') setMode('live'); editor.current?.replace(`[${text}](<${target}>)`, linkRange); }
          setLinkRange(null);
        } catch { setLinkError(t("Use um link HTTP, HTTPS, e-mail ou âncora do documento.")); }
      }}><label>{t("Texto do link")}<input value={linkText} onChange={event => setLinkText(event.target.value)}/></label><label>{t("Endereço")}<input required value={linkUrl} onChange={event => setLinkUrl(event.target.value)}/></label><footer><button type="button" onClick={() => setLinkRange(null)}>{t("Cancelar")}</button><button type="submit">{t("Inserir link")}</button></footer></form></EditorDialog>}{tableEdit && <TableEditorDialog initial={tableEdit.table} onClose={() => setTableEdit(null)} onSave={source => { editor.current?.replace(source, tableEdit.range); setTableEdit(null); }}/>}{newDrawing && <ExcalidrawEditor source={EMPTY_EXCALIDRAW} identity={`new:${diagramScope}`} isNew dark={document.documentElement.dataset.theme !== 'light'} onClose={() => setNewDrawing(null)} onApply={applyNewDrawing}/>}</section>;
}
