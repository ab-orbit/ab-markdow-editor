import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import {mathSpans,remarkCompatibleMath,renderMath} from '../src/lib/markdown/math.ts';
const parse=source=>{const processor=unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkCompatibleMath);return processor.runSync(processor.parse(source),{value:source});};
const all=(node,type)=>[...(node.type===type?[node]:[]),...(node.children||[]).flatMap(child=>all(child,type))];
test('explicit math supports inline, display, AMS matrices and backslash delimiters',()=>{
 const source=String.raw`Inline $\frac{a}{b}$ and \(x_i^2\) done.

$$
\begin{aligned} E &= mc^2 \\ A &= \begin{pmatrix}1&2\\3&4\end{pmatrix} \end{aligned}
$$

\[\sum_{i=1}^n i = \frac{n(n+1)}2\]`;
 const tree=parse(source);assert.equal(all(tree,'inlineMath').length,3);assert.equal(all(tree,'math').length,1);
 for(const node of [...all(tree,'inlineMath'),...all(tree,'math')])assert.match(renderMath(node.value),/class="katex/);
 assert.equal(all(tree,'paragraph')[0].children[2].value,' and ');
});
test('imported doubled TeX preserves prose boundaries and typesets complete fractions and constraints',()=>{
 const source=String.raw`A sensibilidade L\_1 de uma função: \\\\Delta f = \\\\max\_{D, D'} \\\\|f(D) - f(D')\\\\|\_1.

| Parameter | Value |
|---|---|
| Escala | \\\\lambda = \\\\frac{\\\\Delta f}{\\\\epsilon} |

A restrição: Np(1-p) \\\\ge \\\\max\\\\left(\\\\frac{2}{3}\\\\log(10d/\\\\delta), \\\\frac{2\\\\Delta\_\\\\infty}{s}\\\\right) onde d é dimensão.`;
 const tree=parse(source), expressions=all(tree,'inlineMath');
 assert.ok(expressions.some(n=>n.value.includes('\\frac{\\Delta f}{\\epsilon}')));
 assert.ok(expressions.some(n=>n.value.startsWith('Np(1-p) \\ge \\max\\left')));
 assert.ok(all(tree,'text').some(n=>n.value.includes('onde d é dimensão')));
 assert.ok(!expressions.some(n=>/ de | onde |os$/.test(n.value)));
});
test('literal code, links, paths and escaped currency are never inferred as mathematical prose',()=>{
 const tree=parse(String.raw`Code \`\Delta f\` and [\Delta](https://example.com) and C:\Users\notes cost \$20.

\`\`\`python
x = "\\Delta"
\`\`\``.replaceAll('\\`','`'));
 assert.equal(all(tree,'inlineMath').length,0);assert.equal(mathSpans(String.raw`C:\Users\notes`).length,0);
});
test('unsafe TeX cannot create active HTML or fetch external resources, invalid input remains visible',()=>{
 for(const source of [String.raw`\href{javascript:alert(1)}{X}`,String.raw`\includegraphics{https://example.com/x}`,String.raw`\htmlClass{overlay}{X}`]){const html=renderMath(source);assert.doesNotMatch(html,/<a |<img |class="overlay"/);}
 assert.match(renderMath(String.raw`\frac{`),/math-error/);
 assert.match(renderMath('<img src=x onerror=alert(1)>\\bad'),/&lt;img/);
});

test('imported cases retain row separators and escaped reference labels remain plain text',()=>{
 const source=String.raw`Probability P(S_i = 1) = \\\\begin{cases} q, & \\\\text{if } B_i = 1 \\\\\\\\ p, & \\\\text{if } B_i = 0 \\\\end{cases}`;
 const expression=mathSpans(source).find(span=>span.tex.includes('begin{cases}'));
 assert.ok(expression);assert.match(renderMath(expression.tex),/<mtable/);
 const tree=parse(String.raw`Reference (\[SOURCE\_IMAGE\_2\]) stays a reference.`);
 assert.equal(all(tree,'inlineMath').length,0);
});

test('HTML sanitation preserves math display markers before trusted KaTeX output is generated',async()=>{
 const [{default:remarkRehype},{default:sanitize},{default:katex},{documentHtmlSchema},{mathOptions}]=await Promise.all([import('remark-rehype'),import('rehype-sanitize'),import('rehype-katex'),import('../src/components/Markdown/rehypeDocumentHtml.ts'),import('../src/lib/markdown/math.ts')]);
 const processor=unified().use(remarkParse).use(remarkMath).use(remarkCompatibleMath).use(remarkRehype).use(sanitize,documentHtmlSchema).use(katex,mathOptions);
 const source=String.raw`Inline $x^2$.

\[\int_0^1 x\,dx\]

\`\`\`math
\sum_i x_i
\`\`\``.replaceAll('\\`','`');
 const tree=processor.runSync(processor.parse(source),{value:source});
 const find=node=>[...(node.type==='element'&&node.properties?.className?.includes('katex-display')?[node]:[]),...(node.children||[]).flatMap(find)];
 assert.equal(find(tree).length,2,'Display notation and math fences stay display math after sanitization');
});

test('latex fences accept an outer display delimiter without passing nested delimiters to KaTeX',async()=>{
 const [{default:remarkRehype},{default:sanitize},{default:katex},{documentHtmlSchema},{mathOptions}]=await Promise.all([import('remark-rehype'),import('rehype-sanitize'),import('rehype-katex'),import('../src/components/Markdown/rehypeDocumentHtml.ts'),import('../src/lib/markdown/math.ts')]);
 for(const language of ['latex','tex','math'])for(const [open,close]of [['\\[','\\]'],['\\(','\\)'],['$$','$$'],['$','$'],['','']]){
  const formula=String.raw`I = \frac{\text{propostas avaliadas}}{\text{propostas recebidas}} \times 100`;
  const source='```'+language+'\n'+open+' '+formula+' '+close+'\n```';
  const processor=unified().use(remarkParse).use(remarkMath).use(remarkCompatibleMath).use(remarkRehype).use(sanitize,documentHtmlSchema).use(katex,mathOptions);
  const tree=processor.runSync(processor.parse(source),{value:source}),json=JSON.stringify(tree);
  assert.ok(json.includes('katex-display'),language+' '+open);assert.ok(!json.includes('katex-error'),language+' '+open);assert.ok(json.includes('propostas avaliadas'));
 }
});
