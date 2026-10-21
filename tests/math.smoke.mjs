import {chromium,webkit,expect} from '@playwright/test';
import {createServer} from 'vite';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
process.env.VITE_STORAGE_MODE='browser';
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const base=server.resolvedUrls.local[0], safari=process.env.MARKDOWN_BROWSER==='webkit';
const browser=await(safari?webkit:chromium).launch({headless:true});
const fixture=String.raw`# Math regression

Inline $\frac{\Delta f}{\epsilon}$ and \(x_i^2 + y_i^2\) remain in the paragraph.

$$
\begin{aligned} E &= mc^2 \\ A &= \begin{pmatrix}1&2\\3&4\end{pmatrix} \end{aligned}
$$

\[\int_0^1 x^2\,dx=\frac13\]

| Mechanism | Parameter |
|---|---|
| Laplace | Escala \\\\lambda = \\\\frac{\\\\Delta f}{\\\\epsilon} |
| Gaussian | Variância \\\\sigma^2 &gt; \\\\frac{2\\\\ln(1.25/\\\\delta)(\\\\Delta f)^2}{\\\\epsilon^2} |

Restriction: Np(1-p) \\\\ge \\\\max\\\\left(\\\\frac{2}{3}\\\\log(10d/\\\\delta), \\\\frac{2\\\\Delta\_\\\\infty}{s}\\\\right) where d is a dimension.

\`literal \Delta f\`

\`\`\`math
\sum_{i=1}^{n}i=\frac{n(n+1)}2
\`\`\`

\`\`\`latex
\[ I = \frac{\text{propostas avaliadas}}{\text{propostas recebidas}} \times 100 \]
\`\`\`

\`\`\`python
print("\\Delta is literal code")
\`\`\`
`.replaceAll('\\`','`');
try{
 await mkdir('docs/evidence/math',{recursive:true});
 let context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block',acceptDownloads:true});
 let page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'Math.md',mimeType:'text/markdown',buffer:Buffer.from(fixture)});
 await expect(page.getByRole('heading',{name:'Math regression',exact:true})).toBeVisible();await page.getByRole('button',{name:'Ler',exact:true}).click();
 await expect(page.locator('article .katex')).toHaveCount(9);
 await expect(page.locator('article .katex-error, article .math-error')).toHaveCount(0);
 await expect(page.locator('article td .katex')).toHaveCount(2);
 await expect(page.locator('article .katex-mathml math')).toHaveCount(9);
 await expect(page.locator('article .katex-display')).toHaveCount(4);
 await expect(page.locator('article code').filter({hasText:'literal'}).first()).toBeVisible();
 await page.screenshot({path:`docs/evidence/math/standard-${safari?'webkit':'chrome'}.png`});
 await page.locator('article .katex-display').filter({hasText:'propostas avaliadas'}).screenshot({path:`docs/evidence/math/wrapped-latex-${safari?'webkit':'chrome'}.png`});
 // Rendering, mode changes and formula focus cannot rewrite imported source.
 await page.getByRole('button',{name:'Escrever',exact:true}).click();
 await expect(page.locator('.scriba-math')).toHaveCount(9);
 await page.getByRole('button',{name:'Editar fórmula',exact:true}).first().click();
 await expect(page.getByRole('textbox',{name:'Fórmula LaTeX',exact:true})).toBeFocused();
 await page.getByRole('textbox',{name:'Fórmula LaTeX',exact:true}).press('Escape');
 await page.getByLabel('Exportar nota',{exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('group',{name:'Formatos de exportação',exact:true}).getByRole('button',{name:/^Markdown/}).click();
 const downloaded=await pending;assert.equal(await readFile(await downloaded.path(),'utf8'),fixture,'Unchanged formulas retain the exact original Markdown');
 // A real edit updates one formula while preserving its neighboring source.
 await page.getByRole('button',{name:'Editar fórmula',exact:true}).first().click();
 await page.getByRole('textbox',{name:'Fórmula LaTeX',exact:true}).fill(String.raw`\frac{a}{b}`);
 await page.getByRole('textbox',{name:'Fórmula LaTeX',exact:true}).press('Enter');
 await expect(page.locator('.scriba-math').first()).toContainText('a');
 await page.getByLabel('Exportar nota',{exact:true}).click();
 const changedDownload=page.waitForEvent('download');await page.getByRole('group',{name:'Formatos de exportação',exact:true}).getByRole('button',{name:/^Markdown/}).click();
 assert.equal(await readFile(await(await changedDownload).path(),'utf8'),fixture.replace(String.raw`$\frac{\Delta f}{\epsilon}$`,String.raw`$\frac{a}{b}$`),'Editing one formula leaves the other formulas and blocks unchanged');

 const reference=process.env.SCRIBA_MATH_REFERENCE || '/Users/jwcunha/Documents/my-markdown-notes/private-notes/GUIA DE DISCUSSÃO EXECUTIVA E TÉCNICA- PRIVACIDADE DIFERENCIAL EM DEEP LEARNING E FEDERATED LEARNING.md';
 await context.close();context=await browser.newContext({locale:'pt-BR',viewport:{width:1440,height:900},serviceWorkers:'block'});page=await context.newPage();await page.goto(base);await expect(page.getByLabel('Arquivo Markdown',{exact:true})).toBeEnabled();
 const original=await readFile(reference);const digest=()=>createHash('sha256').update(original).digest('hex');const before=digest();
 await page.getByLabel('Arquivo Markdown',{exact:true}).setInputFiles({name:'Math-reference.md',mimeType:'text/markdown',buffer:original});
 await page.getByRole('button',{name:'Ler',exact:true}).click();
 const constraint=page.locator('article p').filter({hasText:'Nota Técnica - Restrição Paramétrica'});
 await expect(constraint.locator('.katex')).toHaveCount(5);
 await expect(page.locator('article .katex-error, article .math-error')).toHaveCount(0);
 const laplace=page.locator('article tr').filter({hasText:'Mecanismo de Laplace'}).first();await expect(laplace.locator('.katex')).toHaveCount(2);
 await constraint.scrollIntoViewIfNeeded();await constraint.screenshot({path:`docs/evidence/math/reference-constraint-${safari?'webkit':'chrome'}.png`});
 await page.setViewportSize({width:390,height:844});const closeNotes=page.getByRole('button',{name:'Fechar lista de notas',exact:true});if(await closeNotes.isVisible())await closeNotes.click();await constraint.scrollIntoViewIfNeeded();await constraint.screenshot({path:`docs/evidence/math/reference-mobile-${safari?'webkit':'chrome'}.png`});
 await page.setViewportSize({width:1440,height:900});await laplace.locator('td').nth(2).dblclick();
 await expect(page.locator('[data-inline-table-editor] input')).toBeFocused();await page.locator('[data-inline-table-editor] input').press('Escape');
 await page.getByRole('button',{name:'Escrever',exact:true}).click();await expect(page.locator('.scriba-math').first()).toBeVisible();
 assert.ok(await page.locator('.scriba-math').count()>100,'The full imported reference remains mathematical in Write mode');
 await page.getByLabel('Exportar nota',{exact:true}).click();const originalDownload=page.waitForEvent('download');await page.getByRole('group',{name:'Formatos de exportação',exact:true}).getByRole('button',{name:/^Markdown/}).click();
 assert.deepEqual(await readFile(await(await originalDownload).path()),original,'The reference survives reading, cell focus and Write mode byte-for-byte');
 assert.equal(createHash('sha256').update(await readFile(reference)).digest('hex'),before,'The reference file is never rewritten');
 assert.deepEqual(errors,[]);console.log('PASS: standard TeX, imported TeX, tables, AMS matrices, editing, source preservation and real reference on desktop/mobile.');
 await context.close();
}finally{await browser.close();await server.close();}
