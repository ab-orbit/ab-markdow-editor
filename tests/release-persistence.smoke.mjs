import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const origin = process.env.SCRIBA_URL || 'http://127.0.0.1:43997/';
const output = path.resolve(process.env.SCRIBA_RELEASE_OUTPUT || 'artifacts/release-persistence');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow' });
const page = await context.newPage(), errors = [], api = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()); });
async function persisted(marker) {
  await expect.poll(() => page.evaluate(marker => new Promise(resolve => {
    const request = indexedDB.open('scriba-private-notes', 1);
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('library', 'readonly'), get = transaction.objectStore('library').get('state');
      get.onsuccess = () => resolve(Object.values(get.result?.notes || {}).some(note => note.value?.includes(marker)));
      transaction.oncomplete = () => db.close();
    };
  }), marker), { timeout: 20000 }).toBe(true);
}
async function edit(marker) {
  const editor = page.getByRole('textbox', { name: 'Texto da nota', exact: true });
  if (!await editor.isVisible()) await page.getByRole('button', { name: 'Formatação', exact: true }).click();
  await expect(editor).toBeVisible();
  await editor.locator('p').first().fill(marker);
  await page.keyboard.press('Meta+s');
  await persisted(marker);
}
try {
  await page.goto(origin);
  const input = page.getByLabel('Arquivo Markdown', { exact: true });
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: 'release-private-check.md', mimeType: 'text/markdown', buffer: Buffer.from('# Release validation\n\nOriginal paragraph.\n') });
  await expect(page.getByRole('heading', { name: 'Release validation', exact: true })).toBeVisible();
  await edit('SCRIBA-PRIVATE-RELEASE-20261106');
  await page.reload();
  await expect(page.getByRole('article')).toContainText('SCRIBA-PRIVATE-RELEASE-20261106');
  const other = await browser.newContext({ locale: 'pt-BR', serviceWorkers: 'block' }), second = await other.newPage();
  await second.goto(origin);
  await expect(second.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
  assert.equal(await second.getByText('SCRIBA-PRIVATE-RELEASE-20261106', { exact: true }).count(), 0);
  await other.close();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 90000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(input).toBeEnabled();
  await edit('SCRIBA-OFFLINE-RELEASE-20261106');
  await page.reload();
  await expect(page.getByRole('article')).toContainText('SCRIBA-OFFLINE-RELEASE-20261106');
  assert.deepEqual(errors, []);
  assert.deepEqual(api, []);
  await page.screenshot({ path: path.join(output, 'offline-private-note.png') });
  await fs.writeFile(path.join(output, 'persistence.json'), JSON.stringify({ origin, persistence: true, contextIsolation: true, offlineSaveAndReload: true, localApiRequests: api.length, pageErrors: errors }, null, 2));
  console.log('PASS: private browser storage, save/reload, second-context isolation, real service-worker offline save/reload and no local API requests.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') });
  await fs.writeFile(path.join(output, 'failure.txt'), await page.locator('body').ariaSnapshot());
  throw error;
} finally { await context.close(); await browser.close(); }
