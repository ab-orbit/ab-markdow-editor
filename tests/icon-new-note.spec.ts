import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('new notes show visual tools and acronym icons render without leaving writing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await page.getByRole('complementary', { name: 'Notas recentes' }).getByRole('button', { name: 'Nova nota', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Descartar e criar', exact: true });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Galeria de ícones', exact: true })).toBeVisible();
  for (const name of ['arrow-down-az', 'arrow-up-az', 'arrow-up-za', 'arrow-up01', 'chart-no-axes-combined']) {
    await page.getByRole('button', { name: 'Galeria de ícones', exact: true }).click();
    const gallery = page.getByRole('dialog', { name: 'Galeria de ícones' });
    await gallery.getByRole('searchbox').fill(name);
    const choice = gallery.getByRole('button', { name: `Inserir ícone ${name}`, exact: true });
    await expect(choice.locator('svg')).toBeVisible();
    await choice.click();
    await expect(page.locator(`.tiptap [data-document-icon="${name}"] svg`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escrever', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cm-content')).not.toBeVisible();
  }
  await mkdir('docs/evidence/icon-new-note', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/icon-new-note/visual-icons-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/evidence/icon-new-note/visual-icons-mobile.png' });
});
