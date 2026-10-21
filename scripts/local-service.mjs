import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
export const serviceLabel = 'com.aeonbridge.markdown.server';
export const serviceFile = path.join(os.homedir(), 'Library', 'LaunchAgents', `${serviceLabel}.plist`);
const domain = () => `gui/${process.getuid()}`;
const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]));

/** Keep the loopback server available across browser launches, logins and process crashes. */
export function servicePlist(resources, state, runtimePath) {
  const text = value => `<string>${escapeXml(value)}</string>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key>${text(serviceLabel)}
<key>ProgramArguments</key><array>${text(path.join(resources, 'runtime/bin/node'))}${text(path.join(resources, 'server/index.mjs'))}</array>
<key>WorkingDirectory</key>${text(resources)}
<key>EnvironmentVariables</key><dict><key>PATH</key>${text(runtimePath)}<key>PORT</key>${text('43127')}<key>MARKDOWN_RUNTIME_FILE</key>${text(path.join(state, 'runtime.json'))}</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>5</integer>
<key>StandardOutPath</key>${text(path.join(state, 'server.log'))}
<key>StandardErrorPath</key>${text(path.join(state, 'server.log'))}
</dict></plist>\n`;
}
export async function stopService() {
  if (process.platform !== 'darwin') return;
  await exec('/bin/launchctl', ['bootout', `${domain()}/${serviceLabel}`]).catch(() => {});
}
export async function startService() {
  if (process.platform !== 'darwin') return false;
  try { await fs.access(serviceFile); } catch { return false; }
  try { await exec('/bin/launchctl', ['print', `${domain()}/${serviceLabel}`]); }
  catch { await exec('/bin/launchctl', ['bootstrap', domain(), serviceFile]); }
  await exec('/bin/launchctl', ['kickstart', `${domain()}/${serviceLabel}`]);
  return true;
}
async function install() {
  const resources = fileURLToPath(new URL('../', import.meta.url));
  const state = path.join(os.homedir(), 'Library', 'Application Support', 'AB Markdown');
  const runtimePath = (await fs.readFile(path.join(resources, 'runtime-path.txt'), 'utf8')).trim();
  await fs.mkdir(path.dirname(serviceFile), { recursive: true });
  await fs.mkdir(state, { recursive: true, mode: 0o700 });
  await stopService();
  await fs.writeFile(serviceFile, servicePlist(resources, state, runtimePath), { mode: 0o600 });
  await exec('/usr/bin/plutil', ['-lint', serviceFile]);
  await startService();
  console.log('Scriba local service installed and started.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'install') await install();
