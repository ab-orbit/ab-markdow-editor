import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './MarkdownWorkbench.module.css';

/** Native modal supplies focus containment, Escape handling and focus restoration. */
export function EditorDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={onClose}>
    <header><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    {children}
  </dialog>;
}
