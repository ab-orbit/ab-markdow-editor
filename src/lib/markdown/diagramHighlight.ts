import { createCssVariablesTheme, createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import mermaid from '@shikijs/langs/mermaid';
import type { DiagramLanguage } from './diagrams';

// ZenUML is a DSL rather than JavaScript. Its small local grammar highlights
// participants, messages and combined fragments without loading another runtime.
const zenuml = {
  name: 'zenuml', scopeName: 'source.zenuml', repository: {},
  patterns: [
    { name: 'comment.line.double-slash', match: '//.*$' },
    { name: 'string.quoted.double', begin: '"', end: '"', patterns: [{ name: 'constant.character.escape', match: '\\\\.' }] },
    { name: 'entity.name.tag', match: '@[A-Za-z][\\w]*' },
    { name: 'entity.name.type', match: '<<[^>]*>>' },
    { name: 'keyword.control', match: '\\b(title|zenuml|participant|group|as|if|else|while|for|foreach|forEach|loop|opt|par|critical|section|frame|try|catch|finally|ref|return|new|in|const|readonly|static|await)\\b' },
    { name: 'constant.language', match: '\\b(true|false|null|nil)\\b' },
    { name: 'constant.numeric', match: '(?:#[a-fA-F0-9]{3,8}\\b|\\b[0-9]+(?:\\.[0-9]+)?(?:ms|px|GB|s)?\\b)' },
    { name: 'entity.name.function', match: '[\\p{L}_][\\p{L}\\p{N}_]*(?=\\s*\\()' },
    { name: 'keyword.operator', match: '-->|->|==|!=|>=|<=|&&|\\|\\||[=+*/!<>:-]' },
  ],
};
// Load only these grammars, without WASM or an external theme.
const highlighter = createHighlighterCore({ themes: [createCssVariablesTheme({ name: 'scriba-code', variablePrefix: '--diagram-code-' })], langs: [mermaid, zenuml], engine: createJavaScriptRegexEngine() });
const cache = new Map<string, string>();

/** Shiki escapes source text before producing theme-token-backed syntax spans. */
export async function highlightDiagram(source: string, language: DiagramLanguage = 'mermaid'): Promise<string> {
  const key = `${language}:${source}`, cached = cache.get(key);
  if (cached) return cached;
  const html = (await highlighter).codeToHtml(source, { lang: language, theme: 'scriba-code' });
  if (source.length < 50_000) {
    cache.set(key, html);
    while (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  return html;
}
