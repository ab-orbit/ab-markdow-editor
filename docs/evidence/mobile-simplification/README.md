# Mobile document controls

The mobile editor has no formatting toolbar. Saving is mandatory on every platform (desktop, mobile and iOS), regardless of a legacy opt-out: a one-second idle debounce saves in the background, with a five-second retry timer. Automatic saves do not prompt for commit messages or make the editor read-only. Existing version-conflict protections remain active. Its overflow menu contains Import, Export, and Settings. Export opens Markdown/PDF choices; existing asset packaging remains in use. The information button provides Statistics and Table of Contents, without backlinks.

Statistics show words, Markdown source characters, parsed paragraphs, and estimated reading time (250 words/minute). Creation and modification dates use stored metadata; unavailable dates are explicitly labeled. The outline reuses heading navigation and per-level/global folding.

Browser checks verify persistence in IndexedDB with legacy automatic saving disabled and commit prompts enabled, plus Chromium and WebKit, portrait/landscape editing, cursor preservation, three menu actions, two information tabs, heading navigation, Markdown download, and Settings access. Physical iOS device testing remains separate.

- [Statistics — Chromium](statistics-chrome.png)
- [Outline — Chromium](outline-chrome.png)
- [Statistics — WebKit](statistics-webkit.png)
- [Outline — WebKit](outline-webkit.png)

Run: `node tests/mobile-writing.smoke.mjs` and `MARKDOWN_BROWSER=webkit node tests/mobile-writing.smoke.mjs`.

Desktop regression: `node tests/desktop-autosave.smoke.mjs` (also with `MARKDOWN_BROWSER=webkit`) verifies persisted note contents with legacy autosave disabled, commit prompts enabled, and editing focus preserved through successive background saves.

Visual refinement: lighter 14px outline labels, a semibold top level, subtle separators and selection, unboxed folding controls, and global folding beside Close. The three-action menu uses left-aligned labels, 16px vector icons, a Settings separator, transparent backdrop, and 44px touch targets.

- [Refined menu — dark](menu-chrome.png)
- [Refined menu — light](menu-webkit-light.png)
- [Refined outline — light](outline-webkit-light.png)
