import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);

/** Open our native helper app; cancellation returns null without changing the checkout. */
export async function pickFolder() {
  if (process.platform !== 'darwin') throw new Error('O seletor nativo está disponível no macOS.');
  const helper = fileURLToPath(new URL('../native/AB Markdown Folder Picker.app', import.meta.url));
  await fs.access(helper);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ab-markdown-picker-'));
  const resultFile = path.join(temporary, 'result.json');
  try {
    await exec('/usr/bin/open', ['-W', '-n', helper, '--args', resultFile], { timeout: 600000, maxBuffer: 65536 });
    const result = JSON.parse(await fs.readFile(resultFile, 'utf8'));
    if (result.error) throw new Error(result.error);
    return { directory: result.directory || null };
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
