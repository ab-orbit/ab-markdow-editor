import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { verifyMacBundle } from '../scripts/verify-macos-bundle.mjs';

const exec = promisify(execFile);
const source = process.env.SCRIBA_MAC_BUNDLE;
const { version } = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('the built Mac application rejects packaging regressions before installation', {
  skip: process.platform !== 'darwin' || !source ? 'Build with MARKDOWN_PACKAGE_ONLY=1 and set SCRIBA_MAC_BUNDLE to run packaging acceptance tests.' : false,
}, async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-macos-package-'));
  const bundle = path.join(temporary, 'Scriba.app');
  try {
    // Exercise a complete, signed application rather than a mocked plist or source-code grep.
    await fs.cp(source, bundle, { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
    const plist = path.join(bundle, 'Contents/Info.plist');
    const metadata = await fs.readFile(plist);
    const helper = path.join(bundle, 'Contents/Resources/scripts/editor-window.mjs');
    const helperBytes = await fs.readFile(helper);
    const icon = path.join(bundle, 'Contents/Resources/AppIcon.icns');
    const iconBytes = await fs.readFile(icon);

    await t.test('a pristine signed package passes', async () => {
      const result = await verifyMacBundle(bundle, { version });
      assert.equal(result.version, version);
    });
    await t.test('the window launcher cannot be omitted from the package', async () => {
      await fs.rm(helper);
      try { await assert.rejects(verifyMacBundle(bundle, { version }), /editor-window\.mjs/); }
      finally { await fs.writeFile(helper, helperBytes); }
    });
    await t.test('the Markdown document icon must be declared', async () => {
      await exec('/usr/libexec/PlistBuddy', ['-c', 'Delete :CFBundleDocumentTypes:0:CFBundleTypeIconFile', plist]);
      try { await assert.rejects(verifyMacBundle(bundle, { version }), /document icon/i); }
      finally { await fs.writeFile(plist, metadata); }
    });
    await t.test('the declared icon must be a real bundled resource', async () => {
      await fs.rm(icon);
      try { await assert.rejects(verifyMacBundle(bundle, { version }), /document icon/i); }
      finally { await fs.writeFile(icon, iconBytes); }
    });
    await t.test('Markdown cannot regress to a secondary application role', async () => {
      await exec('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleDocumentTypes:0:LSHandlerRank Alternate', plist]);
      try { await assert.rejects(verifyMacBundle(bundle, { version }), /Markdown.*Default/); }
      finally { await fs.writeFile(plist, metadata); }
    });
    await t.test('a modified signed resource invalidates the package', async () => {
      const html = path.join(bundle, 'Contents/Resources/dist/index.html');
      const content = await fs.readFile(html);
      await fs.appendFile(html, '\n<!-- Packaging acceptance: altered after signing. -->\n');
      try { await assert.rejects(verifyMacBundle(bundle, { version }), /codesign|signature|resource/i); }
      finally { await fs.writeFile(html, content); }
    });
    await t.test('stale application versions are rejected', async () => {
      await assert.rejects(verifyMacBundle(bundle, { version: '0.0.0' }), /version/i);
    });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});
