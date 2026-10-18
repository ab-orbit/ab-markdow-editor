# GitHub synchronization

Public web/PWA users can connect a GitHub account, select an existing repository and a folder (default `scriba`), and work on the repository's default branch. This also works from iOS without local filesystem access. Creating repositories and selecting another branch are not implemented. Initialize an empty repository with a README on GitHub before saving its first Scriba note.

## Authentication

The production gateway runs as the dedicated `scriba` system user, behind nginx at `/github/`, listening only on loopback. A GitHub App uses the web OAuth flow with state, expiry, and PKCE. Its public permissions are `Contents: write` and `Metadata: read`; users choose which repositories to authorize on GitHub. Until the owner activates the App, a fine-grained personal access token limited to the chosen repository is supported as an alternative.

The browser stores only the repository identity. Access/refresh tokens stay in an HttpOnly, Secure, SameSite=Lax session cookie's server-side record. Cookie values are opaque random identifiers; SQLite stores their SHA-256 digests. Session and App credentials are encrypted with AES-256-GCM using a separate file key. The state directory and service environment are private. API mutations require a same-origin request and custom client header. Session expiry is seven days with renewal on use. Disconnect deletes the server session; GitHub authorization can also be revoked in the user's GitHub settings.

The VPS handles document contents transiently to call GitHub; it does not persist note bodies or images. Local browser copies and drafts remain in IndexedDB, scoped by repository, branch and folder. Browser-private notes remain separate when connecting or disconnecting GitHub.

## One-time App activation

The operator's private `/github/setup?key=...` link renders a preconfigured registration form for organization `ab-orbit`. The organization owner confirms **Create GitHub App** on GitHub. The callback exchanges GitHub's temporary manifest code and stores registration credentials directly on the server, encrypted. They must never be committed or pasted into chat. The setup link stops working after registration. If the organization requires account reauthentication or administrator approval, its owner must complete that step.

Production environment: `/etc/scriba-github.env`; service: `scriba-github`; state: `/var/lib/scriba`; code: `/opt/scriba/github`. Preserve the database and encryption key across deployments and back them up together. Losing the key requires users to reconnect.

## Saving and conflicts

Each save creates the Markdown and new image blobs, one tree and one commit, then updates the branch reference with `force: false`. Existing unrelated files remain in the base tree. Document blob revisions reject stale writes. A concurrent branch change refuses the reference update, preserving both the current remote branch and local draft. Identical retries create no extra commit. Existing images with different bytes require a new filename.

Offline saves retain the note and its original remote revision in the browser. Reopening a pending local note does not replace it with older remote content. Once online, save the pending note or keep it open with automatic saving enabled. Pending notes are not synchronized in a closed/backgrounded PWA; iOS can suspend it. Repository protection rules and GitHub permission/rate limits can refuse saves; the browser copy remains available for export or retry.

The sidebar reads Markdown files within the selected prefix, fetches their latest per-file commit timestamps, and displays the latest 100. Up to 1000 candidates are supported; choose a smaller dedicated repository/folder above that limit. Metadata is cached per authorized account and branch head; no note bodies are cached on the server.

## External changes

The active note's blob revision is checked every minute and when the foreground window regains focus. A read-only revision endpoint returns only the current blob SHA (or null after deletion), scoped to the selected repository/branch/folder. Clean documents refresh automatically. Dirty documents and pending offline writes require explicit confirmation before reloading; autosave pauses while a newer source is unresolved. Explicit reloads fail visibly offline instead of silently returning an older cached note. Late responses cannot replace a different document or edits typed while an automatic load was in flight.

## Verification

- `npm test`: HTTP security/session/OAuth tests, real local Git commit trees, atomic note/image commits, idempotent writes, stale versions and concurrent branch updates. GitHub endpoints are represented by a local HTTP fixture.
- `node tests/github-browser.smoke.mjs`: real mobile browser and gateway HTTP navigation with a simulated GitHub API; login by token, repository/folder selection, listing, editing, commit, offline save/retry, and disconnection with library isolation.
- A real GitHub account authorization and installation must be verified after App activation; automated fixtures do not constitute that verification.
