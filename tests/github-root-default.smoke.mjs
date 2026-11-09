import { chromium, webkit, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

process.env.VITE_STORAGE_MODE = 'browser';
const native = process.env.SCRIBA_NATIVE_FIXTURE === '1';
process.env.VITE_APP_PLATFORM = native ? 'ios' : '';
const output = process.env.SCRIBA_GITHUB_OUTPUT || 'artifacts/github-root-default';
await mkdir(output, { recursive: true });
const server = process.env.SCRIBA_URL ? null : await createServer({ server: {
  host: '127.0.0.1', port: 0,
  watch: { ignored: ['**/dist/**', '**/dist-ios/**', '**/ios/**', '**/artifacts/**', '**/docs/evidence/**'] },
} });
await server?.listen();
const origin = process.env.SCRIBA_URL || server.resolvedUrls.local[0];
const engine = process.env.MARKDOWN_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true, ...(engine === 'chromium' ? { channel: 'chrome' } : {}),
});
const results = [];

async function openSettings(page) {
  const panel = page.getByRole('region', { name: 'Armazenamento', exact: true });
  if (await panel.isVisible()) return panel;
  const button = page.getByRole('button', { name: 'Configurações', exact: true });
  if (await button.isVisible()) await button.click();
  else {
    const closeNotes = page.getByRole('button', { name: 'Fechar lista de notas', exact: true });
    if (await closeNotes.isVisible()) await closeNotes.click();
    await page.getByRole('button', { name: 'Mais opções da nota', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Configurações', exact: true }).click();
  }
  return panel;
}

try {
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(native => {
      localStorage.setItem('scriba-language', 'pt');
      if (!native) return;
      window.CapacitorCustomPlatform = { name: 'ios' };
      const methods = ['appearance', 'folderStatus', 'disconnectFolder', 'updateInfo', 'accessibilityPreferences', 'githubRequest', 'workspaceLayout', 'workspaceChrome', 'removeListener'];
      window.Capacitor = {
        PluginHeaders: [{ name: 'ScribaNative', methods: [...methods.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }] }],
        nativeCallback: () => 'fixture-listener',
        nativePromise: async (_, method, args) => {
          if (method === 'folderStatus') return { label: '' };
          if (method === 'updateInfo') return { version: '1.17.8', build: '31', channel: 'development' };
          if (method === 'workspaceLayout') return { nativeChrome: false, width: innerWidth, height: innerHeight, verticalBarEdge: 'none', posture: 'unavailable', occlusions: [], keyboardVisible: false, textScale: 1 };
          if (method === 'githubRequest') {
            const response = await fetch('/github/' + args.route, {
              method: args.body === undefined ? 'GET' : 'POST',
              headers: { 'Content-Type': 'application/json' }, body: args.body,
            });
            return { status: response.status, text: await response.text() };
          }
          return {};
        },
      };
    }, native);
    const notes = new Map([['root.md', { name: 'root.md', value: '# Root note', version: 'root-version', files: [] }]]);
    let selection = null;
    const destinations = [];
    await context.route('**/github/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const body = request.method() === 'POST' ? request.postDataJSON() : undefined;
      const reply = json => route.fulfill({ json });
      if (url.pathname === '/github/status') return reply({ configured: true, connected: true, user: { login: 'example' }, selection, installUrl: null });
      if (url.pathname === '/github/repositories') return reply([{ fullName: 'example/notes', defaultBranch: 'main', private: true }]);
      if (url.pathname === '/github/select') {
        destinations.push(body);
        selection = { ...body, branch: 'main' };
        return reply(selection);
      }
      if (url.pathname === '/github/library') return reply({ notes: [...notes.values()].map(({ value, files, ...note }) => ({ ...note, title: note.name, modifiedAt: '2026-11-09T12:00:00Z' })) });
      if (url.pathname === '/github/save') {
        const note = { ...body, version: 'saved-' + notes.size };
        notes.set(body.name, note);
        return reply({ version: note.version, synced: true });
      }
      if (url.pathname === '/github/document') return reply({ ...notes.get(url.searchParams.get('name')), warnings: [] });
      if (url.pathname === '/github/document-version') return reply({ version: notes.get(url.searchParams.get('name'))?.version || null });
      return route.fulfill({ status: 404, json: { error: 'Unknown fixture route' } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
    const panel = await openSettings(page);
    await panel.getByRole('button', { name: 'Conectar GitHub', exact: true }).click();
    await panel.getByText('Opções avançadas', { exact: true }).click();
    const folder = panel.getByRole('textbox', { name: 'Pasta das notas', exact: true });
    await expect(folder).toBeEnabled();
    await expect(folder).toHaveValue('');
    await folder.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${engine}-${native ? 'native-bridge' : 'web'}-${width}-root-picker.png` });
    await panel.getByRole('button', { name: /example\/notes/ }).click();
    await expect(panel.getByText('Salvamento ativo no GitHub.', { exact: true })).toBeVisible();
    assert.equal(destinations.at(-1).folder, '');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('scriba-github-selection')).folder), '');
    await page.screenshot({ path: `${output}/${engine}-${native ? 'native-bridge' : 'web'}-${width}-root.png` });

    await panel.getByRole('button', { name: 'Trocar repositório', exact: true }).click();
    await panel.getByText('Opções avançadas', { exact: true }).click();
    await expect(folder).toBeEnabled();
    await folder.fill('research/notes');
    await panel.getByRole('button', { name: /example\/notes/ }).click();
    await expect(panel.getByText('research/notes', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Trocar repositório', exact: true })).toBeEnabled();
    assert.equal(destinations.at(-1).folder, 'research/notes');
    await page.screenshot({ path: `${output}/${engine}-${native ? 'native-bridge' : 'web'}-${width}-custom-folder.png` });
    await page.reload();
    await expect(page.getByLabel('Arquivo Markdown', { exact: true })).toBeEnabled();
    const restoredPanel = await openSettings(page);
    await expect(restoredPanel.getByText('research/notes', { exact: true })).toBeVisible();
    assert.equal(destinations.length, 2, 'Loading settings must not change an existing destination.');

    await restoredPanel.getByRole('button', { name: 'Trocar repositório', exact: true }).click();
    await restoredPanel.getByText('Opções avançadas', { exact: true }).click();
    await expect(folder).toBeEnabled();
    await expect(folder).toHaveValue('');
    await restoredPanel.getByRole('button', { name: /example\/notes/ }).click();
    await expect(restoredPanel.getByText('Salvamento ativo no GitHub.', { exact: true })).toBeVisible();
    await expect(restoredPanel.getByRole('button', { name: 'Trocar repositório', exact: true })).toBeEnabled();
    assert.equal(destinations.at(-1).folder, '');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    results.push({ engine, nativeBridgeFixture: native, width, height, defaultRoot: true, customSubfolder: true, restoredDestination: true, rootOnReselection: true });
    await context.close();
  }
  await writeFile(`${output}/${engine}-${native ? 'native-bridge' : 'web'}-results.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await server?.close();
}
