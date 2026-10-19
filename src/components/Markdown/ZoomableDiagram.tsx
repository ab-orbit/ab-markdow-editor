import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { MagnifiableDiagram } from './MagnifiableDiagram';
import styles from './DiagramBlock.module.css';

export interface DiagramZoomHandle { zoomBy: (factor: number) => void; reset: () => void }
interface ZoomableDiagramProps {
  ref?: Ref<DiagramZoomHandle>;
  svg: string;
  id: string;
  magnifying: boolean;
  onZoom: (scale: number) => void;
  onLayout?: () => void;
  /** Wide hand-drawn scenes retain readable labels and pan instead of shrinking to tiny text. */
  minWidth?: number;
}

/** Transform the existing SVG; zooming and panning never execute a diagram renderer. */
export function ZoomableDiagram({ ref, svg, id, magnifying, onZoom, onLayout, minWidth }: ZoomableDiagramProps) {
  const viewport = useRef<HTMLDivElement>(null), surface = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1), [height, setHeight] = useState(0);
  const scale = useRef(1), anchor = useRef<{ x: number; y: number; left: number; top: number; ratio: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  function change(next: number, point?: { x: number; y: number }) {
    const element = viewport.current;
    if (!element) return;
    next = Math.max(1, Math.min(6, next));
    if (Math.abs(next - scale.current) < .0001) return;
    const bounds = element.getBoundingClientRect(), x = point ? point.x - bounds.left : element.clientWidth / 2, y = point ? point.y - bounds.top : element.clientHeight / 2;
    anchor.current = { x, y, left: element.scrollLeft, top: element.scrollTop, ratio: next / scale.current };
    scale.current = next; setZoom(next); onZoom(next);
  }
  useImperativeHandle(ref, () => ({ zoomBy: factor => change(scale.current * factor), reset: () => change(1) }));
  useLayoutEffect(() => {
    const point = anchor.current;
    if (point && viewport.current) { viewport.current.scrollLeft = (point.left + point.x) * point.ratio - point.x; viewport.current.scrollTop = (point.top + point.y) * point.ratio - point.y; anchor.current = null; }
  }, [zoom]);
  useEffect(() => {
    const element = viewport.current!;
    const wheel = (event: WheelEvent) => {
      if (event.shiftKey || event.deltaY === 0) return;
      const next = Math.max(1, Math.min(6, scale.current * Math.exp(-Math.max(-240, Math.min(240, event.deltaY * (event.deltaMode === 1 ? 16 : 1))) * .0025)));
      if (Math.abs(next - scale.current) < .0001) return;
      event.preventDefault(); event.stopPropagation(); change(next, { x: event.clientX, y: event.clientY });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    const observer = new ResizeObserver(entries => { const next = Math.ceil(entries[0].contentRect.height); setHeight(previous => previous === next ? previous : next); });
    observer.observe(surface.current!);
    return () => { element.removeEventListener('wheel', wheel); observer.disconnect(); };
  }, []);
  useEffect(() => { change(1); onZoom(1); }, [svg]);
  useEffect(() => { if (height) onLayout?.(); }, [height]);
  return <div ref={viewport} className={styles.zoomViewport} data-diagram-zoom={zoom.toFixed(3)} style={{ height: height || undefined }} tabIndex={0} role="group" aria-label="Zoom do diagrama" title="Use a roda do mouse para ampliar; arraste para navegar. Shift + roda rola horizontalmente."
    onKeyDown={event => { if (event.target !== event.currentTarget) return; if (['+', '=', '-', '0'].includes(event.key)) { event.preventDefault(); event.key === '0' ? change(1) : change(scale.current * (event.key === '-' ? 1 / 1.25 : 1.25)); } }}
    onPointerDown={event => { if (event.pointerType !== 'mouse' || event.button !== 0 || magnifying || scale.current <= 1) return; const element = event.currentTarget; drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }; element.setPointerCapture(event.pointerId); event.preventDefault(); }}
    onPointerMove={event => { if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y); }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <div className={styles.zoomBounds} style={{ width: `${zoom * 100}%`, minWidth: minWidth ? minWidth * zoom : undefined, height: height * zoom || undefined }}><div ref={surface} className={styles.zoomSurface} style={{ width: `${100 / zoom}%`, transform: `scale(${zoom})` }}><MagnifiableDiagram svg={svg} enabled={magnifying} id={id}/></div></div>
  </div>;
}
