import { chromium, webkit, expect } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.env.SCRIBA_RENAME_OUTPUT || 'artifacts/inline-rename';
const engines = process.env.MARKDOWN_BROWSER ? [process.env.MARKDOWN_BROWSER] : ['chromium', 'webkit'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'tablet-landscape', width: 1180, height: 820 },
].filter(viewport => !process.env.SCRIBA_RENAME_VIEWPORT || viewport.name === process.env.SCRIBA_RENAME_VIEWPORT);
const server = process.env.SCRIBA_URL ? null : await preview({ build: { outDir: process.env.SCRIBA_DIST || 'dist' }, preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.SCRIBA_URL || server.resolvedUrls.local[0];
const results = [];
const source = '# Caderno de pesquisa\n\nRegistros para retomar uma ideia, preservar o contexto e planejar a próxima entrevista.\n\n## Próximos passos\n\n- Revisar as fontes\n- Compartilhar a síntese\n';

async function openLibrary(page) {
  if (await page.locator('#recent-notes').isVisible()) return;
  const back = page.getByRole('button', { name: 'Voltar às notas', exact: true });
  if (await back.isVisible()) await back.click();
  else {
    await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
    await page.getByRole('button', { name: 'Mostrar notas recentes', exact: true }).click();
  }
}

async function beginRename(page) {
  const trigger = page.getByRole('button', { name: 'Renomear arquivo', exact: true });
  if (await trigger.isVisible()) await trigger.click();
  else {
    await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Renomear arquivo', exact: true }).click();
  }
  const input = page.getByRole('textbox', { name: 'Nome do arquivo', exact: true });
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Renomear arquivo', exact: true })).toHaveCount(0);
  return input;
}

try {
  await mkdir(output, { recursive: true });
  for (const engine of engines) {
    const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(origin);
          await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled({ timeout: 30000 });
          await openLibrary(page);
          await page.getByLabel('Arquivos de notas', { exact: true }).setInputFiles([
            { name: 'Manual de campo.md', mimeType: 'text/markdown', buffer: Buffer.from(source) },
            { name: 'Ocupada.md', mimeType: 'text/markdown', buffer: Buffer.from('# Outra nota\n\nConteúdo independente.\n') },
          ]);
          await expect(page.getByRole('article')).toContainText('Conteúdo independente.', { timeout: 30000 });
          await openLibrary(page);
          await page.locator('#recent-notes').getByRole('button', { name: 'Manual de campo.md', exact: true }).click();
          await expect(page.getByRole('article')).toContainText('Registros para retomar uma ideia');
          await expect(page.locator('.toast')).toHaveCount(0, { timeout: 7000 });

          let input = await beginRename(page);
          const selection = await input.evaluate(element => element.value.slice(element.selectionStart, element.selectionEnd));
          expect(selection).toBe('Manual de campo');
          const form = page.getByRole('form', { name: 'Renomear arquivo', exact: true });
          const geometry = await form.evaluate(element => {
            const rect = node => { const box = node.getBoundingClientRect(); return { x: box.x, right: box.right, width: box.width, height: box.height }; };
            return { form: rect(element), input: rect(element.querySelector('input')), buttons: [...element.querySelectorAll('button')].map(rect), viewport: document.documentElement.clientWidth };
          });
          expect(geometry.input.width).toBeGreaterThan(70);
          expect(geometry.form.x).toBeGreaterThanOrEqual(0);
          expect(geometry.form.right).toBeLessThanOrEqual(geometry.viewport);
          for (const button of geometry.buttons) { expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44); }
          for (const theme of ['dark', 'light']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-${theme}.png`) });
          }
          await input.fill('Nome cancelado');
          await input.press('Escape');
          await expect(input).toHaveCount(0);
          await expect(page.locator('header button[aria-label="Renomear arquivo"]')).toHaveText('Manual de campo.md');

          input = await beginRename(page);
          await input.fill('../invalido');
          await input.press('Enter');
          await expect(input).toHaveAttribute('aria-invalid', 'true');
          await expect(form.getByRole('alert')).toContainText('nome de arquivo válido');
          await expect(input).toBeFocused();
          await page.screenshot({ path: path.join(output, `${engine}-${viewport.name}-validation.png`) });
          await input.fill('Ocupada.md');
          await input.press('Enter');
          await expect(form.getByRole('alert')).toBeVisible({ timeout: 30000 });
          await expect(input).toHaveValue('Ocupada.md');
          await expect(input).toBeEditable();

          let renameRequests = 0;
          if (process.env.SCRIBA_RENAME_LOCAL) await page.route('**/api/rename', async route => {
            renameRequests++;
            await new Promise(resolve => setTimeout(resolve, 650));
            await route.continue();
          });
          await input.fill('Caderno revisado');
          await input.press('Enter');
          if (process.env.SCRIBA_RENAME_LOCAL) {
            await expect(form).toHaveAttribute('aria-busy', 'true');
            await input.press('Escape');
            await expect(form).toBeVisible();
            await input.press('Enter');
          }
          await expect(input).toHaveCount(0, { timeout: 30000 });
          if (process.env.SCRIBA_RENAME_LOCAL) {
            expect(renameRequests).toBe(1);
            await page.unroute('**/api/rename');
          }
          await expect(page.locator('header button[aria-label="Renomear arquivo"]')).toHaveText('Caderno revisado.md');
          await page.reload();
          await expect(page.locator('header button[aria-label="Renomear arquivo"]')).toHaveText('Caderno revisado.md', { timeout: 30000 });
          await expect(page.getByRole('article')).toContainText('Registros para retomar uma ideia');
          input = await beginRename(page);
          await input.fill('Caderno final.markdown');
          await form.getByRole('button', { name: 'Renomear', exact: true }).click();
          await expect(input).toHaveCount(0, { timeout: 30000 });
          await expect(page.locator('header button[aria-label="Renomear arquivo"]')).toHaveText('Caderno final.markdown');
          input = await beginRename(page);
          await input.fill('Cancelar pelo botão');
          await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
          await expect(input).toHaveCount(0);

          // Exercise the native command entry point and its CSS layout without claiming UIKit execution.
          const closeLibrary = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
          if (await closeLibrary.isVisible()) await closeLibrary.click();
          await page.evaluate(() => {
            document.documentElement.dataset.nativeChrome = 'true';
            window.dispatchEvent(new CustomEvent('scriba:native-command', { detail: 'rename' }));
          });
          input = page.getByRole('textbox', { name: 'Nome do arquivo', exact: true });
          await expect(input).toBeVisible();
          await input.press('Escape');
          await expect(input).toHaveCount(0);
          await page.evaluate(() => document.documentElement.dataset.nativeChrome = 'false');
          expect(errors).toEqual([]);
          results.push({ engine, viewport: viewport.name, geometry, passed: true });
          console.log(`${engine} ${viewport.name}: inline rename, keyboard, validation, collision recovery, persistence and native-command layout passed.`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, results }, null, 2) + '\n');
} finally { await server?.httpServer.close(); }
