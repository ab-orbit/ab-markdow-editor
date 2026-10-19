import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ListTree, X } from 'lucide-react';
import { documentOutline, type OutlineHeading } from '@/lib/markdown/outline';
import styles from './DocumentOutline.module.css';

interface DocumentOutlineProps {
  /** Source is parsed only while this optional panel is mounted. */
  source: string;
  id: string;
  scrollContainer: RefObject<HTMLDivElement | null>;
  viewKey: string;
  currentHeading: (headings: OutlineHeading[]) => string | undefined;
  onNavigate: (heading: OutlineHeading, dismiss: boolean) => void;
  onClose: () => void;
}

/** A quiet desktop sidebar and a native, focus-contained sheet on small screens. */
export function DocumentOutline({ source, id, scrollContainer, viewKey, currentHeading, onNavigate, onClose }: DocumentOutlineProps) {
  const headings = useMemo(() => documentOutline(source), [source]);
  const [small, setSmall] = useState(() => matchMedia('(max-width: 899px)').matches);
  const [active, setActive] = useState('');
  const modal = useRef<HTMLDialogElement>(null), list = useRef<HTMLElement>(null);
  const readCurrent = useRef(currentHeading); readCurrent.current = currentHeading;
  useEffect(() => {
    const media = matchMedia('(max-width: 899px)'), update = () => setSmall(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!small) return;
    const dialog = modal.current; dialog?.showModal(); return () => dialog?.close();
  }, [small]);
  useEffect(() => {
    const root = scrollContainer.current;
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setActive(readCurrent.current(headings) || headings[0]?.id || ''); });
    };
    root.addEventListener('scroll', schedule, true);
    const resize = new ResizeObserver(schedule); resize.observe(root);
    // Lazy diagrams and the visual editor can mount or change document height.
    const changes = new MutationObserver(schedule); changes.observe(root, { childList: true, subtree: true });
    schedule();
    return () => { cancelAnimationFrame(frame); root.removeEventListener('scroll', schedule, true); resize.disconnect(); changes.disconnect(); };
  }, [headings, viewKey, small, scrollContainer]);
  useEffect(() => {
    const nav = list.current, row = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!nav || !row) return;
    const bounds = nav.getBoundingClientRect(), target = row.getBoundingClientRect();
    if (target.top < bounds.top) nav.scrollTop -= bounds.top - target.top + 8;
    else if (target.bottom > bounds.bottom) nav.scrollTop += target.bottom - bounds.bottom + 8;
  }, [active]);

  const content = <>
    <header className={styles.header}><div><ListTree size={17} aria-hidden="true"/><h2>Índice</h2><span>{headings.length}</span></div><button type="button" aria-label="Fechar outline" title="Fechar índice" onClick={onClose}><X size={17}/></button></header>
    {headings.length ? <nav ref={list} className={styles.list} aria-label="Seções da nota"><ol>{headings.map(heading => <li key={heading.id} data-level={heading.level}><a href={`#${encodeURIComponent(heading.id)}`} title={heading.label} aria-current={active === heading.id ? 'location' : undefined} onClick={event => { event.preventDefault(); setActive(heading.id); onNavigate(heading, small); }}>{heading.label}</a></li>)}</ol></nav> : <p className={styles.empty}>Os títulos de níveis 1, 2 e 3 aparecem aqui conforme você escreve.</p>}
  </>;
  return small ? <dialog ref={modal} id={id} aria-label="Índice da nota" className={`${styles.panel} ${styles.sheet}`} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    // Safari's keyboard preference can skip links even in a native modal.
    // Explicit cycling keeps every section reachable; Escape remains native.
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey) return;
    const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(element => element.getClientRects().length);
    const index = targets.indexOf(document.activeElement as HTMLElement);
    event.preventDefault(); targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length]?.focus();
  }} onClick={event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) onClose();
  }}>{content}</dialog> : <aside id={id} aria-label="Índice da nota" className={styles.panel} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>{content}</aside>;
}
