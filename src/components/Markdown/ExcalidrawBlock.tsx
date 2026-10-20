import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Download, Minus, Pencil, Plus, ZoomIn, ZoomOut, PenTool } from 'lucide-react';
import { renderExcalidraw, downloadExcalidraw } from '@/lib/markdown/excalidraw';
import { diagramKey, scopeDiagramSvg } from '@/lib/markdown/diagrams';
import { ExcalidrawEditor } from './ExcalidrawEditor';
import { DiagramSource } from './DiagramSource';
import { ZoomableDiagram, type DiagramZoomHandle } from './ZoomableDiagram';
import styles from './DiagramBlock.module.css';

interface Props {
  source: string;
  identity: string;
  onChange?: (source: string) => void;
  onEditSource?: () => void;
  onLayout?: () => void;
}
/** Excalidraw is its own editable scene dialect; the three Mermaid choices are unchanged. */
export const ExcalidrawBlock = memo(function ExcalidrawBlock({ source, identity, onChange, onEditSource, onLayout }: Props) {
  const frame = useRef<HTMLElement>(null), zoomer = useRef<DiagramZoomHandle>(null), menu = useRef<HTMLDetailsElement>(null);
  const [instance] = useState(() => `excalidraw-${crypto.randomUUID()}`);
  const [visible, setVisible] = useState(false), [dark, setDark] = useState(document.documentElement.dataset.theme !== 'light');
  const [drawing, setDrawing] = useState<{ key: string; svg: string }>(), [failure, setFailure] = useState<{ key: string; message: string }>();
  const [editing, setEditing] = useState(false), [codeOpen, setCodeOpen] = useState(false), [magnifying, setMagnifying] = useState(false), [zoom, setZoom] = useState(1), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const key = `${dark}:${source}`, current = drawing?.key === key ? drawing.svg : undefined, error = failure?.key === key ? failure.message : undefined;
  const empty = useMemo(() => { try { const scene = JSON.parse(source); return scene.type === 'excalidraw' && Array.isArray(scene.elements) && !scene.elements.some((element: {isDeleted?: boolean}) => !element.isDeleted); } catch { return false; } }, [source]);
  const minWidth = useMemo(() => current ? Number(/data-diagram-min-width="(\d+)"/.exec(current)?.[1]) || undefined : undefined, [current]);
  const layout = useRef(onLayout); layout.current = onLayout;
  useEffect(() => {
    const viewport = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: '160px' }); viewport.observe(frame.current!);
    const theme = new MutationObserver(() => setDark(document.documentElement.dataset.theme !== 'light')); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { viewport.disconnect(); theme.disconnect(); };
  }, []);
  useEffect(() => {
    if (!visible || current || empty) return;
    let abandoned = false;
    const timer = setTimeout(() => { void renderExcalidraw(source, dark).then(svg => { if (!abandoned) { setDrawing({ key, svg: scopeDiagramSvg(svg, instance) }); setFailure(undefined); } }).catch(cause => { if (!abandoned) setFailure({ key, message: cause instanceof Error ? cause.message : 'Não foi possível desenhar esta cena.' }); }); }, 100);
    return () => { abandoned = true; clearTimeout(timer); };
  }, [key, visible, !!current, empty]);
  useEffect(() => { const id = requestAnimationFrame(() => layout.current?.()); return () => cancelAnimationFrame(id); }, [current, error, codeOpen]);
  useEffect(() => {
    if (!magnifying) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMagnifying(false); } };
    window.addEventListener('keydown', dismiss, true); return () => window.removeEventListener('keydown', dismiss, true);
  }, [magnifying]);
  async function exportDrawing(format: 'svg' | 'png' | 'excalidraw') {
    if (exporting) return;
    setExporting(true); setExportError(''); if (menu.current) menu.current.open = false;
    try { await downloadExcalidraw(source, format, dark); }
    catch (cause) { setExportError(cause instanceof Error ? cause.message : 'Não foi possível exportar o desenho.'); }
    finally { setExporting(false); }
  }
  return <figure ref={frame} className={styles.diagram} data-excalidraw-state={empty ? 'empty' : error ? 'error' : current ? 'ready' : 'loading'} aria-label="Desenho Excalidraw" onDoubleClick={event => { event.stopPropagation(); if (onChange && !(event.target as Element).closest('button,select,summary,pre')) setEditing(true); }}>
    <div className={styles.controls} onDoubleClick={event => event.stopPropagation()}><span className={styles.engineLabel}>Excalidraw</span>
      <button className={styles.edit} type="button" disabled={!current} aria-label={magnifying ? 'Desativar lupa do diagrama' : 'Ativar lupa do diagrama'} aria-pressed={magnifying} onClick={() => setMagnifying(value => !value)}>{magnifying ? <ZoomOut size={16}/> : <ZoomIn size={16}/>}</button>
      {onChange && <button className={styles.edit} type="button" aria-label="Editar desenho Excalidraw" title="Editar no Excalidraw" onClick={() => setEditing(true)}><Pencil size={16}/></button>}
    </div>
    <div className={styles.canvas} aria-busy={!empty && !current && !error}>{empty ? <div className={styles.empty}><PenTool size={24} aria-hidden="true"/><span>Quadro vazio</span>{onChange && <button type="button" onClick={() => setEditing(true)}>Começar desenho</button>}</div> : current ? <ZoomableDiagram ref={zoomer} svg={current} id={`${instance}-drawing`} minWidth={minWidth} magnifying={magnifying} onZoom={setZoom} onLayout={() => layout.current?.()}/> : error ? <div className={styles.failure} role="alert"><strong>Excalidraw</strong><span>{error}</span>{onEditSource && <button type="button" onClick={onEditSource}>Editar JSON</button>}</div> : <div className={styles.loading} role="status">Preparando Excalidraw…</div>}</div>
    <div className={styles.diagramFooter} onDoubleClick={event => event.stopPropagation()}>
      <button className={styles.codeToggle} type="button" aria-label={codeOpen ? 'Ocultar código do desenho' : 'Ver código do desenho'} aria-expanded={codeOpen} onClick={() => setCodeOpen(open => !open)}><Code2 size={16}/><span>Código</span></button>
      <div className={styles.zoomTools} role="group" aria-label="Ampliar desenho"><button type="button" aria-label="Diminuir zoom do diagrama" disabled={!current || zoom <= 1} onClick={() => zoomer.current?.zoomBy(1 / 1.25)}><Minus size={16}/></button><button type="button" aria-label="Ajustar diagrama à largura" disabled={!current} onClick={() => zoomer.current?.reset()}>{Math.round(zoom * 100)}%</button><button type="button" aria-label="Aumentar zoom do diagrama" disabled={!current || zoom >= 6} onClick={() => zoomer.current?.zoomBy(1.25)}><Plus size={16}/></button></div>
      <details ref={menu} className={styles.exportMenu} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary aria-label="Baixar desenho" title="Baixar desenho"><Download size={17}/></summary><div role="group" aria-label="Formato do desenho"><button type="button" disabled={!current || exporting} onClick={() => void exportDrawing('svg')}>SVG vetorial</button><button type="button" disabled={!current || exporting} onClick={() => void exportDrawing('png')}>PNG transparente</button><button type="button" disabled={exporting} onClick={() => void exportDrawing('excalidraw')}>Excalidraw editável</button></div></details>
    </div>
    {exportError && <p className={styles.exportError} role="alert">{exportError}</p>}
    {codeOpen && <><DiagramSource source={source} language="excalidraw" id={`${instance}-code`} onLayout={() => layout.current?.()}/>{onEditSource && <div className={styles.diagramFooter}><button type="button" onClick={onEditSource}><Code2 size={16}/>Editar JSON</button></div>}</>}
    {editing && onChange && <ExcalidrawEditor source={source} identity={diagramKey(identity)} dark={dark} onClose={() => setEditing(false)} onApply={next => { onChange(next); setEditing(false); }}/>}
  </figure>;
});
