# Whiteboard controls and document workflow

22 October 2026. Chromium and WebKit, 390 × 900, 1024 × 900 and 1440 × 900.

The application form defaults no longer reach Excalidraw's controls. Fixed palette grids keep their SDK geometry; material, accent and accessibility tokens are applied at the SDK root, including portaled popovers. Tests check both color and shade swatches for overlap, clipping and viewport containment.

| Engine | Phone | Tablet | Desktop |
| --- | --- | --- | --- |
| Chromium | [390 px](chromium-390.png) | [1024 px](chromium-1024.png) | [1440 px](chromium-1440.png) |
| WebKit | [390 px](webkit-390.png) | [1024 px](webkit-1024.png) | [1440 px](webkit-1440.png) |

Commands:

- `node tests/whiteboard-colors.smoke.mjs`: all six palette layouts pass.
- `node tests/document-naming.smoke.mjs`: note/whiteboard names contain a stable creation timestamp; real rename persists through reload; returning to Note creates adjacent editable paragraphs and focuses the paragraph below the drawing. Chromium and WebKit at 390 and 1440 px.
- `node tests/modal-localization.smoke.mjs`: modal text fields remain editable without forwarding pointer, context-menu or keyboard events to the surrounding canvas. Four save-message languages verified.
- `node tests/excalidraw-libraries.smoke.mjs`: 187 bundled symbols; personal edits preserved; deleted or cleared symbols never reappear on subsequent initialization.
- `npm test`: 88 passing tests, including real HTTP/Git rename with stale-version, occupied-target, attachment, pin and unrelated-stage preservation checks.

Native text selection, Paste and Select All remain available in iOS text fields. These system editing actions are not an Excalidraw context menu.

Browser directory rename requires an actual file-move API. If unavailable, the editor preserves the note and directs the user to rename it in Files. It never implements rename as an unsafe overwrite-and-delete sequence.
