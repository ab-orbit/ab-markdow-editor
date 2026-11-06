import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparePdfTables, PDF_PAGE_MARGINS } from '../src/lib/markdown/pdfTables.ts';

const table = (columns, rows = 3, text = column => `Column ${column + 1}`) => ({
  layout: 'scribaTable',
  fontSize: columns > 5 ? 8.5 : 10,
  table: { headerRows: 1, dontBreakRows: true, widths: Array(columns).fill('*'),
    body: Array.from({ length: rows }, () => Array.from({ length: columns }, (_, column) => ({ text: [{ text: text(column) }] }))) },
});
const heading = text => ({ text, headlineLevel: 2, style: 'h2' });
const paragraph = text => ({ text, style: 'paragraph' });
const width = orientation => (orientation === 'landscape' ? 841.89 : 595.28) - PDF_PAGE_MARGINS[0] - PDF_PAGE_MARGINS[2];
const tableWidth = node => node.table.widths.reduce((sum, value) => sum + value, 0) + node.table.widths.length * 12;

test('a wide table has its own landscape pages, keeps its heading and restores portrait text', () => {
  const source = [paragraph('Introduction'), heading('Comparison'), table(5), paragraph('Conclusion')];
  const original = structuredClone(source);
  const result = preparePdfTables(source);
  assert.equal(result.pageOrientation, 'portrait');
  assert.equal(result.content[1].pageOrientation, 'landscape');
  assert.equal(result.content[1].pageBreak, 'before');
  assert.equal(result.content[1].stack[0].text, 'Comparison');
  const formatted = result.content[1].stack[1];
  assert.ok(Math.abs(tableWidth(formatted) - width('landscape')) < .02);
  assert.equal(formatted.table.headerRows, 1);
  assert.equal(formatted.fontSize, 10);
  assert.equal(result.content[2].pageOrientation, 'portrait');
  assert.equal(result.content[2].pageBreak, 'before');
  assert.deepEqual(source, original, 'Formatting never mutates the note export snapshot.');
});

test('small tables stay in the text flow and long identifiers cannot widen the sheet', () => {
  const node = table(3, 3, column => column === 1 ? 'unbroken_identifier_'.repeat(12) : `Cell ${column}`);
  const result = preparePdfTables([paragraph('Before'), node, paragraph('After')]);
  assert.equal(result.pageOrientation, 'portrait');
  assert.equal(result.content.length, 3);
  assert.ok(Math.abs(tableWidth(result.content[1]) - width('portrait')) < .02);
  assert.equal(result.content[2].pageBreak, undefined);
  assert.equal(result.content[1].table.body[1][1].text[0].text, node.table.body[1][1].text[0].text);
});

test('dense four-column prose also gets landscape, without reducing the text size', () => {
  const dense = table(4, 4, () => 'A detailed comparison needs readable space for its context and evidence. '.repeat(3));
  const result = preparePdfTables([dense]);
  assert.equal(result.pageOrientation, 'landscape');
  assert.equal(result.content[0].pageBreak, undefined, 'A table-only note has no blank cover.');
  assert.equal(result.content[0].stack[0].fontSize, 10);
});

test('consecutive wide tables start separate pages without a trailing empty portrait page', () => {
  const result = preparePdfTables([heading('First'), table(5), heading('Second'), table(6)]);
  assert.equal(result.pageOrientation, 'landscape');
  assert.equal(result.content.length, 2);
  assert.equal(result.content[0].pageBreak, undefined);
  assert.equal(result.content[1].pageBreak, 'before');
  assert.equal(result.content[1].pageOrientation, 'landscape');
  assert.equal(result.content[1].stack[0].text, 'Second');
});

test('rows taller than a page may continue instead of disappearing as an unbreakable block', () => {
  const result = preparePdfTables([table(5, 2, column => column === 4 ? 'Long cell content. '.repeat(700) : 'Short')]);
  assert.equal(result.content[0].stack[0].table.dontBreakRows, false);
  assert.equal(result.content[0].stack[0].table.headerRows, 1);
});

test('an empty note stays portrait and a code panel is not treated as a Markdown table', () => {
  assert.deepEqual(preparePdfTables([]), { content: [], pageOrientation: 'portrait' });
  const code = { layout: 'noBorders', table: { widths: ['*'], body: [[{ text: 'example code' }]] } };
  assert.deepEqual(preparePdfTables([code]).content, [code]);
});
