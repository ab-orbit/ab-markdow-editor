import { useEffect, useId, useState } from "react";
import { FolderGit2, RefreshCw, CircleCheck } from "lucide-react";
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
    [repo, setRepo] = useState(""),
    [folder, setFolder] = useState("scriba"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [token, setToken] = useState("");
  const suggestionsId = useId();
  const [repositoryQuery, setRepositoryQuery] = useState("");
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const collator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
  });
  const matchingRepositories = [...repositories]
    .filter((item) =>
      normalize(item.fullName).includes(normalize(repositoryQuery.trim())),
    )
    .sort(
      (a, b) =>
        collator.compare(a.fullName.split("/")[0], b.fullName.split("/")[0]) ||
        collator.compare(a.fullName.split("/")[1], b.fullName.split("/")[1]),
    );
  const repositoryGroups = new Map<string, Repository[]>();
  for (const item of matchingRepositories) {
    const owner = item.fullName.split("/")[0];
    repositoryGroups.set(owner, [...(repositoryGroups.get(owner) || []), item]);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const info = await githubStatus();
    setStatus(info);
    if (info.selection) {
      setRepo(info.selection.fullName);
      setFolder(info.selection.folder);
    }
    if (info.connected)
      setRepositories(await githubJson<Repository[]>("repositories"));
  }
  useEffect(() => {
    void run(refresh);
  }, []);
  return (
    <section className="repository" aria-label="GitHub remoto">
      <h3>
        <FolderGit2 size={20} /> GitHub · todos os dispositivos
      </h3>
      <p>
        Conecte sua conta e escolha um repositório para ler e salvar notas no
        iPhone, iPad e computador. Cada salvamento cria um commit com o Markdown
        e suas imagens.
      </p>
      {error && <p role="alert">{error}</p>}
      {!status && <p>Verificando conexão GitHub…</p>}
      {status && !status.connected && (
        <>
          {status.configured ? (
            <a className="settings-action" href="/github/login">
              Conectar GitHub
            </a>
          ) : (
            <p>
              A conexão com um clique aguarda a ativação do GitHub App pela
              administração. Enquanto isso, você pode conectar usando um token
              do seu repositório.
            </p>
          )}
          <details>
            <summary>Conectar com token de acesso</summary>
            <p>
              Crie um token fine-grained limitado ao repositório desejado, com
              Contents: leitura e escrita. Ele fica criptografado na sessão do
              servidor; não é guardado no navegador.
            </p>
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              Criar token no GitHub
            </a>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSwitch()) return;
                void run(async () => {
                  await githubJson("token", { token });
                  setToken("");
                  await refresh();
                });
              }}
            >
              <label>
                Token GitHub
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                />
              </label>
              <button disabled={busy}>Conectar com token</button>
            </form>
          </details>
        </>
      )}
      {status?.connected && (
        <>
          <p>
            <span className="connection-status" data-state="connected"><CircleCheck size={16} aria-hidden="true"/>Conectado como <strong>{status.user?.login}</strong></span>
            {status.selection &&
              ` · ${status.selection.fullName}/${status.selection.folder}`}
          </p>
          <p>
            {githubSelection()
              ? "Salvamento ativo no GitHub."
              : "Conta conectada. Use este repositório para ativar o salvamento no GitHub."}
          </p>
          <div className="settings-actions">
            {status.installUrl && (
              <a
                className="settings-action"
                href={status.installUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Autorizar repositórios no GitHub
              </a>
            )}
            <button disabled={busy} onClick={() => void run(refresh)}>
              <RefreshCw size={18} />
              Atualizar repositórios
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSwitch()) return;
              void run(async () => {
                const selection = await githubJson<
                  NonNullable<GitHubStatus["selection"]>
                >("select", { fullName: repo, folder });
                setGitHubSelection(selection);
                await onChange();
                await refresh();
              });
            }}
          >
            <label className="grow">
              Buscar repositório
              <input
                aria-label="Buscar repositório"
                type="search"
                list={suggestionsId}
                autoComplete="off"
                placeholder="Organização ou nome do repositório"
                value={repositoryQuery}
                onChange={(event) => {
                  const query = event.target.value;
                  setRepositoryQuery(query);
                  setRepo(
                    repositories.find(
                      (item) =>
                        normalize(item.fullName) === normalize(query.trim()),
                    )?.fullName || "",
                  );
                }}
              />
              <datalist id={suggestionsId}>
                {matchingRepositories.map((item) => (
                  <option key={item.fullName} value={item.fullName}>
                    {item.private ? "Privado" : "Público"}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="grow">
              Repositório
              <select
                aria-label="Repositório GitHub"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                required
              >
                <option value="">Selecione um repositório</option>
                {[...repositoryGroups].map(([owner, items]) => (
                  <optgroup key={owner} label={owner}>
                    {items.map((item) => (
                      <option key={item.fullName} value={item.fullName}>
                        {item.fullName.split("/")[1]}
                        {item.private ? " · privado" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {repositoryQuery && (
              <p role="status">
                {matchingRepositories.length
                  ? `${matchingRepositories.length} ${matchingRepositories.length === 1 ? "repositório encontrado" : "repositórios encontrados"}.`
                  : "Nenhum repositório encontrado."}
              </p>
            )}
            <label>
              Pasta das notas
              <input
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="scriba"
              />
            </label>
            <p>
              Use scriba para uma pasta dedicada. Deixe vazio para ler as notas
              desde a raiz do repositório. Seus rascunhos do navegador continuam
              separados por destino.
            </p>
            <button disabled={busy || !repo}>Usar este repositório</button>
          </form>
          <button
            disabled={busy}
            onClick={() => {
              if (!canSwitch()) return;
              void run(async () => {
                await githubJson("logout", {});
                setGitHubSelection(null);
                await onChange();
                await refresh();
              });
            }}
          >
            Desconectar e usar navegador
          </button>
        </>
      )}
      <p>
        Alterações offline ficam neste dispositivo. Ao reconectar, salve a nota
        pendente ou aguarde o salvamento automático enquanto ela estiver aberta.
        Se uma nota mudar em outro dispositivo, o editor pede para reabrir ou
        salvar uma cópia.
      </p>
    </section>
  );
}
