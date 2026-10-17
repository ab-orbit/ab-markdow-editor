import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);
const MAX_TEXT = 5 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Git is invoked without a shell and inherits the user's credential helpers/SSH agent. */
async function git(cwd, args) {
  try {
    const { stdout } = await exec('git', ['-C', cwd, ...args], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    throw new Error((error.stderr || error.message).trim());
  }
}

/** Reject traversal, Git internals, symlinks and platform-dependent path separators. */
async function safeFile(root, relative, createParents = false) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative)) throw new Error('Caminho inválido.');
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git' || /[\x00-\x1f]/.test(p))) throw new Error('Caminho inválido.');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Links simbólicos não são permitidos.');
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('Pasta inválida.');
      if (i === parts.length - 1 && !stat.isFile()) throw new Error('Arquivo inválido.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (createParents && i < parts.length - 1) await fs.mkdir(current);
    }
  }
  return current;
}

function markdownName(name) {
  if (typeof name !== 'string' || !/\.(md|markdown|mdown)$/i.test(name)) throw new Error('Use um arquivo .md, .markdown ou .mdown.');
}

function imageMime(bytes) {
  if (bytes.length >= 8 && Buffer.from([137,80,78,71,13,10,26,10]).equals(bytes.subarray(0,8))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a/.test(bytes.toString('ascii',0,6))) return 'image/gif';
  if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  throw new Error('Imagem inválida. Use PNG, JPEG, GIF ou WebP.');
}

/** Owns one local checkout; settings stay outside the source and destination repositories. */
export class Repository {
  constructor(stateDir) { this.stateDir = stateDir; this.root = null; this.queue = Promise.resolve(); this.preferences = { askCommitNote: false, autoSave: false, intervalMinutes: 1 }; }

  async initialize() {
    await fs.mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    try {
      const settings = JSON.parse(await fs.readFile(path.join(this.stateDir, 'settings.json'), 'utf8'));
      if (settings.preferences) this.preferences = this.validatePreferences(settings.preferences);
      if (settings.repository) await this.connect(settings.repository);
    }
    catch { /* A moved/deleted checkout is reselected through the UI. */ }
  }

  /** Serialize mutations to avoid concurrent saves, index updates or checkout switches. */
  mutate(action) {
    const next = this.queue.then(action);
    this.queue = next.catch(() => {});
    return next;
  }

  validatePreferences(input) {
    if (!input || typeof input.askCommitNote !== 'boolean' || typeof input.autoSave !== 'boolean' || !Number.isInteger(input.intervalMinutes) || input.intervalMinutes < 1 || input.intervalMinutes > 1440) throw new Error('Use um intervalo inteiro entre 1 e 1440 minutos.');
    return { askCommitNote: input.askCommitNote, autoSave: input.autoSave, intervalMinutes: input.intervalMinutes };
  }

  async persistSettings(root = this.root, preferences = this.preferences) {
    const temporary = path.join(this.stateDir, 'settings.tmp');
    await fs.writeFile(temporary, JSON.stringify({ repository: root, preferences }), { mode: 0o600 });
    await fs.rename(temporary, path.join(this.stateDir, 'settings.json'));
  }

  async updatePreferences(input) {
    const preferences = this.validatePreferences(input);
    await this.persistSettings(this.root, preferences);
    this.preferences = preferences;
    return preferences;
  }

  async connect(directory) {
    if (typeof directory !== 'string' || !directory.trim()) throw new Error('Informe a pasta local do repositório.');
    const expanded = directory.startsWith('~/') ? path.join(process.env.HOME, directory.slice(2)) : directory;
    const resolved = await fs.realpath(path.resolve(expanded));
    const root = await fs.realpath(await git(resolved, ['rev-parse', '--show-toplevel']));
    if (root !== resolved) throw new Error('Selecione a raiz do repositório Git.');
    if (await git(root, ['rev-parse', '--is-bare-repository']) !== 'false') throw new Error('O repositório precisa ter uma cópia de trabalho.');
    await fs.access(root, 6);
    await fs.mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await this.persistSettings(root);
    this.root = root;
    return this.info();
  }

  async clone(url, destination) {
    if (typeof url !== 'string' || !(/^(https:\/\/|ssh:\/\/|git@)/.test(url)) || /[\r\n]/.test(url)) throw new Error('Use uma URL Git HTTPS ou SSH.');
    if (/^https:\/\//.test(url) && new URL(url).username) throw new Error('Use as credenciais locais; não inclua tokens na URL.');
    if (typeof destination !== 'string' || !path.isAbsolute(destination)) throw new Error('Informe um caminho absoluto para a nova pasta.');
    // Git refuses to replace an existing non-empty destination.
    await git(this.stateDir, ['clone', '--', url, destination]);
    return this.connect(destination);
  }

  requireRoot() { if (!this.root) throw new Error('Configure um repositório primeiro.'); return this.root; }

  async info() {
    if (!this.root) return { repository: null, branch: '', status: '' };
    return { repository: this.root, branch: await git(this.root, ['branch', '--show-current']), status: await git(this.root, ['status', '--short']) };
  }

  async list() {
    const root = this.requireRoot();
    const { stdout } = await exec('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 16 * 1024 * 1024 });
    return [...new Set(stdout.split('\0').filter(name => /\.(md|markdown|mdown)$/i.test(name)))].sort();
  }

  /** Most recently modified Markdown files in this checkout, including untracked notes. */
  async recent() {
    const root = this.requireRoot();
    const names = await this.list();
    const notes = [];
    // Bound filesystem concurrency for repositories with many notes.
    for (let offset = 0; offset < names.length; offset += 32) {
      const batch = await Promise.all(names.slice(offset, offset + 32).map(async name => {
        try {
          const filename = await safeFile(root, name);
          const stat = await fs.stat(filename);
          if (!stat.isFile()) return null;
          const file = await fs.open(filename, 'r');
          let text;
          try { const buffer = Buffer.alloc(8192); const {bytesRead} = await file.read(buffer, 0, buffer.length, 0); text = buffer.subarray(0, bytesRead).toString('utf8'); }
          finally { await file.close(); }
          const lines = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').split(/\r?\n/);
          const heading = lines.find(line => /^#{1,6}\s+/.test(line));
          const plain = line => line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>~]/g, '').trim();
          const title = heading ? plain(heading).slice(0, 160) : name.split('/').at(-1);
          const preview = lines.filter(line => line !== heading && line.trim()).map(plain).filter(Boolean).join(' ').slice(0, 180);
          return { name, modifiedAt: stat.mtime.toISOString(), title, preview };
        } catch { return null; } // Deleted files and unsafe symlinks are not openable notes.
      }));
      notes.push(...batch.filter(Boolean));
    }
    return notes.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name)).slice(0, 100);
  }

  async read(name) {
    markdownName(name);
    const root = this.requireRoot();
    const filename = await safeFile(root, name);
    const stat = await fs.stat(filename);
    if (stat.size > MAX_TEXT) throw new Error('O Markdown excede 5 MB.');
    const bytes = await fs.readFile(filename);
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const files = [];
    const warnings = [];
    let total = 0;
    // Existing editor-generated image references are relative to the Markdown document.
    const sources = [...value.matchAll(/!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)].map(match => match[1]);
    for (const source of new Set(sources)) {
      if (/^[a-z]+:/i.test(source) || source.startsWith('#')) continue;
      try {
        const relative = decodeURIComponent(source).replace(/^\.\//, '');
        if (relative.split('/').some(part => part === '..')) throw new Error('Referência fora da pasta do documento.');
        const imagePath = await safeFile(root, path.posix.join(path.posix.dirname(name), relative));
        if ((await fs.stat(imagePath)).size > MAX_IMAGE) throw new Error('Imagem maior que 10 MB.');
        const data = await fs.readFile(imagePath);
        const mime = imageMime(data);
        total += data.length;
        if (total > 40 * 1024 * 1024 || files.length >= 50) throw new Error('Limite de imagens excedido.');
        files.push({ path: relative, data: data.toString('base64'), mime });
      } catch (error) { warnings.push(`${source}: ${error.message}`); }
    }
    return { value, version: digest(bytes), files, warnings };
  }

  async save({ name, value, version, baseVersion, repository: expectedRepository, backupBeforeReplace = false, files = [] }) {
    markdownName(name);
    if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_TEXT) throw new Error('O Markdown excede 5 MB.');
    if (!Array.isArray(files) || files.length > 50) throw new Error('Limite de imagens excedido.');
    const root = this.requireRoot();
    if (expectedRepository && expectedRepository !== root) throw new Error('O repositório mudou. Reconecte a pasta original antes de salvar este rascunho.');
    const filename = await safeFile(root, name, true);
    let previous = null;
    try { previous = digest(await fs.readFile(filename)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Browser imports can identify their original bytes without granting a blind overwrite.
    const matchesImport = previous !== null && typeof baseVersion === 'string' && previous === baseVersion;
    const identicalContent = previous !== null && previous === digest(Buffer.from(value));
    if (previous !== version && !matchesImport && !identicalContent) {
      const kind = previous === null ? 'deleted' : version == null ? 'exists' : 'modified';
      throw Object.assign(new Error(kind === 'exists' ? 'Já existe um arquivo com esse nome. Seu texto continua no editor.' : 'A versão no disco mudou desde a abertura. Seu texto continua no editor.'), {
        code: 'DOCUMENT_CONFLICT', conflict: { name, kind, currentVersion: previous },
      });
    }
    let total = 0;
    const prepared = [];
    for (const file of files) {
      if (typeof file.path !== 'string' || !file.path || file.path.startsWith('/') || typeof file.data !== 'string') throw new Error('Caminho de imagem inválido.');
      const data = Buffer.from(file.data, 'base64');
      total += data.length;
      if (data.length > MAX_IMAGE || total > 40 * 1024 * 1024) throw new Error('Limite de imagens excedido.');
      imageMime(data);
      const relative = `${path.posix.dirname(name)}/${file.path}`.replace(/^\.\//, '');
      const target = await safeFile(root, relative, true);
      try { if (!(await fs.readFile(target)).equals(data)) throw new Error('Já existe outra imagem com este nome.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      prepared.push({ target, data });
    }
    // Image files are immutable; the Markdown is replaced atomically after all validation.
    for (const file of prepared) {
      try { await fs.writeFile(file.target, file.data, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    if (backupBeforeReplace && previous !== null) {
      const backupDirectory = path.join(this.stateDir, 'conflict-backups');
      await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
      const backup = path.join(backupDirectory, `${randomUUID()}.md`);
      await fs.copyFile(filename, backup);
      await fs.chmod(backup, 0o600);
    }
    const temporary = `${filename}.${process.pid}.tmp`;
    try { await fs.writeFile(temporary, value, { flag: 'wx' }); await fs.rename(temporary, filename); }
    finally { await fs.rm(temporary, { force: true }); }
    return { version: digest(Buffer.from(value)) };
  }

  async commit({ name, message, assets = [] }) {
    markdownName(name);
    if (typeof message !== 'string' || !message.trim() || message.length > 1000) throw new Error('Informe uma mensagem de commit de até 1000 caracteres.');
    const root = this.requireRoot();
    // Never accidentally commit unrelated changes that were staged by another tool.
    if (await git(root, ['diff', '--cached', '--name-only'])) throw new Error('Há alterações já preparadas no Git. Faça o commit delas ou retire-as do stage antes de continuar.');
    const paths = [name, ...assets.map(asset => `${path.posix.dirname(name)}/${asset}`.replace(/^\.\//, ''))];
    for (const relative of paths) await safeFile(root, relative);
    await git(root, ['--literal-pathspecs', 'add', '--', ...paths]);
    if (!await git(root, ['diff', '--cached', '--name-only'])) return { commit: null, ...await this.info() };
    try {
      await git(root, ['var', 'GIT_AUTHOR_IDENT']);
      await git(root, ['var', 'GIT_COMMITTER_IDENT']);
      return { commit: await git(root, ['commit', '-m', message]), ...await this.info() };
    } catch (error) {
      // Only our paths were staged. Release them so a failed hook/identity can be retried.
      await git(root, ['--literal-pathspecs', 'reset', '--quiet', '--', ...paths]).catch(() => {});
      throw error;
    }
  }

  /** Save, commit and push inside the mutation queue; retain local progress on Git failures. */
  async saveAndSync(body) {
    const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : `Update ${body.name}`;
    if (message.length > 1000) throw new Error('A nota do commit aceita até 1000 caracteres.');
    const saved = await this.save(body);
    let committed = false;
    let stage = 'commit';
    try {
      const result = await this.commit({ name: body.name, message, assets: (body.files || []).map(file => file.path) });
      committed = !!result.commit;
      stage = 'push';
      await this.push();
      return { ...saved, synced: true, committed };
    } catch (error) {
      // HTTP 200 reports the saved content version as well as the pending Git stage.
      return { ...saved, synced: false, committed, stage, error: error.message };
    }
  }

  async push() {
    const root = this.requireRoot();
    const branch = await git(root, ['branch', '--show-current']);
    if (!branch) throw new Error('Selecione uma branch antes de enviar ao remoto.');
    let upstream = false;
    try { upstream = !!await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); } catch { /* First push creates the upstream on origin. */ }
    await git(root, upstream ? ['push'] : ['push', '-u', 'origin', branch]);
    return this.info();
  }
}
