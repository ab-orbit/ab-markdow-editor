import { t, useLanguage, currentLocale } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { restoreExcalidraw } from '@/lib/markdown/excalidraw';
import { initialCanvasLibrary, writeCanvasState } from '@/lib/markdown/excalidrawStore';
import { EMPTY_EXCALIDRAW } from '@/lib/markdown/excalidrawScene';
import '@excalidraw/excalidraw/index.css';
import styles from './ExcalidrawEditor.module.css';

interface Props {
  source: string;
  dark: boolean;
  /** Host saves and malformed initial scenes can temporarily allow navigation only. */
  readOnly?: boolean;
  onReady: (api: ExcalidrawImperativeAPI) => void;
  onChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
  onError: (message: string) => void;
}
/** Mounted only while editing; the document itself uses a lightweight SVG preview. */
export default function ExcalidrawCanvas({ source, dark, readOnly, onReady, onChange, onError }: Props) {
  useLanguage();
  const [initial, setInitial] = useState<Awaited<ReturnType<typeof restoreExcalidraw>> & { libraryItems?: LibraryItems }>();
  const api = useRef<ExcalidrawImperativeAPI>(null), fitted = useRef(false), libraryReady = useRef(false);
  useEffect(() => {
    let abandoned = false;
    const scene = restoreExcalidraw(source).catch(cause => {
      if (!abandoned) onError(cause instanceof Error ? t(cause.message) : t("Não foi possível abrir o desenho."));
      // A broken JSON block remains unchanged until an explicit apply. Keep
      // Import available so a valid .excalidraw file can repair it visually.
      return restoreExcalidraw(EMPTY_EXCALIDRAW);
    });
    void Promise.all([scene, initialCanvasLibrary().then(items => { libraryReady.current=true; return items; }).catch(() => { if(!abandoned)onError(t("Não foi possível preparar as bibliotecas de desenhos. Seus símbolos pessoais foram preservados.")); return undefined; })]).then(([scene, libraryItems]) => {
      if (!abandoned) setInitial({ ...scene, libraryItems });
    }).catch(cause => { if (!abandoned) onError(cause instanceof Error ? t(cause.message) : t("Não foi possível abrir o desenho.")); });
    return () => { abandoned = true; };
  }, []);
  if (!initial) return <p role="status" className={styles.loading}>{t("Abrindo a prancheta…")}</p>;
  return <Excalidraw initialData={{ elements: initial.elements, files: initial.files, appState: { ...initial.appState, theme: dark ? 'dark' : 'light' }, libraryItems: initial.libraryItems, scrollToContent: true }} excalidrawAPI={instance => { api.current = instance; onReady(instance); }} onChange={(elements, appState, files) => {
    if (!fitted.current && !appState.isLoading && initial.elements.length && elements.length && api.current) { fitted.current = true; requestAnimationFrame(() => api.current?.scrollToContent(undefined, { fitToContent: true, animate: false })); }
    onChange(elements, appState, files);
  }} langCode={currentLocale().replace("en-US", "en")} theme={dark ? 'dark' : 'light'} viewModeEnabled={readOnly} name={t("Desenho Scriba")} autoFocus handleKeyboardGlobally={false} aiEnabled={false} validateEmbeddable={false}
    UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false } }}
    onLibraryChange={items => { if(!libraryReady.current)return; void writeCanvasState('library', items).catch(() => onError(t("Não foi possível guardar a biblioteca neste navegador. Exporte os símbolos antes de fechar."))); }}
    onLinkOpen={(element, event) => { if (element.link && !/^(?:https?:\/\/|mailto:|#)/i.test(element.link)) event.preventDefault(); }}
    onPaste={data => { if (data.files && Object.values(data.files).some(file => !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimeType))) { onError(t("Cole imagens PNG, JPEG, GIF ou WebP.")); return false; } return true; }}><MainMenu><MainMenu.DefaultItems.CommandPalette/><MainMenu.DefaultItems.SearchMenu/><MainMenu.DefaultItems.ClearCanvas/><MainMenu.DefaultItems.ChangeCanvasBackground/><MainMenu.DefaultItems.Help/></MainMenu></Excalidraw>;
}
