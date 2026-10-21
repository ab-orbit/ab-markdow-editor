import { t } from '../../i18n';
import { StateField, type EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import {rawBlockContains} from './blockEditing';
import { resolveAsset, type MarkdownAsset } from '@/lib/markdown/assets';

class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string, readonly from: number) { super(); }
  eq(other: ImageWidget) { return other.url === this.url && other.alt === this.alt && other.from === this.from; }
  toDOM(view: EditorView) {
    const figure = document.createElement('figure'); figure.className = 'md-live-image';
    const image = document.createElement('img'); image.src = this.url; image.alt = this.alt; image.draggable = false;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = t("Editar descrição / caminho");
    button.addEventListener('click', () => { view.dispatch({ selection: { anchor: this.from } }); view.focus(); });
    figure.append(image, button); return figure;
  }
  ignoreEvent() { return true; }
}

/** Replace standalone, inactive image syntax with a registered local image only. */
export function imageDecorations(assets: readonly MarkdownAsset[]) {
  function build(state: EditorState) {
    const ranges: ReturnType<Decoration['range']>[] = [];
    syntaxTree(state).iterate({ enter(node) {
      if (node.name !== 'Image') return;
      const line = state.doc.lineAt(node.from);
      if (line.from !== node.from || line.to !== node.to || rawBlockContains(state,node.from,node.to) || state.selection.ranges.some(range => range.from <= line.to && range.to >= line.from)) return;
      const match = state.sliceDoc(node.from, node.to).match(/^!\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))\)$/);
      if (!match) return;
      const asset = resolveAsset(match[2] ?? match[3], assets);
      if (asset) ranges.push(Decoration.replace({ block: true, widget: new ImageWidget(asset.url, match[1], node.from) }).range(node.from, node.to));
    } });
    return Decoration.set(ranges, true);
  }
  return StateField.define({ create: build, update: (_decorations, transaction) => build(transaction.state), provide: field => EditorView.decorations.from(field) });
}
