/**
 * Compare a repository's fence regex with the Scriba Markdown parser.
 * This experiment exercises parser boundaries and React markup only.
 * It does not execute Mermaid, the external application, or a benchmark.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

const fenceRegex = /\x60\x60\x60mermaid\n([\s\S]*?)\x60\x60\x60/g;
const tick = String.fromCharCode(96);
const fence = tick.repeat(3);
const cases = [
  ['lf', fence + 'mermaid\nflowchart LR\n A-->B\n' + fence],
  ['crlf', fence + 'mermaid\r\nflowchart LR\r\n A-->B\r\n' + fence],
  ['tilde', '~~~mermaid\nflowchart LR\n A-->B\n~~~'],
  ['documentation-example', tick.repeat(4) + 'markdown\n' + fence + 'mermaid\nflowchart LR\n A-->B\n' + fence + '\n' + tick.repeat(4)],
];
const results = cases.map(([id, source]) => {
  let astBlocks = 0;
  renderToStaticMarkup(React.createElement(ReactMarkdown, {
    components: {
      code: ({ className, children }) => {
        if (className === 'language-mermaid') astBlocks++;
        return React.createElement('code', { className }, children);
      },
    },
  }, source));
  return {
    id,
    repoRegexMatches: [...source.matchAll(fenceRegex)].length,
    astMermaidBlocks: astBlocks,
  };
});
const suppliedStructure = renderToStaticMarkup(React.createElement(ReactMarkdown, {
  components: {
    code: ({ className, children }) => className === 'language-mermaid'
      ? React.createElement('div', { className: 'mermaid-chart' }, 'diagram placeholder')
      : React.createElement('code', { className }, children),
  },
}, cases[0][1]));
process.stdout.write(JSON.stringify({
  kind: 'parser-boundary-experiment',
  scope: 'Markdown parsing only; no diagram engine execution or performance measurement',
  results,
  suppliedStructure,
}, null, 2) + '\n');
