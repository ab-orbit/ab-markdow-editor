import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createReadStream, constants} from 'node:fs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
const exec = promisify(execFile);

/** Validate a repository-relative path before touching either checkout. */
export function transferFolder(value = '') {
  if (typeof value !== 'string' || path.isAbsolute(value) || value.includes('\\')) throw new Error('Use uma pasta relativa dentro do repositório.');
  const normalized = value.replace(/\/$/, '');
  if (normalized && normalized.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git' || /[\x00-\x1f]/.test(part))) throw new Error('Pasta de importação inválida.');
  return normalized;
}
async function safePath(root, relative) {
  transferFolder(relative);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${relative}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}
async function hashFile(filename) {
  const hash=createHash('sha256');for await(const bytes of createReadStream(filename))hash.update(bytes);return hash.digest('hex');
}
/** Include working files and untracked notes; Git metadata and ignored files stay out. */
export async function transferSnapshot(root) {
  const {stdout}=await exec('git',['-C',root,'ls-files','-z','--cached','--others','--exclude-standard'],{maxBuffer:16*1024*1024});
  const files=[],skipped=[];
  for(const name of [...new Set(stdout.split('\0').filter(Boolean))].sort()) {
    transferFolder(name);
    let filename,stat;
    try {filename=await safePath(root,name);stat=await fs.lstat(filename);}
    catch(error){if(error.code==='ENOENT')continue;if(error.message.startsWith('Link simbólico')){skipped.push(name);continue;}throw error;}
    if(!stat.isFile()){skipped.push(name);continue;}
    files.push({name,size:stat.size,modifiedAt:stat.mtimeMs,hash:await hashFile(filename)});
  }
  return {files,skipped,fingerprint:createHash('sha256').update(JSON.stringify({files,skipped})).digest('hex')};
}
export async function checkoutStamp(root) {
  const command=async(...args)=>(await exec('git',['-C',root,...args],{maxBuffer:16*1024*1024})).stdout;
  const head=await command('rev-parse','--verify','HEAD').catch(()=>'');
  return createHash('sha256').update(head).update(await command('status','--porcelain=v1','-z','--untracked-files=all')).digest('hex');
}
export async function inspectTransfer(source,target,folder) {
  const snapshot=await transferSnapshot(source),entries=[],conflicts=[];
  for(const file of snapshot.files) {
    const name=folder?`${folder}/${file.name}`:file.name;
    let identical=false;
    try {const destination=await safePath(target,name),stat=await fs.lstat(destination);identical=stat.isFile()&&await hashFile(destination)===file.hash;if(!identical)conflicts.push(name);}
    catch(error){if(error.code!=='ENOENT'){if(error.code==='ENOTDIR'||error.message.startsWith('Link simbólico'))conflicts.push(name);else throw error;}}
    entries.push({...file,target:name,identical});
  }
  return {snapshot,entries,conflicts};
}
/** Stage verified bytes privately, then create destination files exclusively, never overwrite. */
export async function copyTransfer(plan,stateDir) {
  const staging=await fs.mkdtemp(path.join(stateDir,'transfer-'));
  const created=[],directories=[];
  try {
    if((await transferSnapshot(plan.source)).fingerprint!==plan.snapshot.fingerprint)throw new Error('Os arquivos de origem mudaram. Revise a transferência novamente.');
    for(let index=0;index<plan.entries.length;index++) {
      const entry=plan.entries[index];if(entry.identical)continue;
      const staged=path.join(staging,String(index));await fs.copyFile(await safePath(plan.source,entry.name),staged);
      if(await hashFile(staged)!==entry.hash)throw new Error('Um arquivo mudou durante a cópia. Revise a transferência novamente.');
    }
    if(await checkoutStamp(plan.target)!==plan.targetStamp)throw new Error('O destino mudou. Revise a transferência novamente.');
    // Recheck identical/absent paths as well as Git status before the first write.
    for (const entry of plan.entries) {
      try {
        const target = await safePath(plan.target, entry.target);
        const stat = await fs.lstat(target);
        if (!entry.identical || !stat.isFile() || await hashFile(target) !== entry.hash) throw new Error('Um arquivo do destino mudou. Revise a transferência novamente.');
      } catch(error) {
        if (error.code === 'ENOENT' && !entry.identical) continue;
        if (error.code === 'ENOENT') throw new Error('Um arquivo do destino foi removido. Revise a transferência novamente.');
        throw error;
      }
    }
    for(let index=0;index<plan.entries.length;index++) {
      const entry=plan.entries[index];if(entry.identical)continue;
      const destination=await safePath(plan.target,entry.target);
      let parent=plan.target;
      for(const part of entry.target.split('/').slice(0,-1)) {
        parent=path.join(parent,part);
        try {await fs.mkdir(parent);directories.push(parent);}catch(error){if(error.code!=='EEXIST')throw error;}
        if((await fs.lstat(parent)).isSymbolicLink())throw new Error('O destino contém um link simbólico.');
      }
      await fs.copyFile(path.join(staging,String(index)),destination,constants.COPYFILE_EXCL);
      created.push({filename:destination,hash:entry.hash,ino:(await fs.stat(destination)).ino});
      await fs.utimes(destination, new Date(entry.modifiedAt), new Date(entry.modifiedAt));
    }
    return created.length;
  } catch(error) {
    // Roll back only files created by this transfer that nobody has subsequently changed.
    for(const file of created.reverse())try {if((await fs.lstat(file.filename)).ino===file.ino&&await hashFile(file.filename)===file.hash)await fs.rm(file.filename);}catch{}
    for(const directory of directories.reverse())await fs.rmdir(directory).catch(()=>{});
    throw error;
  } finally {await fs.rm(staging,{recursive:true,force:true});}
}
