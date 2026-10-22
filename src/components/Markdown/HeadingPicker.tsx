import { navigateActionMenu } from '../ui/actionMenu';
import { t } from '../../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { MarkdownCommand } from './editorCommands';
import styles from './MarkdownWorkbench.module.css';


/** Custom menu keeps heading previews consistent in Safari, which ignores option typography. */
export function HeadingPicker({ disabled, onCommand }: { disabled: boolean; onCommand: (command: MarkdownCommand) => void }) {
  const choices = [
  { command: 'paragraph', label: t("Texto"), hint: t("Parágrafo"), badge: '¶', level: 0 },
  { command: 'heading1', label: t("Título 1"), hint: t("Seção principal"), badge: 'H1', level: 1 },
  { command: 'heading2', label: t("Título 2"), hint: t("Subseção"), badge: 'H2', level: 2 },
  { command: 'heading3', label: t("Título 3"), hint: t("Detalhamento"), badge: 'H3', level: 3 },
] as const;
  const [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), id = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className={styles.headingPicker}><button ref={trigger} type="button" disabled={disabled} aria-label={t("Estilo do parágrafo")} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onMouseDown={event => event.preventDefault()} onClick={() => {
      const rect = trigger.current!.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 286)), top: rect.bottom + 300 < window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - 300) });
      setOpen(!open);
    }}>{t("Título / texto")}<ChevronDown size={16}/></button>{open && createPortal(<div ref={menu} style={position} id={id} role="menu" data-ui="action-menu" aria-label={t("Estilo do parágrafo")} className={styles.headingMenu} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      else navigateActionMenu(event);
    }}>{choices.map(choice => <button key={choice.command} role="menuitem" type="button" className={styles.headingChoice} data-heading-level={choice.level} onMouseDown={event => event.preventDefault()} onClick={() => { onCommand(choice.command); setOpen(false); }}><span className={styles.headingBadge}>{choice.badge}</span><span><span className={styles.headingLabel}>{choice.label}</span><small>{choice.hint}</small></span></button>)}</div>, document.body)}</div>;
}
