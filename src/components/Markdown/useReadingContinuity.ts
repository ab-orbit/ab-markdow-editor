import {useEffect, type RefObject} from 'react';

/** Preserve a source-backed reading anchor while the same mounted document reflows. */
export function useReadingContinuity(container: RefObject<HTMLDivElement | null>, enabled: boolean, documentIdentity: number) {
  useEffect(() => {
    const root = container.current;
    if (!root || !enabled) return;
    let anchor: {element: HTMLElement; fraction: number} | undefined;
    let width = root.clientWidth, height = root.clientHeight, frame = 0, restoring = false;
    const remember = () => {
      if (restoring || document.getSelection()?.anchorNode && document.activeElement?.closest('[contenteditable="true"]')) return;
      const top = root.getBoundingClientRect().top;
      const blocks = [...root.querySelectorAll<HTMLElement>('[data-source-from][data-source-to]')].filter(element => element.getClientRects().length);
      const element = blocks.find(element => element.getBoundingClientRect().bottom > top + 1);
      if (element) { const box=element.getBoundingClientRect(); anchor={element,fraction:Math.max(0,(top-box.top)/Math.max(1,box.height))}; }
    };
    root.addEventListener('scroll', remember, {passive:true});
    const observer = new ResizeObserver(() => {
      if (width===root.clientWidth && height===root.clientHeight) return;
      width=root.clientWidth; height=root.clientHeight;
      cancelAnimationFrame(frame); restoring=true;
      frame=requestAnimationFrame(() => {
        // The browser/ProseMirror owns a live caret; only ordinary reading is anchored here.
        if (!document.activeElement?.closest('[contenteditable="true"],.cm-editor') && anchor?.element.isConnected) {
          const box=anchor.element.getBoundingClientRect();
          root.scrollTop += box.top-root.getBoundingClientRect().top+anchor.fraction*box.height;
        }
        restoring=false; remember();
      });
    });
    observer.observe(root); requestAnimationFrame(remember);
    return () => {root.removeEventListener('scroll',remember);observer.disconnect();cancelAnimationFrame(frame);};
  }, [container, enabled, documentIdentity]);
}
