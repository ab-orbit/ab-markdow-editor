import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openEditorWindow } from '../scripts/editor-window.mjs';

const exec = promisify(execFile);
const localURL = 'http://127.0.0.1:43127/?finder=cf75023a-0b84-4b87-9c5d-e2bfc24839ce';

async function application(root, name, info) {
  const bundle = path.join(root, name);
  await fs.mkdir(path.join(bundle, 'Contents'), { recursive: true });
  await fs.writeFile(path.join(bundle, 'Contents', 'Info.plist'), JSON.stringify(info));
  // Exercise macOS binary bundle metadata, including spaces and accented names.
  await exec('/usr/bin/plutil', ['-convert', 'binary1', path.join(bundle, 'Contents', 'Info.plist')]);
  return bundle;
}

test('Finder opens the installed local Scriba as an app window, preserving its browser profile', { skip: process.platform !== 'darwin' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-editor-window-'));
  try {
    await application(root, 'Google Chrome.app', { CFBundleIdentifier: 'com.google.Chrome' });
    const apps = path.join(root, 'Chrome Apps.localized');
    const pwa = await application(apps, 'Escriba — notas locais.app', {
      CFBundleIdentifier: 'com.google.Chrome.app.abcdefghijklmnopabcdefghijklmnop',
      CrBundleIdentifier: 'com.google.Chrome',
      CrAppModeShortcutID: 'abcdefghijklmnopabcdefghijklmnop',
      CrAppModeShortcutURL: 'http://127.0.0.1:43127/?source=pwa',
      CrAppModeProfileDir: 'Profile 7',
    });
    const opened = [];
    await openEditorWindow(localURL, { applicationsDirectories: [root], run: async (...args) => { opened.push(args); } });
    assert.deepEqual(opened.map(call => call.slice(0, 2)), [
      ['/usr/bin/open', ['-a', pwa]],
      ['/usr/bin/open', ['-n', '-b', 'com.google.Chrome', '--args', '--profile-directory=Profile 7', '--app-id=abcdefghijklmnopabcdefghijklmnop', `--app-launch-url-for-shortcuts-menu-item=${localURL}`]],
    ]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a public-site Scriba PWA cannot receive private local Finder handoffs', { skip: process.platform !== 'darwin' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-editor-window-'));
  try {
    const chrome = await application(root, 'Google Chrome.app', { CFBundleIdentifier: 'com.google.Chrome' });
    await application(path.join(root, 'Chrome Apps.localized'), 'Scriba.app', {
      CrBundleIdentifier: 'com.google.Chrome',
      CrAppModeShortcutID: 'abcdefghijklmnopabcdefghijklmnop',
      CrAppModeShortcutURL: 'https://scriba.aeonbridge.app/?source=pwa',
    });
    const opened = [];
    await openEditorWindow(localURL, { applicationsDirectories: [root], run: async (...args) => { opened.push(args); } });
    assert.deepEqual(opened.map(call => call.slice(0, 2)), [['/usr/bin/open', ['-n', '-a', chrome, '--args', `--app=${localURL}`]]]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('launching Scriba without a file activates its installed window without opening a browser tab', { skip: process.platform !== 'darwin' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-editor-window-'));
  try {
    const pwa = await application(root, 'Scriba.app', {
      CrBundleIdentifier: 'com.google.Chrome',
      CrAppModeShortcutID: 'abcdefghijklmnopabcdefghijklmnop',
      CrAppModeShortcutURL: 'http://127.0.0.1:43127/?source=pwa',
    });
    const opened = [];
    await openEditorWindow('http://127.0.0.1:43127', { applicationsDirectories: [root], run: async (...args) => { opened.push(args); } });
    assert.deepEqual(opened.map(call => call.slice(0, 2)), [['/usr/bin/open', ['-a', pwa]]]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('local file handoffs reject remote URLs before launching an application', async () => {
  const opened = [];
  for (const url of ['https://scriba.aeonbridge.app/?finder=test', 'http://example.invalid:43127/', 'http://user:secret@127.0.0.1:43127/']) {
    await assert.rejects(openEditorWindow(url, { applicationsDirectories: [], run: async (...args) => { opened.push(args); } }), /loopback/);
  }
  assert.deepEqual(opened, []);
});

test('missing standalone browsers never silently send a document to the default browser', { skip: process.platform !== 'darwin' }, async () => {
  const opened = [];
  await assert.rejects(openEditorWindow(localURL, { applicationsDirectories: ['/missing/scriba-applications'], run: async (...args) => { opened.push(args); } }), /Chrome ou Edge/);
  assert.deepEqual(opened, []);
});
