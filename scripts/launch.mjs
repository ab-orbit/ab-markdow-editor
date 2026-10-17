import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Repository } from '../server/repository.mjs';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const resources = fileURLToPath(new URL('../', import.meta.url));
const state = path.join(os.homedir(), 'Library', 'Application Support', 'AB Markdown');
const runtimeFile = path.join(state, 'runtime.json');
await fs.mkdir(state, { recursive: true, mode: 0o700 });
async function active() {
  try {
    const runtime = JSON.parse(await fs.readFile(runtimeFile, 'utf8'));
    const url = new URL(runtime.url);
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') return null;
    process.kill(runtime.pid, 0);
    const response = await fetch(`${runtime.url}/health`, { signal: AbortSignal.timeout(1200) });
    const health = await response.json();
    return health.app === 'ab-markdown-editor' && health.pid === runtime.pid ? runtime.url : null;
  } catch { return null; }
}
let url = await active();
if (!url) {
  // Finder does not source shell profiles. Preserve install-time PATH for Git/SSH helpers.
  const installedPath = await fs.readFile(path.join(resources, 'runtime-path.txt'), 'utf8').catch(() => '');
  const log = await fs.open(path.join(state, 'server.log'), 'a', 0o600);
  const child = spawn(process.execPath, [path.join(resources, 'server/index.mjs')], {
    detached: true, stdio: ['ignore', log.fd, log.fd],
    env: { ...process.env, PATH: `${installedPath.trim()}:${process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'}`, PORT: '43127', MARKDOWN_RUNTIME_FILE: runtimeFile },
  });
  child.unref(); await log.close();
  for (let attempt = 0; attempt < 80; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 150));
    url = await active(); if (url) break;
  }
}
if (!url) {
  await exec('/usr/bin/osascript', ['-e', 'display alert "AB Markdown" message "Não foi possível iniciar. Consulte ~/Library/Application Support/AB Markdown/server.log." as critical']);
  process.exit(1);
}
const documents = process.argv.slice(2).filter(argument => !argument.startsWith('-psn_'));
if (!documents.length) await exec('/usr/bin/open', [url]);
for (const document of documents) {
  const filename = await fs.realpath(document);
  if (!/\.(md|markdown|mdown)$/i.test(filename)) continue;
  // Scope attachment reads to the selected document's directory without changing the user's Git checkout.
  const reader = new Repository(state); reader.root = path.dirname(filename);
  const payload = { ...await reader.read(path.basename(filename)), filename };
  const inbox = path.join(state, 'finder-inbox'); await fs.mkdir(inbox, {recursive:true, mode:0o700});
  const id = randomUUID(); await fs.writeFile(path.join(inbox, `${id}.json`), JSON.stringify(payload), {mode:0o600});
  await exec('/usr/bin/open', [`${url}/?finder=${id}`]);
}
