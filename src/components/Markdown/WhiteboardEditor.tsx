import { handleDetailsMenu, closeOtherDetailsMenus } from '../ui/actionMenu';
import { t } from '../../i18n';
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Download, FileUp } from 'lucide-react';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { downloadExcalidraw, loadExcalidraw, restoreExcalidraw, serializeExcalidraw } from '@/lib/markdown/excalidraw';
import { EMPTY_EXCALIDRAW, parseExcalidrawScene } from '@/lib/markdown/excalidrawScene';
import ExcalidrawCanvas from './ExcalidrawCanvas';
import canvasStyles from './ExcalidrawEditor.module.css';
import styles from './WhiteboardEditor.module.css';

export interface WhiteboardEditorHandle {
  /** Commit an active text box before saving, closing or changing presentation. */
  flush: () => Promise<boolean>;
  /** Unpublished invalid edits and SDK text input pause host saves and reloads. */
  isBusy: () => boolean;
}
interface Props {
  ref?: Ref<WhiteboardEditorHandle>;
  /** Initial scene; changing the selected board remounts this editor. */
  source: string;
  disabled: boolean;
  onChange: (source: string) => void;
  onCount: (count: number) => void;
  onSave?: () => void;
  onOpen: () => void;
  onClose?: () => void;
  /** Scene selection stays beside import/export without adding another toolbar row. */
  navigation?: ReactNode;
}

/** Inline infinite canvas; every authored change uses the note's existing persistence pipeline. */
export default function WhiteboardEditor({ ref, source, disabled, onChange, onCount, onSave, onOpen, onClose, navigation }: Props) {
  const api = useRef<ExcalidrawImperativeAPI>(null), input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [initial] = useState(() => { try { parseExcalidrawScene(source); return { source, error: "" }; } catch (cause) { return { source: EMPTY_EXCALIDRAW, error: cause instanceof Error ? t(cause.message) : t("Não foi possível abrir o quadro.") }; } });
  const [error, setError] = useState(initial.error), [ready, setReady] = useState(false), [working, setWorking] = useState(false);
  const [invalidSource, setInvalidSource] = useState(!!initial.error);
  const [dark, setDark] = useState(document.documentElement.dataset.theme !== 'light');
  const invalidInitial = useRef(!!initial.error), unpublished = useRef(false), operation = useRef(false);
  const baseline = useRef<string | undefined>(undefined), published = useRef<string | undefined>(undefined), lastVersion = useRef("");
  const callbacks = useRef({ onChange, onCount, onSave, onOpen, onClose }); callbacks.current = { onChange, onCount, onSave, onOpen, onClose };
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.dataset.theme !== 'light'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); return () => observer.disconnect();
  }, []);

  function publish(value: string) {
    if (!mounted.current) return;
    if (value === published.current) return;
    callbacks.current.onChange(value); published.current = value; unpublished.current = false; setError("");
  }
  function update(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
    if (!mounted.current || appState.isLoading || invalidInitial.current) return;
    callbacks.current.onCount(elements.filter(element => !element.isDeleted).length);
    const version = elements.map(element => `${element.id}:${element.version}:${element.versionNonce}`).join('|') + JSON.stringify([appState.viewBackgroundColor, appState.gridSize, appState.gridStep, appState.gridModeEnabled, appState.objectsSnapModeEnabled, Object.keys(files)]);
    if (version === lastVersion.current) return;
    lastVersion.current = version;
    try {
      const serialized = serializeExcalidraw(elements, appState, files);
      if (baseline.current === undefined) { baseline.current = serialized; return; }
      if (serialized !== baseline.current || published.current !== undefined) publish(serialized);
    } catch (cause) { unpublished.current = true; setError(cause instanceof Error ? t(cause.message) : t("Não foi possível aplicar a alteração. Desfaça a última mudança antes de salvar.")); }
  }
  async function flush() {
    if (!mounted.current || operation.current) return false;
    if (invalidInitial.current) return true; // Opening malformed source never replaces it with an empty scene.
    if (!api.current) return !unpublished.current;
    const original = api.current;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const instance = api.current;
      if (!mounted.current || !instance || instance !== original) return false;
      const serialized = serializeExcalidraw(instance.getSceneElements(), instance.getAppState(), instance.getFiles());
      if (baseline.current !== undefined && (serialized !== baseline.current || published.current !== undefined)) publish(serialized);
      return !unpublished.current;
    } catch (cause) { unpublished.current = true; setError(cause instanceof Error ? t(cause.message) : t("Não foi possível salvar esta alteração. Desfaça a última mudança.")); return false; }
  }
  useImperativeHandle(ref, () => ({ flush, isBusy: () => operation.current || unpublished.current || !!api.current?.getAppState().editingTextElement }));

  async function importFile(file?: File) {
    if (!file || !api.current || operation.current) return;
    const original = api.current;
    operation.current = true; setWorking(true); setError("");
    try {
      if (file.size > 8_000_000) throw new Error(t("O arquivo excede 8 MB."));
      const scene = await restoreExcalidraw(await file.text()), module = await loadExcalidraw();
      if (!mounted.current || api.current !== original) return;
      invalidInitial.current = false; setInvalidSource(false);
      api.current.addFiles(Object.values(scene.files));
      api.current.updateScene({ elements: scene.elements, appState: { ...api.current.getAppState(), ...scene.appState }, captureUpdate: module.CaptureUpdateAction.IMMEDIATELY });
      publish(serializeExcalidraw(scene.elements, scene.appState, scene.files));
      api.current.scrollToContent(undefined, { fitToContent: true, animate: false });
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? t(cause.message) : t("Não foi possível importar o quadro.")); }
    finally { operation.current = false; if (mounted.current) setWorking(false); }
  }
  async function exportFile(format: 'svg' | 'png' | 'excalidraw') {
    if (!await flush() || !api.current || operation.current) return;
    operation.current = true; setWorking(true); setError("");
    try { await downloadExcalidraw(serializeExcalidraw(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles()), format, dark); }
    catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Não foi possível exportar o quadro.")); }
    finally { operation.current = false; setWorking(false); }
  }

  return <section className={styles.whiteboard} aria-label={t("Whiteboard Excalidraw")} data-whiteboard-state={ready ? 'ready' : 'loading'} onKeyDownCapture={event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || !['s', 'o', 'w'].includes(event.key.toLowerCase())) return;
    event.preventDefault(); event.stopPropagation();
    const action = event.key.toLowerCase();
    if (action === 'o') { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); callbacks.current.onOpen(); }
    else void flush().then(ok => { if (ok) { if (action === 's') callbacks.current.onSave?.(); else callbacks.current.onClose?.(); } });
  }}><div data-ui="toolbar" className={styles.tools}><div>{navigation || <span>{t("Tela infinita")}</span>}</div><div><button type="button" disabled={!ready || working || disabled} onClick={() => input.current?.click()} aria-label={t("Importar .excalidraw no whiteboard")} title={t("Importar arquivo .excalidraw")}><FileUp size={16} aria-hidden="true"/><span>{t("Importar")}</span></button><details data-ui-menu onKeyDown={handleDetailsMenu} onToggle={event=>closeOtherDetailsMenus(event.currentTarget)}><summary aria-label={t("Exportar whiteboard")} title={t("Exportar whiteboard")}><Download size={17} aria-hidden="true"/>{t("Exportar")}</summary><div data-ui="action-menu" role="group" aria-label={t("Formato do whiteboard")}>{([['svg', t("SVG vetorial")], ['png', t("PNG transparente")], ['excalidraw', t("Excalidraw editável")]] as const).map(([format, label]) => <button key={format} type="button" disabled={!ready || working} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void exportFile(format); }}>{label}</button>)}</div></details></div><input ref={input} type="file" hidden aria-label={t("Arquivo do whiteboard")} accept=".excalidraw,application/vnd.excalidraw+json,application/json" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }}/></div>{error && <p role="alert" className={canvasStyles.error}>{error}</p>}<div className={canvasStyles.canvas}><ExcalidrawCanvas source={initial.source} dark={dark} readOnly={disabled || invalidSource} onReady={instance => { api.current = instance; requestAnimationFrame(() => requestAnimationFrame(() => { if (mounted.current && api.current === instance) setReady(true); })); }} onChange={update} onError={setError}/></div></section>;
}
