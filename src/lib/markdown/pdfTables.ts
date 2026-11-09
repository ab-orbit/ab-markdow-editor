import type { Content, ContentTable, ContentText, ContentStack, ContentUnorderedList, ContentOrderedList, PageOrientation } from 'pdfmake/interfaces';

/** Shared A4 margins in points, including the space reserved for the branded footer. */
export const PDF_PAGE_MARGINS: [number, number, number, number] = [42, 42, 42, 58];
const A4 = { width: 595.28, height: 841.89 }, PADDING = 12, FONT_SIZE = 10;
const PORTRAIT_WIDTH = A4.width - PDF_PAGE_MARGINS[0] - PDF_PAGE_MARGINS[2];
const LANDSCAPE_WIDTH = A4.height - PDF_PAGE_MARGINS[0] - PDF_PAGE_MARGINS[2];
/** Text and mathematical layout share the exact widths chosen for table pages. */
export const PDF_CONTENT_WIDTHS = { portrait: PORTRAIT_WIDTH, landscape: LANDSCAPE_WIDTH };

function cellText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(cellText).join('');
  if (value && typeof value === 'object' && 'text' in value) return cellText(value.text);
  return '';
}
function isTable(node: Content): node is ContentTable {
  return !!node && typeof node === 'object' && !Array.isArray(node) && 'table' in node && 'layout' in node && node.layout === 'scribaTable';
}
function isHeading(node: Content | undefined): node is ContentText {
  return !!node && typeof node === 'object' && !Array.isArray(node) && 'headlineLevel' in node && !!node.headlineLevel;
}
function columnDemands(node: ContentTable): number[] {
  const count = node.table.body[0]?.length || 0;
  // Prose needs more room than a short row label. Cap the preference of a very long
  // identifier: pdfmake's fixed-width cells can wrap it without widening every column.
  return Array.from({ length: count }, (_, column) => {
    const longest = Math.max(0, ...node.table.body.map(row => cellText(row[column]).length));
    return Math.max(64, Math.min(180, Math.sqrt(longest) * 12));
  });
}
function isWide(node: ContentTable): boolean {
  const demands = columnDemands(node);
  return demands.length >= 5 || demands.reduce((sum, value) => sum + value + PADDING, 0) > PORTRAIT_WIDTH;
}
function formatTable(node: ContentTable, availableWidth: number, orientation: PageOrientation): ContentTable {
  const demands = columnDemands(node), total = demands.reduce((sum, value) => sum + value, 0);
  const available = availableWidth - demands.length * PADDING;
  const widths = demands.map(value => Math.floor(available * value / total * 100) / 100);
  if (widths.length) widths[widths.length - 1] += available - widths.reduce((sum, value) => sum + value, 0);
  const rowHeight = (row: unknown[]) => 8.4 + Math.max(1, ...row.map((cell, column) => cellText(cell).split('\n').reduce(
    (lines, line) => lines + Math.max(1, Math.ceil(line.length * FONT_SIZE * .7 / widths[column])), 0,
  ))) * FONT_SIZE * 1.35;
  const pageHeight = orientation === 'landscape' ? A4.width : A4.height;
  const room = pageHeight - PDF_PAGE_MARGINS[1] - PDF_PAGE_MARGINS[3] - rowHeight(node.table.body[0] || []) - 24;
  return {
    ...node, fontSize: FONT_SIZE,
    table: {
      ...node.table, widths, headerRows: 1,
      // Keep ordinary records intact. An oversized row must be allowed to continue
      // across pages; treating it as unbreakable can silently discard its text.
      dontBreakRows: node.table.body.slice(1).every(row => rowHeight(row) <= room),
    },
  };
}
function embedded(node: Content, availableWidth: number): Content {
  if (isTable(node)) return formatTable(node, availableWidth, 'portrait');
  if (Array.isArray(node)) return node.map(child => embedded(child, availableWidth));
  if (!node || typeof node !== 'object') return node;
  const margin = 'margin' in node ? node.margin : 0;
  const inset = Array.isArray(margin) ? margin[0] + (margin.length === 2 ? margin[0] : margin[2]) : (margin || 0) * 2;
  const width = availableWidth - inset;
  if ('stack' in node && Array.isArray(node.stack)) return { ...node, stack: node.stack.map(child => embedded(child, width)) } as ContentStack;
  if ('ul' in node && Array.isArray(node.ul)) return { ...node, ul: node.ul.map(child => embedded(child, width - 16)) } as ContentUnorderedList;
  if ('ol' in node && Array.isArray(node.ol)) return { ...node, ol: node.ol.map(child => embedded(child, width - 16)) } as ContentOrderedList;
  return node;
}

/** Isolate wide Markdown tables on landscape pages, then restore portrait flow.
 * Only export nodes are copied; the original Markdown and browser preview are untouched.
 */
export function preparePdfTables(source: readonly Content[]): { content: Content[]; pageOrientation: PageOrientation } {
  const content: Content[] = [];
  let pageOrientation: PageOrientation = 'portrait', previousWide = false;
  for (let index = 0; index < source.length; index++) {
    const node = source[index], next = source[index + 1];
    const withHeading = isHeading(node) && next !== undefined && isTable(next) && isWide(next);
    const table = withHeading ? next as ContentTable : isTable(node) && isWide(node) ? node : undefined;
    if (table) {
      const stack: Content[] = [...(withHeading ? [node] : []), formatTable(table, LANDSCAPE_WIDTH, 'landscape')];
      if (content.length === 0) pageOrientation = 'landscape';
      content.push({ stack, pageOrientation: 'landscape', ...(content.length ? { pageBreak: 'before' as const } : {}) });
      if (withHeading) index++;
      previousWide = true;
    } else {
      const formatted = embedded(node, PORTRAIT_WIDTH);
      content.push(previousWide ? { stack: [formatted], pageOrientation: 'portrait', pageBreak: 'before' } : formatted);
      previousWide = false;
    }
  }
  return { content, pageOrientation };
}
