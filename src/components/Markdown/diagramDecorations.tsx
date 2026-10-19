import { StateField, type EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { createRoot, type Root } from 'react-dom/client';
import { RenderedDiagram } from './RenderedDiagram';
import { replaceExcalidrawFence } from '@/lib/markdown/excalidrawScene';
import { rawBlockContains, revealBlock } from './blockEditing';
import { diagramIdentity, diagramSourceKey, diagramLanguage, type DiagramLanguage } from '@/lib/markdown/diagrams';

const roots = new WeakMap<HTMLElement, Root>();

class DiagramWidget extends WidgetType {
  constructor(readonly source: string, readonly from: number, readonly to: number, readonly scope: string, readonly occurrence: number, readonly language: DiagramLanguage) { super(); }
  eq(other: DiagramWidget) { return this.source === other.source && this.from === other.from && this.to === other.to && this.scope === other.scope && this.occurrence === other.occurrence && this.language === other.language; }
  get estimatedHeight() { return 260; }
  toDOM(view: EditorView) {
    const element = document.createElement('div'); element.className = 'md-live-diagram';
    const root = createRoot(element); roots.set(element, root);
    root.render(<RenderedDiagram source={this.source} language={this.language} identity={diagramIdentity(this.scope, this.source, this.occurrence, this.language)} legacyIdentity={`${this.scope}:${this.from}`} onEdit={view.state.readOnly ? undefined : () => { revealBlock(view, this.from); }} onChange={view.state.readOnly ? undefined : source => {
      if (!element.isConnected || view.state.readOnly) return;
      view.dispatch({ changes: { from: this.from, to: this.to, insert: replaceExcalidrawFence(view.state.sliceDoc(this.from, this.to), source) } });
    }} onLayout={() => { if (element.isConnected) view.requestMeasure(); }}/>);
    return element;
  }
  ignoreEvent() { return true; }
  destroy(element: HTMLElement) {
    const root = roots.get(element); roots.delete(element);
    // CodeMirror may remove a widget during a parent React effect.
    if (root) queueMicrotask(() => root.unmount());
  }
}

/** Replace inactive fenced diagrams; keep source plus a preview while editing one. */
export function diagramDecorations(scope: string) {
  function build(state: EditorState) {
    const ranges: ReturnType<Decoration['range']>[] = [];
    const occurrences = new Map<string, number>();
    syntaxTree(state).iterate({ enter(node) {
      if (node.name !== 'FencedCode') return;
      const info = node.node.getChild('CodeInfo');
      const language = info ? diagramLanguage(state.sliceDoc(info.from, info.to)) : undefined;
      if (!language) return;
      const parts: string[] = [];
      for (let child = node.node.firstChild; child; child = child.nextSibling) if (child.name === 'CodeText') parts.push(state.sliceDoc(child.from, child.to));
      const source = parts.join(''), key = `${language}:${diagramSourceKey(source)}`, occurrence = occurrences.get(key) || 0;
      occurrences.set(key, occurrence + 1);
      const widget = new DiagramWidget(source, node.from, node.to, scope, occurrence, language);
      const active = rawBlockContains(state, node.from, node.to) || state.selection.ranges.some(range => range.from <= node.to && range.to >= node.from);
      ranges.push(active
        ? Decoration.widget({ block: true, side: 1, widget }).range(node.to)
        : Decoration.replace({ block: true, widget }).range(node.from, node.to));
    } });
    return Decoration.set(ranges, true);
  }
  const field = StateField.define({ create: build, update: (_decorations, transaction) => build(transaction.state), provide: value => EditorView.decorations.from(value) });
  return [field, EditorView.atomicRanges.of(view => view.state.field(field))];
}
