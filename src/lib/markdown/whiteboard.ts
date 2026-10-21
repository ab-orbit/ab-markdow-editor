import { t } from '../../i18n';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { EMPTY_EXCALIDRAW, replaceExcalidrawFence } from './excalidrawScene';

export interface DocumentWhiteboard {
  /** Original UTF-16 offsets include an optional leading BOM. */
  from: number;
  to: number;
  /** Portable scene JSON, without its Markdown fence. */
  source: string;
  /** Nearest preceding heading, used only as a navigation label. */
  title: string;
}
interface TextNode { type: string; value?: string; children?: TextNode[] }
const parser = unified().use(remarkParse).use(remarkGfm);
const plainText = (node: TextNode): string => node.value || node.children?.map(plainText).join('') || '';

/** Cache source offsets while drawing; an SDK pointer update must not reparse a long manual. */
export class WhiteboardSource {
  private value: string | undefined;
  private boards: DocumentWhiteboard[] = [];
  /** Comments and whitespace do not turn a canvas document into a prose note. */
  private onlyBoards = true;
  private trailingHeading = '';
  private needsHeading = false;
  /** A drawing-only Markdown document opens as a canvas on another device too. */
  standalone = false;

  read(value: string): readonly DocumentWhiteboard[] {
    if (value === this.value) return this.boards;
    // Prose without an Excalidraw fence cannot contain a board; avoid parsing an entire book.
    if (!/(?:^|\r?\n)[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*excalidraw(?:[ \t]|\r?$)/im.test(value.replace(/^\uFEFF/, ''))) {
      this.value = value; this.boards = []; this.onlyBoards = !value.replace(/<!--[\s\S]*?-->/g, '').trim(); this.standalone = false; this.trailingHeading = ''; this.needsHeading = true;
      return this.boards;
    }
    this.needsHeading = false;
    const bom = value.startsWith('\uFEFF') ? 1 : 0;
    const tree = parser.parse(value.slice(bom));
    this.boards = [];
    let heading = '';
    for (const node of tree.children) {
      if (node.type === 'heading') heading = plainText(node).trim();
      if (node.type !== 'code' || node.lang?.toLowerCase() !== 'excalidraw') continue;
      const from = node.position!.start.offset! + bom, to = node.position!.end.offset! + bom;
      // Only closed top-level fences are writable; quoted or unfinished source stays untouched.
      try { replaceExcalidrawFence(value.slice(from, to), node.value); }
      catch { continue; }
      this.boards.push({ from, to, source: node.value, title: heading });
    }
    const content = tree.children.filter(node => node.type !== 'html' || !/^<!--[\s\S]*-->$/.test(node.value.trim()));
    this.onlyBoards = content.length === this.boards.length;
    this.standalone = this.onlyBoards && this.boards.length > 0;
    this.trailingHeading = heading;
    this.value = value;
    return this.boards;
  }

  replace(index: number, scene: string): string {
    const value = this.value ?? '';
    const board = this.boards[index];
    if (!board) {
      if (index !== this.boards.length) throw new Error(t("O quadro mudou. Abra-o novamente antes de editar."));
      return this.append(scene);
    }
    if (board.source.replace(/\r\n?/g, '\n').trimEnd() === scene.replace(/\r\n?/g, '\n').trimEnd()) return value;
    const fence = replaceExcalidrawFence(value.slice(board.from, board.to), scene);
    const delta = fence.length - (board.to - board.from);
    this.value = value.slice(0, board.from) + fence + value.slice(board.to);
    this.boards = this.boards.map((item, ordinal) => ordinal === index ? { ...item, to: item.to + delta, source: scene } : ordinal > index ? { ...item, from: item.from + delta, to: item.to + delta } : item);
    return this.value;
  }

  append(scene = EMPTY_EXCALIDRAW): string {
    if (this.needsHeading) {
      for (const node of parser.parse(this.value || '').children) if (node.type === 'heading') this.trailingHeading = plainText(node).trim();
      this.needsHeading = false;
    }
    const value = this.value ?? '', newline = value.match(/\r\n|\r|\n/)?.[0] || '\n';
    const separator = value && !value.endsWith(newline.repeat(2)) ? value.endsWith(newline) ? newline : newline.repeat(2) : '';
    const from = value.length + separator.length;
    const fence = `\`\`\`excalidraw${newline}${scene.replace(/\r\n?/g, '\n').replace(/\n/g, newline)}${newline}\`\`\``;
    this.value = value + separator + fence + newline;
    this.boards = [...this.boards, { from, to: from + fence.length, source: scene, title: this.trailingHeading }];
    this.standalone = this.onlyBoards;
    return this.value;
  }
}
