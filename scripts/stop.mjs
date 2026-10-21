import { stopService } from './local-service.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const state = process.env.MARKDOWN_STATE_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'AB Markdown');
const file = path.join(state, 'runtime.json');
// An explicit stop/update must unload supervision before terminating the server.
if (!process.env.MARKDOWN_STATE_DIR) await stopService();
let runtime;
try { runtime = JSON.parse(await fs.readFile(file, 'utf8')); } catch { process.exit(0); }
// Verify the process identity through the loopback service before sending a signal.
const url = new URL(runtime.url);
if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw new Error('Invalid local runtime URL.');
let health;
try { health = await (await fetch(`${runtime.url}/health`, { signal: AbortSignal.timeout(1500) })).json(); }
catch { process.exit(0); }
if (health.app !== 'ab-markdown-editor' || health.pid !== runtime.pid) throw new Error('The runtime does not belong to AB Markdown.');
process.kill(runtime.pid, 'SIGTERM');
for (let i = 0; i < 50; i++) {
  try { process.kill(runtime.pid, 0); }
  catch { await fs.rm(file, { force: true }); console.log('AB Markdown encerrado.'); process.exit(0); }
  await new Promise(resolve => setTimeout(resolve, 100));
}
throw new Error('The local server did not exit. Close it before updating.');
