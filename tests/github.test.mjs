import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createGitHubService } from "../server/github/service.mjs";
const exec = promisify(execFile);
test("GitHub gateway HTTP: isolated encrypted sessions, real Git atomic commits, revision conflicts and CSRF", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "scriba-github-"));
  const repo = path.join(temporary, "repo");
  await fs.mkdir(repo);
  const git = async (...args) =>
    (
      await exec("git", ["-C", repo, ...args], {
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Scriba Test",
          GIT_AUTHOR_EMAIL: "test@example.invalid",
          GIT_COMMITTER_NAME: "Scriba Test",
          GIT_COMMITTER_EMAIL: "test@example.invalid",
        },
      })
    ).stdout.trim();
  await git("init", "-b", "main");
  await fs.mkdir(path.join(repo, "scriba"));
  await fs.writeFile(path.join(repo, "scriba/note.md"), "# Original");
  await git("add", ".");
  await git("commit", "-m", "Initial");
  let forceRace = false;
  const calls = [];
  const mock = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://mock");
      let body = {};
      if (req.method !== "GET") {
        let text = "";
        for await (const chunk of req) text += chunk;
        body = JSON.parse(text || "{}");
      }
      calls.push({ path: url.pathname, body });
      const reply = (data, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      };
      const sha = await git("rev-parse", "HEAD");
      const rootTree = await git("rev-parse", "HEAD^{tree}");
      if (
        req.headers.authorization !== "Bearer github_pat_test_valid_token_12345"
      )
        return reply({ message: "Bad credentials" }, 401);
      if (url.pathname === "/user") return reply({ login: "alice", id: 1 });
      if (url.pathname === "/user/repos")
        return reply([
          {
            full_name: "alice/notes",
            default_branch: "main",
            private: true,
            permissions: { push: true },
          },
        ]);
      if (url.pathname === "/repos/alice/notes")
        return reply({
          full_name: "alice/notes",
          default_branch: "main",
          permissions: { push: true },
        });
      if (url.pathname.endsWith("/git/ref/heads/main"))
        return reply({ object: { sha } });
      if (url.pathname.endsWith(`/git/commits/${sha}`))
        return reply({ sha, tree: { sha: rootTree } });
      if (url.pathname.includes("/git/trees/") && req.method === "GET") {
        const items = (await git("ls-tree", "-r", "HEAD"))
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [metadata, file] = line.split("\t");
            const [mode, type, id] = metadata.split(" ");
            return { mode, type, sha: id, path: file, size: 100 };
          });
        return reply({ tree: items, truncated: false });
      }
      if (url.pathname.endsWith("/commits") && req.method === "GET")
        return reply([
          { commit: { committer: { date: "2026-10-17T18:00:00Z" } } },
        ]);
      if (url.pathname.includes("/contents/")) {
        const file = decodeURIComponent(url.pathname.split("/contents/")[1]);
        try {
          const data = await exec("git", ["-C", repo, "show", `HEAD:${file}`], {
            encoding: "buffer",
          });
          return reply({
            type: "file",
            sha: await git("rev-parse", `HEAD:${file}`),
            content: data.stdout.toString("base64"),
            encoding: "base64",
            size: data.stdout.length,
          });
        } catch {
          return reply({}, 404);
        }
      }
      if (url.pathname.endsWith("/git/blobs") && req.method === "POST") {
        const file = path.join(temporary, `blob-${calls.length}`);
        await fs.writeFile(
          file,
          Buffer.from(
            body.content,
            body.encoding === "base64" ? "base64" : "utf8",
          ),
        );
        return reply({ sha: await git("hash-object", "-w", file) });
      }
      if (url.pathname.endsWith("/git/trees") && req.method === "POST") {
        const index = path.join(temporary, `index-${calls.length}`);
        const indexed = async (...args) =>
          (
            await exec("git", ["-C", repo, ...args], {
              env: { ...process.env, GIT_INDEX_FILE: index },
            })
          ).stdout.trim();
        await indexed("read-tree", body.base_tree);
        for (const entry of body.tree)
          await indexed(
            "update-index",
            "--add",
            "--cacheinfo",
            `${entry.mode},${entry.sha},${entry.path}`,
          );
        return reply({ sha: await indexed("write-tree") });
      }
      if (url.pathname.endsWith("/git/commits") && req.method === "POST") {
        const next = await git(
          "commit-tree",
          body.tree,
          "-p",
          body.parents[0],
          "-m",
          body.message,
        );
        if (forceRace) {
          await git("read-tree", "HEAD");
          await fs.writeFile(path.join(repo, "parallel.md"), "Concurrent");
          await git("add", "parallel.md");
          await git("commit", "-m", "Concurrent");
        }
        return reply({ sha: next });
      }
      if (
        url.pathname.endsWith("/git/refs/heads/main") &&
        req.method === "PATCH"
      ) {
        assert.equal(body.force, false);
        try {
          await git("merge-base", "--is-ancestor", sha, body.sha);
          await git("update-ref", "refs/heads/main", body.sha, sha);
          return reply({ object: { sha: body.sha } });
        } catch {
          return reply({}, 422);
        }
      }
      reply({ message: "Unhandled mock route" }, 404);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const mockOrigin = `http://127.0.0.1:${mock.address().port}`;
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const gateway = createGitHubService({
    directory: path.join(temporary, "state"),
    origin,
    secure: false,
    apiOrigin: mockOrigin,
  });
  await new Promise((resolve) =>
    gateway.server.listen(port, "127.0.0.1", resolve),
  );
  let cookie = "";
  async function request(route, body, headers = {}) {
    const response = await fetch(`${origin}/github/${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(body === undefined
          ? {}
          : {
              Origin: origin,
              "X-Scriba-Client": "1",
              "Content-Type": "application/json",
            }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await request("status")).data.connected, false);
    assert.match(cookie, /scriba_session=/);
    assert.equal(
      (await request("token", { token: "github_pat_test_valid_token_12345" }))
        .status,
      200,
    );
    assert.equal(
      (await request("repositories")).data[0].fullName,
      "alice/notes",
    );
    assert.equal(
      (await request("select", { fullName: "alice/notes", folder: "scriba" }))
        .status,
      200,
    );
    const listing = await request("library");
    assert.equal(listing.data.notes[0].name, "note.md");
    const original = (await request("document?name=note.md")).data;
    const revision=await request("document-version?name=note.md&scope=github%3Aalice%2Fnotes%3Amain%3Ascriba");
    assert.deepEqual(revision.data,{version:original.version});
    assert.deepEqual((await request("document-version?name=missing.md")).data,{version:null});
    assert.equal((await request("document-version?name=note.md&scope=wrong-scope")).status,409);
    assert.equal((await request("document?name=note.md&scope=wrong-scope")).status,409);
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII=";
    const beforeScopedSave = await git("rev-parse", "HEAD");
    assert.equal((await request("save", {name:"Scriba-Diagramas.md", value:"# Reference", version:null, files:[], scope:"github:other/repo:main:scriba"})).status,409);
    assert.equal(await git("rev-parse", "HEAD"),beforeScopedSave);
    const save = await request("save", {
      name: "note.md",
      value: "# Updated\n\n![Image](assets/image.png)",
      version: original.version,
      files: [{ path: "assets/image.png", data: png }],
      message: "Save note and image",
    });
    assert.equal(save.status, 200);
    assert.equal(save.data.synced, true);
    assert.deepEqual(
      (await git("show", "--pretty=", "--name-only", "HEAD"))
        .split("\n")
        .sort(),
      ["scriba/assets/image.png", "scriba/note.md"],
    );
    assert.equal(
      (await request("document?name=note.md")).data.files[0].data,
      png,
    );
    const savedHead = await git("rev-parse", "HEAD");
    const retry = await request("save", {
      name: "note.md",
      value: "# Updated\n\n![Image](assets/image.png)",
      version: save.data.version,
      files: [{ path: "assets/image.png", data: png }],
    });
    assert.equal(retry.status, 200);
    assert.equal(await git("rev-parse", "HEAD"), savedHead);

    assert.equal(
      (
        await request("save", {
          name: "note.md",
          value: "# Lost update",
          version: original.version,
          files: [],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("save", {
          name: "../../escape.md",
          value: "# Escape",
          files: [],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "save",
          { name: "blocked.md", value: "x" },
          { Origin: "https://evil.invalid" },
        )
      ).status,
      403,
    );
    const firstCookie = cookie;
    cookie = "";
    assert.equal((await request("status")).data.connected, false);
    assert.equal((await request("library")).status, 401);
    cookie = firstCookie;
    forceRace = true;
    const before = (await request("document?name=note.md")).data;
    const concurrent = await request("save", {
      name: "note.md",
      value: "# Concurrent overwrite",
      version: before.version,
      files: [],
    });
    assert.equal(concurrent.status, 409);
    assert.equal(
      await git("show", "HEAD:scriba/note.md"),
      "# Updated\n\n![Image](assets/image.png)",
    );
    const database = await fs.readFile(
      path.join(temporary, "state/sessions.sqlite"),
    );
    assert.equal(
      database.includes(Buffer.from("github_pat_test_valid_token_12345")),
      false,
    );
    assert.equal((await request("logout", {})).status, 200);
    assert.equal((await request("status")).data.connected, false);
  } finally {
    await new Promise((resolve) => gateway.server.close(resolve));
    gateway.close();
    await new Promise((resolve) => mock.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("GitHub App manifest and OAuth HTTP flow require state and PKCE, keep credentials off responses", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "scriba-oauth-"));
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let challenge = "";
  const fetcher = async (url, options = {}) => {
    if (url.includes("/app-manifests/"))
      return Response.json({
        client_id: "test-client",
        client_secret: "secret-oauth-client",
        slug: "scriba-test",
      });
    if (url.includes("/login/oauth/access_token")) {
      const body = JSON.parse(options.body);
      assert.equal(body.client_secret, "secret-oauth-client");
      const { createHash } = await import("node:crypto");
      assert.equal(
        createHash("sha256").update(body.code_verifier).digest("base64url"),
        challenge,
      );
      return Response.json({
        access_token: "oauth-secret-token",
        refresh_token: "oauth-refresh-secret",
        expires_in: 28800,
      });
    }
    if (url.endsWith("/user")) {
      assert.equal(options.headers.Authorization, "Bearer oauth-secret-token");
      return Response.json({ login: "owner", id: 2 });
    }
    throw new Error("Unexpected OAuth request");
  };
  const service = createGitHubService({
    directory,
    origin,
    secure: false,
    setupKey: "admin-setup-key",
    fetcher,
  });
  await new Promise((resolve) =>
    service.server.listen(port, "127.0.0.1", resolve),
  );
  let cookie = "";
  const request = async (route) => {
    const response = await fetch(origin + route, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    cookie = response.headers.get("set-cookie")?.split(";")[0] || cookie;
    return response;
  };
  try {
    assert.equal((await request("/github/setup?key=wrong")).status, 403);
    const setup = await request("/github/setup?key=admin-setup-key");
    assert.equal(setup.status, 200);
    const html = await setup.text();
    const state = html.match(/new\?state=([a-f0-9]+)/)[1];
    assert.ok(!html.includes("secret-oauth-client"));
    assert.equal(
      (await request("/github/setup/callback?code=valid-code&state=wrong"))
        .status,
      403,
    );
    assert.equal(
      (await request(`/github/setup/callback?code=valid-code&state=${state}`))
        .status,
      302,
    );
    assert.equal(
      (await (await request("/github/status")).json()).configured,
      true,
    );
    const login = await request("/github/login");
    const authorization = new URL(login.headers.get("location"));
    challenge = authorization.searchParams.get("code_challenge");
    assert.equal(
      authorization.searchParams.get("code_challenge_method"),
      "S256",
    );
    assert.ok(challenge);
    assert.equal(
      (await request("/github/callback?code=oauth-code&state=wrong")).status,
      403,
    );
    const callback = await request(
      `/github/callback?code=oauth-code&state=${authorization.searchParams.get("state")}`,
    );
    assert.equal(callback.status, 302);
    const status = await (await request("/github/status")).json();
    assert.equal(status.connected, true);
    assert.equal(status.user.login, "owner");
    assert.equal(JSON.stringify(status).includes("secret"), false);
    assert.equal(
      (
        await request(
          `/github/callback?code=oauth-code&state=${authorization.searchParams.get("state")}`,
        )
      ).status,
      403,
    );
  } finally {
    await new Promise((resolve) => service.server.close(resolve));
    service.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
