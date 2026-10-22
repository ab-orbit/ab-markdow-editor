import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { nativeAuthentication } from './native-auth.mjs';
const hash = (value) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("hex");
const safeEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fail = (message, status = 400, remoteStatus) =>
  Object.assign(new Error(message), { status, remoteStatus });
/** Standalone GitHub gateway. Credentials are encrypted; document bodies are never persisted on the VPS. */
export function createGitHubService({
  directory,
  origin,
  fetcher = fetch,
  apiOrigin = "https://api.github.com",
  webOrigin = "https://github.com",
  secure = true,
  setupKey = process.env.SCRIBA_SETUP_KEY,
} = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyFile = path.join(directory, "encryption.key");
  if (!existsSync(keyFile))
    writeFileSync(keyFile, randomBytes(32), { mode: 0o600 });
  const key = readFileSync(keyFile);
  // sessions.id: SHA-256 of the opaque cookie; data: AES-GCM ciphertext; expires: UTC milliseconds.
  // config.id: singleton app identifier; data: encrypted GitHub App registration credentials.
  const db = new DatabaseSync(path.join(directory, "sessions.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS config (id TEXT PRIMARY KEY, data TEXT NOT NULL);",
  );
  const encrypt = (value) => {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv),
      data = Buffer.concat([
        cipher.update(JSON.stringify(value)),
        cipher.final(),
      ]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  };
  const decrypt = (value) => {
    const bytes = Buffer.from(value, "base64"),
      cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]),
    );
  };
  const nativeAuth = nativeAuthentication(db, { encrypt, decrypt, origin });
  const config = () => {
    const row = db.prepare("SELECT data FROM config WHERE id=?").get("app");
    return row ? decrypt(row.data) : null;
  };
  const saveConfig = (data) =>
    db
      .prepare("INSERT OR REPLACE INTO config VALUES (?,?)")
      .run("app", encrypt(data));
  const queues = new Map();
  const libraryCache = new Map();
  const sessionWriters = new WeakMap();
  async function serialize(id, fn) {
    const previous = queues.get(id) || Promise.resolve();
    const current = previous.catch(() => {}).then(fn);
    queues.set(id, current);
    try {
      return await current;
    } finally {
      if (queues.get(id) === current) queues.delete(id);
    }
  }
  async function request(url, options = {}) {
    const response = await fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(30000),
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Scriba/1.1",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw fail("Resposta inválida do GitHub.", 502);
    }
    if (!response.ok)
      throw fail(
        response.status === 401
          ? "Sua conexão GitHub expirou. Conecte novamente."
          : response.status === 403
            ? "GitHub recusou o acesso. Confira as permissões e o limite de requisições."
            : response.status === 409 || response.status === 422
              ? "O repositório mudou. Recarregue a nota antes de salvar."
              : response.status === 404
                ? "Repositório ou arquivo não encontrado. Confira a autorização."
                : "Não foi possível concluir a operação no GitHub.",
        response.status === 401
          ? 401
          : response.status === 409 || response.status === 422
            ? 409
            : 400,
        response.status,
      );
    return body;
  }
  async function token(session) {
    if (!session.credentials) throw fail("Conecte sua conta GitHub.", 401);
    const credentials = session.credentials;
    if (credentials.expiresAt && credentials.expiresAt < Date.now() + 60000) {
      const app = config();
      if (!app || !credentials.refreshToken)
        throw fail("Reconecte sua conta GitHub.", 401);
      const result = await request(`${webOrigin}/login/oauth/access_token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: app.client_id,
          client_secret: app.client_secret,
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
        }),
      });
      if (!result.access_token) throw fail("Reconecte sua conta GitHub.", 401);
      session.credentials = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + (result.expires_in || 28800) * 1000,
      };
      sessionWriters.get(session)?.();
    }
    return session.credentials.accessToken;
  }
  async function api(session, route, body) {
    return request(`${apiOrigin}${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${await token(session)}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  const repository = (session) => {
    if (!session.selection) throw fail("Selecione um repositório GitHub.");
    return `/repos/${session.selection.fullName}`;
  };
  const filePath = (session, name) => {
    if (
      typeof name !== "string" ||
      !name ||
      name
        .split("/")
        .some(
          (part) =>
            !part || part === "." || part === ".." || part.startsWith(".git"),
        ) ||
      name.includes("\\") ||
      name.includes("\0")
    )
      throw fail("Caminho inválido.");
    return (
      (session.selection.folder ? session.selection.folder + "/" : "") + name
    );
  };
  const encoded = (p) => p.split("/").map(encodeURIComponent).join("/");
  async function head(session) {
    return api(
      session,
      `${repository(session)}/git/ref/heads/${encoded(session.selection.branch)}`,
    );
  }
  async function snapshot(session) {
    let ref;
    try {
      ref = await head(session);
    } catch (error) {
      if ([404, 409].includes(error.remoteStatus)) {
        const repo = await api(session, repository(session));
        if (repo.size === 0)
          return {
            commit: { tree: { sha: undefined } },
            tree: { tree: [] },
            sha: null,
          };
      }
      throw error;
    }
    const commit = await api(
      session,
      `${repository(session)}/git/commits/${ref.object.sha}`,
    );
    const tree = await api(
      session,
      `${repository(session)}/git/trees/${commit.tree.sha}?recursive=1`,
    );
    if (tree.truncated)
      throw fail(
        "Repositório muito grande. Escolha um repositório dedicado às notas.",
      );
    return { commit, tree, sha: ref.object.sha };
  }
  async function blob(session, sha) {
    const data = await api(session, `${repository(session)}/git/blobs/${sha}`);
    if (data.size > 10 * 1024 * 1024) throw fail("Arquivo maior que 10 MB.");
    return { data: data.content.replace(/\s/g, ""), size: data.size };
  }
  async function read(session, name) {
    const target = filePath(session, name);
    const data = await api(
      session,
      `${repository(session)}/contents/${encoded(target)}?ref=${encodeURIComponent(session.selection.branch)}`,
    );
    if (data.type !== "file" || data.size > 5 * 1024 * 1024)
      throw fail("Arquivo Markdown inválido ou maior que 5 MB.");
    const value = Buffer.from(
      data.encoding === "base64"
        ? data.content
        : (await blob(session, data.sha)).data,
      "base64",
    ).toString("utf8");
    const files = [],
      warnings = [];
    let total = 0;
    for (const match of value.matchAll(
      /!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g,
    )) {
      try {
        const source = decodeURIComponent(match[1]);
        if (/^[a-z]+:|^\/|^#/i.test(source)) continue;
        const relative = path.posix.join(path.posix.dirname(name), source);
        if (source.split("/").includes(".."))
          throw fail("Imagem fora da pasta da nota.");
        if (!/\.(png|jpe?g|gif|webp)$/i.test(source)) continue;
        const image = await api(
          session,
          `${repository(session)}/contents/${encoded(filePath(session, relative))}?ref=${encodeURIComponent(session.selection.branch)}`,
        );
        if (
          image.size > 10 * 1024 * 1024 ||
          files.length >= 50 ||
          (total += image.size) > 40 * 1024 * 1024
        )
          throw fail("Limite de imagens excedido.");
        files.push({
          path: source,
          data:
            image.encoding === "base64"
              ? image.content.replace(/\s/g, "")
              : (await blob(session, image.sha)).data,
          mime: /\.png$/i.test(source)
            ? "image/png"
            : /\.webp$/i.test(source)
              ? "image/webp"
              : /\.gif$/i.test(source)
                ? "image/gif"
                : "image/jpeg",
        });
      } catch {
        warnings.push("Uma imagem local não pôde ser carregada.");
      }
    }
    return { name, value, version: data.sha, files, warnings };
  }
  async function library(session) {
    const { tree, sha } = await snapshot(session);
    const cacheKey = JSON.stringify([session.user.id, session.selection, sha]);
    if (libraryCache.has(cacheKey)) return libraryCache.get(cacheKey);
    const prefix = session.selection.folder
      ? session.selection.folder + "/"
      : "";
    const entries = tree.tree.filter(
      (entry) =>
        entry.type === "blob" &&
        entry.path.startsWith(prefix) &&
        /\.(md|markdown|mdown)$/i.test(entry.path) &&
        entry.size <= 5 * 1024 * 1024,
    );
    if (entries.length > 1000)
      throw fail("Mais de 1000 notas. Selecione uma pasta menor.");
    const notes = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(6, entries.length) }, async () => {
        while (cursor < entries.length) {
          const entry = entries[cursor++];
          const commits = await api(
            session,
            `${repository(session)}/commits?sha=${encodeURIComponent(session.selection.branch)}&path=${encodeURIComponent(entry.path)}&per_page=1`,
          );
          notes.push({
            name: entry.path.slice(prefix.length),
            version: entry.sha,
            title: path.posix
              .basename(entry.path)
              .replace(/\.(md|markdown|mdown)$/i, ""),
            modifiedAt:
              commits[0]?.commit?.committer?.date || new Date(0).toISOString(),
          });
        }
      }),
    );
    const result = {
      notes: notes
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 100),
    };
    if (libraryCache.size > 100)
      libraryCache.delete(libraryCache.keys().next().value);
    libraryCache.set(cacheKey, result);
    return result;
  }
  async function save(session, body, attempt = 0) {
    const name = body.name;
    if (
      !/\.(md|markdown|mdown)$/i.test(name) ||
      typeof body.value !== "string" ||
      Buffer.byteLength(body.value) > 5 * 1024 * 1024
    )
      throw fail("Nota Markdown inválida.");
    const target = filePath(session, name);
    const snapshotNow = await snapshot(session);
    if (!snapshotNow.sha)
      throw fail(
        "Inicialize o repositório com um README no GitHub antes do primeiro salvamento.",
      );
    const previous = snapshotNow.tree.tree.find((item) => item.path === target);
    const bytes = Buffer.from(body.value);
    const documentSha = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    if (
      previous &&
      previous.sha !== body.version &&
      previous.sha !== documentSha
    )
      return {
        conflict: {
          name,
          kind: body.version ? "modified" : "exists",
          currentVersion: previous.sha,
        },
        error: "Esta nota mudou no GitHub. Reabra a nota ou salve uma cópia.",
      };
    if (!previous && body.version)
      return {
        conflict: { name, kind: "deleted", currentVersion: null },
        error: "A nota foi removida no GitHub. Salve uma cópia.",
      };
    const entries = [];
    let total = 0;
    for (const file of body.files || []) {
      if (!/\.(png|jpe?g|gif|webp)$/i.test(file.path))
        throw fail("Formato de imagem não permitido.");
      const data = Buffer.from(file.data, "base64");
      total += data.length;
      if (
        data.length > 10 * 1024 * 1024 ||
        total > 40 * 1024 * 1024 ||
        entries.length >= 50
      )
        throw fail("Limite de imagens excedido.");
      const targetImage = filePath(
        session,
        path.posix.join(path.posix.dirname(name), file.path),
      );
      const imageSha = createHash("sha1")
        .update(`blob ${data.length}\0`)
        .update(data)
        .digest("hex");
      const old = snapshotNow.tree.tree.find(
        (item) => item.path === targetImage,
      );
      if (old && old.sha !== imageSha)
        throw fail(
          "Uma imagem já existe com conteúdo diferente. Renomeie a imagem para preservar a versão anterior.",
          409,
        );
      if (!old) {
        const created = await api(session, `${repository(session)}/git/blobs`, {
          content: file.data,
          encoding: "base64",
        });
        entries.push({
          path: targetImage,
          mode: "100644",
          type: "blob",
          sha: created.sha,
        });
      }
    }
    if (previous?.sha === documentSha && !entries.length)
      return { version: documentSha, synced: true };
    const created = await api(session, `${repository(session)}/git/blobs`, {
      content: body.value,
      encoding: "utf-8",
    });
    entries.push({
      path: target,
      mode: "100644",
      type: "blob",
      sha: created.sha,
    });
    const tree = await api(session, `${repository(session)}/git/trees`, {
      base_tree: snapshotNow.commit.tree.sha,
      tree: entries,
    });
    const commit = await api(session, `${repository(session)}/git/commits`, {
      message: String(body.message || `Update ${name}`).slice(0, 500),
      tree: tree.sha,
      parents: snapshotNow.sha ? [snapshotNow.sha] : [],
    });
    // Never force a branch update: a concurrent commit must be retried against a fresh tree.
    try {
    if (!snapshotNow.sha)
      await api(session, `${repository(session)}/git/refs`, {
        ref: `refs/heads/${session.selection.branch}`,
        sha: commit.sha,
      });
    else
      await request(
        `${apiOrigin}${repository(session)}/git/refs/heads/${encoded(session.selection.branch)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${await token(session)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sha: commit.sha, force: false }),
        },
      );
    } catch (error) {
      // A different device may advance the branch after our snapshot. Rebuild once;
      // the fresh document SHA check still protects same-note concurrent changes.
      if (!attempt && error.status === 409) {
        const result = await save(session, body, attempt + 1);
        return {...result, integrated:!result.conflict};
      }
      throw error;
    }
    return { version: created.sha, synced: true };
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const redirect = (url) => {
      res.writeHead(302, { Location: url });
      res.end();
    };
    try {
      const url = new URL(req.url, origin);
      if (req.headers.host !== new URL(origin).host)
        throw fail("Host inválido.", 403);
      if (
        req.headers["sec-fetch-site"] === "cross-site" &&
        req.method !== "GET"
      )
        throw fail("Origem inválida.", 403);
      if (
        req.method === "POST" &&
        (req.headers.origin !== origin ||
          req.headers["x-scriba-client"] !== "1")
      )
        throw fail("Origem inválida.", 403);
      const cookie = req.headers.cookie?.match(
        /(?:^|; )scriba_session=([a-f0-9]{64})(?:;|$)/,
      )?.[1];
      let sid = cookie || random();
      const id = hash(sid);
      const row = db
        .prepare("SELECT data FROM sessions WHERE id=? AND expires>?")
        .get(id, Date.now());
      const session = row ? decrypt(row.data) : {};
      const persist = () => {
        nativeAuth.cleanup();
        db.prepare("INSERT OR REPLACE INTO sessions VALUES (?,?,?)").run(
          id,
          encrypt(session),
          Date.now() + 7 * 86400000,
        );
        db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      };
      sessionWriters.set(session, persist);
      res.setHeader(
        "Set-Cookie",
        `scriba_session=${sid}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/github; Max-Age=604800`,
      );
      let body = {};
      if (req.method === "POST") {
        let size = 0,
          chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 60 * 1024 * 1024)
            throw fail("Envio maior que 60 MB.", 413);
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      }
      if (url.pathname === "/github/health")
        return send(200, { app: "scriba-github" });
      if (url.pathname === "/github/status") {
        const app = config();
        if (row) persist();
        return send(200, {
          configured: !!app,
          connected: !!session.credentials,
          user: session.user || null,
          selection: session.selection || null,
          installUrl: app
            ? `${webOrigin}/apps/${app.slug}/installations/new`
            : null,
        });
      }
      if (url.pathname === "/github/setup" && req.method === "GET") {
        if (
          !setupKey ||
          !safeEqual(url.searchParams.get("key"), setupKey) ||
          config()
        )
          throw fail("Configuração indisponível.", 403);
        session.setupState = random();
        session.setupExpires = Date.now() + 3600000;
        persist();
        const manifest = {
          name: "Scriba by Aeon Bridge",
          url: origin,
          redirect_url: `${origin}/github/setup/callback`,
          callback_urls: [`${origin}/github/callback`],
          setup_url: `${origin}/github/login`,
          public: true,
          hook_attributes: { url: `${origin}/github/webhook`, active: false },
          default_permissions: { contents: "write", metadata: "read" },
          request_oauth_on_install: false,
        };
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; form-action https://github.com; style-src 'unsafe-inline'; base-uri 'none'",
        });
        return res.end(
          `<title>Ativar GitHub — Scriba</title><body style="font:18px system-ui;max-width:640px;margin:80px auto;padding:24px"><h1>Ativar GitHub no Scriba</h1><p>Crie o GitHub App na organização AB Orbit. O GitHub enviará as credenciais diretamente ao servidor; elas não ficam no código público.</p><form method="post" action="https://github.com/organizations/ab-orbit/settings/apps/new?state=${session.setupState}"><input type="hidden" name="manifest" value="${JSON.stringify(manifest).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"><button style="padding:16px;font:inherit">Criar GitHub App</button></form></body>`,
        );
      }
      if (url.pathname === "/github/setup/callback") {
        if (
          config() ||
          !session.setupState ||
          !safeEqual(session.setupState, url.searchParams.get("state")) ||
          session.setupExpires < Date.now()
        )
          throw fail("Configuração expirada.", 403);
        const code = url.searchParams.get("code");
        if (!/^[a-zA-Z0-9_-]{5,200}$/.test(code || ""))
          throw fail("Código inválido.");
        const result = await request(
          `${apiOrigin}/app-manifests/${code}/conversions`,
          { method: "POST" },
        );
        if (!result.client_id || !result.client_secret || !result.slug)
          throw fail(
            "Registro do GitHub App incompleto. Tente novamente.",
            502,
          );
        saveConfig(result);
        delete session.setupState;
        delete session.setupExpires;
        persist();
        return redirect("/?github=ready");
      }
      if (req.method === 'POST' && url.pathname === '/github/native/start') {
        const flow = nativeAuth.start(id, body.challenge);
        persist();
        return send(200, flow);
      }
      if (req.method === 'POST' && url.pathname === '/github/native/complete') {
        const account = nativeAuth.claim(id, body.state, body.verifier);
        session.credentials = account.credentials;
        session.user = account.user;
        delete session.selection;
        persist();
        return send(200, { connected: true, user: session.user });
      }
      if (url.pathname === "/github/login") {
        const app = config();
        if (!app)
          throw fail(
            "A conexão GitHub está aguardando ativação do administrador.",
            503,
          );
        if (url.searchParams.has('native')) {
          const flow = url.searchParams.get('native');
          nativeAuth.begin(flow);
          session.nativeHandoff = flow;
        } else delete session.nativeHandoff;
        session.oauthState = random();
        session.oauthExpires = Date.now() + 600000;
        session.verifier = random();
        persist();
        return redirect(
          `${webOrigin}/login/oauth/authorize?${new URLSearchParams({ client_id: app.client_id, redirect_uri: `${origin}/github/callback`, state: session.oauthState, code_challenge: createHash("sha256").update(session.verifier).digest("base64url"), code_challenge_method: "S256" })}`,
        );
      }
      if (url.pathname === "/github/callback") {
        if (
          !session.oauthState ||
          !safeEqual(session.oauthState, url.searchParams.get("state")) ||
          session.oauthExpires < Date.now()
        )
          throw fail("Autorização expirada. Conecte novamente.", 403);
        const app = config();
        const result = await request(`${webOrigin}/login/oauth/access_token`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: app.client_id,
            client_secret: app.client_secret,
            code: url.searchParams.get("code"),
            redirect_uri: `${origin}/github/callback`,
            code_verifier: session.verifier,
          }),
        });
        if (!result.access_token)
          throw fail("O GitHub não autorizou a conexão.");
        session.credentials = {
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt: result.expires_in
            ? Date.now() + result.expires_in * 1000
            : null,
        };
        session.user = await api(session, "/user");
        session.user = { login: session.user.login, id: session.user.id };
        delete session.oauthState;
        delete session.verifier;
        if (session.nativeHandoff) {
          const target = nativeAuth.finish(session.nativeHandoff, { credentials: session.credentials, user: session.user });
          delete session.nativeHandoff;
          delete session.credentials;
          delete session.user;
          persist();
          return redirect(target);
        }
        persist();
        return redirect("/?github=connected");
      }
      if (req.method === "POST" && url.pathname === "/github/token") {
        if (
          typeof body.token !== "string" ||
          !/^[A-Za-z0-9_-]{20,300}$/.test(body.token)
        )
          throw fail("Token inválido.");
        session.credentials = { accessToken: body.token };
        session.user = await api(session, "/user");
        session.user = { login: session.user.login, id: session.user.id };
        delete session.selection;
        persist();
        return send(200, { connected: true, user: session.user });
      }
      if (req.method === "POST" && url.pathname === "/github/logout") {
        nativeAuth.cancel(id);
        db.prepare("DELETE FROM sessions WHERE id=?").run(id);
        return send(200, { connected: false });
      }
      if (
        [
          "/github/repositories",
          "/github/select",
          "/github/library",
          "/github/document",
          "/github/document-version",
          "/github/save",
        ].includes(url.pathname)
      )
        await token(session);
      if (url.pathname === "/github/repositories") {
        const items = [];
        for (let page = 1; page <= 10; page++) {
          const batch = await api(
            session,
            `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
          );
          items.push(
            ...batch
              .filter((repo) => repo.permissions?.push && !repo.archived)
              .map((repo) => ({
                fullName: repo.full_name,
                defaultBranch: repo.default_branch,
                private: repo.private,
              })),
          );
          if (batch.length < 100) break;
        }
        persist();
        return send(200, items);
      }
      if (req.method === "POST" && url.pathname === "/github/select") {
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(body.fullName || ""))
          throw fail("Repositório inválido.");
        const repo = await api(session, `/repos/${body.fullName}`);
        if (!repo.permissions?.push || repo.archived)
          throw fail("Sem permissão de escrita.", 403);
        const folder = String(body.folder ?? "scriba")
          .trim()
          .replace(/^\/+|\/+$/g, "");
        if (
          folder &&
          folder
            .split("/")
            .some(
              (part) =>
                !part ||
                part === "." ||
                part === ".." ||
                part.startsWith(".git") ||
                part.includes("\\"),
            )
        )
          throw fail("Pasta inválida.");
        session.selection = {
          fullName: repo.full_name,
          branch: repo.default_branch,
          folder,
        };
        persist();
        return send(200, session.selection);
      }
      if (url.pathname === "/github/library") {
        const result = await library(session);
        persist();
        return send(200, result);
      }
      if (["/github/document", "/github/document-version"].includes(url.pathname) && url.searchParams.has("scope")) {
        const scope = session.selection ? `github:${session.selection.fullName}:${session.selection.branch}:${session.selection.folder}` : "state";
        if (url.searchParams.get("scope") !== scope) throw fail("O repositório mudou. Reabra a nota no destino selecionado.", 409);
      }
      if (url.pathname === "/github/document-version") {
        const name = filePath(session, url.searchParams.get("name"));
        const {tree} = await snapshot(session);
        const entry = tree.tree.find(item => item.type === "blob" && item.path === name);
        persist();
        return send(200, {version:entry?.sha || null});
      }
      if (url.pathname === "/github/document") {
        const result = await read(session, url.searchParams.get("name"));
        persist();
        return send(200, result);
      }
      if (req.method === "POST" && url.pathname === "/github/save") {
        const result = await serialize(
          session.selection?.fullName + "/" + session.selection?.branch,
          () => {
            const scope = session.selection ? `github:${session.selection.fullName}:${session.selection.branch}:${session.selection.folder}` : "state";
            if (body.scope && body.scope !== scope) throw fail("O repositório mudou. Reabra a biblioteca no destino selecionado.", 409);
            // Each request owns a decrypted session snapshot, including its destination.
            return save(session, body);
          },
        );
        persist();
        return send(result.conflict ? 409 : 200, result);
      }
      send(404, { error: "Rota não encontrada." });
    } catch (error) {
      send(error.status || 400, {
        error: error.message || "Não foi possível concluir a operação.",
      });
    }
  });
  return { server, close: () => db.close() };
}
