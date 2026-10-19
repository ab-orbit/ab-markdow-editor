import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Pencil, ZoomIn, ZoomOut } from 'lucide-react';
import { diagramEngines, diagramKey, renderDiagram, scopeDiagramSvg, selectedDiagramEngine, setDiagramEngine, subscribeDiagramEngine, type DiagramAppearance, type DiagramEngine, type DiagramResult } from '@/lib/markdown/diagrams';
import styles from './DiagramBlock.module.css';
import { MagnifiableDiagram } from './MagnifiableDiagram';

interface DiagramBlockProps {
  /** The parser-provided source inside one Mermaid fence. */
  source: string;
  /** Stable document/block identity keeps duplicate diagrams independently selectable. */
  identity?: string;
  /** Reveal the original fence without serializing the generated drawing. */
  onEdit?: () => void;
  /** Notify CodeMirror when an asynchronous widget changes its height. */
  onLayout?: () => void;
}

function appearanceAt(element: Element): DiagramAppearance {
  const css = getComputedStyle(element);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    background: token('--bg-surface'), foreground: token('--text-primary'), muted: token('--text-muted'),
    surface: token('--bg-elevated'), border: token('--text-muted'), accent: token('--cyan'),
    font: token('--font-ui') || css.fontFamily, dark: document.documentElement.dataset.theme !== 'light',
  };
}

/** One source-backed diagram, with presentation controls above the drawing. */
export const DiagramBlock = memo(function DiagramBlock({ source: originalSource, identity, onEdit, onLayout }: DiagramBlockProps) {
  // Normalize only the drawing input, never the source stored by the workbench.
  const source = originalSource.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  const frame = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const layout = useRef(onLayout); layout.current = onLayout;
  const [instance] = useState(() => `scriba-view-${crypto.randomUUID()}`);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [appearance, setAppearance] = useState<DiagramAppearance | null>(null);
  const [drawing, setDrawing] = useState<(DiagramResult & { key: string }) | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [magnifying, setMagnifying] = useState(false);
  const key = diagramKey(identity || source);
  const engine = useSyncExternalStore<DiagramEngine>(subscribeDiagramEngine, () => selectedDiagramEngine(key), () => 'mermaid');
  const definition = diagramEngines.find(item => item.id === engine)!;
  const roundedWidth = Math.max(200, Math.round(width / 8) * 8);
  // CSS-driven renderers keep their SVG across color-theme changes.
  const palette = appearance && (engine === 'mermaid' ? JSON.stringify(appearance) : appearance.font);
  const requestKey = JSON.stringify([engine, source, roundedWidth, palette]);
  const request = useRef({ engine, source, appearance, width: roundedWidth });
  request.current = { engine, source, appearance, width: roundedWidth };
  const current = drawing?.key === requestKey ? drawing : null;
  const error = failure?.key === requestKey ? failure.message : null;

  useEffect(() => {
    const element = frame.current!, container = canvas.current!;
    const updateAppearance = () => {
      const next = appearanceAt(element);
      setAppearance(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    updateAppearance();
    const resize = new ResizeObserver(() => { if (container.clientWidth) setWidth(container.clientWidth); });
    resize.observe(container);
    const theme = new MutationObserver(updateAppearance);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    const viewport = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { rootMargin: '160px' });
    viewport.observe(element);
    return () => { resize.disconnect(); theme.disconnect(); viewport.disconnect(); };
  }, []);

  useEffect(() => {
    const snapshot = request.current;
    if (!visible || !width || !snapshot.appearance) return;
    let abandoned = false;
    // Coalesce typing; switching a selector never sets application-wide busy state.
    const timer = window.setTimeout(() => {
      void renderDiagram(snapshot.engine, snapshot.source, snapshot.appearance!, snapshot.width).then(result => {
        if (abandoned) return;
        setFailure(null);
        setDrawing({ ...result, svg: scopeDiagramSvg(result.svg, instance), key: requestKey });
      }).catch(reason => {
        if (abandoned) return;
        const message = reason instanceof Error ? reason.message.split('\n').filter(Boolean).slice(0, 3).join(' ') : 'Não foi possível desenhar este diagrama.';
        setFailure({ key: requestKey, message });
      });
    }, 120);
    return () => { abandoned = true; clearTimeout(timer); };
  }, [requestKey, visible, !!width, instance]);

  useEffect(() => {
    const measured = requestAnimationFrame(() => { if (frame.current?.isConnected) layout.current?.(); });
    return () => cancelAnimationFrame(measured);
  }, [current?.svg, error]);

  useEffect(() => {
    if (!magnifying) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); setMagnifying(false);
    };
    window.addEventListener('keydown', dismiss, true);
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [magnifying]);

  return <figure ref={frame} className={styles.diagram} data-diagram-engine={engine} data-diagram-state={error ? 'error' : current ? 'ready' : 'loading'} data-diagram-magnifying={magnifying} aria-label="Diagrama Mermaid">
    <div className={styles.controls} onDoubleClick={event => event.stopPropagation()}>
      {current && <output className={styles.timing} title={`${definition.label} ${definition.version} · tempo de desenho; o primeiro uso pode carregar recursos internos${current.cached ? ' · resultado em cache' : ''}`} aria-label={`Tempo de desenho: ${current.milliseconds.toFixed(1)} milissegundos${current.cached ? ', em cache' : ''}`}>{current.milliseconds < 1 ? '<1' : Math.round(current.milliseconds)} ms</output>}
      <div className={styles.picker}>
        <select aria-label="Renderizador do diagrama" value={engine} onChange={event => setDiagramEngine(key, event.target.value as DiagramEngine)}>
          {diagramEngines.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden="true"/>
      </div>
      <button className={`${styles.edit} ${styles.magnifierButton}`} type="button" aria-label={magnifying ? 'Desativar lupa do diagrama' : 'Ativar lupa do diagrama'} title={magnifying ? 'Desativar lupa (Esc)' : 'Lupa 2× · mouse, toque ou teclado'} aria-pressed={magnifying} aria-controls={current ? `${instance}-drawing` : undefined} disabled={!current && !magnifying} onClick={() => setMagnifying(value => !value)}>{magnifying ? <ZoomOut size={16} aria-hidden="true"/> : <ZoomIn size={16} aria-hidden="true"/>}</button>
      {onEdit && <button className={styles.edit} type="button" aria-label="Editar código do diagrama" title="Editar código do diagrama" onClick={onEdit}><Pencil size={15} aria-hidden="true"/></button>}
    </div>
    <div ref={canvas} className={styles.canvas} aria-busy={!current && !error}>
      {current ? <MagnifiableDiagram svg={current.svg} enabled={magnifying} id={`${instance}-drawing`}/>
        : error ? <div className={styles.failure} role="alert"><strong>{definition.label}</strong><span>{error}</span><span className={styles.help}>Troque o renderizador acima ou edite o código.</span></div>
        : <div className={styles.loading} role="status">Preparando {definition.label}…</div>}
    </div>
  </figure>;
});
