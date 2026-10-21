import { t, useLanguage } from '../../i18n';
import { memo, useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { scopeDiagramSvg } from '@/lib/markdown/diagrams';
import styles from './DiagramBlock.module.css';

interface MagnifiableDiagramProps {
  /** Sanitized SVG already used by the normal preview. */
  svg: string;
  /** The magnifier is opt-in for this diagram and never changes its source. */
  enabled: boolean;
  /** Unique preview identity also namespaces the magnified SVG definitions. */
  id: string;
}

const ZOOM = 2;

/** Reuse the vector drawing; pointer movement never invokes a rendering engine. */
export const MagnifiableDiagram = memo(function MagnifiableDiagram({ svg, enabled, id }: MagnifiableDiagramProps) {
  useLanguage();
  const drawing = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const enlarged = useRef<HTMLDivElement>(null);
  const animation = useRef(0);
  const pending = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const relative = useRef({ x: 0.5, y: 0.5 });
  const touchId = useRef<number | null>(null);
  // React compares this prop by identity; toggling the lens must retain the SVG DOM.
  const originalMarkup = useMemo(() => ({ __html: svg }), [svg]);
  // Only create the second SVG while enabled; fresh IDs avoid marker/style clashes.
  const magnified = useMemo(() => enabled ? scopeDiagramSvg(svg, `${id}-magnifier`) : "", [svg, enabled, id]);

  function hide() {
    cancelAnimationFrame(animation.current); animation.current = 0;
    if (lens.current) lens.current.style.visibility = 'hidden';
  }

  function show(x: number, y: number, touch = false) {
    if (!enabled) return;
    pending.current = { x, y, touch };
    if (animation.current) return;
    animation.current = requestAnimationFrame(() => {
      animation.current = 0;
      const point = pending.current, bounds = drawing.current?.querySelector('svg')?.getBoundingClientRect();
      if (!point || !bounds || !lens.current || !enlarged.current || !bounds.width || !bounds.height
        || point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) { hide(); return; }
      relative.current = { x: (point.x - bounds.left) / bounds.width, y: (point.y - bounds.top) / bounds.height };
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
      const diameter = Math.min(192, width - 24, height - 24), radius = diameter / 2;
      const centerX = Math.max(left + radius + 8, Math.min(left + width - radius - 8, point.x));
      // Keep the enlarged detail above a finger instead of directly beneath it.
      const centerY = Math.max(top + radius + 8, Math.min(top + height - radius - 8, point.y - (point.touch ? radius + 24 : 0)));
      Object.assign(lens.current.style, { width: `${diameter}px`, height: `${diameter}px`, transform: `translate3d(${centerX - radius}px, ${centerY - radius}px, 0)`, visibility: 'visible' });
      Object.assign(enlarged.current.style, {
        width: `${bounds.width * ZOOM}px`, height: `${bounds.height * ZOOM}px`,
        transform: `translate3d(${radius - (point.x - bounds.left) * ZOOM}px, ${radius - (point.y - bounds.top) * ZOOM}px, 0)`,
      });
    });
  }

  function pointer(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType === 'touch' && touchId.current !== event.pointerId) return;
    show(event.clientX, event.clientY, event.pointerType === 'touch');
  }

  function focusPoint() {
    const bounds = drawing.current?.querySelector('svg')?.getBoundingClientRect();
    if (bounds) show(bounds.left + bounds.width * relative.current.x, bounds.top + bounds.height * relative.current.y);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const bounds = drawing.current?.querySelector('svg')?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 48 : 16;
    const x = Math.max(0, Math.min(bounds.width, relative.current.x * bounds.width + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)));
    const y = Math.max(0, Math.min(bounds.height, relative.current.y * bounds.height + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)));
    show(bounds.left + x, bounds.top + y);
  }

  useEffect(() => {
    if (!enabled) return;
    // Hide stale geometry when the document moves, loses focus, or unmounts.
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    return () => {
      hide(); touchId.current = null;
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, [enabled, svg]);

  return <><div ref={drawing} id={id} data-diagram-drawing={""} className={`${styles.drawing} ${enabled ? styles.magnifiable : ""}`}
      tabIndex={enabled ? 0 : undefined} role={enabled ? 'group' : undefined}
      aria-label={enabled ? t("Explorar diagrama com lupa") : undefined}
      aria-describedby={enabled ? `${id}-help` : undefined}
      onFocus={focusPoint} onBlur={hide} onKeyDown={keyDown}
      onPointerEnter={pointer} onPointerMove={pointer} onPointerLeave={hide}
      onPointerDown={event => {
        if (!enabled) return;
        event.preventDefault(); event.stopPropagation(); window.getSelection()?.removeAllRanges();
        if (event.pointerType === 'touch') { touchId.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); }
        pointer(event);
      }}
      onPointerUp={event => { if (event.pointerType === 'touch') { touchId.current = null; hide(); } }}
      onPointerCancel={() => { touchId.current = null; hide(); }}
      onDoubleClick={event => { if (enabled) { event.preventDefault(); event.stopPropagation(); window.getSelection()?.removeAllRanges(); } }}
      dangerouslySetInnerHTML={originalMarkup}/>{enabled && <><span id={`${id}-help`} className={styles.hiddenHint}>{t("Passe o mouse ou arraste o dedo para ampliar 2 vezes. No teclado, use as setas; Esc desativa a lupa.")}</span>{createPortal(<div ref={lens} className={styles.magnifier} data-diagram-magnifier={id} aria-hidden="true"><div ref={enlarged} className={styles.magnified} dangerouslySetInnerHTML={{ __html: magnified }}/><span className={styles.magnification}>{t("2×")}</span></div>, document.body)}</>}</>;
});
