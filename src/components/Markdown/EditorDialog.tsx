import { interactionFocusTarget } from '../ui/interactionFocus';
import { navigateActionMenu } from '../ui/actionMenu';
import { t } from '../../i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './MarkdownWorkbench.module.css';

/** Native modal supplies focus containment, Escape handling and focus restoration. */
export function EditorDialog({ title, onClose, children, className = "", dismissOnOutside = false, variant = "dialog" }: { title: string; onClose: () => void; children: ReactNode; className?: string; dismissOnOutside?: boolean; variant?: "dialog" | "menu" | "inspector" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog=ref.current,trigger=interactionFocusTarget();
    dialog?.showModal();
    // A touch-opened menu starts neutral; keyboard navigation selects one command explicitly.
    if(variant === 'menu')dialog?.focus({preventScroll:true});
    return () => {dialog?.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
  }, [variant]);
  return <dialog ref={ref} tabIndex={variant === "menu" ? -1 : undefined} data-ui={variant === "menu" ? "action-menu" : variant} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()} onContextMenu={event => event.stopPropagation()} onKeyDown={event=>{event.stopPropagation();if(variant === "menu")navigateActionMenu(event);}} className={`${styles.dialog} ${className}`} aria-labelledby={id} onCancel={onClose} onClick={event=>{event.stopPropagation();if(!dismissOnOutside||event.target!==event.currentTarget)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}><header><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label={t("Fechar")}><X size={18}/></button></header>{children}</dialog>;
}
