import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.platform === 'darwin') {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const app = path.join(root, 'native', 'AB Markdown Folder Picker.app');
  mkdirSync(path.dirname(app), { recursive: true }); rmSync(app, { force: true, recursive: true });
  execFileSync('/usr/bin/osacompile', ['-l', 'JavaScript', '-o', app, path.join(root, 'scripts/folder-picker.jxa.js')]);
  const plist = path.join(app, 'Contents', 'Info.plist');
  execFileSync('/usr/bin/plutil', ['-replace', 'CFBundleIdentifier', '-string', 'com.aeonbridge.markdown.folderpicker', plist]);
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', app]);
}
