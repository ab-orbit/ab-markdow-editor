import { chromium, webkit, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

// Synthetic notes live only in fresh browser contexts. No account, user checkout or OS picker is used.
const url = process.env.SCRIBA_URL || 'https://scriba.aeonbridge.app/';
const evidence = new URL(process.env.SCRIBA_EVIDENCE_DIR || '../docs/evidence/reload-confirmation/', import.meta.url);
const results = [];
await fs.mkdir(evidence, { recursive: true });
for (const engine of ['chromium', 'webkit']) {
  const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      await page.goto(url);
      const input = page.getByLabel('Arquivo Markdown', { exact: true });
      const name = `Reload-${width}.md`, original = '# Conteúdo salvo\n\nArquivo sintético de verificação.';
      await expect(input).toBeEnabled();
      await input.setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(original) });
      // File inputs return before asynchronous decoding and host registration have finished.
      await expect(page.getByRole('article')).toContainText('Conteúdo salvo');
      await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('data-mode', 'read');
      await expect(page.getByLabel('Bancada Markdown')).toHaveAttribute('aria-busy', 'false');
      await expect(input).toBeEnabled();
      const close = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
      if (await close.isVisible()) await close.click();
      const more = page.getByRole('button', { name: 'Mais opções da nota', exact: true });
      if (await more.isVisible() && !await page.getByRole('button', { name: 'Fonte', exact: true }).isVisible()) await more.click();
      async function savedValue() {
        return page.evaluate(async name => {
          const db = await new Promise((resolve, reject) => { const request = indexedDB.open('scriba-private-notes'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
          try { return await new Promise((resolve, reject) => { const request = db.transaction('library').objectStore('library').get('state'); request.onsuccess = () => resolve(request.result?.notes?.[name]?.value); request.onerror = () => reject(request.error); }); }
          finally { db.close(); }
        }, name);
      }
      await page.getByRole('button', { name: 'Salvar nota', exact: true }).click();
      await expect.poll(savedValue).toBe(original);
      await page.getByRole('button', { name: 'Fonte', exact: true }).click();
      const source = page.locator('.cm-content'); await source.fill('# Rascunho que será descartado por confirmação.');
      await page.getByRole('button', { name: 'Recarregar nota', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Recarregar nota', exact: true });
      await dialog.getByRole('button', { name: 'Continuar editando', exact: true }).click();
      await expect(source).toContainText('Rascunho que será descartado');
      await page.getByRole('button', { name: 'Recarregar nota', exact: true }).first().click();
      await dialog.getByRole('button', { name: 'Recarregar e descartar rascunho', exact: true }).click();
      await expect(dialog).toHaveCount(0); await expect(source).toContainText('Conteúdo salvo');
      assert.equal(await savedValue(), original, 'Reload itself never writes over the saved source.');
      await source.fill('# Salvo depois de recarregar.'); await page.getByRole('button', { name: 'Salvar nota', exact: true }).click();
      await expect.poll(savedValue).toBe('# Salvo depois de recarregar.');
      await page.screenshot({ path: new URL(`reload-${width}x${height}-${engine}.png`, evidence).pathname });
      results.push({ engine, width, height, cancelPreservedDraft: true, confirmedReload: true, originalPreservedByReload: true, savedAfterReload: true });
      await context.close();
    }
  } finally { await browser.close(); }
}
await fs.writeFile(new URL('verification.json', evidence), JSON.stringify({ checkedAt: new Date().toISOString(), url, version: process.env.SCRIBA_EXPECTED_VERSION || undefined, fakeClock: false, results }, null, 2) + '\n');
console.log(`PASS: confirmed reload in production on Chromium/WebKit, desktop/phone; cancel, reload, source preservation and subsequent save (${results.length} journeys).`);
