import { t } from './i18n';
import { useEffect, useState } from "react";
import { isIosApp, iosBridge } from './lib/ios';
import { FolderGit2, RefreshCw, CircleCheck, ChevronRight, Search } from "lucide-react";
import {
  githubJson,
  githubSelection,
  githubStatus,
  setGitHubSelection,
  type GitHubStatus,
} from "./lib/github";
interface Repository {
  /** Canonical owner/repository identifier shown in the selector. */
  fullName: string;
  /** Repository branch used by the initial integration. */
  defaultBranch: string;
  /** Privacy label, independent of the authorized write permission. */
  private: boolean;
}
/** Account connection and repository authorization are independent of local folder storage. */
export function GitHubSettings({
  canSwitch,
  onChange,
}: {
  canSwitch: () => boolean;
  onChange: () => Promise<void>;
}) {
  const [status, setStatus] = useState<GitHubStatus | null>(null),
    [repositories, setRepositories] = useState<Repository[]>([]),
    [folder, setFolder] = useState(t("scriba")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [token, setToken] = useState("");
  const [repositoryQuery, setRepositoryQuery] = useState("");
  const [choosing, setChoosing] = useState(false);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const matchingRepositories = repositories.filter(item => normalize(item.fullName).includes(normalize(repositoryQuery.trim())))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "en", {numeric: true, sensitivity: "base"}));
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? t(error.message) : String(error));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const info = await githubStatus();
    setStatus(info);
    if (info.selection) {
      setFolder(info.selection.folder);
    }
    if (info.connected)
      setRepositories(await githubJson<Repository[]>("repositories"));
  }
  useEffect(() => {
    void run(refresh);
  }, []);
  const active = githubSelection();
  async function disconnect() {
    if (!canSwitch()) return;
    await run(async () => {
      await githubJson("logout", {});
      setGitHubSelection(null);
      await onChange();
      await refresh();
    });
  }
  async function selectRepository(fullName: string) {
    if (busy || !canSwitch()) return;
    await run(async () => {
      // Selection activates the destination; no separate confirmation step is needed.
      const selection = await githubJson<NonNullable<GitHubStatus["selection"]>>("select", {fullName, folder});
      setGitHubSelection(selection);
      setChoosing(false);
      await onChange();
      await refresh();
    });
  }
  if (active && !choosing) return <div className="storage-github-active">
    <div className="storage-current"><FolderGit2 size={22} aria-hidden="true"/><div><strong>GitHub</strong><p className="storage-path">{active.fullName}</p></div></div>
    <dl className="storage-details"><div><dt>{t('Branch')}</dt><dd>{active.branch}</dd></div><div><dt>{t('Pasta das notas')}</dt><dd>{active.folder || '/'}</dd></div></dl>
    <p>{t('Salvamento ativo no GitHub.')}</p>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy} onClick={() => {setRepositoryQuery(""); setChoosing(true); void run(refresh);}}>{t("Trocar repositório")}</button>
    <button className="storage-disconnect" disabled={busy} onClick={() => void disconnect()}>{t('Desconectar GitHub')}</button>
  </div>;
  return (
    <section className="repository" aria-label={t("GitHub remoto")}><h3><FolderGit2 size={20} />{t("GitHub · todos os dispositivos")}</h3><p>{t("Conecte sua conta e selecione onde guardar suas notas.")}</p>{error && <p role="alert">{error}</p>}{!status && !error && <p>{t("Verificando conexão GitHub…")}</p>}{status && !status.connected && (
        <>{status.configured ? (
            <a className="settings-action" href="/github/login" onClick={isIosApp ? event => {event.preventDefault();void run(async()=>{await iosBridge.githubLogin();await refresh();});} : undefined}>{t("Conectar GitHub")}</a>
          ) : (
            <p>{t("A conexão com um clique aguarda a ativação do GitHub App pela administração. Enquanto isso, você pode conectar usando um token do seu repositório.")}</p>
          )}<details><summary>{t("Conectar com token de acesso")}</summary><p>{t("Crie um token fine-grained limitado ao repositório desejado, com Contents: leitura e escrita. Ele fica criptografado na sessão do servidor; não é guardado no navegador.")}</p><a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
            >{t("Criar token no GitHub")}</a><form
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSwitch()) return;
                void run(async () => {
                  await githubJson("token", { token });
                  setToken("");
                  await refresh();
                });
              }}
            ><label>{t("Token GitHub")}<input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                /></label><button disabled={busy}>{t("Conectar com token")}</button></form></details></>
      )}{status?.connected && (
        <div className="github-repository-picker" aria-busy={busy}>
          <p><span className="connection-status" data-state="connected"><CircleCheck size={16} aria-hidden="true"/>{t("Conectado como")}{' '}<strong>{status.user?.login}</strong></span></p>
          <h4>{t("Selecione um repositório")}</h4>
          <p>{t("Ao selecionar, suas notas serão salvas automaticamente na pasta indicada.")}</p>
          <label className="repository-search"><Search size={18} aria-hidden="true"/><input type="search" autoFocus autoComplete="off" aria-label={t("Buscar repositório")} placeholder={t("Organização ou nome do repositório")} value={repositoryQuery} disabled={busy} onChange={event => setRepositoryQuery(event.target.value)}/></label>
          <ul className="github-repository-list" aria-label={t("Repositório GitHub")}>
            {matchingRepositories.map(item => <li key={item.fullName}><button type="button" disabled={busy} onClick={() => void selectRepository(item.fullName)}><span><strong>{item.fullName}</strong><small>{item.private ? t("Privado") : t("Público")}</small></span><ChevronRight size={18} aria-hidden="true"/></button></li>)}
          </ul>
          {!matchingRepositories.length && !busy && <p role="status">{t("Nenhum repositório encontrado.")}</p>}
          {busy && <p role="status">{t("Carregando…")}</p>}
          <details className="github-advanced"><summary>{t("Opções avançadas")}</summary>
            <label>{t("Pasta das notas")}<input value={folder} disabled={busy} onChange={event => setFolder(event.target.value)} placeholder="scriba"/></label>
            <p>{t("Use scriba para uma pasta dedicada. Deixe vazio para ler as notas desde a raiz do repositório. Seus rascunhos do navegador continuam separados por destino.")}</p>
            <div className="settings-actions">{status.installUrl && <a className="settings-action" href={status.installUrl} target="_blank" rel="noopener noreferrer">{t("Autorizar repositórios no GitHub")}</a>}
              <button type="button" disabled={busy} onClick={() => void run(refresh)}><RefreshCw size={18}/>{t("Atualizar repositórios")}</button>
            </div>
            <button type="button" disabled={busy} onClick={() => void disconnect()}>{t("Desconectar GitHub")}</button>
          </details>
          {active && <button type="button" disabled={busy} onClick={() => setChoosing(false)}>{t("Cancelar")}</button>}
        </div>
      )}<p>{t("Alterações offline ficam neste dispositivo e são sincronizadas automaticamente ao reconectar.")}</p></section>
  );
}
