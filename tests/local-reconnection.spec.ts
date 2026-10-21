import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('reconnects to local files automatically without replacing the open draft', async ({ page }) => {
  const repo = await mkdtemp(join(tmpdir(), 'scriba-reconnect-'));
  try {
    execFileSync('git', ['init', '-b', 'main', repo]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
    await page.route('**/api/pick-folder', route => route.fulfill({ json: { directory: repo } }));
    await page.getByRole('button', { name: 'Selecionar pasta', exact: true }).click();
    await page.getByRole('button', { name: 'Revisar troca', exact: true }).click();
    await page.getByRole('button', { name: 'Conectar repositório', exact: true }).click();
    await expect(page.getByText('Pasta conectada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
    await page.getByLabel('Arquivo Markdown', { exact: true }).setInputFiles({ name: 'draft.md', mimeType: 'text/markdown', buffer: Buffer.from('# Draft preserved\n\nUnsaved local text.') });
    await expect(page.getByRole('article')).toContainText('Unsaved local text.');
    await page.route('**/health', route => route.abort('connectionrefused'));
    await page.getByRole('button', { name: 'Configurações', exact: true }).click();
    await expect(page.getByText('Serviço local indisponível', { exact: true })).toBeVisible({ timeout: 10000 });
    await mkdir('docs/evidence/local-reconnection', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'docs/evidence/local-reconnection/service-unavailable-desktop.png' });
    await page.unroute('**/health');
    await expect(page.getByText('Pasta conectada', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
    await expect(page.getByRole('article')).toContainText('Unsaved local text.');
    await page.setViewportSize({ width: 390, height: 844 });
    const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
    if (await closeNotes.isVisible()) await closeNotes.click();
    await page.screenshot({ path: 'docs/evidence/local-reconnection/reconnected-draft-mobile.png' });
  } finally { await rm(repo, { recursive: true, force: true }); }
});
