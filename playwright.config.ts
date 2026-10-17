import { defineConfig } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const state = mkdtempSync(join(tmpdir(), 'ab-markdown-playwright-'));
process.on('exit', () => rmSync(state, { recursive: true, force: true }));
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', workers: 1, timeout: 60000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:43128', headless: true, screenshot: 'only-on-failure', channel: process.env.MARKDOWN_BROWSER_CHANNEL || undefined },
  webServer: { command: 'node server/index.mjs', url: 'http://127.0.0.1:43128/health', env: { PORT: '43128', MARKDOWN_STATE_DIR: state }, reuseExistingServer: false },
});
