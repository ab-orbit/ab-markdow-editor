import katex from 'katex';
import { decodeString } from 'micromark-util-decode-string';
import type { Root, RootContent } from 'mdast';
import type { VFile } from 'vfile';

export interface MathSpan {
  /** UTF-16 boundaries in the unchanged source string. */
  from: number; to: number;
  /** TeX presentation and the exact original token used for serialization. */
  tex: string; raw: string; display: boolean;
}
export const mathOptions = { trust: false, strict: 'ignore' as const, maxExpand: 1000, maxSize: 20, output: 'htmlAndMathml' as const };
/** Imported Markdown sometimes escapes TeX twice and also escapes subscripts. */
function importedTex(raw: string) {
  return raw.replace(/\\+(?=[A-Za-z|])/g, '\\').replace(/\\+([_^])/g, '$1').replace(/\\+([{}])/g, '\\$1').replace(/\\+([\[\]])/g, '$1').replace(/\\{4,}(?=\s)/g, '\\\\').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function groupEnd(source: string, start: number): number {
  const close = source[start] === '{' ? '}' : source[start] === '[' ? ']' : ')'; let depth = 1;
  for (let i = start + 1; i < source.length; i++) { if (source[i] === source[start]) depth++; if (source[i] === close && !--depth) return i + 1; }
  // An unclosed group is not an atom; returning its offset can trap the scanner in a loop.
  return 0;
}
/** Conservative legacy detection: only short math identifiers, balanced groups and TeX commands join a run. */
function legacyEnd(source: string, start: number): number {
  let end = start;
  while (end < source.length) {
    const rest = source.slice(end), space = /^ +/.exec(rest);
    if (space) { const next = legacyAtom(source, end + space[0].length); if (next <= end + space[0].length) break; end = next; continue; }
    const next = legacyAtom(source, end); if (next <= end) break; end = next;
  }
  return end;
}
function legacyAtom(source: string, start: number): number {
  const rest = source.slice(start);
  const environment = /^\\+begin\{([A-Za-z*]+)\}/.exec(rest);
  if (environment) { const ending = new RegExp('\\\\+end\\{' + environment[1].replace('*','\\*') + '\\}').exec(rest.slice(environment[0].length)); if (ending) return start + environment[0].length + ending.index + ending[0].length; }
  const token = /^(?:\\+[A-Za-z]+|\\+[|_^{}]|[A-Za-z]{1,2}(?![A-Za-z])|&(?:gt|lt|amp);|\d+(?:\.\d+)?|[=+*/^_<>!|−-])/.exec(rest);
  if (token) { if (/^(?:de|da|do|em|um|os|ou|na|no|as|ao)$/i.test(token[0]) || token[0] === 'e' && !/^[_^=+*/-]/.test(source.slice(start + 1))) return 0; return start + token[0].length; }
  if (source[start] === '{') return groupEnd(source, start);
  if (source[start] === '(' || source[start] === '[') { const end = groupEnd(source, start); if (end > start && !/[A-Za-z]{3,}/.test(source.slice(start + 1, end - 1).replace(/\\+[A-Za-z]+/g, '').replace(/\{[^{}]*\}/g, ''))) return end; }
  if (source[start] === ',' && !/^,\s+[A-Za-z]{3}/.test(rest)) return start + 1;
  return 0;
}
/** Find explicit TeX first; legacy inference never runs inside explicit expressions. */
export function mathSpans(source: string, legacy = true): MathSpan[] {
  const spans: MathSpan[] = [];
  for (let i = 0; i < source.length;) {
    let to = 0, tex = '', display = false;
    const preceding = source.slice(Math.max(0, i - 64), i);
    const slashDelimiter = source[i - 1] !== '\\' && !/\\[A-Za-z]+$|\\+in\s*$/.test(preceding);
    const delimiter = source.startsWith('$$', i) ? '$$' : source[i] === '$' && source[i - 1] !== '\\' ? '$' : slashDelimiter && source.startsWith('\\(', i) ? '\\(' : slashDelimiter && source.startsWith('\\[', i) ? '\\[' : '';
    if (delimiter) {
      const close = delimiter === '\\(' ? '\\)' : delimiter === '\\[' ? '\\]' : delimiter;
      let end = source.indexOf(close, i + delimiter.length);
      while (end >= 0 && source[end - 1] === '\\') end = source.indexOf(close, end + close.length);
      const inner = end < 0 ? '' : source.slice(i + delimiter.length, end);
      const bracketMath = delimiter !== '\\[' || !source.slice(0, i).trim() && !source.slice(end + close.length).trim() || /\\[A-Za-z]+|[=+^]|(?<!\\)_/.test(inner);
      if (end >= 0 && bracketMath && (delimiter !== '$' || !source.slice(i + 1, end).includes('\n'))) { to = end + close.length; tex = source.slice(i + delimiter.length, end); display = delimiter === '$$' || delimiter === '\\['; }
    }
    if (!to && legacy && !/[\p{L}\p{N}\\]/u.test(source[i - 1] || '') && /[A-Za-z\\(]/.test(source[i])) {
      const end = legacyEnd(source, i), raw = source.slice(i, end).trimEnd();
      if (/\\+[A-Za-z]+|[A-Za-z]\\*_\{?[\d\\]/.test(raw)) {
        const candidate = importedTex(raw).replace(/[, ]+$/, '');
        try { katex.renderToString(candidate, { ...mathOptions, throwOnError: true }); to = i + raw.replace(/[, ]+$/, '').length; tex = candidate; } catch { /* Ordinary text and incomplete expressions remain editable source. */ }
      }
    }
    if (to > i && tex.trim()) { spans.push({ from: i, to, tex: tex.trim(), raw: source.slice(i, to), display }); i = to; } else i++;
  }
  return spans;
}
/** A math fence is already a math container; unwrap one complete outer delimiter pair for rendering only. */
export function mathBody(source: string): string {
  const trimmed = source.trim(), span = mathSpans(trimmed, false)[0];
  return span?.from === 0 && span.to === trimmed.length ? span.tex : trimmed;
}
/** Replace only prose text nodes: code, HTML, links and existing math retain their own semantics. */
export function remarkCompatibleMath() {
  return (tree: Root, file: VFile) => {
    function visit(parent: Root | RootContent) {
      if (parent.type === 'code' && /^(?:math|latex|tex)$/i.test(parent.lang || '')) { parent.lang = 'math'; parent.value = mathBody(parent.value); }
      if (!('children' in parent) || ['link', 'linkReference', 'image', 'code', 'inlineCode', 'html', 'math', 'inlineMath'].includes(parent.type)) return;
      const children: typeof parent.children = [];
      for (const child of parent.children) {
        if (child.type !== 'text') { visit(child as RootContent); children.push(child as never); continue; }
        // Explicit dollar math is parsed by remark-math. Backslash delimiters require the original bytes.
        const offset = child.position?.start.offset;
        const raw = offset === undefined ? child.value : String(file.value).slice(offset, child.position?.end.offset);
        const explicit = mathSpans(raw, false).filter(span => span.raw.startsWith('\\'));
        if (explicit.length) {
          let cursor = 0;
          for (const span of explicit) { appendText(raw.slice(cursor, span.from)); children.push(mathNode(span) as never); cursor = span.to; } appendText(raw.slice(cursor));
        } else {
          const spans = mathSpans(child.value);
          let cursor = 0;
          for (const span of spans) { if (span.from > cursor) children.push({type:'text',value:child.value.slice(cursor,span.from)} as never); children.push(mathNode(span) as never); cursor = span.to; }
          if (cursor < child.value.length) children.push({...child,value:child.value.slice(cursor)} as never);
        }
        function appendText(source: string) {
          const text = decodeString(source); let cursor = 0;
          for (const span of mathSpans(text)) { if (span.from > cursor) children.push({type:'text',value:text.slice(cursor,span.from)} as never); children.push(mathNode(span) as never); cursor = span.to; }
          if (cursor < text.length) children.push({type:'text',value:text.slice(cursor)} as never);
        }
      }
      parent.children = children as never;
    }
    visit(tree);
  };
}
function mathNode(span: MathSpan) {
  return { type:'inlineMath' as const, value:span.tex, data:{hName:'code',hProperties:{className:['language-math',span.display?'math-display':'math-inline']},hChildren:[{type:'text' as const,value:span.tex}]} };
}
/** Safe, local rendering; unsupported TeX remains visible instead of breaking the note. */
export function renderMath(tex: string, display = false): string {
  try { return katex.renderToString(mathBody(tex), { ...mathOptions, displayMode: display, throwOnError: true }); }
  catch { return `<code class="math-error">${tex.replace(/[&<>"']/g, character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!))}</code>`; }
}
