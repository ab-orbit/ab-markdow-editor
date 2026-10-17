import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`${viewport.name}: edit, save, reopen, attach image, commit and push`, async ({ page }) => {
    const dir = await mkdtemp(join(tmpdir(), 'markdown-browser-'));
    const repo = join(dir, 'repo'); const remote = join(dir, 'remote.git');
    const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
    try {
      git('init', '-b', 'main', repo); git('init', '--bare', '-b', 'main', remote);
      for (const [key, value] of [['user.name','Browser Test'],['user.email','browser@example.invalid'],['commit.gpgsign','false'],['core.hooksPath','/dev/null']]) git('-C',repo,'config',key,value);
      await writeFile(join(repo, 'README.md'), '# Example\n');
      git('-C',repo,'add','.');git('-C',repo,'commit','-m','Initial');git('-C',repo,'remote','add','origin',remote);git('-C',repo,'push','-u','origin','main');
      await page.setViewportSize(viewport); await page.goto('/');
      page.on('dialog', dialog => dialog.accept());
      const settings = page.getByRole('dialog', { name: 'Configurações', exact: true });
      const gear = page.getByRole('button', { name: 'Configurações', exact: true });
      await expect(settings).toBeVisible();
      const summary = page.locator('details.repository > summary');
      if (!(await page.locator('details.repository').evaluate(el => el.hasAttribute('open')))) await summary.click();
      let folderChoice: string | null = null;
      await page.route('**/api/pick-folder', route => route.fulfill({ json: { directory: folderChoice } }));
      await page.getByRole('button', { name: 'Selecionar pasta', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Selecionar pasta', exact: true })).toBeEnabled();
      await expect(page.getByLabel('Pasta local do repositório', { exact: true })).toHaveValue('');
      folderChoice = repo;
      await page.getByRole('button', { name: 'Selecionar pasta', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Repositório conectado.');
      await expect(settings).toHaveCount(0);
      await expect(page.getByText('O texto é o documento.', { exact: true })).toHaveCount(0);
      await expect(page.locator('.document-controls')).toHaveCount(0);
      await gear.click();
      await expect(settings).toBeVisible();
      if (!(await page.locator('details.repository').evaluate(el => el.hasAttribute('open')))) await summary.click();
      await page.getByText('Clonar um repositório por URL', { exact: true }).click();
      await page.getByLabel('URL HTTPS ou SSH', { exact: true }).fill('git@github.com:example/research.git');
      await page.getByRole('button', { name: 'Selecionar onde clonar' }).click();
      await expect(page.getByLabel('Nova pasta local (caminho absoluto)')).toHaveValue(`${repo}/research`);
      await page.getByText('Clonar um repositório por URL', { exact: true }).click();
      await page.getByLabel('Caminho do arquivo no repositório').fill('notes/pesquisa.md');
      await settings.getByRole('button', { name: 'Fechar', exact: true }).click();
      const source = page.locator('.cm-content'); await source.click(); await page.keyboard.insertText('# Pesquisa\n\nTexto com **evidências**.\n\n- [ ] Conferir fontes\n');
      await gear.click();
      await page.keyboard.press('Escape');
      await expect(settings).toHaveCount(0);
      await expect(source).toContainText('Pesquisa');
      await page.getByRole('button', { name: 'Visão', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Pesquisa', exact: true })).toBeVisible();
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII=', 'base64');
      await page.getByLabel('Arquivos de imagem', { exact: true }).setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: image });
      await expect(page.getByText('1 imagem(ns) anexada(s).', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: 'Salvar no repositório', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Documento e imagens salvos no repositório local.');
      const saved = await readFile(join(repo,'notes/pesquisa.md'),'utf8'); expect(saved).toContain('# Pesquisa'); expect(saved).toContain('assets/');
      await gear.click();
      await page.getByLabel('Mensagem de commit').fill('Pesquisa com evidências');
      await page.getByRole('button', { name: 'Criar commit' }).click();
      await expect(page.getByRole('status')).toHaveText('Commit criado. Use Enviar para publicar no remoto.');
      await page.getByRole('button', { name: 'Enviar (push)' }).click();
      await expect(page.getByRole('status')).toHaveText('Commits enviados ao remoto.');
      expect(git('-C',remote,'show','main:notes/pesquisa.md')).toBe(saved);
      await page.reload();
      await expect(settings).toHaveCount(0);
      await expect(page.locator('.document-controls')).toHaveCount(0);
      await gear.click();
      await page.getByLabel('Arquivos do repositório', { exact: true }).selectOption('notes/pesquisa.md');
      await page.getByRole('button', { name: 'Abrir do repositório' }).click();
      await expect(page.getByRole('status')).toHaveText('Documento aberto.');
      await page.getByRole('button', { name: 'Ler', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Pesquisa', exact: true })).toBeVisible();
      await expect(page.locator('article img')).toHaveCount(1);
      await expect(page.locator('article img')).toBeVisible();
      await expect(settings).toHaveCount(0);
      await page.screenshot({ path: `docs/evidence/${viewport.name}-repository-document-dark.png`, fullPage: true });
      await gear.click();
      await page.screenshot({ path: `docs/evidence/${viewport.name}-settings.png`, fullPage: true });
      await page.getByRole('button', { name: 'Usar tema claro' }).click();
      await settings.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme','light');
      await page.screenshot({ path: `docs/evidence/${viewport.name}-repository-document-light.png`, fullPage: true });
      const contrast = await page.evaluate(() => {
        const original = document.documentElement.dataset.theme;
        const results: {token: string; ratio: number}[] = [];
        for (const theme of ['dark', 'light']) {
        document.documentElement.dataset.theme = theme;
        const css = getComputedStyle(document.documentElement);
        const luminance = (token: string) => {
          const hex = css.getPropertyValue(token).trim().slice(1);
          const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
          return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
        };
        results.push(...['--text-primary', '--text-secondary', '--text-muted', '--lime', '--cyan'].map(token => {
          const a = luminance(token), b = luminance('--bg-surface');
          return { token: `${theme}/${token}`, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        }));
        }
        document.documentElement.dataset.theme = original;
        return results;
      });
      for (const pair of contrast) expect(pair.ratio, pair.token).toBeGreaterThanOrEqual(4.5);
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(horizontalOverflow).toBe(false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
