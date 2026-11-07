import { promises as fs, constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);

/** Verify the application produced by the installer before it replaces an existing installation. */
export async function verifyMacBundle(bundle, { version } = {}) {
  if (process.platform !== 'darwin') throw new Error('Mac application verification requires macOS.');
  const contents = path.join(bundle, 'Contents');
  const resources = path.join(contents, 'Resources');
  const { stdout } = await exec('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(contents, 'Info.plist')]);
  const info = JSON.parse(stdout);
  if (info.CFBundleIdentifier !== 'com.aeonbridge.markdown') throw new Error('Unexpected application bundle identifier.');
  if (!version || info.CFBundleVersion !== version || info.CFBundleShortVersionString !== version) throw new Error('Application version differs from the source package version.');
  const markdown = info.CFBundleDocumentTypes?.find(type => type.LSItemContentTypes?.includes('net.daringfireball.markdown'));
  if (markdown?.CFBundleTypeRole !== 'Editor' || markdown.LSHandlerRank !== 'Default') throw new Error('Markdown must be registered as an Editor with Default rank.');
  const iconName = markdown.CFBundleTypeIconFile;
  if (typeof iconName !== 'string' || path.basename(iconName) !== iconName) throw new Error('Markdown document icon is missing or invalid.');
  const icon = await fs.readFile(path.join(resources, iconName)).catch(() => null);
  if (!icon || icon.length < 8 || icon.toString('ascii', 0, 4) !== 'icns' || icon.readUInt32BE(4) !== icon.length) throw new Error('Markdown document icon must resolve to a real bundled ICNS resource.');
  const imported = info.UTImportedTypeDeclarations?.find(type => type.UTTypeIdentifier === 'net.daringfireball.markdown');
  if (imported?.UTTypeIconFile !== iconName) throw new Error('The imported Markdown type must declare the same document icon.');
  await fs.access(path.join(contents, 'MacOS', info.CFBundleExecutable), constants.X_OK);
  const required = ['scripts/launch.mjs', 'scripts/editor-window.mjs', 'scripts/local-service.mjs', 'server/index.mjs', 'dist/index.html'];
  for (const file of required) {
    await fs.access(path.join(resources, file)).catch(() => { throw new Error(`Missing application resource: ${file}`); });
  }
  const helper = await import(pathToFileURL(path.join(resources, 'scripts/editor-window.mjs')).href);
  if (typeof helper.openEditorWindow !== 'function') throw new Error('editor-window.mjs must expose the application-window launcher.');
  const node = path.join(resources, 'runtime/bin/node');
  await fs.access(node, constants.X_OK);
  const nodeVersion = (await exec(node, ['--version'])).stdout.trim();
  const [major, minor] = nodeVersion.replace(/^v/, '').split('.').map(Number);
  if (!Number.isInteger(major) || major < 22 || major === 22 && minor < 12) throw new Error('The embedded Node runtime must support the source package engine requirement.');
  for (const file of required.filter(file => file.endsWith('.mjs'))) await exec(node, ['--check', path.join(resources, file)]);
  await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
  return { bundle, version, documentIcon: iconName, nodeVersion, signature: 'verified' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: verify-macos-bundle.mjs APPLICATION.app EXPECTED_VERSION');
    console.log(JSON.stringify(await verifyMacBundle(process.argv[2], { version: process.argv[3] })));
  } catch (error) { console.error(`Invalid Mac package: ${error.message}`); process.exitCode = 1; }
}
