import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { MathJaxTexFont } from '@mathjax/mathjax-tex-font/js/svg.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import katex from 'katex';
import { decodeString } from 'micromark-util-decode-string';
import type { Content, ContentColumns, ContentText, Style, StyleDictionary } from 'pdfmake/interfaces';
import type { PdfMathText } from './pdfTypes';
import { mathOptions } from './math.ts';
import { PDF_CONTENT_WIDTHS } from './pdfTables.ts';

export interface PdfFontMetrics {
  /** Metrics come from the same embedded font used by pdfmake's final layout. */
  ascender: number;
  descender: number;
  widthOfString: (value: string, size: number) => number;
  lineHeight: (size: number) => number;
}
export type PdfFontResolver = (family: string, bold: boolean, italics: boolean) => PdfFontMetrics;
type Appearance = Style & { link?: string };
interface Run {
  /** A measured word, whitespace, forced newline or indivisible vector formula. */
  text: string;
  style: Appearance;
  width: number;
  ascent: number;
  descent: number;
  lineHeight: number;
  svg?: string;
  display?: boolean;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
// The complete TeX font is bundled. No autoload, require, HTML or external-font loader is enabled.
const mathDocument = mathjax.document('', {
  InputJax: new TeX({ packages: ['base', 'ams', 'newcommand'], maxBuffer: 50_000, maxMacros: 1000 }),
  OutputJax: new SVG({ fontData: MathJaxTexFont, fontCache: 'none', linebreaks: { inline: false } }),
});

/** Apply Markdown decoding only to otherwise invalid, doubly escaped imported TeX. */
function formulaSource(value: string): string {
  if (!/\\\\[A-Za-z]/.test(value)) return value;
  try { katex.renderToString(value, { ...mathOptions, throwOnError: true }); return value; }
  catch {
    const decoded = decodeString(value);
    try { katex.renderToString(decoded, { ...mathOptions, throwOnError: true }); return decoded; }
    catch { return value; }
  }
}

/** Compose formulas with native PDF text after table widths and page orientations are known. */
export function preparePdfMath(source: readonly Content[], resolveFont: PdfFontResolver, styles: StyleDictionary, defaults: Style): Content[] {
  const cache = new Map<string, Omit<Run, 'style'>>();

  function appearance(node: Partial<ContentText>, inherited: Appearance): Appearance {
    const names = Array.isArray(node.style) ? node.style : [node.style];
    const merged = { ...inherited, ...Object.assign({}, ...names.map(name => typeof name === 'string' ? styles[name] : name)), ...node };
    return {
      font: merged.font, fontSize: merged.fontSize, bold: merged.bold, italics: merged.italics,
      color: merged.color, background: merged.background, decoration: merged.decoration,
      alignment: merged.alignment, lineHeight: merged.lineHeight, link: merged.link,
    };
  }
  function word(text: string, style: Appearance): Run {
    const size = style.fontSize || 11, font = resolveFont(style.font || 'Roboto', !!style.bold, !!style.italics);
    return { text, style, width: font.widthOfString(text, size), ascent: font.ascender * size / 1000,
      descent: -font.descender * size / 1000, lineHeight: font.lineHeight(size) * (style.lineHeight || 1.35) };
  }
  function equation(node: PdfMathText, style: Appearance, availableWidth: number): Run {
    const size = style.fontSize || 11, tex = formulaSource(node.scribaMath.tex);
    const key = JSON.stringify([tex, size, node.scribaMath.display, availableWidth, style.color]);
    const stored = cache.get(key);
    if (stored) return { ...stored, style };
    try {
      const container = mathDocument.convert(tex, { display: node.scribaMath.display, em: size, ex: size / 2, containerWidth: availableWidth });
      const element = adaptor.tags(container, 'svg')[0];
      if (!element) throw new Error('Missing formula SVG');
      const viewBox = adaptor.getAttribute(element, 'viewBox')?.split(/\s+/).map(Number);
      let svg = adaptor.outerHTML(element);
      if (!viewBox || viewBox.length !== 4 || viewBox.some((value: number) => !Number.isFinite(value)) || /data-mml-node="merror"/.test(svg)) throw new Error('Unsupported mathematical expression');
      const [, top, width, height] = viewBox;
      const scale = Math.min(size / 1000, availableWidth / width, 620 / height);
      if (!(scale > 0) || !(width > 0) || !(height > 0)) throw new Error('Invalid formula dimensions');
      const pixels = { width: width * scale, height: height * scale };
      adaptor.setAttribute(element, 'width', String(pixels.width));
      adaptor.setAttribute(element, 'height', String(pixels.height));
      svg = adaptor.outerHTML(element).replaceAll('currentColor', String(style.color || defaults.color));
      const result = { text: tex, width: pixels.width, ascent: Math.max(0, -top * scale),
        descent: Math.max(0, (top + height) * scale), lineHeight: pixels.height + 3, svg, display: node.scribaMath.display };
      cache.set(key, result);
      return { ...result, style };
    } catch {
      // An unsupported expression stays visible without preventing the rest of the document from exporting.
      return word(node.text as string, style);
    }
  }
  function runs(value: Content | undefined, inherited: Appearance, width: number): Run[] {
    if (Array.isArray(value)) return value.flatMap(child => runs(child, inherited, width));
    if (typeof value === 'number' || typeof value === 'string') return String(value).match(/\n|[^\S\n]+|[^\s]+/gu)?.map(text => word(text, inherited)) || [];
    if (!value || typeof value !== 'object' || !('text' in value)) return [];
    const style = appearance(value as ContentText, inherited);
    if ('scribaMath' in value) {
      const result = equation(value as PdfMathText, style, width);
      return result.svg ? [result] : runs(result.text, style, width);
    }
    return runs(value.text, style, width);
  }
  function containsMath(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if ('scribaMath' in value) return true;
    return Object.values(value).some(containsMath);
  }
  function row(sourceRuns: Run[], width: number, alignment: Appearance['alignment'], last: boolean): ContentColumns {
    const line = [...sourceRuns];
    while (line.length && /^\s+$/.test(line[0].text) && !line[0].svg) line.shift();
    while (line.length && /^\s+$/.test(line[line.length - 1].text) && !line[line.length - 1].svg) line.pop();
    const ascent = Math.max(0, ...line.map(run => run.ascent));
    const descent = Math.max(0, ...line.map(run => run.descent));
    const height = Math.max(ascent + descent, ...line.map(run => run.lineHeight));
    const used = line.reduce((sum, run) => sum + run.width, 0), spare = Math.max(0, width - used);
    const spaces = line.filter(run => !run.svg && /^\s+$/.test(run.text)).length;
    const justify = alignment === 'justify' && !last && spaces ? spare / spaces : 0;
    const columns: ContentColumns['columns'] = [];
    if (alignment === 'center' || alignment === 'right') columns.push({ text: '', width: alignment === 'center' ? spare / 2 : spare });
    for (const run of line) {
      const margin: [number, number, number, number] = [0, Math.max(0, ascent - run.ascent), 0, 0];
      if (run.svg) columns.push({ svg: run.svg, width: run.width, margin });
      else columns.push({ ...run.style, text: run.text, width: run.width + (/^\s+$/.test(run.text) ? justify : 0) + .001, margin, noWrap: true, lineHeight: 1 });
    }
    return { columns: columns.length ? columns : [{ text: ' ' }], columnGap: 0, unbreakable: true,
      margin: [0, 0, 0, Math.max(0, height - ascent - descent)] };
  }
  function flow(value: Content, style: Appearance, width: number): Content[] {
    const output: Content[] = [], tokens = runs(value, style, width);
    let line: Run[] = [], used = 0;
    const flush = (last = false) => {
      if (line.length) output.push(row(line, width, style.alignment, last));
      line = []; used = 0;
    };
    function append(run: Run) {
      if (!run.svg && run.text === '\n') { flush(true); return; }
      if (run.display) {
        flush(true); output.push(row([run], width, 'center', true)); return;
      }
      if (line.length && used + run.width > width) flush();
      if (!line.length && !run.svg && /^\s+$/.test(run.text)) return;
      line.push(run); used += run.width;
    }
    for (const run of tokens) {
      if (run.svg || run.width <= width) { append(run); continue; }
      // Long identifiers remain text and can wrap within the actual column width.
      let part = '';
      for (const character of run.text) {
        if (part && word(part + character, run.style).width > width) { append(word(part, run.style)); part = ''; }
        part += character;
      }
      if (part) append(word(part, run.style));
    }
    flush(true);
    return output;
  }
  function visit(node: Content, available: number, inherited: Appearance): Content {
    if (Array.isArray(node)) return node.map(child => visit(child, available, inherited));
    if (!node || typeof node !== 'object') return node;
    const style = appearance(node as ContentText, inherited);
    const orientation = 'pageOrientation' in node ? node.pageOrientation : undefined;
    const pageWidth = orientation === 'portrait' || orientation === 'landscape' ? PDF_CONTENT_WIDTHS[orientation] : available;
    const margin = 'margin' in node ? node.margin || 0 : 0;
    const inset = Array.isArray(margin) ? margin[0] + (margin.length === 2 ? margin[0] : margin[2]) : margin * 2;
    const width = Math.max(1, pageWidth - inset);
    if ('text' in node && containsMath(node)) {
      const { text, ...properties } = node as ContentText;
      const { scribaMath: _annotation, ...rest } = properties as typeof properties & Partial<PdfMathText>;
      return { ...rest, stack: flow('scribaMath' in node ? node : text, style, width) } as Content;
    }
    if ('table' in node && node.table) {
      const widths = node.table.widths;
      return { ...node, table: { ...node.table, body: node.table.body.map(row => row.map((cell, column) =>
        visit(cell as Content, Array.isArray(widths) && typeof widths[column] === 'number' ? widths[column] : width / row.length - 12, style))) } } as Content;
    }
    if ('stack' in node && node.stack) return { ...node, stack: node.stack.map(child => visit(child, width, style)) } as Content;
    if ('ul' in node && node.ul) return { ...node, ul: node.ul.map(child => visit(child, width - 16, style)) } as Content;
    if ('ol' in node && node.ol) return { ...node, ol: node.ol.map(child => visit(child, width - 16, style)) } as Content;
    return node;
  }
  return source.map(node => visit(node, PDF_CONTENT_WIDTHS.portrait, defaults));
}
