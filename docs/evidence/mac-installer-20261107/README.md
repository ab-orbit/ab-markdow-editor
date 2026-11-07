# Fresh Mac installer acceptance — 7 November 2026

The public installation link still selected `main`, while the Finder window and Markdown icon fixes existed only on a feature branch. This release brings both fixes onto the normal installation path and adds checks of the generated application before replacement.

## Actual fresh build

Built the application from a new checkout, using the real installer, npm lockfile and checksum-verified official Node distribution:

```sh
MARKDOWN_PACKAGE_ONLY=1 \
MARKDOWN_APPLICATIONS_DIR=/tmp/scriba-mac-installer-20261107/package \
MARKDOWN_DESKTOP_DIR=/tmp/scriba-mac-installer-20261107/desktop \
./install.sh

SCRIBA_MAC_BUNDLE=/tmp/scriba-mac-installer-20261107/package/Scriba.app npm test
```

The signed application was generated successfully, version **1.17.2**, with embedded **Node v22.23.4**, a resolvable `AppIcon.icns` Markdown document icon and the packaged `editor-window.mjs` launcher. `codesign --verify --deep --strict` passed both before and after moving the app to the output directory.

The complete suite passed: **114 tests, 0 failures, 0 skipped**. [Full test output](unit-tests.txt).

The regression tests operate on a copy of that actual signed application and confirm rejection of a missing window helper, missing document-icon declaration, absent icon resource, Alternate Markdown rank, a resource changed after signing and an incorrect expected version. The initially empty verifier failed the negative cases; after implementation all cases passed.

The existing installed Scriba and its local service were preserved during packaging. The existing service remained healthy on port 43127 with PID 4111, and no default-application settings or desktop aliases were changed by the test.

## Future builds

- `install.sh` signs and validates its completed application before stopping the current service or replacing an existing Scriba installation.
- The [macOS installer workflow](../../../.github/workflows/macos-installer.yml) builds from checkout on a fresh hosted Mac, runs all tests against that artifact and retains a ZIP identified by source commit.
- [Installation and update procedures](../../MAC-INSTALLATION.md) point to `main` and explain the user's explicit default-editor selection. Installing the application does not silently replace a different default editor.

No new web or iOS interface was added. Finder interaction and appearance were validated in the preceding [application-window](../finder-app-window-20261107/README.md) and [Markdown associations](../markdown-associations-20261107/README.md) checks.
