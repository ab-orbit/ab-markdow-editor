import { t, useLanguage } from '../../i18n';
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Pencil, ZoomIn, ZoomOut, Minus, Plus, Code2, Download } from 'lucide-react';
import { DEFAULT_DIAGRAM_ENGINE, diagramEngines, diagramKey, migrateDiagramEngine, renderDiagram, scopeDiagramSvg, selectedDiagramEngine, setDiagramEngine, subscribeDiagramEngine, usesZenUml, type DiagramLanguage, type DiagramAppearance, type DiagramEngine, type DiagramResult } from '@/lib/markdown/diagrams';
import styles from './DiagramBlock.module.css';
import { ZoomableDiagram, type DiagramZoomHandle } from './ZoomableDiagram';
import { DiagramSource } from './DiagramSource';
import { downloadDiagram } from '@/lib/markdown/diagramExport';

interface DiagramBlockProps {
  /** The parser-provided source inside one diagram fence. */
  source: string;
  /** Fence dialect; ZenUML remains distinct from Mermaid sequenceDiagram syntax. */
  language?: Exclude<DiagramLanguage, 'excalidraw'>;
  /** Stable document/block identity keeps duplicate diagrams independently selectable. */
  identity?: string;
  /** Previous offset identity, retained only to migrate presentation preferences. */
  legacyIdentity?: string;
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
export const DiagramBlock = memo(function DiagramBlock({ source: originalSource, language = 'mermaid', identity, legacyIdentity, onEdit, onLayout }: DiagramBlockProps) {
  useLanguage();
  // Normalize only the drawing input, never the source stored by the workbench.
  const source = originalSource.replace(/\r\n?/g, '\n').replace(/\n+$/, "");
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
  const [codeOpen, setCodeOpen] = useState(false), [zoom, setZoom] = useState(1);
  const zoomer = useRef<DiagramZoomHandle>(null);
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState("");
  const key = diagramKey(identity || source);
  const legacyKey = legacyIdentity ? diagramKey(legacyIdentity) : undefined;
  const preference = useSyncExternalStore<DiagramEngine>(subscribeDiagramEngine, () => selectedDiagramEngine(key, legacyKey), () => DEFAULT_DIAGRAM_ENGINE);
  useEffect(() => { migrateDiagramEngine(key, legacyKey); }, [key, legacyKey]);
  const zenuml = usesZenUml(source, language);
  const engine: DiagramEngine = zenuml ? 'zenuml' : preference === 'zenuml' ? DEFAULT_DIAGRAM_ENGINE : preference;
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
    // Re-entering the viewport must retain this block's SVG and zoom even
    // after other diagrams have evicted its source from the shared LRU.
    if (!visible || !width || !snapshot.appearance || drawing?.key === requestKey) return;
    let abandoned = false;
    // Coalesce typing; switching a selector never sets application-wide busy state.
    const timer = window.setTimeout(() => {
      void renderDiagram(snapshot.engine, snapshot.source, snapshot.appearance!, snapshot.width).then(result => {
        if (abandoned) return;
        setFailure(null);
        setDrawing({ ...result, svg: scopeDiagramSvg(result.svg, instance), key: requestKey });
      }).catch(reason => {
        if (abandoned) return;
        const message = reason instanceof Error ? t(reason.message).split('\n').filter(Boolean).slice(0, 3).join(' ') : t("Não foi possível desenhar este diagrama.");
        setFailure({ key: requestKey, message });
      });
    }, 120);
    return () => { abandoned = true; clearTimeout(timer); };
  }, [requestKey, visible, !!width, instance, drawing?.key]);

  useEffect(() => {
    const measured = requestAnimationFrame(() => { if (frame.current?.isConnected) layout.current?.(); });
    return () => cancelAnimationFrame(measured);
  }, [current?.svg, error, codeOpen, exportError]);

  useEffect(() => {
    if (!magnifying) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); setMagnifying(false);
    };
    window.addEventListener('keydown', dismiss, true);
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [magnifying]);

  async function exportDrawing(format: 'svg' | 'png') {
    const element = canvas.current?.querySelector<SVGSVGElement>('[data-diagram-drawing] > svg');
    if (!element || exporting) return;
    setExporting(true); setExportError(""); if (exportMenu.current) exportMenu.current.open = false;
    try {
      const font = zenuml ? await (await import('@/lib/markdown/zenuml')).zenUmlExportFont() : "";
      await downloadDiagram(element, format, `diagrama-${engine}`, font);
    }
    catch (cause) { setExportError(cause instanceof Error ? t(cause.message) : t("Não foi possível exportar. Tente novamente ou escolha SVG.")); }
    finally { setExporting(false); }
  }

  return <figure ref={frame} className={styles.diagram} data-diagram-engine={engine} data-diagram-state={error ? 'error' : current ? 'ready' : 'loading'} data-diagram-magnifying={magnifying} aria-label={zenuml ? t("Diagrama ZenUML") : t("Diagrama Mermaid")}><div className={styles.controls} onDoubleClick={event => event.stopPropagation()}>{current && <output className={styles.timing} title={`${definition.label} ${definition.version} · tempo de desenho; o primeiro uso pode carregar recursos internos${current.cached ? t(" · resultado em cache") : ""}`} aria-label={`Tempo de desenho: ${current.milliseconds.toFixed(1)} milissegundos${current.cached ? t(", em cache") : ""}`}>{current.milliseconds < 1 ? '<1' : Math.round(current.milliseconds)}{' '}{t("ms")}</output>}{zenuml ? <span className={styles.engineLabel} title={t("ZenUML 4.7.2 · sintaxe própria de sequência")}>{t("ZenUML")}</span> : <div className={styles.picker}><select aria-label={t("Renderizador do diagrama")} value={engine} onChange={event => setDiagramEngine(key, event.target.value as DiagramEngine)}>{diagramEngines.filter(item => item.id !== 'zenuml').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></div>}<button className={`${styles.edit} ${styles.magnifierButton}`} type="button" aria-label={magnifying ? t("Desativar lupa do diagrama") : t("Ativar lupa do diagrama")} title={magnifying ? t("Desativar lupa (Esc)") : t("Lupa 2× · mouse, toque ou teclado")} aria-pressed={magnifying} aria-controls={current ? `${instance}-drawing` : undefined} disabled={!current && !magnifying} onClick={() => setMagnifying(value => !value)}>{magnifying ? <ZoomOut size={16} aria-hidden="true"/> : <ZoomIn size={16} aria-hidden="true"/>}</button>{onEdit && <button className={styles.edit} type="button" aria-label={t("Editar código do diagrama")} title={t("Editar código do diagrama")} onClick={onEdit}><Pencil size={15} aria-hidden="true"/></button>}</div><div ref={canvas} className={styles.canvas} aria-busy={!current && !error}>{current ? <ZoomableDiagram ref={zoomer} svg={current.svg} magnifying={magnifying} id={`${instance}-drawing`} onZoom={setZoom} onLayout={() => layout.current?.()}/>
        : error ? <div className={styles.failure} role="alert"><strong>{definition.label}</strong><span>{error}</span><span className={styles.help}>{zenuml ? t("Confira as chaves, mensagens e condições no código ZenUML.") : t("Troque o renderizador acima ou edite o código.")}</span></div>
        : <div className={styles.loading} role="status">{t("Preparando")}{' '}{definition.label}…</div>}</div><div className={styles.diagramFooter} onDoubleClick={event => event.stopPropagation()}><button className={styles.codeToggle} type="button" aria-label={codeOpen ? t("Ocultar código do diagrama") : t("Ver código do diagrama")} title={codeOpen ? t("Ocultar código") : t("Ver código")} aria-expanded={codeOpen} aria-controls={`${instance}-code`} onClick={() => setCodeOpen(open => !open)}><Code2 size={16}/><span>{t("Código")}</span></button><div className={styles.zoomTools} role="group" aria-label={t("Ampliar diagrama")}><button type="button" aria-label={t("Diminuir zoom do diagrama")} title={t("Diminuir zoom")} disabled={!current || zoom <= 1} onClick={() => zoomer.current?.zoomBy(1 / 1.25)}><Minus size={16}/></button><button type="button" aria-label={t("Ajustar diagrama à largura")} title={t("Voltar a 100%")} disabled={!current} onClick={() => zoomer.current?.reset()}>{Math.round(zoom * 100)}%</button><button type="button" aria-label={t("Aumentar zoom do diagrama")} title={t("Ampliar (também pela roda do mouse)")} disabled={!current || zoom >= 6} onClick={() => zoomer.current?.zoomBy(1.25)}><Plus size={16}/></button></div><details ref={exportMenu} className={styles.exportMenu} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary aria-label={t("Baixar diagrama")} title={t("Baixar diagrama")} aria-disabled={!current || exporting} onClick={event => { if (!current || exporting) event.preventDefault(); }}><Download size={17}/></summary><div role="group" aria-label={t("Formato do diagrama")}><button type="button" disabled={!current || exporting} onClick={() => void exportDrawing('svg')}>{t("SVG vetorial")}</button><button type="button" disabled={!current || exporting} onClick={() => void exportDrawing('png')}>{t("PNG transparente")}</button></div></details></div>{exportError && <p className={styles.exportError} role="alert">{exportError}</p>}{codeOpen && <DiagramSource source={originalSource} language={zenuml ? 'zenuml' : 'mermaid'} id={`${instance}-code`} onLayout={() => layout.current?.()}/>}</figure>;
});
