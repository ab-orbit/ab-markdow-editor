import { readFile, writeFile, copyFile } from 'node:fs/promises';

/** Keep release metadata in one place and reject a native build that would load remote application code. */
const root = new URL('../', import.meta.url), json = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const config = await readFile(new URL('capacitor.config.ts', root), 'utf8');
if (/\bserver\s*:|allowNavigation|cleartext\s*:\s*true/.test(config)) throw new Error('App Store builds must use bundled web assets without a remote server override.');
const project = new URL('ios/App/App.xcodeproj/project.pbxproj', root);
let source = await readFile(project, 'utf8');
source = source.replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${json.version};`);
if (process.env.SCRIBA_IOS_BUILD_NUMBER) {
  if(!/^[1-9]\d{0,17}$/.test(process.env.SCRIBA_IOS_BUILD_NUMBER))throw new Error('SCRIBA_IOS_BUILD_NUMBER must be a positive numeric App Store build number.');
  source = source.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${process.env.SCRIBA_IOS_BUILD_NUMBER};`);
}
await writeFile(project, source);
await copyFile(new URL('public/icons/profile-v4/scribe-store-1024.png', root), new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', root));
const entry = new URL('dist-ios/index.html', root);
let html = await readFile(entry, 'utf8');
html = html.replace('<script src="/register-sw.js" defer></script>', '').replace('<link rel="manifest" href="/manifest.webmanifest">', '');
const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
await writeFile(entry, html);
console.log(`iOS bundled editor ${json.version}; native Files, Keychain, authentication and sharing enabled.`);
