import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

test('contextual manual examples render cards, Lucide icons and SVG on desktop and mobile', async ({ page }) => {
  const manual = await readFile('docs/Scriba-Diagramas.md', 'utf8');
  const section = manual.slice(manual.indexOf('<!-- scriba-extension:html-icons-svg-v1:start -->'));
  expect(section).toContain('<!-- scriba-extension:html-icons-svg-v1:end -->');
  await page.goto('/');
  await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'html-reference.md', mimeType: 'text/markdown', buffer: Buffer.from(section) });
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  await expect(reading.locator('[data-document-icon] svg')).toHaveCount(6);
  const card = reading.getByText('Value Chain', { exact: true }).locator('..').locator('..');
  await expect(reading.getByText('Estrutura econômica', { exact: true })).toBeVisible();
  await expect(reading.locator('svg[aria-label="Relação entre duas entidades"] circle')).toHaveCount(2);
  await mkdir('docs/evidence/document-html-reference', { recursive: true });
  for (const [width, height, device] of [[1440, 900, 'desktop'], [390, 844, 'mobile']] as const) {
    await page.setViewportSize({ width, height });
    const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
    if (await closeNotes.isVisible()) await closeNotes.click();
    await card.scrollIntoViewIfNeeded();
    await expect(reading.getByText('Stakeholders', { exact: true })).toBeVisible();
    await page.screenshot({ path: `docs/evidence/document-html-reference/value-chain-${device}.png` });
  }
});
