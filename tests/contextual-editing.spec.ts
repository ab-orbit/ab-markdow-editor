import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function open(page: import('@playwright/test').Page, source: string) {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'context.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
}

test('colors language fences and edits only the clicked paragraph, heading or table cell', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, '# Main\n\n## Local title\n\nFirst **strong** paragraph, preserved text.\n\nSecond untouched paragraph.\n\n| Name | State |\n| --- | --- |\n| Alpha | Draft |\n\n```html\n<div class="card">Hello</div>\n```\n\n```python\ndef answer():\n    return "hello"\n```\n\n```javascript\nconst answer = "hello";\n```\n\n```console\n$ echo "hello"\nhello\n```');
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  for (const language of ['html', 'python', 'javascript', 'console']) {
    const code = reading.locator(`[data-code-language="${language}"]`);
    await expect(code.locator('.shiki')).toBeVisible({ timeout: 15000 });
    expect(await code.locator('span[style]').count()).toBeGreaterThan(1);
  }
  await reading.locator('[data-code-language="html"]').dblclick();
  const codeEditor = reading.locator('[data-inline-block-editor] .cm-content');
  await expect(codeEditor).toContainText('class="card"');
  await expect.poll(async () => codeEditor.locator('span').evaluateAll(elements => new Set(elements.map(element => getComputedStyle(element).color)).size)).toBeGreaterThan(2);
  await page.keyboard.press('Escape');
  await reading.getByText('First', { exact: false }).filter({ hasText: 'paragraph, preserved text.' }).last().dblclick();
  const local = reading.locator('[data-inline-block-editor] .cm-content');
  await expect(local).toHaveCount(1);
  await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode', 'read');
  await expect(reading.getByText('Second untouched paragraph.', { exact: true })).toBeVisible();
  await expect(local).not.toContainText('Second untouched');
  await local.click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText(' Added locally.\n\nNew local paragraph.');
  await expect(reading.locator('p').filter({ hasText: /^New local paragraph\.$/ })).toHaveCount(0);
  await reading.getByRole('heading', { name: 'Local title' }).click();
  await expect(local).toHaveCount(0);
  await expect(reading.locator('p').filter({ hasText: /^New local paragraph\.$/ })).toHaveCount(1);
  await expect(reading.getByText('Added locally.', { exact: false }).last()).toBeVisible();
  await reading.getByRole('heading', { name: 'Local title' }).dblclick();
  await expect(reading.getByLabel('Título nível 2')).toBeVisible();
  await expect(local).toContainText('## Local title');
  await page.keyboard.press('Escape'); await expect(local).toHaveCount(0);
  await reading.getByRole('cell', { name: 'Alpha', exact: true }).dblclick();
  const cell = reading.getByRole('textbox', { name: 'Linha 2, coluna 1' });
  await expect(cell).toBeFocused(); await cell.fill('Beta');
  await reading.getByRole('heading', { name: 'Local title' }).click();
  await expect(reading.getByRole('cell', { name: 'Beta', exact: true })).toBeVisible();
  await expect(reading.locator('[data-inline-table-editor]')).toHaveCount(0);
  await expect(reading.locator('[data-inline-block-editor]')).toHaveCount(0);
  await mkdir('docs/evidence/contextual-editing', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await reading.getByRole('heading', { name: 'Local title' }).dblclick();
  await page.screenshot({ path: 'docs/evidence/contextual-editing/local-heading-desktop.png' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true }); if (await close.isVisible()) await close.click();
  await reading.getByRole('cell', { name: 'Beta', exact: true }).dblclick();
  await page.screenshot({ path: 'docs/evidence/contextual-editing/table-cell-mobile.png' });
  expect(errors).toEqual([]);
});

test('split view follows source and preview scroll positions in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, Array.from({ length: 60 }, (_, i) => `## Section ${i}\n\nParagraph ${i}. ${'Long text for wrapping and scroll mapping. '.repeat(8)}\n\n\`\`\`python\ndef section_${i}():\n    return ${i}\n\`\`\`\n`).join('\n'));
  await page.getByRole('button', { name: 'Visão', exact: true }).click();
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  const source = page.locator('[data-document-scroll] > div').first();
  await source.evaluate(element => { element.scrollTop = element.scrollHeight * .55; });
  await expect.poll(() => reading.evaluate(element => element.scrollTop)).toBeGreaterThan(500);
  await expect.poll(async () => {
    const left = await source.locator('.cm-line').evaluateAll(elements => elements.find(element => /^## Section/.test(element.textContent || '') && element.getBoundingClientRect().top >= element.closest('[data-document-scroll]')!.getBoundingClientRect().top)?.textContent?.replace(/^## /, ''));
    const right = await reading.locator('h2').evaluateAll(elements => elements.find(element => element.getBoundingClientRect().top >= element.closest('article')!.getBoundingClientRect().top)?.textContent);
    return left === right && !!left;
  }).toBe(true);
  const leftPosition = await source.evaluate(element => element.scrollTop);
  await reading.click({ position: { x: 10, y: 20 } });
  await reading.evaluate(element => { element.scrollTop = element.scrollHeight * .2; });
  await expect.poll(() => source.evaluate(element => element.scrollTop)).toBeLessThan(leftPosition * .8);
  const tops = await reading.evaluate(element => {
    const top = element.getBoundingClientRect().top;
    return Array.from(element.querySelectorAll<HTMLElement>('[data-source-from]')).filter(child => child.getBoundingClientRect().bottom >= top).slice(0, 1).map(child => child.textContent);
  });
  expect(tops.length).toBe(1);
  const visibleHeading = await reading.locator('h2').evaluateAll(elements => elements.find(element => element.getBoundingClientRect().top >= element.closest('article')!.getBoundingClientRect().top)?.textContent);
  if (visibleHeading) {
    const matching = source.locator('.cm-line').filter({ hasText: visibleHeading }).first();
    await expect(matching).toBeInViewport();
    await expect.poll(async () => {
      const leftBounds = await matching.boundingBox(), rightBounds = await reading.getByRole('heading', { name: visibleHeading, exact: true }).boundingBox();
      return Math.abs(leftBounds!.y - rightBounds!.y);
    }).toBeLessThan(32);
  }
  await mkdir('docs/evidence/contextual-editing', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/contextual-editing/synchronized-split-desktop.png' });
});

test('opening a local block preserves source bytes and one edit leaves unrelated CRLF/BOM content intact', async ({ page }) => {
  const source = '\uFEFF# Source identity\r\n\r\n<!-- keep this comment exactly -->\r\n\r\nEditable paragraph.\r\n\r\nUntouched **paragraph** and [link][ref].\r\n\r\n[ref]: https://example.invalid "Original title"\r\n';
  await open(page, source);
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  await reading.getByText('Editable paragraph.', { exact: true }).dblclick();
  const local = reading.locator('[data-inline-block-editor] .cm-content');
  await expect(local).toHaveCount(1);
  await page.keyboard.press('Escape');
  async function exported() {
    const pending = page.waitForEvent('download');
    await page.getByLabel('Exportar nota', {exact:true}).click(); await page.getByRole('button', {name:/^Markdown \(.md\)/}).click();
    const { readFile } = await import('node:fs/promises');
    return readFile((await (await pending).path())!, 'utf8');
  }
  expect(await exported()).toBe(source);
  await reading.getByText('Editable paragraph.', { exact: true }).dblclick();
  await local.click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText(' Appended.');
  await reading.getByRole('heading', { name: 'Source identity' }).click();
  expect(await exported()).toBe(source.replace('Editable paragraph.', 'Editable paragraph. Appended.'));
});

test('split expands folded content and clicks align corresponding lines in either pane', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '# Root\n\n' + Array.from({ length: 40 }, (_, i) => `## Click section ${i}\n\nParagraph ${i}. ${'Content for mapping. '.repeat(15)}\n`).join('\n'));
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  await reading.getByRole('button', { name: 'Recolher seção Root', exact: true }).click();
  await expect(reading.getByText('Paragraph 0.', { exact: false })).not.toBeVisible();
  await page.getByRole('button', { name: 'Visão', exact: true }).click();
  await expect(reading.getByText('Paragraph 0.', { exact: false })).toBeVisible();
  const source = page.locator('[data-document-scroll] > div').first();
  // Deliberately displace the follower while source owns scrolling, then click without scrolling the driver.
  await source.evaluate(element => { element.scrollTop = 1500; });
  await page.waitForTimeout(250);
  const line = source.locator('.cm-line').filter({ hasText: /^## Click section/ });
  const target = await line.evaluateAll(elements => elements.find(element => { const b=element.getBoundingClientRect(), p=element.closest('[data-document-scroll]')!.getBoundingClientRect(); return b.top>p.top+80 && b.bottom<p.bottom-80; })?.textContent?.replace(/^## /,''));
  expect(target).toBeTruthy();
  await reading.evaluate(element => { element.scrollTop = 0; });
  await source.locator('.cm-line').filter({ hasText: `## ${target}` }).click();
  const heading = reading.getByRole('heading', { name: target!, exact: true });
  await expect(heading).toBeInViewport();
  await expect.poll(async () => Math.abs((await heading.boundingBox())!.y-(await source.locator('.cm-line').filter({ hasText: `## ${target}` }).boundingBox())!.y)).toBeLessThan(45);
  // Reading now owns scrolling; displace only the follower before clicking visible text.
  await heading.click();
  await source.evaluate(element => { element.scrollTop = 0; });
  await page.waitForTimeout(200);
  await heading.click();
  const matching=source.locator('.cm-line').filter({ hasText: `## ${target}` });
  await expect(matching).toBeInViewport();
  await expect.poll(async () => Math.abs((await heading.boundingBox())!.y-(await matching.boundingBox())!.y)).toBeLessThan(45);
  await mkdir('docs/evidence/contextual-editing', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/contextual-editing/click-aligned-split-desktop.png' });
});

test('double-clicking a code block preserves the reading viewport while enabling local editing', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  await open(page, '# Position\n\n' + 'Introductory paragraph.\n\n'.repeat(16) + '## Local code\n\n```text\nindustry has taxonomy\nindustry has context\ndomain has evidences\n```\n\n' + 'Following paragraph.\n\n'.repeat(30));
  const reading=page.getByRole('article',{name:'Prévia Markdown'});
  const code=reading.locator('[data-code-language="text"]');
  await code.scrollIntoViewIfNeeded();
  await reading.evaluate(element=>{element.closest('[data-document-scroll]')!.scrollTop-=120;});
  const before=await code.boundingBox();
  const scroll=await page.locator('[data-document-scroll]').evaluate(element=>element.scrollTop);
  await code.dblclick({position:{x:140,y:35}});
  const local=reading.locator('[data-inline-block-editor]');
  await expect(local.locator('.cm-content')).toBeFocused();
  await expect.poll(async()=>Math.abs((await local.boundingBox())!.y-before!.y)).toBeLessThan(20);
  await expect.poll(async()=>Math.abs(await page.locator('[data-document-scroll]').evaluate(element=>element.scrollTop)-scroll)).toBeLessThan(3);
  await page.keyboard.insertText('Edited');
  await expect(local).toContainText('Edited');
  await page.screenshot({path:'docs/evidence/contextual-editing/code-edit-preserves-position-desktop.png'});
});
