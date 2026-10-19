import type { Editor, JSONContent } from '@tiptap/core';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

interface SourceBlock {
  /** Exact original bytes and whitespace preceding this top-level Markdown block. */
  raw: string;
  gap: string;
  /** Canonical editor JSON, excluding bookkeeping attributes. */
  baseline: string;
}

const parser = unified().use(remarkParse).use(remarkGfm);

/** Compare semantic content without treating source bookkeeping as an edit. */
function fingerprint(node: JSONContent): string {
  return JSON.stringify(node, (key, value) => key === 'sourceId' || key === 'sourceStart' || key === 'diagramOrdinal' ? undefined : value);
}

/** Keep unrelated Markdown, comments, references, fences and line endings byte-for-byte. */
export class ReadingSource {
  private blocks = new Map<string, SourceBlock>();
  private prefix = '';
  private suffix = '';
  private newline = '\n';

  load(source: string, editor: Editor): void {
    this.blocks.clear();
    this.newline = source.includes('\r\n') ? '\r\n' : source.includes('\r') ? '\r' : '\n';
    this.prefix = source.startsWith('\uFEFF') ? '\uFEFF' : '';
    const body = source.slice(this.prefix.length), tree = parser.parse(body);
    const definitions = tree.children.filter(node => node.type === 'definition').map(node => body.slice(node.position!.start.offset!, node.position!.end.offset!)).join('\n');
    const content: JSONContent[] = [];
    let previous = 0;
    previous = this.prefix.length;
    for (const node of tree.children) {
      const start = node.position!.start.offset! + this.prefix.length, end = node.position!.end.offset! + this.prefix.length;
      const raw = source.slice(start, end), gap = source.slice(previous, start);
      previous = end;
      let parsed: JSONContent[];
      if (['html', 'definition', 'footnoteDefinition'].includes(node.type)) {
        parsed = [{ type: 'sourceOnly', attrs: { raw } }];
      } else {
        parsed = editor.markdown!.parse(raw + (definitions ? `\n\n${definitions}` : '')).content || [];
        // A parser cannot discard an unsupported block silently.
        if (!parsed.length) parsed = [{ type: 'sourceOnly', attrs: { raw } }];
      }
      if (parsed.length > 1) {
        // One source block can produce multiple schema nodes (for example an inline image).
        // Preserve it as one container so editing a neighboring paragraph cannot normalize it.
        parsed = [{ type: 'sourceGroup', content: parsed }];
      }
      const id = crypto.randomUUID();
      const block = { ...parsed[0], attrs: { ...parsed[0].attrs, sourceId: id, sourceStart: start } };
      content.push(block);
      this.blocks.set(id, { raw, gap, baseline: '' });
    }
    this.suffix = source.slice(previous);
    // Loading is never an undoable user edit, including typing immediately after opening.
    editor.chain().setMeta('addToHistory', false).setContent({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }, { emitUpdate: false }).run();
    editor.state.doc.forEach(node => {
      const block = this.blocks.get(node.attrs.sourceId);
      if (block) block.baseline = fingerprint(node.toJSON());
    });
  }

  serialize(editor: Editor): string {
    let source = this.prefix;
    const used = new Set<string>();
    editor.state.doc.forEach(node => {
      const json = node.toJSON(), id = node.attrs.sourceId as string;
      const block = !used.has(id) ? this.blocks.get(id) : undefined;
      used.add(id);
      const raw = block && block.baseline === fingerprint(json) ? block.raw : editor.markdown!.serialize({ type: 'doc', content: [json] }).replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '').replace(/\n/g, this.newline);
      // New adjacent blocks need a separator; an untouched block retains its original gap.
      const gap = block?.gap ?? (source && !source.endsWith(this.newline.repeat(2)) ? this.newline.repeat(2) : '');
      source += gap + raw;
    });
    return source + this.suffix;
  }
}
