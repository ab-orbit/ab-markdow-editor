import { createCssVariablesTheme, createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import mermaid from '@shikijs/langs/mermaid';

// Load only the Mermaid grammar, on demand, without downloading a WASM engine or external theme.
const highlighter = createHighlighterCore({ themes: [createCssVariablesTheme({ name: 'scriba-code', variablePrefix: '--diagram-code-' })], langs: [mermaid], engine: createJavaScriptRegexEngine() });
const cache = new Map<string, string>();

/** Shiki escapes source text before producing theme-token-backed syntax spans. */
export async function highlightDiagram(source: string): Promise<string> {
  const cached = cache.get(source);
  if (cached) return cached;
  const html = (await highlighter).codeToHtml(source, { lang: 'mermaid', theme: 'scriba-code' });
  if (source.length < 50_000) {
    cache.set(source, html);
    while (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  return html;
}
