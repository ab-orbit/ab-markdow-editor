# Standalone Markdown editor

Approved scope: extract the Markdown Lab into a separately installable macOS local web application without changing the Lab. Preserve editing capabilities and add a configurable Git checkout, document persistence, automatic commit and push on save using existing local credentials.

The isolated copy uses React/Vite and the original CodeMirror/Markdown components. A loopback-only Node HTTP server serves the built application and handles Git/filesystem operations. Repository selection uses a bundled native macOS directory chooser; clone destination selection proposes a new subfolder named after the remote. The installed app bundles an official Node LTS distribution and opens the default browser. No monorepo imports, external service or database is required.

Once configured, the main screen contains only the workbench. A gear opens repository, file and Git controls in a native HTML dialog; closing it preserves the mounted editor and undo history. A toolbar save action and Cmd/Ctrl+S remain available directly. Notifications are temporary.

Repository settings remain in the user's Application Support directory. New documents use an absent-file version; existing documents use a SHA-256 version. Saves reject conflicts, traversal, symlinks and Git internals. Raster attachments are stored relative to the document. Commits stage only the current document and its attachments and reject pre-existing staged work. Push uses the checkout's existing upstream, or configures origin for the first push. Save-sync returns the new on-disk content hash even if a later Git operation fails; retries do not duplicate commits. Unchanged documents do not create empty commits. User preferences persist beside the repository setting: optional per-save commit notes, optional autosave, and a whole-minute interval defaulting to one minute. Scheduled saves skip unchanged documents and pause while settings or notes are open.

The installer targets both Apple Silicon and Intel, validates its downloaded runtime using official SHA-256 sums, builds with the lockfile, generates an icon, and installs a `.app` plus a Desktop link. Validation covers real HTTP operations, a temporary Git remote, browser navigation on desktop/mobile and installed macOS launching.

Implementation sequence:

1. Copy editor, asset utilities and theme tokens into an independent package.
2. Implement serialized repository mutations, conflict checking and authenticated local HTTP endpoints.
3. Add repository configuration, file open/save, commit/push and themes to the host UI.
4. Package the runtime, icon and launcher in an idempotent macOS installer.
5. Run production build, HTTP tests, browser journeys, contrast checks and macOS installation/launch checks; save evidence.
