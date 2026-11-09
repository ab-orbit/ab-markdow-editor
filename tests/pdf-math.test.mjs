import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pdfMake from 'pdfmake/build/pdfmake.js';
import fonts from 'pdfmake/build/vfs_fonts.js';
import { preparePdfMath } from '../src/lib/markdown/pdfMath.ts';
import { preparePdfTables } from '../src/lib/markdown/pdfTables.ts';

const defaults = { font: 'Roboto', fontSize: 11, color: '#333333', lineHeight: 1.35 };
const styles = { paragraph: { alignment: 'justify', margin: [0, 0, 0, 11] } };
let metrics, document;
before(async () => {
  pdfMake.addVirtualFileSystem(fonts);
  metrics = pdfMake.createPdf({ content: [] });
  document = await metrics.getStream();
});
after(async () => { await metrics.getBuffer(); });

const formula = (tex, display = false) => ({ text: tex, scribaMath: { tex, display } });
const prepare = content => preparePdfMath(content, (...args) => document.provideFont(...args), styles, defaults);
function nodes(value, predicate) {
  if (!value || typeof value !== 'object') return [];
  return [...(predicate(value) ? [value] : []), ...Object.values(value).flatMap(child => nodes(child, predicate))];
}
const vectors = value => nodes(value, node => typeof node.svg === 'string');
const text = value => nodes(value, node => typeof node.text === 'string').map(node => node.text).join('');

test('inline fractions share the prose baseline while words and links remain native PDF text', () => {
  const output = prepare([{ text: [{ text: 'A esperança ' }, formula(String.raw`\frac{1}{p}`), { text: ' permanece selecionável.', link: 'https://example.com' }], style: 'paragraph' }]);
  assert.equal(vectors(output).length, 1);
  assert.match(vectors(output)[0].svg, /<path/);
  assert.match(text(output), /A esperança.*permanece selecionável\./);
  assert.ok(nodes(output, node => node.link === 'https://example.com').length > 0);
  const line = output[0].stack[0], font = document.provideFont('Roboto', false, false);
  const baseline = line.columns[0].margin[1] + font.ascender * 11 / 1000;
  const equation = vectors(line)[0], top = Number(/viewBox="[^ ]+ ([^ ]+)/.exec(equation.svg)[1]);
  const units = Number(/viewBox="[^ ]+ [^ ]+ ([^ ]+)/.exec(equation.svg)[1]);
  assert.ok(Math.abs(equation.margin[1] - top * equation.width / units - baseline) < .01);
});

test('long mathematical paragraphs wrap and paginate as bounded lines without dropping prose or formulas', () => {
  const children = Array.from({ length: 80 }, (_, index) => [{ text: `Observation ${index} ` }, formula(String.raw`\sigma^2`), { text: ' has a contextual explanation. ' }]).flat();
  const input = [{ text: children, style: 'paragraph' }], before = JSON.stringify(input);
  const output = prepare(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(vectors(output).length, 80);
  assert.ok(output[0].stack.length > 10);
  assert.match(text(output), /Observation 79/);
  for (const line of output[0].stack) {
    assert.ok(line.columns.reduce((sum, column) => sum + column.width, 0) <= 512);
    assert.equal(line.unbreakable, true);
  }
});

test('landscape table cells use their calculated column widths and following prose returns to portrait width', () => {
  const table = { layout: 'scribaTable', table: { body: [Array.from({ length: 5 }, (_, index) => ({ text: `Column ${index}` })), Array.from({ length: 5 }, () => ({ text: [formula(String.raw`\frac{a+b+c+d}{p(1-p)}`)], margin: [0, 4, 0, 4] }))] } };
  const pages = preparePdfTables([table, { text: [{ text: 'Final portrait ' }, formula('x^2'), { text: ' sentence.' }], style: 'paragraph' }]);
  const output = prepare(pages.content);
  assert.equal(output[0].pageOrientation, 'landscape');
  assert.equal(output[1].pageOrientation, 'portrait');
  const result = nodes(output[0], node => !!node.table)[0];
  for (let index = 0; index < 5; index++) assert.ok(vectors(result.table.body[1][index])[0].width <= result.table.widths[index]);
  assert.match(text(output[1]), /Final portrait.*sentence/);
});

test('display AMS matrices, cases and aligned equations are self-contained vectors', () => {
  for (const tex of [String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`, String.raw`f(x)=\begin{cases}x^2&x>0\\0&x\le0\end{cases}`, String.raw`\begin{aligned}E&=mc^2\\P(X=k)&=\frac{\lambda^k e^{-\lambda}}{k!}\end{aligned}`]) {
    const output = prepare([formula(tex, true)]);
    assert.equal(vectors(output).length, 1, tex);
    assert.match(vectors(output)[0].svg, /data-mml-node="mtable"/);
    assert.doesNotMatch(vectors(output)[0].svg, /<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/);
  }
});

test('doubly escaped imported intervals render without changing the supplied source', () => {
  const tex = String.raw`\\mu \- \\sigma, \\mu \+ \\sigma`;
  const input = [formula(tex)], before = JSON.stringify(input);
  const output = prepare(input);
  assert.equal(vectors(output).length, 1);
  assert.equal(JSON.stringify(input), before);
  assert.doesNotMatch(vectors(output)[0].svg, /merror/);
});

test('unsupported or active TeX remains visible native text and cannot add external resources', () => {
  for (const tex of [String.raw`\includegraphics{https://example.com/x}`, String.raw`\href{javascript:alert(1)}{X}`, String.raw`\frac{`]) {
    const output = prepare([{ text: [{ text: 'Before ' }, formula(tex), { text: ' after.' }] }]);
    assert.equal(vectors(output).length, 0, tex);
    assert.match(text(output), /Before/);
    assert.ok(text(output).includes(tex), tex);
    assert.match(text(output), /after\./);
  }
});
