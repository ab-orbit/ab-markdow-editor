import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`import multiple notes preserves duplicates and the open draft at ${viewport.width}px`, async ({ page }) => {
    const repo = await mkdtemp(join(tmpdir(), 'scriba-import-notes-'));
    execFileSync('git', ['init', '-b', 'main', repo]);
    await writeFile(join(repo, 'first.md'), '# Existing\n');
    const { token } = await (await page.request.get('/api/session', { headers: { 'x-ab-markdown-client': '1' } })).json();
    const headers = { authorization: `Bearer ${token}` };
    try {
      expect((await page.request.post('/api/connect', { headers, data: { directory: repo } })).ok()).toBeTruthy();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      if (await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).isVisible()) await page.getByRole('button', { name: 'Voltar ao editor', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Fonte', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Fonte', exact: true }).click();
      await page.locator('.cm-content').fill('# Keep my draft\n');
      await page.setViewportSize(viewport);
      const notes = page.getByRole('complementary', { name: 'Notas recentes' });
      if (!await notes.isVisible()) await page.getByRole('button', { name: viewport.width < 600 ? 'Voltar às notas' : 'Mostrar notas recentes', exact: true }).click();
      await notes.locator('.notes-menu > summary').click();
      const chooser = page.waitForEvent('filechooser');
      await notes.getByRole('button', { name: 'Importar notas', exact: true }).click();
      const picker = await chooser;
      expect(picker.isMultiple()).toBe(true);
      await picker.setFiles([
        { name: 'first.md', mimeType: 'text/markdown', buffer: Buffer.from('# Imported first\n') },
        { name: 'second.markdown', mimeType: 'text/markdown', buffer: Buffer.from('# Imported second\n') },
      ]);
      await expect(notes.getByRole('button', { name: 'first (2).md', exact: true })).toBeVisible();
      await expect(notes.getByRole('button', { name: 'second.md', exact: true })).toBeVisible();
      expect(await readFile(join(repo, 'first.md'), 'utf8')).toBe('# Existing\n');
      expect(await readFile(join(repo, 'first (2).md'), 'utf8')).toBe('# Imported first\n');
      expect(await readFile(join(repo, 'second.md'), 'utf8')).toBe('# Imported second\n');
      await expect(page.locator('.cm-content')).toContainText('Keep my draft');
      await notes.locator('.notes-menu > summary').click();
      await mkdir('docs/evidence/import-notes', { recursive: true });
      await page.screenshot({ path: `docs/evidence/import-notes/multiple-import-${viewport.width}.png` });
    } finally {
      await page.request.post('/api/disconnect', { headers, data: { repository: repo } });
      await rm(repo, { recursive: true, force: true });
    }
  });
}
