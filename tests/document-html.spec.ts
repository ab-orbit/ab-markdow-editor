import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('renders HTML cards, local icons and static SVG while stripping active content', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'icons.md', mimeType: 'text/markdown', buffer: Buffer.from(`# Value Chain\n\nReference[^note].\n\n[^note]: Footnote text.\n\n<div style="display:flex;gap:8px;position:fixed;background:url(https://example.invalid/pixel)"><div style="padding:12px;border:1px solid currentColor"><i data-lucide="users" aria-label="Stakeholders"></i><strong>Stakeholders</strong></div><svg viewBox="0 0 24 24" width="24" height="24" aria-label="Circle"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor"/></svg><script>window.htmlExecuted=true</script><iframe src="https://example.invalid"></iframe><svg onload="window.htmlExecuted=true"><foreignObject><p>Forbidden</p></foreignObject><image href="https://example.invalid/pixel"/></svg></div>`) });
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  await expect(reading.locator('[data-document-icon="users"] svg')).toBeVisible();
  await expect(reading.locator('svg[aria-label="Circle"] circle')).toBeVisible();
  await expect(reading.getByText('Stakeholders', { exact: true })).toBeVisible();
  await expect(reading.locator('script, iframe, foreignObject, image, [onload]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).htmlExecuted)).toBeUndefined();
  await expect(reading.locator('h1')).toHaveAttribute('id', 'value-chain');
  const reference = reading.locator('a[data-footnote-ref]');
  const href = await reference.getAttribute('href');
  await expect(reading.locator(`[id="${href?.slice(1)}"]`)).toHaveCount(1);
  const style = await reading.locator('div[style*="display"]').first().getAttribute('style');
  expect(style).toContain('display: flex'); expect(style).not.toContain('position'); expect(style).not.toContain('url(');
  await mkdir('docs/evidence/document-html', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'docs/evidence/document-html/html-icons-svg-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
  if (await closeNotes.isVisible()) await closeNotes.click();
  await expect(reading.locator('[data-document-icon="users"] svg')).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/document-html/html-icons-svg-mobile.png' });
});
