import { interactionFocusTarget } from '../ui/interactionFocus';
import { t } from '../../i18n';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Check, FileImage, Download, X, PenTool } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { downloadExcalidraw, serializeExcalidraw, restoreExcalidraw, loadExcalidraw } from '@/lib/markdown/excalidraw';
import { readCanvasState, writeCanvasState } from '@/lib/markdown/excalidrawStore';
import styles from './ExcalidrawEditor.module.css';

const Canvas = lazy(() => import('./ExcalidrawCanvas'));
interface Props {
  source: string;
  /** Stable document/occurrence identity scopes private recovery drafts. */
  identity: string;
  dark: boolean;
  isNew?: boolean;
  onClose: () => void;
  onApply: (source: string) => void;
}
/** Full-screen drawing workspace, with explicit apply/cancel and local crash recovery. */
export function ExcalidrawEditor({ source, identity, dark, isNew = false, onClose, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), api = useRef<ExcalidrawImperativeAPI>(null), input = useRef<HTMLInputElement>(null);
  const [initial, setInitial] = useState<string>(), [ready, setReady] = useState(false), [dirty, setDirty] = useState(false), [protectedDraft, setProtectedDraft] = useState(false), [error, setError] = useState(""), [recovered, setRecovered] = useState(false), [working, setWorking] = useState(false);
  const baseline = useRef<string | undefined>(undefined), lastVersion = useRef(""), latest = useRef(source), changed = useRef(false), timer = useRef(0), closed = useRef(false);
  const finishing = useRef(false);
  const draftKey = `draft:${identity}`;
  const base = source.replace(/\r\n?/g, '\n').trimEnd();
  useEffect(() => {
    const node = dialog.current!, previous = interactionFocusTarget();
    let mounted = true; closed.current = false;
    node.showModal();
    void readCanvasState<{ base: string; value: string }>(draftKey).catch(() => undefined).then(draft => {
      if (!mounted || closed.current) return;
      if (draft?.base === base && draft.value !== source) { setInitial(draft.value); setRecovered(true); setDirty(true); changed.current = true; latest.current = draft.value; }
      else setInitial(source);
    });
    return () => { mounted = false; closed.current = true; clearTimeout(timer.current); node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
    if (closed.current || appState.isLoading) return;
    // Pointer/selection/viewport updates are frequent. Serialize only when scene content changes.
    const version = elements.map(element => `${element.id}:${element.version}:${element.versionNonce}`).join('|') + JSON.stringify([appState.viewBackgroundColor, appState.gridSize, appState.gridStep, appState.gridModeEnabled, appState.objectsSnapModeEnabled, Object.keys(files)]);
    if (version === lastVersion.current) return;
    lastVersion.current = version;
    try {
      const serialized = serializeExcalidraw(elements, appState, files);
      if (baseline.current === undefined) { baseline.current = serialized; if (!changed.current) latest.current = serialized; return; }
      const differs = baseline.current !== serialized || recovered;
      if (latest.current === serialized) return;
      latest.current = serialized; changed.current = differs; setDirty(differs); setProtectedDraft(false);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (closed.current) return;
        void writeCanvasState(draftKey, differs ? { base, value: serialized } : undefined).then(() => { if (!closed.current && latest.current === serialized) setProtectedDraft(differs); }).catch(() => setError(t("O navegador não conseguiu proteger este rascunho. Aplique o desenho à nota para salvá-lo.")));
      }, 300);
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Não foi possível atualizar o desenho.")); }
  }
  async function finish(apply: boolean) {
    if (working || !ready && apply || finishing.current) return;
    finishing.current = true;
    // Commit an active text box before reading the scene or checking pending changes.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (api.current) {
      try {
        const current = serializeExcalidraw(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles());
        if (current !== baseline.current) { latest.current = current; changed.current = true; }
      } catch (cause) { if (apply) { finishing.current = false; setError(cause instanceof Error ? t(cause.message) : t("Não foi possível aplicar o desenho.")); return; } }
    }
    if (!apply && changed.current && !window.confirm(t("Descartar as alterações deste desenho? A nota continuará como estava."))) { finishing.current = false; return; }
    clearTimeout(timer.current);
    try {
      if (apply && (changed.current || isNew)) onApply(latest.current);
      else onClose();
      closed.current = true;
      await writeCanvasState(draftKey).catch(() => {});
    } catch (cause) {
      finishing.current = false;
      setError(cause instanceof Error ? t(cause.message) : t("Não foi possível aplicar. O rascunho continua neste dispositivo."));
    }
  }
  async function importFile(file?: File) {
    if (!file || !api.current) return;
    setWorking(true); setError("");
    try {
      if (!file.name.toLowerCase().endsWith('.excalidraw')) throw new Error(t("Escolha um desenho .excalidraw. Para importar notas Markdown, volte ao modo Nota."));
      if (file.size > 8_000_000) throw new Error(t("O arquivo excede 8 MB."));
      const scene = await restoreExcalidraw(await file.text()), module = await loadExcalidraw();
      api.current.addFiles(Object.values(scene.files));
      api.current.updateScene({ elements: scene.elements, appState: { ...api.current.getAppState(), ...scene.appState }, captureUpdate: module.CaptureUpdateAction.IMMEDIATELY });
      api.current.scrollToContent(undefined, { fitToContent: true });
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Não foi possível importar o arquivo.")); }
    finally { setWorking(false); }
  }
  async function exportFile() {
    if (!api.current || working) return;
    setWorking(true); setError("");
    try { await downloadExcalidraw(serializeExcalidraw(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles()), 'excalidraw', dark); }
    catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Não foi possível exportar.")); }
    finally { setWorking(false); }
  }
  return createPortal(<dialog ref={dialog} className={styles.editor} data-scriba-canvas aria-label={t("Editor Excalidraw")} onCancel={event => { event.preventDefault(); void finish(false); }} onKeyDownCapture={event => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && ['s', 'o', 'w'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      if (event.key.toLowerCase() === 's') void finish(true);
      else if (event.key.toLowerCase() === 'o') input.current?.click();
      else void finish(false);
    }
  }}><header data-ui="toolbar" className={styles.header}><div className={styles.title}><PenTool size={20} aria-hidden="true"/><div><h2>{isNew ? t("Novo desenho") : t("Excalidraw")}</h2><span role="status">{recovered ? t("Rascunho recuperado neste dispositivo") : protectedDraft ? t("Rascunho protegido neste dispositivo") : dirty ? t("Alterações no desenho") : t("Desenho na nota")}</span></div></div><div className={styles.actions}><button className={styles.importDrawing} type="button" disabled={!ready || working} onClick={() => input.current?.click()} aria-label={t("Importar .excalidraw")} title={t("Importar .excalidraw (⌘O / Ctrl+O)")}><FileImage size={18}/><span>{t("Importar desenho")}</span></button><button type="button" disabled={!ready || working} onClick={() => void exportFile()} aria-label={t("Baixar .excalidraw")} title={t("Baixar arquivo editável")}><Download size={18}/><span>{t("Baixar")}</span></button><button type="button" data-prominent className={styles.apply} disabled={!ready || working} onClick={() => void finish(true)} aria-label={t("Aplicar desenho à nota")} title={t("Aplicar à nota (⌘S / Ctrl+S)")}><Check size={18}/><span>{t("Aplicar à nota")}</span></button><button type="button" onClick={() => void finish(false)} aria-label={t("Fechar editor Excalidraw")} title={t("Fechar (Esc)")}><X size={20}/></button></div><input ref={input} type="file" hidden aria-label={t("Arquivo Excalidraw")} accept=".excalidraw,application/vnd.excalidraw+json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }}/></header>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.canvas}>{initial && <Suspense fallback={<p role="status" className={styles.loading}>{t("Carregando Excalidraw…")}</p>}><Canvas source={initial} dark={dark} onReady={instance => { api.current = instance; setReady(true); }} onChange={update} onError={setError}/></Suspense>}</div></dialog>, document.body);
}
