import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
const browsers = ['com.google.Chrome', 'com.microsoft.edgemac', 'com.brave.Browser', 'org.chromium.Chromium'];

async function applications(directories) {
  const result = [];
  for (const directory of directories) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const bundle = path.join(directory, entry.name);
      if (entry.name.endsWith('.app')) result.push(bundle);
      // Browser-installed web apps live one level below Applications. Never read browser profiles.
      else if (entry.name.endsWith('.localized') || / Apps$/.test(entry.name)) {
        const children = await fs.readdir(bundle, { withFileTypes: true }).catch(() => []);
        result.push(...children.filter(child => child.isDirectory() && child.name.endsWith('.app')).map(child => path.join(bundle, child.name)));
      }
    }
  }
  const apps = [];
  for (const bundle of result) {
    try {
      const { stdout } = await exec('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents', 'Info.plist')]);
      apps.push({ bundle, info: JSON.parse(stdout) });
    } catch { /* Ignore unrelated or incomplete bundles, including iOS-on-Mac wrappers. */ }
  }
  return apps;
}

/** Open the local editor without changing the user's default Markdown application. */
export async function openEditorWindow(url, {
  applicationsDirectories = [path.join(os.homedir(), 'Applications'), '/Applications'],
  run = exec,
} = {}) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password) {
    throw new Error('A janela local do Scriba exige um endereço de loopback.');
  }
  const installed = await applications(applicationsDirectories);
  const pwa = installed.find(({ info }) => {
    if (!browsers.includes(info.CrBundleIdentifier) || !/^[a-p]{32}$/.test(info.CrAppModeShortcutID || '')) return false;
    try { return new URL(info.CrAppModeShortcutURL).origin === target.origin; } catch { return false; }
  });
  if (pwa) {
    // Activating the installed shim selects the app's existing Chrome/Edge profile, including multi-profile shims.
    await run('/usr/bin/open', ['-a', pwa.bundle]);
    if (!target.searchParams.has('finder')) return;
    const profile = pwa.info.CrAppModeProfileDir;
    const profileArguments = profile && profile !== '-' ? [`--profile-directory=${profile}`] : [];
    // Ordinary HTTP open-URL AppleEvents are ignored by Chromium app shims. Use the supported app URL override.
    await run('/usr/bin/open', ['-n', '-b', pwa.info.CrBundleIdentifier, '--args', ...profileArguments,
      `--app-id=${pwa.info.CrAppModeShortcutID}`, `--app-launch-url-for-shortcuts-menu-item=${target.href}`]);
    return;
  }
  const browser = browsers.map(id => installed.find(app => app.info.CFBundleIdentifier === id)).find(Boolean);
  if (!browser) throw new Error('Instale o Scriba pelo Chrome ou Edge para abrir suas notas em uma janela de aplicativo.');
  // A fresh installation still opens a separate window instead of a tab in the default browser.
  await run('/usr/bin/open', ['-n', '-a', browser.bundle, '--args', `--app=${target.href}`]);
}
