import { createHighlighterCore, createCssVariablesTheme } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { bundledLanguages } from 'shiki/langs';
const highlighter = createHighlighterCore({ themes: [createCssVariablesTheme({ name: 'scriba-code', variablePrefix: '--diagram-code-' })], langs: [], engine: createJavaScriptRegexEngine() });
const pending = new Map<string, Promise<void>>();
/** Resolve common console aliases; unsupported languages remain escaped plain text. */
export async function highlightCode(source: string, language: string) {
  const lang = ({ console: 'shellsession', terminal: 'shellsession', shell: 'bash', sh: 'bash', js: 'javascript', ts: 'typescript', py: 'python' } as Record<string, string>)[language.toLowerCase()] || language.toLowerCase();
  if (!Object.hasOwn(bundledLanguages, lang)) return null;
  const engine = await highlighter;
  if (!pending.has(lang)) pending.set(lang, (async () => { await engine.loadLanguage(await bundledLanguages[lang as keyof typeof bundledLanguages]()); })());
  await pending.get(lang);
  return engine.codeToHtml(source, { lang, theme: 'scriba-code' });
}
