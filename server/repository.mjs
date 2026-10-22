import welcomeTexts from './welcome-texts.json' with {type:'json'};
import referenceTexts from './reference-texts.json' with {type:'json'};
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { extendDiagramManual } from './diagram-manual.mjs';
import { whiteboardPreview } from './markdown-summary.mjs';
import {transferFolder, transferSnapshot, checkoutStamp, inspectTransfer, copyTransfer} from './repository-transfer.mjs';

const exec = promisify(execFile);
const MAX_TEXT = 5 * 1024 * 1024;
const welcomeImage = 'assets/escriba-welcome-v1.jpg';
const MAX_IMAGE = 10 * 1024 * 1024;
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Git is invoked without a shell and inherits the user's credential helpers/SSH agent. */
async function git(cwd, args) {
  try {
    // Explicit relative paths avoid background macOS directory discovery while
    // retaining ordinary relative Git environment variables inside user hooks.
    // Linked worktrees and clone/init destinations keep Git's normal discovery.
    let explicit = false;
    try { explicit = (await fs.stat(path.join(cwd, '.git'))).isDirectory(); }
    catch { /* A clone or bare destination has no checkout metadata yet. */ }
    const location = explicit ? ['-C', cwd, '--git-dir=.git', '--work-tree=.'] : ['-C', cwd];
    const { stdout } = await exec('git', [...location, ...args], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    throw new Error((error.stderr || error.message).trim());
  }
}

/** Display the destination without exposing credentials embedded in an older Git config. */
function displayRemote(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'ssh:'].includes(url.protocol)) return undefined;
    if (url.protocol === 'https:') url.username = '';
    url.password = ''; url.search = ''; url.hash = '';
    return url.toString();
  } catch { return /^git@[a-z0-9.-]+:[^\s]+$/i.test(value) ? value : undefined; }
}

/** Check containment using path segments, including equal checkout roots. */
function containsCheckout(parent, child) {
  const relative = path.relative(parent, child);
  return !relative || relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
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
  constructor(stateDir) { this.stateDir = stateDir; this.root = null; this.previousRoot = null; this.switchPlans = new Map(); this.queue = Promise.resolve(); this.preferences = { askCommitNote: false, autoSave: false, intervalMinutes: 1, doubleClickToEdit: true }; }

  async initialize() {
    await fs.mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    try {
      const settings = JSON.parse(await fs.readFile(path.join(this.stateDir, 'settings.json'), 'utf8'));
      if (typeof settings.previousRepository === 'string') this.previousRoot = settings.previousRepository;
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
    if(input.doubleClickToEdit!==undefined&&typeof input.doubleClickToEdit!=='boolean')throw new Error('A opção de edição por duplo clique precisa estar ativada ou desativada.');
    return { askCommitNote: input.askCommitNote, autoSave: input.autoSave, intervalMinutes: input.intervalMinutes, doubleClickToEdit: input.doubleClickToEdit ?? this.preferences.doubleClickToEdit ?? true };
  }

  async persistSettings(root = this.root, preferences = this.preferences, previousRepository = this.previousRoot) {
    const temporary = path.join(this.stateDir, 'settings.tmp');
    await fs.writeFile(temporary, JSON.stringify({ repository: root, preferences, previousRepository }), { mode: 0o600 });
    await fs.rename(temporary, path.join(this.stateDir, 'settings.json'));
  }

  async updatePreferences(input) {
    const preferences = this.validatePreferences(input);
    await this.persistSettings(this.root, preferences);
    this.preferences = preferences;
    return preferences;
  }

  async resolveCheckout(directory) {
    if (typeof directory !== 'string' || !directory.trim()) throw new Error('Informe a pasta local do repositório.');
    const expanded = directory.startsWith('~/') ? path.join(process.env.HOME, directory.slice(2)) : directory;
    const resolved = await fs.realpath(path.resolve(expanded));
    const root = await fs.realpath(await git(resolved, ['rev-parse', '--show-toplevel']));
    if (root !== resolved) throw new Error('Selecione a raiz do repositório Git.');
    if (await git(root, ['rev-parse', '--is-bare-repository']) !== 'false') throw new Error('O repositório precisa ter uma cópia de trabalho.');
    await fs.access(root, 6);
    return root;
  }

  async connect(directory) {
    const root = await this.resolveCheckout(directory);
    await fs.mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await this.persistSettings(root, this.preferences, root);
    this.root = root; this.previousRoot = root;
    return this.info();
  }

  async disconnect({ repository: expectedRepository }) {
    if (expectedRepository !== this.root) throw new Error('O repositório mudou. Reabra as configurações.');
    const previous = this.root || this.previousRoot;
    await this.persistSettings(null, this.preferences, previous);
    this.root = null; this.previousRoot = previous; this.switchPlans.clear();
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

  validateRemoteUrl(url) {
    if (typeof url !== 'string' || !/^(https:\/\/|ssh:\/\/|git@)/.test(url) || /[\x00-\x20]/.test(url)) throw new Error('Use uma URL Git HTTPS ou SSH.');
    if (url.startsWith('https://') || url.startsWith('ssh://')) {
      const parsed = new URL(url);
      if (parsed.password || parsed.search || parsed.hash || parsed.protocol === 'https:' && parsed.username) throw new Error('Use as credenciais locais; não inclua tokens ou senhas na URL.');
    }
    return url;
  }

  /** Preview never changes the active checkout or its remote. Clones remain ordinary local folders. */
  async prepareSwitch({ repository: expectedRepository, mode, directory, url, destination, carryFiles = false, folder = '' }) {
    if (expectedRepository !== this.root) throw new Error('O repositório mudou. Reabra as configurações.');
    if (!['local', 'clone', 'remote'].includes(mode) || typeof carryFiles !== 'boolean') throw new Error('Escolha como conectar o novo repositório.');
    folder = transferFolder(folder);
    const source = this.root || this.previousRoot;
    let target;
    if (mode === 'remote') {
      if (!source) throw new Error('Selecione uma pasta local primeiro.');
      target = await this.resolveCheckout(source);
      url = this.validateRemoteUrl(url);
      const branch = await git(target, ['branch', '--show-current']);
      if (!branch) throw new Error('Selecione uma branch antes de trocar o remoto.');
      const refs = await git(target, ['ls-remote', '--heads', '--', url]);
      for (const line of refs.split('\n').filter(Boolean)) {
        const [sha, ref] = line.split(/\s+/);
        if (ref === `refs/heads/${branch}`) {
          try { await git(target, ['merge-base', '--is-ancestor', sha, 'HEAD']); }
          catch { throw new Error('Esse remoto tem um histórico diferente. Escolha “Clonar outra URL” para copiar os arquivos preservando o histórico do destino.'); }
        }
      }
      carryFiles = true; folder = '';
    } else if (mode === 'clone') {
      if (carryFiles && !source) throw new Error('Não há uma pasta anterior para transferir.');
      url = this.validateRemoteUrl(url);
      if (typeof destination !== 'string' || !path.isAbsolute(destination)) throw new Error('Selecione onde criar a nova pasta.');
      if (carryFiles) {
        const proposed = path.join(await fs.realpath(path.dirname(destination)), path.basename(destination));
        if (containsCheckout(source, proposed) || containsCheckout(proposed, source)) throw new Error('Escolha um destino fora da pasta de origem.');
      }
      const contents = await fs.readdir(destination).catch(error => {if(error.code === 'ENOENT')return [];throw error;});
      if (!contents.length) await git(this.stateDir, ['clone', '--', url, destination]);
      target = await this.resolveCheckout(destination);
      if (await git(target, ['config', '--get', 'remote.origin.url']) !== url) throw new Error('A pasta já existe e pertence a outro repositório. Escolha uma nova pasta.');
    } else target = await this.resolveCheckout(directory);
    if (carryFiles && !source) throw new Error('Não há uma pasta anterior para transferir.');
    if (carryFiles && await this.resolveCheckout(source) !== source) throw new Error('A pasta de origem mudou. Reconecte a pasta antes de transferir.');
    if (carryFiles && mode !== 'remote' && !(source === target && !folder)) {
      if (containsCheckout(source, target) || containsCheckout(target, source)) throw new Error('Escolha um destino fora da pasta de origem.');
      if (await git(target, ['status', '--porcelain'])) throw new Error('O destino tem alterações locais. Faça o commit delas antes de transferir a estrutura.');
    }
    const data = carryFiles && mode !== 'remote' ? await inspectTransfer(source, target, folder) : {snapshot: carryFiles ? await transferSnapshot(source) : null, entries: [], conflicts: []};
    const targetStamp = await checkoutStamp(target);
    const branch = await git(target, ['branch', '--show-current']);
    const origin = await git(target, ['remote', 'get-url', 'origin']).catch(() => '');
    let suggestedFolder = path.basename(source || 'notas').replace(/[^\p{L}\p{N}._-]/gu, '-') || 'notas-importadas';
    for (let suffix = 2; ; suffix++) { try { await fs.access(path.join(target, suggestedFolder)); suggestedFolder = `${path.basename(source || 'notas')}-scriba-${suffix}`; } catch(error) { if(error.code !== 'ENOENT') throw error; break; } }
    for (const [key, plan] of this.switchPlans) if (Date.now() - plan.createdAt > 600000) this.switchPlans.delete(key);
    if (this.switchPlans.size >= 16) this.switchPlans.delete(this.switchPlans.keys().next().value);
    const id = randomUUID();
    this.switchPlans.set(id, {id, mode, source, target, url, carryFiles, folder, ...data, targetStamp, branch, origin, expectedRepository: this.root, createdAt: Date.now()});
    return {id, mode, source, target, branch, folder, carryFiles, fileCount:data.snapshot?.files.length || 0, bytes:data.snapshot?.files.reduce((sum,file)=>sum+file.size,0) || 0, identical:data.entries.filter(file=>file.identical).length, conflicts:data.conflicts, skipped:data.snapshot?.skipped || [], suggestedFolder, remote:displayRemote(mode === 'remote' || mode === 'clone' ? url : origin)};
  }

  async applySwitch({ id, publish = false, message = 'Import notes with Scriba' }) {
    const plan = this.switchPlans.get(id);
    if (!plan || Date.now() - plan.createdAt > 600000) throw new Error('A revisão expirou. Revise o destino novamente.');
    if (plan.expectedRepository !== this.root) throw new Error('O repositório mudou. Revise o destino novamente.');
    if (typeof publish !== 'boolean' || typeof message !== 'string' || !message.trim() || message.length > 1000) throw new Error('Informe uma mensagem de commit de até 1000 caracteres.');
    if (plan.conflicts.length) throw new Error('Há arquivos diferentes com o mesmo nome. Escolha uma subpasta para preservar as duas estruturas.');
    if (await checkoutStamp(plan.target) !== plan.targetStamp || await git(plan.target, ['remote', 'get-url', 'origin']).catch(() => '') !== plan.origin) throw new Error('O destino mudou. Revise a transferência novamente.');
    if (await this.resolveCheckout(plan.target) !== plan.target || plan.carryFiles && await this.resolveCheckout(plan.source) !== plan.source) throw new Error('Uma pasta mudou. Revise a transferência novamente.');
    let copied = 0;
    if (plan.mode !== 'remote' && plan.carryFiles) copied = await copyTransfer(plan, this.stateDir);
    if (plan.mode === 'remote') {
      if ((await transferSnapshot(plan.source)).fingerprint !== plan.snapshot.fingerprint) throw new Error('A origem mudou. Revise o destino novamente.');
      const keys = ['remote.origin.url', 'remote.origin.pushurl', `branch.${plan.branch}.remote`, `branch.${plan.branch}.merge`, `branch.${plan.branch}.pushRemote`];
      const previous = await Promise.all(keys.map(key => git(plan.target, ['config', '--local', '--get-all', key]).then(value=>value.split('\n')).catch(()=>[])));
      try {
        const values = [plan.url, plan.url, 'origin', `refs/heads/${plan.branch}`, 'origin'];
        for (let index=0; index<keys.length; index++) await git(plan.target, ['config', '--local', '--replace-all', keys[index], values[index]]);
        await this.connect(plan.target);
      } catch(error) {
        for (let index=0; index<keys.length; index++) { await git(plan.target, ['config', '--local', '--unset-all', keys[index]]).catch(()=>{}); for(const value of previous[index]) await git(plan.target, ['config', '--local', '--add', keys[index], value]); }
        throw error;
      }
    } else await this.connect(plan.target);
    // A reviewed local-only switch must not trigger the guide's automatic first push.
    const library = await this.libraryState();
    const entry = library[plan.target] || {pinned:[], welcomeImageVersion:1};
    entry.referenceAutoSync = publish;
    if (plan.carryFiles && plan.mode !== 'remote') {
      const included = new Set(plan.entries.map(file=>file.name));
      const sourcePins = (library[plan.source]?.pinned || []).filter(name=>included.has(name)).map(name=>plan.folder ? `${plan.folder}/${name}` : name);
      entry.pinned = [...new Set([...(entry.pinned || []), ...sourcePins])];
      const reference = library[plan.source];
      for(const [language,name] of Object.entries(reference?.referenceTexts || {}))if(included.has(name)){
        entry.referenceTexts ||= {};entry.referenceTexts[language]=plan.folder?`${plan.folder}/${name}`:name;
      }
      if (reference?.diagramManualName && included.has(reference.diagramManualName)) {
        entry.diagramManualName = plan.folder ? `${plan.folder}/${reference.diagramManualName}` : reference.diagramManualName;
        entry.diagramManualVersion = reference.diagramManualVersion;
        entry.diagramManualZenUmlVersion = reference.diagramManualZenUmlVersion;
        entry.diagramManualExcalidrawVersion = reference.diagramManualExcalidrawVersion;
      }
    }
    library[plan.target] = entry;
    await this.persistLibrary(library);
    this.switchPlans.clear();
    let synchronization = null;
    if (publish) {
      try { synchronization = await this.sync({repository:plan.target, message, paths:plan.mode !== 'remote' && plan.carryFiles ? plan.entries.map(file=>file.target) : null}); }
      catch(error) { synchronization = {synced:false, stage:'commit', error:error.message}; }
    }
    return {info:await this.info(), copied, identical:plan.entries.filter(file=>file.identical).length, folder:plan.folder, carriedFiles:plan.carryFiles, synchronization};
  }

  requireRoot() { if (!this.root) throw new Error('Configure um repositório primeiro.'); return this.root; }

  async info() {
    if (!this.root) return { repository: null, branch: '', status: '', previousRepository: this.previousRoot };
    // Expose only a canonical GitHub page, never credentials from a remote URL.
    const origin = await git(this.root, ['remote', 'get-url', 'origin']).catch(() => '');
    const match = origin.match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/(?:[^/@]+@)?github\.com\/)([\w.-]+)\/([\w.-]+?)\/?$/i);
    const githubUrl = match ? `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}` : undefined;
    return { repository: this.root, branch: await git(this.root, ['branch', '--show-current']), status: await git(this.root, ['status', '--short']), githubUrl };
  }

  async list() {
    const root = this.requireRoot();
    const { stdout } = await exec('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 16 * 1024 * 1024 });
    return [...new Set(stdout.split('\0').filter(name => /\.(md|markdown|mdown)$/i.test(name)))].sort();
  }

  /** Only local raster references are eligible; remote images are never fetched. */
  localImage(text) {
    for (const match of text.matchAll(/!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g)) {
      const reference = match[1] || match[2];
      if (!/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(reference)) return reference;
    }
    return null;
  }

  async thumbnail(name) {
    markdownName(name);
    const root = this.requireRoot();
    const filename = await safeFile(root, name);
    const note = await fs.open(filename, 'r');
    let text;
    try { const buffer = Buffer.alloc(8192); const {bytesRead} = await note.read(buffer, 0, buffer.length, 0); text = buffer.subarray(0, bytesRead).toString('utf8'); }
    finally { await note.close(); }
    const image = this.localImage(text);
    if (!image) return null;
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(name), decodeURIComponent(image)));
    const target = await safeFile(root, relative);
    const stat = await fs.stat(target);
    if (stat.size > MAX_IMAGE) throw new Error('Imagem maior que 10 MB.');
    const data = await fs.readFile(target);
    return { data: data.toString('base64'), mime: imageMime(data) };
  }

  /** Most recently modified Markdown files in this checkout, including untracked notes. */
  async recent({ all = false } = {}) {
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
          const lines = text.replace(/<!--[\s\S]*?-->/g, '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').split(/\r?\n/);
          const heading = lines.find(line => /^#{1,6}\s+/.test(line));
          const plain = line => line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>~]/g, '').trim();
          const title = heading ? plain(heading).slice(0, 160) : name.split('/').at(-1);
          const preview = whiteboardPreview(text) ?? lines.filter(line => line !== heading && line.trim()).map(plain).filter(Boolean).join(' ').slice(0, 180);
          return { name, modifiedAt: stat.mtime.toISOString(), createdAt: stat.birthtimeMs > 0 ? stat.birthtime.toISOString() : undefined, title, preview, hasImage: !!this.localImage(text) };
        } catch { return null; } // Deleted files and unsafe symlinks are not openable notes.
      }));
      notes.push(...batch.filter(Boolean));
    }
    const sorted = notes.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name));
    return all ? sorted : sorted.slice(0, 100);
  }

  /** Per-checkout pin ordering is private local UI state, never mixed into document commits. */
  async libraryState() {
    try { return JSON.parse(await fs.readFile(path.join(this.stateDir, 'library.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  }

  async persistLibrary(state) {
    const temporary = path.join(this.stateDir, 'library.tmp');
    await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await fs.rename(temporary, path.join(this.stateDir, 'library.json'));
  }

  async library() {
    const root = this.requireRoot();
    const state = await this.libraryState();
    const names = state[root]?.pinned || [];
    const notes = await this.recent({ all: true });
    const byName = new Map(notes.map(note => [note.name, note]));
    return { pinned: names.flatMap(name => byName.has(name) ? [byName.get(name)] : []), recent: notes.filter(note => !names.includes(note.name)).slice(0, 100) };
  }

  /** Seed editable reference notes once per checkout; never replace an existing user file. */
  async initializeLibrary({language} = {}) {
    const root = this.requireRoot();
    const state = await this.libraryState();
    let synchronization;
    const rememberSync = result => {
      if (synchronization?.synced !== false) synchronization = result;
    };
    if(!state[root]&&Object.hasOwn(referenceTexts,language||'')){state[root]={pinned:[],welcomeImageVersion:1};await this.persistLibrary(state);}
    if (!state[root]) {
      let name = 'AB-Markdown-Guia.md';
      for (let suffix = 2; ; suffix++) {
        const filename = await safeFile(root, name);
        try { await fs.access(filename); name = `AB-Markdown-Guia-${suffix}.md`; }
        catch (error) { if (error.code === 'ENOENT') break; throw error; }
      }
      const value = await fs.readFile(new URL('./guide.md', import.meta.url), 'utf8');
      const image = await fs.readFile(new URL('./assets/escriba-welcome-v1.jpg', import.meta.url));
      rememberSync(await this.saveAndSync({ name, value, version: null, files:[{path:welcomeImage, data:image.toString('base64')}], message: 'Add AB Markdown platform guide' }));
      state[root] = { pinned: [name], guideName:name, welcomeImageVersion:1 };
      await this.persistLibrary(state);
    }
    const entry = state[root];
    entry.pinned ||= [];
    if (!entry.welcomeImageVersion) {
      const name = entry.guideName || entry.pinned.find(item => /^AB-Markdown-Guia(?:-\d+)?\.md$/.test(item));
      if (name) {
        try {
          const doc = await this.read(name);
          if (doc.value.startsWith('# AB Markdown — Guia da plataforma') && !doc.value.includes(welcomeImage)) {
            const image = `![Boas-vindas ao Escriba — um escriba egípcio escrevendo em papiro](${welcomeImage})`;
            const value = doc.value.replace(/^(#[^\n]*\n)/, `$1\n${image}\n`);
            const data = await fs.readFile(new URL('./assets/escriba-welcome-v1.jpg', import.meta.url));
            rememberSync(await this.saveAndSync({name, value, version:doc.version, files:[{path:welcomeImage, data:data.toString('base64')}], message:'Add welcome image to AB Markdown guide'}));
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      entry.welcomeImageVersion = 1;
      await this.persistLibrary(state);
    }
    // New clients request one independent reference per language. Older clients retain their legacy API behavior.
    if (Object.hasOwn(referenceTexts, language || '')) {
      entry.referenceTexts ||= {};
      if (!Object.hasOwn(entry.referenceTexts,language)) {
        const cover=await fs.readFile(new URL('../docs/reference-texts/assets/cover.jpg',import.meta.url));
        let directory='';
        for(let index=1;;index++) {
          try { const existing=await fs.readFile(await safeFile(root,`${directory}assets/cover.jpg`)); if(existing.equals(cover))break; directory=`Scriba-References${index===1?'':` (${index})`}/`; }
          catch(error){if(error.code==='ENOENT')break;throw error;}
        }
        const originalName=directory+referenceTexts[language]; let name=originalName,exists=false;
        const value=await fs.readFile(new URL(`../docs/reference-texts/${referenceTexts[language]}`,import.meta.url),'utf8');
        for(let suffix=2;;suffix++) {
          try { const document=await this.read(name); if(document.value===value){exists=true;break;} name=originalName.replace(/\.md$/,` (${suffix}).md`); }
          catch(error){if(error.code==='ENOENT')break;throw error;}
        }
        if(!exists){
          const document={name,value,version:null,files:[{path:'assets/cover.jpg',data:cover.toString('base64')}],message:`Add Scriba reference (${language})`};
          if(entry.referenceAutoSync===false)await this.save(document);else rememberSync(await this.saveAndSync(document));
        }
        entry.referenceTexts[language]=name;
        if(!entry.pinned.includes(name))entry.pinned.unshift(name);
        await this.persistLibrary(state);
      }
      // Welcome files are normal editable notes, seeded once per locale beside the resource guide.
      entry.welcomeTexts ||= {};
      if (!Object.hasOwn(entry.welcomeTexts,language)) {
        const image=await fs.readFile(new URL('../docs/welcome-texts/assets/boas-vindas.jpg',import.meta.url));
        let directory=path.posix.dirname(entry.referenceTexts[language]);
        directory=directory==='.'?'':directory+'/';
        for(let index=1;;index++) {
          try {const existing=await fs.readFile(await safeFile(root,`${directory}assets/boas-vindas.jpg`));if(existing.equals(image))break;directory=`Scriba-Welcome${index===1?'':` (${index})`}/`;}
          catch(error){if(error.code==='ENOENT')break;throw error;}
        }
        const originalName=directory+welcomeTexts[language];let name=originalName,exists=false;
        const authored=await fs.readFile(new URL(`../docs/welcome-texts/${welcomeTexts[language]}`,import.meta.url),'utf8');
        const value=authored.replace(referenceTexts[language],entry.referenceTexts[language]);
        for(let suffix=2;;suffix++) {
          try {const document=await this.read(name);if(document.value===value){exists=true;break;}name=originalName.replace(/\.md$/,` (${suffix}).md`);}
          catch(error){if(error.code==='ENOENT')break;throw error;}
        }
        if(!exists) {
          const document={name,value,version:null,files:[{path:'assets/boas-vindas.jpg',data:image.toString('base64')}],message:`Add Scriba welcome (${language})`};
          if(entry.referenceAutoSync===false)await this.save(document);else rememberSync(await this.saveAndSync(document));
        }
        entry.welcomeTexts[language]=name;
        if(!entry.pinned.includes(name))entry.pinned.unshift(name);
        await this.persistLibrary(state);
      }
      return {...await this.library(),welcomeName:entry.welcomeTexts[language],...(synchronization?{synchronization}:{})};
    }
    // A persisted marker respects later edits, deletion and unpinning. Filename
    // collisions select a new name; an already copied reference is adopted intact.
    if (!entry.diagramManualVersion) {
      let name = 'Scriba-Diagramas.md', exists = false;
      for (let suffix = 2; ; suffix++) {
        try {
          const doc = await this.read(name);
          if (doc.value.includes('<!-- scriba-reference:diagram-manual version=')) { exists = true; break; }
          name = `Scriba-Diagramas-${suffix}.md`;
        } catch (error) { if (error.code === 'ENOENT') break; throw error; }
      }
      if (!exists) {
        const value = await fs.readFile(new URL('../docs/Scriba-Diagramas.md', import.meta.url), 'utf8');
        const document = {name, value, version:null, files:[], message:'Add Scriba diagram reference v1.2.0'};
        // Respect a repository switch that was explicitly reviewed without publishing.
        if (entry.referenceAutoSync === false) await this.save(document);
        else rememberSync(await this.saveAndSync(document));
      }
      const guideName = entry.guideName || entry.pinned.find(item => /^AB-Markdown-Guia(?:-\d+)?\.md$/.test(item));
      const guideIndex = entry.pinned.indexOf(guideName);
      if (!entry.pinned.includes(name)) entry.pinned.splice(guideIndex < 0 ? 0 : guideIndex + 1, 0, name);
      entry.diagramManualVersion = 1;
      entry.diagramManualName = name;
      await this.persistLibrary(state);
    }
    // Extend an existing owned manual once, without replacing user annotations,
    // restoring a deleted note, or undoing a decision to unpin the reference.
    if (entry.diagramManualName && (!entry.diagramManualZenUmlVersion || !entry.diagramManualExcalidrawVersion)) {
      try {
        const doc = await this.read(entry.diagramManualName);
        const bundled = await fs.readFile(new URL('../docs/Scriba-Diagramas.md', import.meta.url), 'utf8');
        const extensions = [!entry.diagramManualZenUmlVersion && 'zenuml-v1', !entry.diagramManualExcalidrawVersion && 'excalidraw-v1'].filter(Boolean);
        const value = extendDiagramManual(doc.value, bundled, extensions);
        if (value !== null) {
          const document = { ...doc, name: entry.diagramManualName, value, message: 'Extend Scriba diagram manual reference sections' };
          if (entry.referenceAutoSync === false) await this.save(document);
          else rememberSync(await this.saveAndSync(document));
        }
        entry.diagramManualZenUmlVersion = 1;
        entry.diagramManualExcalidrawVersion = 1;
        await this.persistLibrary(state);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return { ...await this.library(), ...(synchronization ? {synchronization} : {}) };
  }

  async pin({ name, pinned }) {
    markdownName(name);
    if (typeof pinned !== 'boolean') throw new Error('Estado de fixação inválido.');
    const root = this.requireRoot();
    const filename = await safeFile(root, name); await fs.access(filename);
    const state = await this.libraryState();
    const names = state[root]?.pinned || [];
    if (pinned && !names.includes(name) && names.length >= 100) throw new Error('Limite de 100 notas fixadas.');
    state[root] = { ...state[root], pinned: pinned ? [...new Set([...names, name])] : names.filter(item => item !== name) };
    await this.persistLibrary(state);
    return this.library();
  }

  /** Lightweight source check: no image payloads and no Git mutation. */
  async documentVersion(name) {
    markdownName(name);
    try {
      const filename = await safeFile(this.requireRoot(), name);
      if ((await fs.stat(filename)).size > MAX_TEXT) throw new Error('O Markdown excede 5 MB.');
      return { version: digest(await fs.readFile(filename)) };
    } catch(error) { if (error.code === 'ENOENT') return {version:null}; throw error; }
  }

  async read(name) {
    markdownName(name);
    const root = this.requireRoot();
    const filename = await safeFile(root, name);
    const stat = await fs.stat(filename);
    if (stat.size > MAX_TEXT) throw new Error('O Markdown excede 5 MB.');
    const bytes = await fs.readFile(filename);
    // Keep a leading BOM in the editable source, matching browser file imports and exact fence replacement.
    const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
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
    // A path-limited commit leaves another tool's staged files out of this note commit.
    const paths = [name, ...assets.map(asset => `${path.posix.dirname(name)}/${asset}`.replace(/^\.\//, ''))];
    for (const relative of paths) await safeFile(root, relative);
    await git(root, ['--literal-pathspecs', 'add', '--', ...paths]);
    if (!await git(root, ['--literal-pathspecs', 'diff', '--cached', '--name-only', '--', ...paths])) return { commit: null, ...await this.info() };
    try {
      await git(root, ['var', 'GIT_AUTHOR_IDENT']);
      await git(root, ['var', 'GIT_COMMITTER_IDENT']);
      return { commit: await git(root, ['--literal-pathspecs', 'commit', '--only', '-m', message, '--', ...paths]), ...await this.info() };
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
      const integration = await this.push();
      const recovery = integration.copies.find(copy => copy.source === body.name);
      return { ...saved, name: recovery?.name || body.name, synced: true, committed, integrated: integration.integrated, copies: integration.copies };
    } catch (error) {
      // HTTP 200 reports the saved content version as well as the pending Git stage.
      const recovery = error.integration?.copies?.find(copy => copy.source === body.name);
      return { ...saved, name:recovery?.name || body.name, synced: false, committed, stage, error: error.message, integrated:!!error.integration?.integrated, copies:error.integration?.copies || [] };
    }
  }

  /** Commit the requested checkout changes, integrate remote updates and push normally. */
  async sync({ repository: expectedRepository, message = 'Synchronize local notes', paths = null }) {
    const root = this.requireRoot();
    if (expectedRepository !== root) throw new Error('O repositório mudou. Reabra as configurações antes de sincronizar.');
    if (typeof message !== 'string' || !message.trim() || message.length > 1000) throw new Error('Informe uma mensagem de commit de até 1000 caracteres.');
    if (paths !== null) {if(!Array.isArray(paths)||!paths.every(name=>typeof name==='string'))throw new Error('Lista de arquivos inválida.');for(const name of paths)await safeFile(root,name);}
    if (await git(root, ['diff', '--name-only', '--diff-filter=U'])) throw new Error('Resolva os conflitos do Git antes de sincronizar.');
    // Preserve an index prepared by another tool instead of silently including its files.
    if (await git(root, ['diff', '--cached', '--name-only'])) throw new Error('Há alterações já preparadas no Git. Faça o commit delas ou retire-as do stage antes de sincronizar.');
    let committed = false;
    let staged = false;
    let stage = 'commit';
    try {
      if (paths?.length || await git(root, ['status', '--porcelain'])) {
        await git(root, ['var', 'GIT_AUTHOR_IDENT']);
        await git(root, ['var', 'GIT_COMMITTER_IDENT']);
        staged = true;
        if (paths !== null) {for(let index=0;index<paths.length;index+=100)await git(root, ['--literal-pathspecs', 'add', '--force', '--', ...paths.slice(index,index+100)]);}
        else await git(root, ['add', '--all']);
        if (await git(root, ['diff', '--cached', '--name-only'])) {
          await git(root, ['commit', '-m', message.trim()]);
          committed = true;
        }
      }
      stage = 'push';
      const integration = await this.push();
      return { synced: true, committed, integrated: integration.integrated, copies: integration.copies };
    } catch (error) {
      // Files and completed commits remain available for the next retry.
      if (staged && !committed) await git(root, ['reset', '--quiet']).catch(() => {});
      return { synced: false, committed, stage, error: error.message };
    }
  }

  /** Merge incoming commits without rewriting history, stashing edits or choosing a conflict winner. */
  async integrateRemote(branch, upstream) {
    const root = this.requireRoot();
    const remote = upstream ? await git(root, ['config', '--get', `branch.${branch}.remote`]) : 'origin';
    if (remote !== '.') await git(root, ['fetch', '--no-tags', remote]);
    const target = upstream ? '@{upstream}' : `refs/remotes/origin/${branch}`;
    let remoteHead;
    try { remoteHead = await git(root, ['rev-parse', '--verify', `${target}^{commit}`]); }
    catch (error) { if (upstream) throw error; return false; }
    if (!Number(await git(root, ['rev-list', '--count', `HEAD..${remoteHead}`]))) return false;

    // A merge must start from a clean index/worktree and must never replace another Git operation.
    for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      const filename = path.resolve(root, await git(root, ['rev-parse', '--git-path', marker]));
      const exists = await fs.access(filename).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
      if (exists) throw new Error('Há uma integração do Git em andamento. Finalize ou cancele essa operação antes de sincronizar.');
    }
    // Git preserves unrelated dirty files itself and rejects only paths it would overwrite.
    // Do not require a clean checkout merely because another document/tool has edits.
    try { await git(root, ['merge-base', 'HEAD', remoteHead]); }
    catch { throw new Error('Os históricos local e remoto não têm uma origem comum. Selecione outro repositório nas configurações para transferir as notas com segurança.'); }
    const directory = await fs.mkdtemp(path.join(this.stateDir, 'integration-'));
    const workspace = path.join(directory, 'checkout');
    let attached = false;
    try {
      // Merge in a detached worktree so another tool's index and dirty files stay intact.
      await git(root, ['worktree', 'add', '--detach', workspace, 'HEAD']);
      attached = true;
      const result = await this.mergeRemoteInto(workspace, remoteHead);
      const head = await git(workspace, ['rev-parse', 'HEAD']);
      // Fast-forward only: Git refuses any overwrite of dirty/untracked checkout files.
      await git(root, ['merge', '--ff-only', '--no-edit', head]);
      return result;
    } finally {
      if (attached) await git(root, ['worktree', 'remove', '--force', workspace]).catch(() => {});
      await fs.rm(directory, {recursive:true, force:true});
    }
  }

  /** Integrate a remote commit only inside the disposable, detached merge workspace. */
  async mergeRemoteInto(root, remoteHead) {
    const copies = [];
    try {
      await git(root, ['merge', '--no-edit', '--ff', '-m', 'Merge remote notes with Scriba', remoteHead]);
    } catch (error) {
      const conflicts = await git(root, ['-c', 'core.quotepath=false', 'diff', '--name-only', '--diff-filter=U']);
      const merging = await git(root, ['rev-parse', '--verify', 'MERGE_HEAD']).then(() => true, () => false);
      // Conflicting Markdown versions are kept as two ordinary notes, never conflict markers.
      // Other file types remain untouched and the merge is aborted below.
      if (merging && conflicts && conflicts.split('\n').every(name => /\.(md|markdown|mdown)$/i.test(name))) {
        try {
          const entries = (await git(root, ['ls-files', '--unmerged', '-z'])).split('\0').filter(Boolean);
          if (entries.some(entry => !/^100(644|755) /.test(entry))) throw new Error('Unsupported conflict entry');
          const tag = `${new Date().toISOString().slice(0,10)}-${randomUUID().slice(0,8)}`;
          for (const name of conflicts.split('\n')) {
            await safeFile(root, name);
            const local = entries.some(entry => entry.split('\t')[0].endsWith(' 2') && entry.slice(entry.indexOf('\t')+1) === name);
            const incoming = entries.some(entry => entry.split('\t')[0].endsWith(' 3') && entry.slice(entry.indexOf('\t')+1) === name);
            if (local) {
              // execFile's Buffer preserves every byte, including trailing newlines and Unicode.
              const {stdout} = await exec('git', ['-C', root, 'show', `:2:${name}`], {encoding:'buffer', maxBuffer:MAX_TEXT, timeout:120000});
              const copy = name.replace(/(\.(?:md|markdown|mdown))$/i, ` (local ${tag})$1`);
              const filename = await safeFile(root, copy, true);
              await fs.writeFile(filename, stdout, {flag:'wx'});
              await git(root, ['--literal-pathspecs', 'add', '--', copy]);
              copies.push({source:name,name:copy});
            }
            if (incoming) {
              await git(root, ['--literal-pathspecs', 'checkout', '--theirs', '--', name]);
              await git(root, ['--literal-pathspecs', 'add', '--', name]);
            } else await git(root, ['--literal-pathspecs', 'rm', '--', name]);
          }
          await git(root, ['commit', '--no-edit']);
          return {copies};
        } catch {
          // Both original commits remain intact if finishing the merge fails; abort only our merge.
        }
      }
      // Only abort the merge started above. Never reset the checkout or discard either commit.
      if (merging) {
        try { await git(root, ['merge', '--abort']); }
        catch { throw new Error('A integração do Git foi interrompida e precisa ser revisada na pasta local. Os commits dos dois lados continuam preservados.'); }
      }
      if (conflicts) throw new Error(`Não foi possível integrar estes arquivos: ${conflicts.split('\n').join(', ')}. Suas versões foram preservadas. Continue editando ou exporte uma cópia; a sincronização será tentada novamente.`);
      throw error;
    }
    return {copies};
  }

  async push() {
    const root = this.requireRoot();
    const branch = await git(root, ['branch', '--show-current']);
    if (!branch) throw new Error('Selecione uma branch antes de enviar ao remoto.');
    let upstream = false;
    try { upstream = !!await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']); } catch { /* First push creates the upstream on origin. */ }
    let integration = await this.integrateRemote(branch, upstream);
    const copies = [...(integration?.copies || [])];
    const args = upstream ? ['push'] : ['push', '-u', 'origin', branch];
    try {
    try { await git(root, args); }
    catch (error) {
      // Another device may publish between fetch and push. Retry once only if new commits arrived.
      const retry = await this.integrateRemote(branch, upstream);
      if (!retry) throw error;
      integration = retry;copies.push(...retry.copies);
      await git(root, args);
    }
    } catch (error) {
      // Local integration may have succeeded before transport failed. Keep the editor
      // attached to its preserved copy rather than to the incoming canonical document.
      error.integration = {integrated:!!integration,copies};
      throw error;
    }
    return {...await this.info(), integrated:!!integration, copies};
  }
}
