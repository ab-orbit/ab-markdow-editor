import { chromium } from "@playwright/test";
import { createGitHubService } from "../server/github/service.mjs";
import http from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:43650",
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "scriba-github-ui-"));
let content = "# Nota remota\n\nTexto do GitHub.",
  version = "base-sha",
  branch = "branch1",
  tree = "tree1";
const blobs = new Map();
const fetcher = async (url, options = {}) => {
  const u = new URL(url),
    body = options.body ? JSON.parse(options.body) : null;
  const reply = (data) => Response.json(data);
  if (
    options.headers.Authorization !== "Bearer github_pat_browser_fixture_123456"
  )
    return Response.json({ message: "Bad credentials" }, { status: 401 });
  if (u.pathname === "/user") return reply({ login: "alice", id: 1 });
  if (u.pathname === "/user/repos")
    return reply([
      {
        full_name: "alice/notes",
        default_branch: "main",
        private: true,
        permissions: { push: true },
      },
    ]);
  if (u.pathname === "/repos/alice/notes")
    return reply({
      full_name: "alice/notes",
      default_branch: "main",
      permissions: { push: true },
    });
  if (u.pathname.endsWith("/git/ref/heads/main"))
    return reply({ object: { sha: branch } });
  if (u.pathname.endsWith("/git/commits/" + branch))
    return reply({ tree: { sha: tree } });
  if (u.pathname.includes("/git/trees/") && !body)
    return reply({
      tree: [
        {
          type: "blob",
          mode: "100644",
          path: "scriba/Remote.md",
          sha: version,
          size: content.length,
        },
      ],
      truncated: false,
    });
  if (u.pathname.endsWith("/commits") && !body)
    return reply([{ commit: { committer: { date: "2026-10-17T12:00:00Z" } } }]);
  if (u.pathname.includes("/contents/"))
    return reply({
      type: "file",
      encoding: "base64",
      content: Buffer.from(content).toString("base64"),
      sha: version,
      size: content.length,
    });
  if (u.pathname.endsWith("/git/blobs") && body) {
    const bytes = Buffer.from(
        body.content,
        body.encoding === "base64" ? "base64" : "utf8",
      ),
      sha = createHash("sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex");
    blobs.set(sha, bytes);
    return reply({ sha });
  }
  if (u.pathname.endsWith("/git/trees") && body) {
    version = body.tree.find((item) => item.path === "scriba/Remote.md").sha;
    return reply({ sha: "next-tree" });
  }
  if (u.pathname.endsWith("/git/commits") && body)
    return reply({ sha: "next-" + Date.now() });
  if (u.pathname.endsWith("/git/refs/heads/main") && body) {
    assert.equal(body.force, false);
    branch = body.sha;
    tree = "next-tree";
    content = blobs.get(version).toString();
    return reply({ object: { sha: branch } });
  }
  throw new Error("Unexpected mock GitHub endpoint " + u.pathname);
};
const gateway = createGitHubService({
  directory,
  origin,
  secure: false,
  fetcher,
});
const web = http.createServer(async (req, res) => {
  if (req.url.startsWith("/github/"))
    return gateway.server.emit("request", req, res);
  try {
    const url = new URL(req.url, origin),
      file = new URL(
        "../dist/" +
          (url.pathname === "/" ? "index.html" : url.pathname.slice(1)),
        import.meta.url,
      );
    const data = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": file.pathname.endsWith(".js")
        ? "text/javascript"
        : file.pathname.endsWith(".css")
          ? "text/css"
          : file.pathname.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => web.listen(43650, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByText("Conectar com token de acesso", { exact: true }).click();
  await page
    .getByLabel("Token GitHub", { exact: true })
    .fill("github_pat_browser_fixture_123456");
  await page
    .getByRole("button", { name: "Conectar com token", exact: true })
    .click();
  await page
    .getByText("Conectado como", { exact: false })
    .waitFor({ timeout: 5000 })
    .catch(async (error) => {
      console.log((await page.locator("body").innerText()).slice(0, 3500));
      throw error;
    });
  await page
    .getByLabel("Repositório GitHub", { exact: true })
    .selectOption("alice/notes");
  console.log("Account connected");
  await page
    .getByRole("button", { name: "Usar este repositório", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Destino atualizado." })
    .waitFor();
  console.log("Destination refreshed");
  await page.screenshot({path:"docs/evidence/github-mobile-settings.png"});
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar notas recentes" }).click();
  await page.getByRole("button", { name: "Remote.md", exact: true }).click();
  await page
    .getByRole("heading", { name: "Nota remota", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Editar nota", exact: true }).click();
  await page.getByRole("button", { name: "Fonte", exact: true }).click();
  const editor = page.locator(".cm-content");
  await editor.fill("# Editada no celular");
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "salvas no GitHub" })
    .waitFor();
  assert.equal(content, "# Editada no celular");
  await context.setOffline(true);
  await editor.fill("# Editada offline");
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "envio ao GitHub pendente" })
    .waitFor();
  assert.equal(content, "# Editada no celular");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "salvas no GitHub" })
    .waitFor();
  assert.equal(content, "# Editada offline");
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Desconectar e usar navegador" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Destino atualizado." })
    .waitFor();
  console.log("Destination refreshed");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar notas recentes" }).click();
  await page
    .getByRole("button", { name: "Boas-vindas.md", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Remote.md", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "docs/evidence/github-mobile-isolated.png" });
  console.log(
    "PASS: mobile token login, repository/folder selection, remote note listing, open/edit/commit, offline queue/retry, logout restores isolated local library. GitHub API simulated; gateway and browser are real HTTP.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => web.close(resolve));
  gateway.close();
  await fs.rm(directory, { recursive: true, force: true });
}
