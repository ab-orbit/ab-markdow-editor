import { t } from '../../i18n';
import { useEffect, useRef, type RefObject } from 'react';
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor';
import styles from './MarkdownWorkbench.module.css';
/** Mount an editor for exactly one source block, keeping surrounding prose in reading mode. */
export function InlineBlockEditor({ source, cursor, level, onChange, onFinish, editorRef }: { source: string; cursor: number; level?: number; onChange: (source: string) => void; onFinish: () => void; editorRef?: RefObject<MarkdownEditorHandle | null> }) {
  const root = useRef<HTMLDivElement>(null), local = useRef<MarkdownEditorHandle>(null), finish = useRef(onFinish); finish.current = onFinish;
  useEffect(() => {
    // Local editing keeps the clicked block in place; navigation alone requests scrolling.
    local.current?.revealPosition(Math.min(cursor, source.length), true, false);
    if (editorRef) editorRef.current = local.current;
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!root.current?.contains(target) && !target.closest('[role=toolbar],dialog,[role=menu]')) finish.current();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('pointerdown', outside, true); if (editorRef) editorRef.current = null; };
  }, []);
  return <div ref={root} className={styles.inlineBlockEditor} data-inline-block-editor onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onFinish(); } }}>{level && <span className={styles.inlineHeadingBadge} aria-label={t("Título nível {0}", level)}>{t("H")}{level}</span>}<MarkdownEditor ref={local} value={source} onChange={onChange} livePreview={true} doubleClickToEdit={false}/></div>;
}
