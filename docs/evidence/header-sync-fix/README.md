# Header layout and local sync recovery — 2026-10-23

The tablet rule forced all toolbar commands onto a full-width second row even in Whiteboard mode. Whiteboard now reserves three columns for filename, format selection and commands; filename truncation absorbs constrained width. Fine-pointer command buttons use 36px targets; touch targets retain existing 44px rules.

Verified in Chromium in English at 1008 and 1440px, with filename, format selector and Settings vertically aligned in one row.

![1008px Whiteboard header](whiteboard-header-1008.png)
![1440px Whiteboard header](whiteboard-header-1440.png)

## Sync failure

The selected local checkout contained three untracked files identical to incoming remote blobs. Git correctly refused to fast-forward over them. The integration now moves only byte-identical regular files into private state-directory backups, then fast-forwards. It does not stage unrelated work. If integration fails, the original files are copied back exclusively without overwriting concurrent edits. Differing files remain protected by Git.

Twelve HTTP integration tests passed, including identical incoming untracked files, differing untracked files, restoration after a refused merge, staged-index preservation and unrelated local edits.

The actual affected checkout was synchronized through `/api/sync` with `paths: []`: `synced: true`, `committed: false`, `integrated: true`; local HEAD and origin/main aligned. The existing modification to `Scriba-Diagramas.md` remained uncommitted and unpublished. Backups are under `~/Library/Application Support/AB Markdown/untracked-backups/`.

No App Store Connect upload or review change was performed.
