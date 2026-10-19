import type { Root, RootContent } from 'mdast';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

export interface OutlineHeading {
  /** Anchor shared with the reading renderer, including duplicate suffixes. */
  id: string;
  /** Visible inline text without Markdown delimiters. */
  label: string;
  /** Only document heading levels one through three enter the outline. */
  level: 1 | 2 | 3;
  /** Original UTF-16 source position and one-based line, before CRLF normalization. */
  from: number;
  line: number;
  /** Position among all six heading levels, also used by the visual editor. */
  ordinal: number;
}

function headingText(node: Root | RootContent, visible = false): string {
  if (visible && node.type === 'html') return '';
  if (visible && node.type === 'image') return node.alt || '';
  if ('value' in node && typeof node.value === 'string') return node.value;
  return 'children' in node ? node.children.map(child => headingText(child as RootContent, visible)).join('') : '';
}

/** Keep the established anchor algorithm for all heading levels, even excluded ones. */
export function assignHeadingIds(tree: Root): OutlineHeading[] {
  const used = new Set<string>(), headings: OutlineHeading[] = [];
  let ordinal = 0;
  function visit(node: Root | RootContent): void {
    if (node.type === 'heading') {
      const base = headingText(node).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/gu, '-') || 'section';
      let id = base;
      for (let suffix = 1; used.has(id); suffix++) id = `${base}-${suffix}`;
      used.add(id);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      if (node.depth <= 3) headings.push({ id, label: headingText(node, true).trim() || 'Seção sem título', level: node.depth as 1 | 2 | 3, from: node.position?.start.offset ?? 0, line: node.position?.start.line ?? 1, ordinal });
      ordinal++;
    }
    if ('children' in node) node.children.forEach(child => visit(child as RootContent));
  }
  visit(tree);
  return headings;
}

const parser = unified().use(remarkParse).use(remarkGfm);
/** Parse Markdown structure rather than matching hashes inside code or comments. */
export function documentOutline(source: string) { return assignHeadingIds(parser.parse(source)); }
