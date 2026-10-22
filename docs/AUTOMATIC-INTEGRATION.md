# Automatic document integration

Scriba saves a note and its supplied attachments with a path-limited commit. Files staged by another tool remain staged and are not included in that commit. Incoming remote changes are merged in a disposable detached worktree; the original checkout then fast-forwards only if Git can preserve its dirty and untracked files. No stash, force push, reset of unrelated work or automatic commit of the entire working directory is used by note autosave. Explicit whole-repository synchronization retains its existing scope and safety checks.

When committed Markdown versions conflict, Scriba keeps the incoming note at its original path and creates an ordinary sibling note named `name (local YYYY-MM-DD-id).md` containing the exact local bytes. Both versions are committed and pushed together. If the conflicted note is open, the response names the local copy so the editor follows its own preserved content. A failed push after successful integration also returns that destination. Non-Markdown conflicts, symbolic links, existing Git operations and remote changes overlapping another tool's dirty files are preserved rather than overwritten. These cases may leave synchronization pending; there is no claim that arbitrary Git conflicts can always be resolved automatically.

The GitHub gateway used by mobile has no local Git checkout. It writes a tree against a known branch head and never forces its update. If another device advances that branch, it retries once against a fresh tree, retaining document-SHA conflict checks. Autosave handles a same-note conflict by publishing the local edits under a separate unique Markdown name; the existing remote note remains intact. If publication fails, the private draft/copy is retained and normal retry/error behavior applies. Manual revision-conflict actions remain available in the app. No mobile workflow asks the user to run Git commands.

A successful integration shows “Documentos sincronizados e integrados.” If copies were needed, the message also explains that both versions were preserved. Ordinary successful autosaves remain silent.

## Validation

- `npm test`: real HTTP Git repositories, gateway atomic branch updates and native session contracts.
- `tests/repository-remote-sync.test.mjs`: independent dirty edits, unrelated staged edits, both note versions, exact local bytes, open-note destination, existing merge preservation, non-Markdown conflict safety, and concurrent remote advance.
- `tests/github.test.mjs`: concurrent branch advance retries successfully; a simultaneous same-note change still produces a revision conflict without overwriting remote content.
- `node tests/mobile-concurrent-note.smoke.mjs`: isolated WebKit mobile journey automatically preserves both versions and needs no Git command or conflict dialog. It does not represent physical-device QA.
