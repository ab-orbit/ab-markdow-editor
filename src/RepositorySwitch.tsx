import { t, currentLocale } from './i18n';
import {useState} from 'react';
import {ArrowRightLeft, CircleAlert, FolderOpen, GitBranch, X} from 'lucide-react';

export interface RepositorySwitchResult {
  /** Active checkout selected only after the reviewed operation succeeds. */
  info: {repository: string | null; branch: string; status: string; githubUrl?: string; previousRepository?: string | null};
  /** Newly copied files, excluding already identical destination files. */
  copied: number;
  /** Source files already present with the same bytes. */
  identical: number;
  /** Optional subfolder preserving the complete relative note/image structure. */
  folder: string;
  /** Whether the open document should follow its transferred relative path. */
  carriedFiles: boolean;
  /** Commit/push result; null when the user selected local connection only. */
  synchronization: {synced: boolean; stage?: 'commit' | 'push'; error?: string} | null;
}
interface Preview {
  /** Expiring server-owned plan; confirmation cannot edit its paths. */
  id: string;
  /** Canonical local source and destination shown before confirmation. */
  source: string | null;
  target: string;
  /** Destination branch and optional import folder. */
  branch: string;
  folder: string;
  /** Explicit same-folder remote change, when requested. */
  remote?: string;
  /** Source file count and total bytes, including identical files. */
  fileCount: number;
  bytes: number;
  /** Count of files that need no additional copy. */
  identical: number;
  /** Conflicting paths must be resolved before confirmation. */
  conflicts: string[];
  /** Symlinks/submodules excluded from copying. */
  skipped: string[];
  /** Available subfolder alternative that keeps image links intact. */
  suggestedFolder: string;
  /** Whether any structure will be carried from the original folder. */
  carryFiles: boolean;
}
interface Props {
  /** Configured checkout; null means synchronization is disconnected. */
  repository: string | null;
  /** Last checkout remains available for reconnecting or copying after disconnect. */
  source: string | null;
  /** Shared host operation lock and busy state prevent overlapping writes. */
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  /** Local authenticated API transport; credentials never enter this component. */
  request: <T>(route: string, body?: unknown) => Promise<T>;
  /** Honor the existing commit-message preference before publishing a transfer. */
  askCommitNote: boolean;
  /** Host preserves the open draft and refreshes the newly selected library. */
  onComplete: (result: RepositorySwitchResult) => Promise<void>;
  /** Closing this form never changes the active repository. */
  onCancel: () => void;
}
function transferSize(bytes: number): string {
  const number = new Intl.NumberFormat(currentLocale(), {maximumFractionDigits: 1});
  return bytes >= 1048576 ? `${number.format(bytes / 1048576)} MB` : bytes >= 1024 ? `${number.format(bytes / 1024)} KB` : `${bytes} B`;
}
/** A reviewed connection change, with a separate copy decision and no implicit overwrite. */
export function RepositorySwitch({repository, source, busy, run, request, askCommitNote, onComplete, onCancel}: Props) {
  const [mode,setMode]=useState<'local'|'clone'|'remote'>('local');
  const [directory,setDirectory]=useState(repository ? "" : source || "");
  const [url,setUrl]=useState("");
  const [destination,setDestination]=useState("");
  const [carryFiles,setCarryFiles]=useState(!!source);
  const [folder,setFolder]=useState("");
  const [publish,setPublish]=useState(!!source);
  const [message,setMessage]=useState(askCommitNote ? "" : t("Import notes with Scriba"));
  const [preview,setPreview]=useState<Preview|null>(null);
  const [clonedTarget,setClonedTarget]=useState("");
  const [error,setError]=useState("");
  function execute(action:()=>Promise<void>) {
    return run(async()=>{setError("");try{await action();}catch(cause){if(cause instanceof DOMException&&cause.name==='AbortError')return;setError(cause instanceof Error?t(cause.message):t("Não foi possível trocar o destino. Seus arquivos originais continuam preservados."));}});
  }
  async function pick(clone: boolean) {
    const result=await request<{directory:string|null}>('pick-folder',{});
    if(!result.directory)return;
    if(clone){const name=url.trim().split('/').at(-1)?.replace(/\.git$/,"").replace(/[^\p{L}\p{N}._-]/gu,'-')||t("notas");setDestination(`${result.directory}/${name}`);}else setDirectory(result.directory);
    setPreview(null);setClonedTarget("");
  }
  async function review(nextFolder=folder) {
    const result=await request<Preview>('repository/prepare-switch',{repository,mode:mode==='clone'&&clonedTarget?'local':mode,directory:clonedTarget||directory,url,destination,carryFiles,folder:nextFolder});
    if(mode==='clone')setClonedTarget(result.target);
    setFolder(nextFolder);setPreview(result);
  }
  return <section className="repository-switch" aria-labelledby="repository-switch-title"><div className="repository-switch-heading"><h3 id="repository-switch-title">{repository?t("Trocar repositório"):t("Conectar repositório")}</h3><button type="button" aria-label={t("Cancelar troca de repositório")} disabled={busy} onClick={onCancel}><X size={18}/></button></div><p>{t("Escolha o destino e revise antes de aplicar. Os arquivos da pasta original continuam preservados.")}</p>{error&&<p role="alert" className="repository-switch-error"><CircleAlert size={18}/><span>{error}</span></p>}<form onSubmit={event=>{event.preventDefault();void execute(()=>review());}}><label>{t("Como conectar")}<select value={mode} disabled={busy} onChange={event=>{const next=event.target.value as typeof mode;setMode(next);setPreview(null);setClonedTarget("");setPublish(next==='remote'||carryFiles);}}><option value="local">{t("Outra pasta já clonada")}</option><option value="clone">{t("Clonar outra URL")}</option>{source&&<option value="remote">{t("Outra URL, mantendo esta pasta")}</option>}</select></label>{mode==='local'?<div className="repository-switch-path"><label>{t("Pasta local do repositório")}<input required value={directory} placeholder={t("Selecione a pasta do novo repositório")} onChange={event=>{setDirectory(event.target.value);setPreview(null);}}/></label><button type="button" disabled={busy} onClick={()=>void execute(()=>pick(false))}><FolderOpen size={18}/>{t("Selecionar pasta")}</button></div>:<><label>{t("URL HTTPS ou SSH")}<input required value={url} placeholder={t("git@github.com:usuario/repositorio.git")} onChange={event=>{setUrl(event.target.value);setPreview(null);setClonedTarget("");}}/></label>{mode==='clone'?<div className="repository-switch-path"><label>{t("Nova pasta local")}<input required value={destination} placeholder={t("Selecione onde criar a pasta")} onChange={event=>{setDestination(event.target.value);setPreview(null);setClonedTarget("");}}/></label><button type="button" disabled={busy} onClick={()=>void execute(()=>pick(true))}><FolderOpen size={18}/>{t("Selecionar onde clonar")}</button></div>:<p className="repository-switch-source">{t("A pasta")}{' '}<strong>{source}</strong>{' '}{t("continua a mesma, com seus arquivos e histórico. Um remoto com histórico diferente deve ser clonado pela opção acima.")}</p>}</>}{source&&mode!=='remote'&&<><label className="check-option"><input type="checkbox" checked={carryFiles} onChange={event=>{setCarryFiles(event.target.checked);setPublish(event.target.checked);setPreview(null);}}/>{t("Levar notas, imagens e subpastas atuais")}</label><p className="repository-switch-source">{t("Origem:")}{' '}{source}{t(". Copia os arquivos já gravados, preservando os originais e o histórico do destino. O documento aberto permanece no editor.")}</p>{carryFiles&&<label>{t("Pasta dentro do novo repositório")}<input value={folder} placeholder={t("Raiz do repositório")} onChange={event=>{setFolder(event.target.value);setPreview(null);}}/></label>}</>}<button type="submit" disabled={busy}><ArrowRightLeft size={18}/>{busy?t("Aguarde…"):t("Revisar troca")}</button></form>{preview&&<div className="repository-switch-preview" aria-label={t("Revisão da troca")}><h4>{t("Destino da troca")}</h4><dl><div><dt>{t("Pasta")}</dt><dd>{preview.target}{preview.folder&&`/${preview.folder}`}</dd></div><div><dt>{t("Branch")}</dt><dd><GitBranch size={16}/>{preview.branch||t("Sem branch")}</dd></div>{preview.remote&&<div><dt>{t("Remoto")}</dt><dd>{preview.remote}</dd></div>}<div><dt>{t("Estrutura")}</dt><dd>{preview.carryFiles?t("{0} {1} · {2}{3}", preview.fileCount, preview.fileCount===1?t("arquivo"):t("arquivos"), transferSize(preview.bytes), preview.identical?` · ${preview.identical} já idênticos`:''):t("Usar somente os arquivos do destino")}</dd></div></dl>{preview.skipped.length>0&&<p>{preview.skipped.length}{' '}{t("links simbólicos ou submódulos não serão copiados. Arquivos ignorados pelo Git e a pasta .git ficam fora da transferência.")}</p>}{preview.conflicts.length>0?<><p className="repository-switch-warning"><CircleAlert size={18}/>{preview.conflicts.length===1?t("1 arquivo tem"):t("{0} arquivos têm", preview.conflicts.length)}{' '}{t("conteúdo diferente com o mesmo nome.")}</p><ul>{preview.conflicts.slice(0,30).map(name=><li key={name}>{name}</li>)}</ul><p>{t("Copie a estrutura para uma subpasta para preservar as duas versões e os vínculos entre notas e imagens.")}</p><button type="button" disabled={busy} onClick={()=>void execute(()=>review(preview.suggestedFolder))}>{t("Usar subpasta “")}{preview.suggestedFolder}”</button></>:<form onSubmit={event=>{event.preventDefault();void execute(async()=>{const result=await request<RepositorySwitchResult>('repository/apply-switch',{id:preview.id,publish,message:message.trim()||t("Import notes with Scriba")});await onComplete(result);});}}><label className="check-option"><input type="checkbox" checked={publish} onChange={event=>setPublish(event.target.checked)}/>{t("Criar commit e enviar ao remoto")}</label>{publish&&<label>{t("Mensagem do commit")}<input required maxLength={1000} value={message} placeholder={t("Descreva a transferência")} onChange={event=>setMessage(event.target.value)}/></label>}<button className="primary" type="submit" disabled={busy}>{publish?(preview.carryFiles&&preview.source!==preview.target?t("Transferir e sincronizar"):t("Conectar e sincronizar")):(preview.carryFiles&&preview.source!==preview.target?t("Transferir e conectar"):t("Conectar repositório"))}</button></form>}</div>}</section>;
}
