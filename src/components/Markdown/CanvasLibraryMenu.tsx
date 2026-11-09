import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FileUp, LibraryBig, Plus } from 'lucide-react';
import { loadLibraryFromBlob, mergeLibraryItems, MIME_TYPES } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, LibraryItem, LibraryItems } from '@excalidraw/excalidraw/types';
import { t, useLanguage } from '../../i18n';
import { libraryItemType, recentLibraryItems, sortedCanvasLibrary, type LibraryType } from '@/lib/markdown/canvasLibrary';
import { readCanvasState, rememberCanvasLibraryUse } from '@/lib/markdown/excalidrawStore';
import styles from './ExcalidrawEditor.module.css';

interface Props {
  root: RefObject<HTMLDivElement | null>;
  api: RefObject<ExcalidrawImperativeAPI | null>;
  items: LibraryItems;
  readOnly?: boolean;
  onError: (message: string) => void;
}
interface LibrarySection {
  target: HTMLElement;
  signature: string;
  groups: { type: LibraryType; start: number; count: number }[];
}

/** Reuse the SDK-generated SVG, selection, insertion and drag handlers instead of duplicating scene logic. */
function LibraryThumbnail({ svg }: { svg?: SVGSVGElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.replaceChildren(...(svg ? [svg.cloneNode(true)] : []));
  }, [svg]);
  return <span aria-hidden="true"><span ref={ref}/>{!svg && <LibraryBig size={20}/>}</span>;
}

/** Presentation adapter for the pinned 0.18 SDK library DOM. React retains ownership of every SDK unit. */
export function CanvasLibraryMenu({ root, api, items, readOnly, onError }: Props) {
  const language = useLanguage();
  const input = useRef<HTMLInputElement>(null), importOperation = useRef(false), mounted = useRef(true);
  const previousScroller = useRef<HTMLElement | null>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null), [scroll, setScroll] = useState<HTMLElement | null>(null);
  const [sections, setSections] = useState<LibrarySection[]>([]), [selectedCount, setSelectedCount] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]), [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const [importing, setImporting] = useState(false), [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const labels: Record<LibraryType, string> = {
    architecture: t('Arquitetura e infraestrutura'), charts: t('Gráficos e dados'), algorithms: t('Algoritmos e estruturas de dados'),
    icons: t('Ícones'), notes: t('Notas e post-its'), diagrams: t('Diagramas e conexões'), images: t('Imagens'),
    text: t('Textos'), freehand: t('Desenhos à mão livre'), shapes: t('Formas'),
  };
  const recent = recentLibraryItems(items, recentIds);
  function itemLabel(item: LibraryItem) {
    return item.name || item.elements.find(element => element.type === 'text')?.text?.slice(0, 80) || labels[libraryItemType(item)];
  }
  useEffect(() => {
    mounted.current = true;
    void readCanvasState<string[]>('library-recents-v1').then(ids => {
      if (mounted.current && Array.isArray(ids)) setRecentIds(ids.filter(id => typeof id === 'string'));
    }).catch(() => onError(t('Não foi possível carregar os símbolos recentes.')));
    return () => { mounted.current = false; };
  }, []);

  function remember(ids: string[]) {
    if (!ids.length || readOnly) return;
    setFeedback(undefined);
    void rememberCanvasLibraryUse(ids).then(recent => { if (mounted.current) setRecentIds(recent); })
      .catch(() => onError(t('Não foi possível guardar os símbolos recentes.')));
  }
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const refresh = () => {
      const panel = container.querySelector<HTMLElement>('.library-menu-items-container');
      const scroller = panel?.querySelector<HTMLElement>('.library-menu-items-container__items') || null;
      setPanel(panel); setScroll(scroller);
      setSelectedCount(container.querySelectorAll('.library-unit--selected').length);
      if (!scroller) { previousScroller.current = null; setSections(previous => previous.length ? [] : previous); return; }
      if (scroller !== previousScroller.current) {
        previousScroller.current = scroller;
        if (recentIds.length) requestAnimationFrame(() => scroller.scrollTo({ top: 0 }));
      }
      scroller.dataset.libraryOrganized = 'true';
      const published = items.filter(item => item.status === 'published'), personal = items.filter(item => item.status !== 'published');
      const grids = [...scroller.querySelectorAll<HTMLElement>('.library-menu-items-container__grid')];
      const publishedGrid = published.length ? grids.at(-1) : undefined;
      const personalGrid = grids.find(grid => grid !== publishedGrid);
      const next: LibrarySection[] = [];
      const previews = new Map<string, SVGSVGElement>();
      for (const [grid, entries] of [[personalGrid, personal], [publishedGrid, published]] as const) {
        if (!grid) continue;
        const units = [...grid.querySelectorAll<HTMLElement>(':scope > .library-unit')];
        // The private grid can start with the SDK's Add selection unit, whose item has no ID.
        const offset = Math.max(0, units.length - entries.length);
        const groups: LibrarySection['groups'] = [];
        entries.forEach((item, index) => {
          const type = libraryItemType(item), unit = units[index + offset];
          if (!unit) return;
          unit.dataset.libraryId = item.id;
          unit.style.order = String((index + offset) * 2 + 1);
          const dragger = unit.querySelector<HTMLElement>('.library-unit__dragger');
          if (dragger) { dragger.tabIndex = 0; dragger.setAttribute('role', 'button'); dragger.setAttribute('aria-label', t('Inserir {0}', itemLabel(item))); }
          const svg = dragger?.querySelector<SVGSVGElement>('svg');
          if (svg && recentIds.includes(item.id)) previews.set(item.id, svg);
          const last = groups.at(-1);
          if (last?.type === type) last.count++;
          else groups.push({ type, start: (index + offset) * 2, count: 1 });
        });
        next.push({ target: grid, signature: JSON.stringify(groups), groups });
      }
      setSections(previous => previous.length === next.length && previous.every((section, index) => section.target === next[index].target && section.signature === next[index].signature) ? previous : next);
      setThumbnails(previous => previous.size === previews.size && [...previews].every(([id, svg]) => previous.get(id) === svg) ? previous : previews);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const click = (event: MouseEvent) => {
      if (readOnly || event.shiftKey || !(event.target instanceof Element)) return;
      const unit = event.target.closest<HTMLElement>('.library-unit__dragger')?.closest<HTMLElement>('[data-library-id]');
      if (!unit?.dataset.libraryId) return;
      const id = unit.dataset.libraryId;
      const selected = [...container.querySelectorAll<HTMLElement>('.library-unit--selected[data-library-id]')].map(unit => unit.dataset.libraryId!);
      remember(selected.includes(id) ? [id, ...selected.filter(selectedId => selectedId !== id)] : [id]);
    };
    const drop = (event: DragEvent) => {
      if (readOnly) return;
      try {
        const data = JSON.parse(event.dataTransfer?.getData(MIME_TYPES.excalidrawlib) || '{}');
        const ids = new Set(items.map(item => item.id));
        remember((data.libraryItems || []).map((item: LibraryItem) => item.id).filter((id: string) => ids.has(id)));
      } catch { /* Ordinary file and text drops remain owned by the SDK. */ }
    };
    const keydown = (event: KeyboardEvent) => {
      if (readOnly || !['Enter', ' '].includes(event.key) || !(event.target instanceof HTMLElement) || !event.target.matches('.library-unit__dragger')) return;
      event.preventDefault(); event.stopPropagation(); event.target.click();
    };
    container.addEventListener('click', click, true);
    container.addEventListener('drop', drop, true);
    container.addEventListener('keydown', keydown, true);
    refresh();
    return () => {
      observer.disconnect(); container.removeEventListener('click', click, true);
      container.removeEventListener('drop', drop, true); container.removeEventListener('keydown', keydown, true);
    };
  }, [root, items, recentIds, readOnly, language]);

  async function importLibraries(files: File[]) {
    if (!api.current || readOnly || importOperation.current || !files.length) return;
    importOperation.current = true; setImporting(true); setFeedback(undefined);
    let imported = 0;
    try {
      for (const file of files) {
        const entries = await loadLibraryFromBlob(file, 'unpublished');
        if (!entries.length) throw new Error(t('A biblioteca {0} não contém símbolos.', file.name));
        // Stable file-scoped IDs make retries idempotent, including legacy libraries without item IDs.
        const { sha256 } = await import('@noble/hashes/sha256');
        const digest = sha256(new Uint8Array(await file.arrayBuffer()));
        const fingerprint = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
        const incoming = entries.map((item, index) => ({ ...item, id: `scriba:import:${fingerprint}:${index}` }));
        await api.current.updateLibrary({ libraryItems: current => {
          const ids = new Set(current.map(item => item.id));
          const merged = mergeLibraryItems(current, incoming.filter(item => !ids.has(item.id)));
          imported += merged.length - current.length;
          return sortedCanvasLibrary(merged);
        }, merge: false, prompt: false, openLibraryMenu: true });
      }
      if (mounted.current) setFeedback({ error: false, text: imported ? t('{0} símbolos importados. A biblioteca está disponível neste dispositivo.', imported) : t('Esta biblioteca já foi importada. Seus símbolos foram mantidos.') });
    } catch {
      if (mounted.current) setFeedback({ error: true, text: t('Não foi possível importar a biblioteca. Escolha um arquivo .excalidrawlib válido.') });
    } finally { importOperation.current = false; if (mounted.current) setImporting(false); }
  }
  function insertSelected() {
    if (readOnly) return;
    root.current?.querySelector<HTMLElement>('.library-unit--selected .library-unit__dragger')?.click();
    if (matchMedia('(max-width: 899px), (pointer: coarse)').matches) api.current?.updateScene({ appState: { openSidebar: null } });
  }
  function insertRecent(id: string) {
    if (readOnly) return;
    root.current?.querySelector<HTMLElement>(`[data-library-id="${CSS.escape(id)}"] .library-unit__dragger`)?.click();
    if (matchMedia('(max-width: 899px), (pointer: coarse)').matches) api.current?.updateScene({ appState: { openSidebar: null } });
  }
  return <>
    <input ref={input} hidden type="file" multiple accept=".excalidrawlib,.json,application/vnd.excalidrawlib+json,application/json" aria-label={t('Arquivo de biblioteca')} disabled={readOnly || importing} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void importLibraries(files); }}/>
    {panel && createPortal(<div className={styles.libraryControls}>
      <button type="button" disabled={readOnly || importing} onClick={() => input.current?.click()}><FileUp size={18} aria-hidden="true"/>{importing ? t('Importando biblioteca…') : t('Importar biblioteca')}</button>
      <button className={styles.insertLibrary} type="button" disabled={!selectedCount || readOnly || importing} onClick={insertSelected}><Plus size={18} aria-hidden="true"/>{t('Adicionar selecionados')}{selectedCount > 0 ? ` (${selectedCount})` : ''}</button>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? styles.libraryError : styles.libraryFeedback}>{feedback.text}</p>}
    </div>, panel)}
    {scroll && recent.length > 0 && createPortal(<section className={styles.libraryRecent} aria-label={t('Usados recentemente')}><h3>{t('Usados recentemente')}<span>{recent.length}/11</span></h3><div>{recent.map(item => <button key={item.id} type="button" disabled={readOnly} title={itemLabel(item)} aria-label={t('Inserir {0}', itemLabel(item))} data-recent-library-id={item.id} onClick={() => insertRecent(item.id)}><LibraryThumbnail svg={thumbnails.get(item.id)}/></button>)}</div></section>, scroll)}
    {scroll && !items.length && createPortal(<p className={styles.libraryEmpty}>{t('Importe uma biblioteca ou adicione símbolos selecionados no quadro.')}</p>, scroll)}
    {sections.map(section => createPortal(section.groups.map(group => <h3 key={`${group.type}-${group.start}`} className={styles.libraryGroup} data-library-group={group.type} style={{ order: group.start }}>{labels[group.type]}<span>{group.count}</span></h3>), section.target))}
  </>;
}
