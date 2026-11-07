# Markdown default application and document icons

Validated on the user's Mac on 7 November 2026.

## Findings

- Finder's **Get Info** for the selected `.md` document showed **One Markdown (default)**, not Scriba. A fresh read through `NSWorkspace.urlForApplication(toOpen:)` also selected One Markdown for both `.md` and `.markdown` samples.
- The installed Scriba bundle and installer did not declare `CFBundleTypeIconFile` or `UTTypeIconFile`. The document handler was ranked `Alternate`.
- The actual Scriba bundle resolved correctly to `/Applications/Scriba.app`; this failure was independent of the previous launcher-to-browser fix.

## Correction

- Set the user's requested global preference through Finder's **Get Info → Open with → Scriba → Change All** flow.
- Added the bundled `AppIcon.icns` as the Markdown document icon and imported-type icon. The document handler is now ranked `Default`, while the installer continues to preserve the user's explicit default-application preference.
- Updated the installed application's plist, regenerated its existing ad-hoc signature, verified the bundle and re-registered that specific application. The local backend was not restarted.
- `.markdown` immediately showed the Scriba icon; Finder retained the old cached `.md` icon until Finder was relaunched through its system Relaunch control. After relaunch, both the file's Get Info preview and a Finder list displayed the Scriba logo.

## Acceptance checks

The initial read-only installed-bundle check failed with `Missing Markdown document icon`. After the correction:

```sh
xcrun swift tests/macos-associations.smoke.swift /Applications/Scriba.app \
  /tmp/scriba-markdown-associations-20261107/Association.md \
  /tmp/scriba-markdown-associations-20261107/Association.markdown
```

The bundled document icon resolved to a real ICNS resource, and LaunchServices selected `/Applications/Scriba.app` for both samples. This test reads actual macOS state without changing defaults or opening applications.

Manual native UI validation confirmed **Scriba (default)** in Get Info, the Scriba logo in the large icon preview and Finder list, and an ordinary **double click** opening the external Markdown fixture in the standalone Scriba window in reading mode. No “Open With” selection was needed for that final test.

The external document remained unchanged: SHA-256 `1ba2645c1d4ee0ebd86b7bc96abec2cc3b5b7e6586c9d7f39f6017e1dabdf6fe`.

`plutil -lint`, `codesign --verify --deep --strict`, `bash -n install.sh` and `git diff --check` passed. No frontend or iOS code changed, so no new web deployment or App Store submission is required for this local Mac correction.
