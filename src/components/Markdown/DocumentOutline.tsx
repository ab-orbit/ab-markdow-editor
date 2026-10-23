import { t } from '../../i18n';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ListTree, X, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { documentOutline, type OutlineHeading } from '@/lib/markdown/outline';
import styles from './DocumentOutline.module.css';

interface DocumentOutlineProps {
  /** Render inside the mobile information sheet without opening a nested modal. */
  embedded?: boolean;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
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
export function DocumentOutline({ embedded = false, collapsed, onToggle, onExpandAll, onCollapseAll, source, id, scrollContainer, viewKey, currentHeading, onNavigate, onClose }: DocumentOutlineProps) {
  const headings = useMemo(() => documentOutline(source), [source]);
  const [small, setSmall] = useState(() => matchMedia("(max-width: 899px)").matches);
  const [active, setActive] = useState("");
  const modal = useRef<HTMLDialogElement>(null), list = useRef<HTMLElement>(null);
  const readCurrent = useRef(currentHeading); readCurrent.current = currentHeading;
  useEffect(() => {
    const media = matchMedia("(max-width: 899px)"), update = () => setSmall(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!small || embedded) return;
    const dialog = modal.current; dialog?.showModal(); return () => dialog?.close();
  }, [small, embedded]);
  useEffect(() => {
    const root = scrollContainer.current;
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setActive(readCurrent.current(headings) || headings[0]?.id || ""); });
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

  const parents = new Set(headings.filter((heading, index) => headings[index + 1]?.level > heading.level).map(heading => heading.id));
  const hasCollapsed = headings.some(heading => parents.has(heading.id) && collapsed.has(heading.id));
  const toggleAllLabel = hasCollapsed ? t("Expandir todos os níveis") : t("Recolher todos os níveis");
  const ancestors: OutlineHeading[] = [];
  const visible = headings.filter(heading => {
    while (ancestors.length && ancestors.at(-1)!.level >= heading.level) ancestors.pop();
    const show = !ancestors.some(parent => collapsed.has(parent.id)); ancestors.push(heading); return show;
  });
  const content = <><header className={styles.header}><div><ListTree size={17} aria-hidden="true"/><h2>{t("Índice")}</h2><span>{headings.length}</span></div><div className={styles.headerActions}>{parents.size > 0 && <button type="button" aria-label={toggleAllLabel} title={toggleAllLabel} onClick={hasCollapsed ? onExpandAll : onCollapseAll}>{hasCollapsed ? <ChevronsUpDown size={17}/> : <ChevronsDownUp size={17}/>}</button>}{!embedded && <button data-ui="dismiss" type="button" aria-label={t("Fechar outline")} title={t("Fechar índice")} onClick={onClose}><X size={17}/></button>}</div></header>{headings.length ? <nav ref={list} className={styles.list} aria-label={t("Seções da nota")}><ol>{visible.map(heading => <li key={heading.id} data-level={heading.level} style={{ paddingInlineStart: `${(heading.level - 1) * 10}px` }}>{parents.has(heading.id) ? <button type="button" className={styles.foldToggle} aria-label={t("{0} nível {1}: {2}", collapsed.has(heading.id) ? t("Expandir") : t("Recolher"), heading.level, heading.label)} aria-expanded={!collapsed.has(heading.id)} onClick={() => onToggle(heading.id)}>{collapsed.has(heading.id) ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button> : <span className={styles.foldSpacer} aria-hidden="true"/>}<a href={`#${encodeURIComponent(heading.id)}`} title={heading.label} aria-label={heading.label} aria-current={active === heading.id ? 'location' : undefined} onClick={event => { event.preventDefault(); setActive(heading.id); onNavigate(heading, small); }}><span className={styles.levelBadge}>{t("H")}{heading.level}</span>{heading.label}</a></li>)}</ol></nav> : <p className={styles.empty}>{t("Os títulos de níveis 1 a 6 aparecem aqui conforme você escreve.")}</p>}</>;
  if(embedded)return <div className={`${styles.panel} ${styles.embedded}`}>{content}</div>;
  return small ? <dialog ref={modal} id={id} aria-label={t("Índice da nota")} className={`${styles.panel} ${styles.sheet}`} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    // Safari's keyboard preference can skip links even in a native modal.
    // Explicit cycling keeps every section reachable; Escape remains native.
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey) return;
    const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(element => element.getClientRects().length);
    const index = targets.indexOf(document.activeElement as HTMLElement);
    event.preventDefault(); targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length]?.focus();
  }} onClick={event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) onClose();
  }}>{content}</dialog> : <aside id={id} aria-label={t("Índice da nota")} className={styles.panel} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>{content}</aside>;
}
