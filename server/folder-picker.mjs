import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);

/** Open our native helper app; cancellation returns null without changing the checkout. */
async function pick(request) {
  if (process.platform !== 'darwin') throw new Error('O seletor nativo está disponível no macOS.');
  const helper = fileURLToPath(new URL('../native/AB Markdown Folder Picker.app', import.meta.url));
  await fs.access(helper);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ab-markdown-picker-'));
  const resultFile = path.join(temporary, 'result.json');
  try {
    if (request) await fs.writeFile(path.join(temporary, 'request.json'), JSON.stringify(request), {mode:0o600});
    await exec('/usr/bin/open', ['-W', '-n', helper, '--args', resultFile], { timeout: 600000, maxBuffer: 65536 });
    const result = JSON.parse(await fs.readFile(resultFile, 'utf8'));
    if (result.error) throw new Error(result.error);
    return result;
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
export async function pickFolder() { const result = await pick(); return {directory:result.directory || null}; }
/** NSSavePanel authorizes one destination without changing the configured repository. */
export async function pickSaveFile(name, directory) { const result = await pick({mode:'save',name,directory}); return {filename:result.filename || null}; }
