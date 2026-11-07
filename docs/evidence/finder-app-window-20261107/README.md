# Finder opens a Scriba application window

Validated on macOS on 7 November 2026 with the installed Scriba 1.17.2 local launcher.

## Cause and correction

`scripts/launch.mjs` used `/usr/bin/open <local URL>` for both normal launches and Finder document events. LaunchServices therefore chose the default browser instead of the installed Scriba window.

The launcher now resolves the installed local Chromium PWA through application-bundle metadata, matching the exact loopback origin. It activates that application and supplies the Finder URL through Chromium's app URL override. A public-site PWA cannot receive a local handoff. A fresh install without a local PWA uses a separate Chromium application window. Launch errors are visible in a Scriba alert and the local service log.

Chromium documents the URL override in its [command-line switch definitions](https://github.com/chromium/chromium/blob/main/chrome/common/chrome_switches.h). A normal HTTP open-URL event is not an equivalent override: the [Mac shim delegate](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/apps/app_shim/web_app_shim_manager_delegate_mac.cc) validates incoming URLs as registered protocol handlers.

## Manual validation through Finder

1. Created an external Markdown document named `Abertura em janela Scriba.md`, outside the configured repository, with spaces and accented text.
2. Used Finder's actual **Open With → Scriba** command through native UI automation.
3. Observed the document heading, paragraph and three list items in the standalone Scriba application window, without a browser tab/address bar. The application accessibility identity remained `com.google.Chrome.app.hkgkpeblfcklogolpcahjncmnojalcih`.
4. Verified the existing notes library remained visible and the document opened in reading mode. The interface confirmed that the external original was preserved.
5. Confirmed the original file's SHA-256 was unchanged before/after: `1ba2645c1d4ee0ebd86b7bc96abec2cc3b5b7e6586c9d7f39f6017e1dabdf6fe`.
6. Confirmed the existing local backend remained healthy with the same PID, 4111. The correction did not require restarting it.

The launcher/helper were installed in `/Applications/Scriba.app` and the application signature was regenerated and checked with `codesign --verify --deep --strict`. Existing documents, Git configuration and browser data were not rewritten. This is a local Mac launcher change; the submitted iOS build and public web application are unaffected.

## Automated validation

- `npm test`: **106 passed, 0 failed, 0 skipped**.
- New regression tests exercise real binary application plists and filesystem discovery; only the final OS application opener is replaced in those unit tests.
- Coverage includes a local PWA with an explicit browser profile, public-origin exclusion, launch without a file, remote-URL rejection and missing-browser behavior. The Finder integration itself was verified with the actual installed app as described above.
- `node --check scripts/launch.mjs`, `node --check scripts/editor-window.mjs`, `bash -n install.sh` and `git diff --check`: passed.
