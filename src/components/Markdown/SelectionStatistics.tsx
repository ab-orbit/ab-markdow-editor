import { t } from '../../i18n';
import { useEffect, useImperativeHandle, useState, type Ref, type RefObject } from 'react';
import styles from './MarkdownWorkbench.module.css';

export interface SelectionStatisticsHandle {
  /** Report CodeMirror's complete source selection, including off-screen ranges. */
  setEditorSelection: (characters: number) => void;
}
interface SelectionStatisticsProps {
  ref?: Ref<SelectionStatisticsHandle>;
  /** Limit native browser selections to the current document preview. */
  container: RefObject<HTMLDivElement | null>;
  /** Reset transient counts after changing documents or presentation modes. */
  resetKey: string;
  /** Existing source totals, using the same string-length convention as before. */
  words: number;
  characters: number;
}

/** Keep selection updates inside the footer so dragging never reparses Markdown. */
export function SelectionStatistics({ ref, container, resetKey, words, characters }: SelectionStatisticsProps) {
  const [selected, setSelected] = useState(0);
  useImperativeHandle(ref, () => ({ setEditorSelection: setSelected }), []);

  useEffect(() => {
    setSelected(0);
    let frame = 0;
    function readSelection() {
      frame = 0;
      const documentArea = container.current, selection = document.getSelection();
      if (!documentArea || documentArea.closest('[hidden],[inert]') || !selection?.anchorNode || !selection.focusNode) { setSelected(0); return; }
      const anchor = selection.anchorNode, focus = selection.focusNode;
      const anchorElement = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement;
      // CodeMirror owns its selection model. Native DOM ranges may omit source
      // hidden by live preview or virtualization, so its callback takes priority.
      const editor = anchorElement?.closest('.cm-editor');
      if (editor && documentArea.contains(editor) && editor.contains(focus) && !editor.closest('[hidden]')) return;
      const reading = documentArea.querySelector('article');
      setSelected(!selection.isCollapsed && reading?.contains(anchor) && reading.contains(focus) ? selection.toString().length : 0);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(readSelection); }
    document.addEventListener('selectionchange', schedule);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('selectionchange', schedule); };
  }, [container, resetKey]);

  return <span className={styles.statistics}>{words}{' '}{t("palavras ·")}{' '}{characters}{' '}{t("caracteres")}{selected > 0 && <> · <span className={styles.selectionCount} data-selected-characters={selected} title={t("{0} {1}, incluindo espaços e quebras de linha", selected, selected === 1 ? t("caractere selecionado") : t("caracteres selecionados"))}>{selected}{' '}{' '}{selected === 1 ? t("selecionado") : t("selecionados")}</span></>}</span>;
}
