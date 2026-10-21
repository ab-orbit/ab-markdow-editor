import { useEffect, useRef, type RefObject } from 'react';
import type { MarkdownEditorHandle } from './MarkdownEditor';

/** Follow the pane the user is operating; source offsets keep different render heights aligned. */
export function useSplitScroll(container: RefObject<HTMLDivElement | null>, editor: RefObject<MarkdownEditorHandle | null>, enabled: boolean, value: string, onReveal?: () => void) {
  const reveal = useRef(onReveal); reveal.current = onReveal;
  useEffect(() => {
    if (!enabled) return;
    const root = container.current, source = root?.querySelector<HTMLElement>(':scope > div'), reading = root?.querySelector<HTMLElement>(':scope > article');
    if (!root || !source || !reading) return;
    let driver = source, frame = 0, clickUntil = 0;
    const normalized = value.replace(/\r\n?/g, '\n');
    const hasCR = value.includes('\r');
    const normalize = (position: number) => hasCR ? value.slice(0, position).replace(/\r\n?/g, '\n').length : position;
    const anchors = () => Array.from(reading!.querySelectorAll<HTMLElement>('[data-source-from][data-source-to]')).filter(element => element.getClientRects().length > 0).map(element => ({ element, from: normalize(Number(element.dataset.sourceFrom)), to: normalize(Number(element.dataset.sourceTo)) })).sort((a, b) => a.from - b.from);
    function sync(origin: HTMLElement) {
      if (origin !== driver || performance.now() < clickUntil) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const blocks = anchors();
        if (!blocks.length) return;
        if (origin === source) {
          const position = editor.current?.visibleSourcePosition(source!.getBoundingClientRect().top + 1) || 0;
          const block = blocks.filter(block => block.from <= position).at(-1) || blocks[0];
          const ratio = Math.max(0, Math.min(1, (position - block.from) / Math.max(1, block.to - block.from)));
          reading!.scrollTop += block.element.getBoundingClientRect().top - reading!.getBoundingClientRect().top + ratio * block.element.offsetHeight;
          if (source!.scrollTop < 2) reading!.scrollTop = 0;
          if (source!.scrollTop + source!.clientHeight >= source!.scrollHeight - 2) reading!.scrollTop = reading!.scrollHeight;
        } else {
          const top = reading!.getBoundingClientRect().top;
          const block = blocks.find(block => block.element.getBoundingClientRect().bottom > top + 1) || blocks.at(-1)!;
          const bounds = block.element.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (top - bounds.top) / Math.max(1, bounds.height)));
          editor.current?.scrollToSourcePosition(Math.round(block.from + ratio * (block.to - block.from)), source!, Math.max(0, bounds.top - top));
          if (reading!.scrollTop < 2) source!.scrollTop = 0;
          if (reading!.scrollTop + reading!.clientHeight >= reading!.scrollHeight - 2) source!.scrollTop = source!.scrollHeight;
        }
      });
    }
    function clickSource(event: MouseEvent) {
      if ((event.target as Element).closest('button,.cm-foldGutter') || event.button !== 0) return;
      driver = source!; clickUntil = performance.now() + 180; cancelAnimationFrame(frame);
      reveal.current?.();
      frame = requestAnimationFrame(() => {
        const position = editor.current?.selection().from ?? 0, blocks = anchors();
        const block = blocks.filter(block => block.from <= position && block.to >= position).sort((a, b) => (a.to - a.from) - (b.to - b.from))[0] || blocks.reduce<typeof blocks[number] | undefined>((best, block) => !best || Math.abs(block.from - position) < Math.abs(best.from - position) ? block : best, undefined);
        if (!block) return;
        const start = editor.current?.sourcePositionY(block.from) ?? event.clientY;
        const end = editor.current?.sourcePositionY(block.to) ?? start;
        const ratio = Math.max(0, Math.min(1, (event.clientY - start) / Math.max(24, end - start + 24)));
        const bounds = block.element.getBoundingClientRect();
        reading!.scrollTop += bounds.top + ratio * bounds.height - (reading!.getBoundingClientRect().top + event.clientY - source!.getBoundingClientRect().top);
      });
    }
    function clickReading(event: MouseEvent) {
      if ((event.target as Element).closest('a,button,input,textarea,select,.cm-editor') || event.button !== 0) return;
      const element = (event.target as Element).closest<HTMLElement>('[data-source-from][data-source-to]');
      if (!element || !reading!.contains(element)) return;
      driver = reading!; clickUntil = performance.now() + 180; cancelAnimationFrame(frame);
      const from = normalize(Number(element.dataset.sourceFrom)), to = normalize(Number(element.dataset.sourceTo));
      const bounds = element.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
      let position = Math.round(from + ratio * (to - from));
      // Text nodes recover precise columns where Markdown delimiters disappear in reading.
      const caret = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const node = caret?.startContainer;
      if (node?.nodeType === Node.TEXT_NODE && element.contains(node)) {
        const text = node.textContent || '', raw = normalized.slice(from, to);
        let index = raw.indexOf(text), closest = -1;
        while (text && index >= 0) { if (closest < 0 || Math.abs(from + index - position) < Math.abs(from + closest - position)) closest = index; index = raw.indexOf(text, index + 1); }
        if (closest >= 0) position = from + closest + (caret?.startOffset || 0);
      }
      editor.current?.selectSourcePosition(position);
      editor.current?.scrollToSourcePosition(position, source!, Math.max(0, event.clientY - reading!.getBoundingClientRect().top));
    }
    const useSource = () => { driver = source; clickUntil = 0; }, useReading = () => { driver = reading; clickUntil = 0; };
    const left = () => sync(source), right = () => sync(reading);
    // Native scrolling generated in the follower pane cannot feed back into the driver.
    for (const event of ['pointerdown', 'wheel', 'touchstart', 'focusin'] as const) { source.addEventListener(event, useSource, { passive: true }); reading.addEventListener(event, useReading, { passive: true }); }
    source.addEventListener('click', clickSource); reading.addEventListener('click', clickReading);
    source.addEventListener('scroll', left, { passive: true }); reading.addEventListener('scroll', right, { passive: true });
    sync(source);
    return () => {
      source.removeEventListener('click', clickSource); reading.removeEventListener('click', clickReading);
      source.removeEventListener('scroll', left); reading.removeEventListener('scroll', right); cancelAnimationFrame(frame);
      for (const event of ['pointerdown', 'wheel', 'touchstart', 'focusin'] as const) { source.removeEventListener(event, useSource); reading.removeEventListener(event, useReading); }
    };
  }, [enabled, value, container, editor]);
}
