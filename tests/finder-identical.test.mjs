import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Repository } from '../server/repository.mjs';

const exec = promisify(execFile);
const digest = text => createHash('sha256').update(text).digest('hex');

test('a Finder document identical to a repository note (or its imported copy) resolves to that note', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scriba-identical-'));
  try {
    await exec('git', ['init', '-q', root]);
    await fs.writeFile(path.join(root, 'relatorio.md'), '# Editado depois');
    await fs.writeFile(path.join(root, 'relatorio (2).md'), '# Original R$10');
    await fs.writeFile(path.join(root, 'outro.md'), '# Original R$10');
    await fs.mkdir(path.join(root, 'pasta'));
    await fs.writeFile(path.join(root, 'pasta', 'nota.md'), '# Na pasta');
    const repository = new Repository(root); repository.root = root;
    assert.equal(await repository.findIdentical('relatorio.md', digest('# Original R$10')), 'relatorio (2).md');
    assert.equal(await repository.findIdentical('relatorio.md', digest('# Editado depois')), 'relatorio.md');
    assert.equal(await repository.findIdentical('nota.md', digest('# Na pasta')), 'pasta/nota.md');
    assert.equal(await repository.findIdentical('relatorio.md', digest('# Outro conteúdo')), null, 'different bytes never match');
    assert.equal(await repository.findIdentical('x.md', digest('# Original R$10')), null, 'other base names never match');
    assert.equal(await repository.findIdentical('rel(atorio.md', digest('x')), null, 'regex metacharacters are literal');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
