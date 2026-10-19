# Local Git synchronization recovery

Verified on 19 October 2026. This patch changes the local macOS Git backend; it does not change the iOS binary submitted to Apple or the GitHub API storage backend.

## Failure and correction

Saving created a local commit, but pushing failed with `fetch first` after another device had updated the same branch. The local backend attempted a push without fetching and integrating those remote commits.

The backend now fetches the configured upstream before pushing. With a clean checkout, remote-only commits fast-forward the branch and independent commits merge without rewriting either history. A concurrent remote advance permits one additional integration and normal push. New branches retain the initial upstream-creation behavior.

Uncommitted files, a staged index and existing Git operations remain protected. Incompatible changes to the same note return the conflicting paths and abort only the merge started by Scriba. Both committed versions remain available. The implementation does not stash edits, force-push or reset the checkout.

The affected configured checkout was backed up outside the repository, integrated and pushed successfully. Its local and remote heads matched afterward, both original commits remained ancestors, and the working tree was clean. Private note content, repository identifiers and backup files are excluded from this evidence.

## Verification

`npm test`: **60 passed, 0 failed**. The synchronization HTTP tests use real Git repositories, a bare remote and a second checkout to simulate another device.

- Remote-only updates are downloaded without creating empty commits.
- Independent local and remote edits reach both copies with their history preserved.
- Conflicting note edits retain both versions and leave no Scriba-created merge active.
- Saving one note preserves unrelated uncommitted work and the empty index.
- A user-started merge with a clean index is left untouched.
- A real pre-push hook publishes a concurrent remote change; synchronization integrates it and retries successfully.
- A first push reconciles an existing remote before creating its upstream.
- Existing save, push-failure retry, hooks, identity, staged-file protection, repository transfer and GitHub gateway tests remain passing.

The regression assertions were run before the implementation and failed with the original rejection. The same assertions passed after the correction. This is a backend change with HTTP/Git evidence and no UI layout changes.

## Installed application

The existing macOS application was backed up, updated with the verified backend and restarted. Its bundled Node runtime was preserved and deep code-signature verification passed. A real authenticated `POST /api/sync` against the configured checkout returned `synced: true` and `committed: false`; both heads matched, the checkout was clean and both pre-integration commits remained ancestors. The app's private settings and note directories were retained.
