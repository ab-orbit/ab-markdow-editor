# Save-copy dialog layout and drawing return checks

Verified October 22, 2026, in isolated Chromium and WebKit sessions.

The copy dialog inherited the global inline flex form layout. Its filename label and action footer occupied the same row with different margins, misaligning the controls. The copy form now uses a scoped one-column grid: the filename spans the available width and the actions occupy a separate row. Existing theme tokens and shared button styles remain authoritative.

`node tests/diagram-edit-and-copy.smoke.mjs` and `SMOKE_BROWSER=webkit node tests/diagram-edit-and-copy.smoke.mjs` import a synthetic Markdown note with a drawing larger than 50,000 characters, open its JSON source and switch to split View. Both engines restore the drawing in the reading pane. This baseline does not reproduce or resolve the owner's specific drawing symptom; the affected Markdown export is still needed. No private note content is included in the test or evidence.

The same journey opens Save a copy with a long filename and verifies that actions sit below the filename field and that the dialog has no horizontal overflow at 1440×900 and 390×844. TypeScript validation (`npx tsc --noEmit`) also passed.

- [Chromium desktop](chromium-desktop.png)
- [Chromium mobile](chromium-mobile.png)
- [WebKit desktop](webkit-desktop.png)
- [WebKit mobile](webkit-mobile.png)

These are source changes and browser evidence. They do not update the already submitted native build 27 or establish a new TestFlight release.
