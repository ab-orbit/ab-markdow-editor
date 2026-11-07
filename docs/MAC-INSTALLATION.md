# Mac installation and release checks

The public **Install on Mac** link leads to this repository's README. New installations must use `main`; fixing an app on one Mac or pushing a feature branch does not update that distribution path.

## Install or update

For a new installation:

```sh
git clone --branch main https://github.com/ab-orbit/ab-markdow-editor.git
cd ab-markdow-editor
./install.sh
```

To update an existing source installation, save open documents, return to its source clone and fetch the current release source before rebuilding:

```sh
git switch main
git pull --ff-only origin main
./install.sh
```

The installer does not perform a silent Git update or discard source edits. It preserves notes and application state while replacing its own application bundle and restarting the existing local service.

## Checks before installation

`scripts/verify-macos-bundle.mjs` inspects the actual, signed `Scriba.app` produced by `install.sh` before the installer stops the current local service or replaces an existing app. Installation fails if any of these checks fails:

- The bundle identifier and both version fields match the source package.
- Markdown is registered as an Editor with Default rank.
- Both the document declaration and imported Markdown UTI point to a real bundled ICNS document icon.
- The application executable, local server, HTML entry point and launcher dependencies exist.
- `editor-window.mjs` loads from the bundled resources and exposes the application-window launcher.
- The bundled Node runtime runs, meets the package's minimum version and parses the bundled scripts.
- macOS verifies the complete application signature.

For a normal installation, preflight also resolves a supported local application-window route through Chrome, Edge, Brave or Chromium. It does this without opening a window and stops with an installation requirement message if no compatible browser is available. Package-only CI builds skip that host preference check and test the resolver against isolated real bundle metadata instead.

The installer gives the build command a 4 GB Node heap unless an explicit heap limit is already present in `NODE_OPTIONS`. The clean hosted Mac exposed a Vite failure at Node's 2 GB default while processing the editor/diagram bundles. This setting applies to the build subprocess, rather than the installed local service.

Successful installation re-registers this specific application with LaunchServices. It does not erase the global LaunchServices registry or automatically replace another editor chosen by the user. To select Scriba for every `.md` file, use **Finder → Get Info → Open with → Scriba → Change All** and confirm. Finder may need a relaunch to refresh an old cached icon after an update. The installer prints the default-app instructions at completion.

## Fresh-build acceptance and CI

The **macOS installer** GitHub Actions workflow builds from checkout on a fresh hosted Mac for pull requests and changes to `main`, then runs the full Node test suite against the resulting signed app. It keeps a ZIP of that verified app, identified by commit, for release QA.

The `main` branch requires the **Build and verify Mac installer** check from the GitHub Actions app before changes can merge, with an up-to-date branch and enforcement for administrators as well.

The bundle regression tests copy that signed artifact and deliberately remove the window helper, remove the document-icon declaration/resource, downgrade the Markdown handler rank, alter a signed resource and supply a stale expected version. Each damaged package must be rejected. These tests do not modify the installed Scriba, Finder defaults or the user's files.

Run the same packaging flow locally without installing or starting a service:

```sh
MARKDOWN_PACKAGE_ONLY=1 \
MARKDOWN_APPLICATIONS_DIR=/tmp/scriba-package-check \
MARKDOWN_DESKTOP_DIR=/tmp/scriba-package-desktop \
./install.sh

SCRIBA_MAC_BUNDLE=/tmp/scriba-package-check/Scriba.app npm test
```

The output app path must not already exist. Package-only mode exits before aliases, LaunchServices registration, service changes or UI launch. It is intended for packaging QA; normal installations still use `./install.sh`.

The automated checks validate the built package and the launch-command behavior. The real Finder interaction is also covered by the recorded [Open With validation](evidence/finder-app-window-20261107/README.md) and [default association, icon and double-click validation](evidence/markdown-associations-20261107/README.md).

These changes apply to the local Mac installer. The web/PWA shell and native iOS App Store release remain separate distribution channels.
