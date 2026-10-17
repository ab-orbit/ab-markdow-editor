/** GitHub credentials stay in an HttpOnly server session, never in browser storage. */
export interface GitHubSelection {
  /** Canonical owner/repository identity authorized for this account. */
  fullName: string;
  /** Remote default branch receiving non-forced commits. */
  branch: string;
  /** Repository-relative note folder; empty means the root. */
  folder: string;
}
export interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  user: { login: string } | null;
  selection: GitHubSelection | null;
  installUrl: string | null;
}
const selectionKey = "scriba-github-selection";
export function githubSelection(): GitHubSelection | null {
  try {
    return JSON.parse(localStorage.getItem(selectionKey) || "null");
  } catch {
    return null;
  }
}
export function setGitHubSelection(selection: GitHubSelection | null) {
  if (selection) localStorage.setItem(selectionKey, JSON.stringify(selection));
  else localStorage.removeItem(selectionKey);
}
export function libraryKey() {
  const selection = githubSelection();
  return selection
    ? `github:${selection.fullName}:${selection.branch}:${selection.folder}`
    : "state";
}
export async function githubRequest(
  route: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`/github/${route}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Scriba-Client": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export async function githubJson<T>(route: string, body?: unknown): Promise<T> {
  const response = await githubRequest(route, body);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível conectar ao GitHub.");
  return result;
}
export async function githubStatus() {
  return githubJson<GitHubStatus>("status");
}
