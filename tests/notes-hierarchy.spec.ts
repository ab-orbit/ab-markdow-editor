import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const source = '# Root\n\nRoot content.\n\n## Branch\n\nBranch content.\n\n### Topic\n\nTopic content.\n\n#### Detail\n\nDetail content.\n\n##### Evidence\n\nEvidence content.\n\n###### Source\n\nSource content.\n\n## Other branch\n\nOther content.\n';

async function open(page: import('@playwright/test').Page) {
  await page.goto('/'); await page.getByRole('heading', { name: 'Configurações', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
  await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'hierarchy.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
}

test('notes header creates a whiteboard and protects an unsaved note during replacement', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await open(page);
  const notes = page.getByRole('complementary', { name: 'Notas recentes' });
  await expect(notes.getByRole('button', { name: 'Nova nota', exact: true })).toBeVisible();
  await expect(notes.getByRole('button', { name: 'Novo whiteboard', exact: true })).toBeVisible();
  await notes.getByRole('button', { name: 'Ocultar busca de notas' }).click();
  await expect(notes.getByRole('searchbox')).toHaveCount(0);
  await notes.getByRole('button', { name: 'Mostrar busca de notas' }).click();
  await expect(notes.getByRole('searchbox')).toBeFocused();
  await page.getByRole('button', { name: 'Fonte', exact: true }).click();
  await page.locator('.cm-content').click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText('\nUnsaved work.');
  await notes.getByRole('button', { name: 'Novo whiteboard', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Salvar antes de criar um whiteboard?' });
  await expect(confirm).toBeVisible(); await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('Unsaved work.');
  await notes.getByRole('button', { name: 'Novo whiteboard', exact: true }).click();
  await confirm.getByRole('button', { name: 'Descartar e criar', exact: true }).click();
  await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode', 'whiteboard');
  await expect(page.getByRole('region', { name: 'Whiteboard Excalidraw' })).toHaveAttribute('data-whiteboard-state', 'ready', { timeout: 20000 });
  await mkdir('docs/evidence/notes-hierarchy', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/notes-hierarchy/notes-header-whiteboard-desktop.png' });
});

test('all six heading levels fold individually and together without altering Markdown', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await open(page);
  const reading = page.getByRole('article', { name: 'Prévia Markdown' });
  await expect(reading.getByRole('heading', { level: 6, name: 'Source' })).toBeVisible();
  await reading.getByRole('button', { name: 'Recolher seção Branch', exact: true }).click();
  await expect(reading.getByText('Branch content.', { exact: true })).not.toBeVisible();
  await expect(reading.getByText('Other content.', { exact: true })).toBeVisible();
  await reading.getByRole('button', { name: 'Expandir seção Branch', exact: true }).click();
  await expect(reading.getByText('Source content.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar outline', exact: true }).click();
  const outline = page.getByRole('complementary', { name: 'Índice da nota' });
  await expect(outline.getByRole('link', { name: 'Source', exact: true })).toBeVisible();
  await expect(outline.getByRole('link', { name: 'Source', exact: true }).locator('..').getByRole('button')).toHaveCount(0);
  await expect(outline.getByRole('link', { name: 'Other branch', exact: true }).locator('..').getByRole('button')).toHaveCount(0);
  await expect(outline.locator('header button')).toHaveCount(2);
  await outline.getByRole('button', { name: 'Recolher nível 2: Branch', exact: true }).click();
  await expect(outline.getByRole('link', { name: 'Topic', exact: true })).toHaveCount(0);
  await expect(reading.getByText('Topic content.', { exact: true })).not.toBeVisible();
  await outline.getByRole('button', { name: 'Expandir todos os níveis', exact: true }).click();
  await expect(outline.getByRole('link', { name: 'Source', exact: true })).toBeVisible();
  await outline.getByRole('button', { name: 'Recolher todos os níveis', exact: true }).click();
  await expect(outline.getByRole('link')).toHaveCount(1);
  await expect(reading.getByText('Root content.', { exact: true })).not.toBeVisible();
  await outline.getByRole('button', { name: 'Expandir todos os níveis', exact: true }).click();
  await expect(reading.getByText('Source content.', { exact: true })).toBeVisible();
  await mkdir('docs/evidence/notes-hierarchy', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/notes-hierarchy/heading-levels-expanded-desktop.png' });
  const download = page.waitForEvent('download'); await page.getByLabel('Exportar nota', {exact:true}).click(); await page.getByRole('button', {name:/^Markdown \(.md\)/}).click();
  const { readFile } = await import('node:fs/promises'); expect(await readFile((await (await download).path())!, 'utf8')).toBe(source);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog', { name: 'Índice da nota' })).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/notes-hierarchy/heading-levels-expanded-mobile.png' });
});
