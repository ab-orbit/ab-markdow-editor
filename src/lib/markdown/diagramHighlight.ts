import { createCssVariablesTheme, createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import mermaid from '@shikijs/langs/mermaid';
import json from '@shikijs/langs/json';
import type { DiagramLanguage } from './diagrams';
import { isC4 } from './c4';

// The upstream Mermaid grammar does not enter a C4 scope. Keep its function
// syntax readable without treating every ordinary Mermaid fence as C4.
const c4 = {
  name: 'scriba-c4', scopeName: 'source.scriba-c4', repository: {},
  patterns: [
    { name: 'comment.line', match: '%%.*$' },
    { name: 'string.quoted.double', begin: '"', end: '"', patterns: [{ name: 'constant.character.escape', match: '\\\\.' }] },
    { name: 'keyword.control', match: '\\b(C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|title)\\b' },
    { name: 'entity.name.function', match: '[A-Za-z_][\\w]*(?=\\s*\\()' },
    { name: 'variable.parameter', match: '\\$[A-Za-z_]\\w*' },
    { name: 'constant.numeric', match: '\\b[0-9]+\\b' },
    { name: 'punctuation', match: '[(){},=]' },
  ],
};

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
const highlighter = createHighlighterCore({ themes: [createCssVariablesTheme({ name: 'scriba-code', variablePrefix: '--diagram-code-' })], langs: [mermaid, zenuml, c4, json], engine: createJavaScriptRegexEngine() });
const cache = new Map<string, string>();

/** Shiki escapes source text before producing theme-token-backed syntax spans. */
export async function highlightDiagram(source: string, language: DiagramLanguage = 'mermaid'): Promise<string> {
  const key = `${language}:${source}`, cached = cache.get(key);
  if (cached) return cached;
  const html = (await highlighter).codeToHtml(source, { lang: language === 'excalidraw' ? 'json' : language === 'mermaid' && isC4(source) ? 'scriba-c4' : language, theme: 'scriba-code' });
  if (source.length < 50_000) {
    cache.set(key, html);
    while (cache.size > 16) cache.delete(cache.keys().next().value!);
  }
  return html;
}
