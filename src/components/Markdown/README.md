# Markdown editing

React 19 client components in the standalone Scriba application. This extracted copy is independent of the original Lab.

```tsx
'use client';

import { useState } from 'react';
import { MarkdownWorkbench } from '@/components/Markdown/MarkdownWorkbench';

export function Notes() {
  const [value, setValue] = useState('# Research note\n');
  const [fileName, setFileName] = useState('note.md');
  return <MarkdownWorkbench
    value={value}
    onChange={setValue}
    fileName={fileName}
    onFileNameChange={setFileName}
    initialMode="live"
  />;
}
```

`MarkdownEditor` can be used separately with `value`, `onChange`, `livePreview`, `readOnly`, optional `assets` and `onImageFiles`. Its optional ref exposes `command`, `selection`, `replace`, `tables`, `editBlock` and `finishBlock` for programmatic integration. `MarkdownReadingView` accepts `value`, optional registered `assets`, `onEditTable` and `onToggleTask`. The host owns source persistence. The workbench owns its session asset registry and package import/export. Its `initialMode` is read once on mount. Set `readOnly` to prevent interactive edits and imports.

## Editing tools

- Heading levels 1–3 and paragraph style, with distinct H1/H2/H3 visual previews in a keyboard-accessible menu; bold, italic, strikethrough, inline code and fenced code.
- Quotes, bullet/numbered/task lists, indentation/outdentation and horizontal rules.
- Undo/redo, keyboard shortcuts `Mod-B`, `Mod-I`, `Mod-Shift-X`, and collapsible heading/code sections through the editor gutter.
- Link dialog with selection preservation and protocol validation; footnote insertion with an unused numeric identifier and its definition.
- GFM tables: insertion plus **Editar tabela** in Visão/Ler. The modal edits cells, adds/deletes rows and columns, changes column alignment and sorts body rows. Applying performs one source replacement; canceling leaves source untouched. The visual editor accepts up to 20 columns and 100 rows; larger tables remain editable as source.
- Task checkboxes in Visão/Ler update the corresponding source marker and are undoable.

## Source block interaction

The host opens existing documents with `initialMode="read"`; new notes use `live`. `doubleClickToEdit` defaults to true. Reading nodes retain their original mdast offsets for double-click/Enter navigation. The workbench maps CRLF/CR offsets into CodeMirror's normalized LF document before resolving the block. Pure navigation does not emit source changes, preserving the parent value, including a UTF-8 BOM and original line endings.

`blockEditing.ts` stores a transient source range in a CodeMirror StateField. Its effects map through edits and leave the saved document untouched. Double clicking selects the parser's paragraph, heading, code block or table, rather than a wrapped visual line or every paragraph following a heading. Moving the selection outside the block clears it. `Mod-Enter`, Escape and the formatting toolbar provide equivalent controls. Source mode retains native double-click word selection.

The source CodeMirror instance stays mounted across mode changes. Contextual reading edits mount a separate editor for the selected source range; its changes replace only that range and preserve surrounding source bytes. Undo/redo within a contextual block belongs to that block while it remains open. Standalone image widgets respect the revealed block range. Editor markers use platform text tokens and live mode shares the reading font. Modal and settings Escape handling takes priority over block completion.

## Images and portable packages

Insert **PNG, JPEG, GIF or WebP** with the Imagem picker, paste image files, or drop them into the source editor. Limits: 50 images, 10 MiB per image, 40 MiB total image bytes. Image signatures are checked; SVG/HEIC and arbitrary attachments are not supported.

Source contains durable relative references, for example `![Description](assets/<unique-id>-image.png)`. Local object URLs exist only in the session registry; they are revoked when opening another document or unmounting. Retained assets remain available for redo after removing an image from the source. Unreferenced registered assets are also included in the package.

In Escrever, a standalone image line outside the selection becomes an image widget. Click **Editar descrição / caminho** to reveal its Markdown. Fonte keeps image syntax visible; Visão/Ler display the resolved local image. Unknown relative paths and remote URLs remain described placeholders, without automatic network requests.

**Baixar .md** exports source only. **Baixar pacote** exports a ZIP containing `text.md`, `info.json`, and the original image bytes under `assets/`. Reopen that ZIP through **Abrir .md / ZIP** to restore both source and images. One nested TextBundle ZIP/`.bear` with raster assets can also be opened. This is a portable source-and-assets package, not an export of the Bear database.

Package imports are limited to 50 MiB compressed and uncompressed data, 200 ZIP entries and a single `text.md`; traversal paths and oversized/unsupported images are rejected. The decoded Markdown is limited to 5 MiB. No archive is extracted to the filesystem and no document bytes are uploaded.

## Implementation

- CodeMirror 6 owns selection, undo/redo, keyboard input, syntax parsing and editable text. The React wrapper mounts the editor in an effect, destroys it on unmount and synchronizes external changes without emitting feedback changes. Switching modes preserves the mounted editor and its history.
- Syntax-tree decorations hide heading, emphasis, inline-code and strikethrough delimiters outside the active inline span; an explicit block range reveals every delimiter within that range; registered standalone images use block widgets. These do not change the document. Fenced-code delimiters remain explicit. The CodeMirror grammar includes GFM tables, tasks and strikethrough.
- `react-markdown` + `remark-gfm`, already used by this application, render the reading view. Raw HTML is parsed with `rehype-raw` and sanitized with `rehype-sanitize`; inline styles use a presentation-only allowlist. Static SVG geometry is supported; scripts, event handlers, foreignObject, animation, SVG images and external SVG resources are excluded. The default URL filter remains active. Image components resolve only the local registry. Ordinary links open in another tab when clicked; footnote anchors stay in this document.
- The split view is labeled **Visão**. Both columns stay aligned at the top even when their rendered heights differ. Defined footnotes retain their generated IDs and navigate within the page in both directions. Undefined markers such as `[^20]` are shown as `[20?]` with an accessible explanation; no source is fabricated and the original Markdown is unchanged. Code literals are not annotated.
- All colors, fonts, radii and font scaling use the platform tokens. CSS variables also resolve inside CodeMirror, so platform and embed themes apply without remounting the editor. Styles are isolated in a CSS Module.
- `readMarkdownFile` accepts `.md`, `.markdown`, `.mdown`, up to 5 MiB, with strict UTF-8 decoding. A freshly opened file retains decoded CRLF/BOM in the parent's value. CodeMirror edits may normalize line endings to LF. The downloader exports the current value as UTF-8, without another transformation. The browser downloads a new file; it does not overwrite the input file.
- Opening another file asks before replacing a changed document. A `beforeunload` warning covers browser reload/close. It does not guard Next.js client-side navigation; there is no automatic draft storage. Download before leaving. Filenames/initial values for a new document should be changed together by the host.

This is an independent browser implementation inspired by Bear's native attributed-text editing; no Bear code, fonts or assets are included. It does not reproduce all native attachments, wiki-link semantics, arbitrary file imports, sync or every native editing feature. Tables are edited through a source-backed modal, rather than Bear's native embedded cell views.

## Checks

```sh
npm run build
npm test
node tests/block-editing.smoke.mjs
MARKDOWN_BROWSER=webkit node tests/block-editing.smoke.mjs
node tests/document-reload.smoke.mjs
```

The block smoke test uses actual HTTP, temporary Git checkouts and browser pointer/keyboard interactions. It verifies default reading, inline and whole-block marker visibility, multi-line scope, undo/redo, exact saved source and commits, preference persistence, CRLF/BOM offsets, responsive layouts and Chromium touch input. It never uses the user's note repository.

## HTML layouts, Lucide icons and inline SVG

HTML blocks support local presentation styles (flex/grid, spacing, borders and typography). Leave a blank line before and after an HTML block. Keep its inner HTML together; blank lines can make Markdown resume parsing within the block.

Use any installed Lucide icon by its kebab-case name. The catalog is bundled locally and loaded on demand. Icons inherit text color and size. Decorative icons are hidden from assistive technology; provide `aria-label` for meaningful icons. Unknown names display a text fallback.

```html
<div style="display:flex;flex-wrap:wrap;gap:8px">
<div style="flex:1;min-width:180px;border:1px solid currentColor;border-radius:10px;padding:16px;text-align:center">
<i data-lucide="git-branch" style="font-size:24px"></i>
<div><strong>Estrutura econômica</strong></div>
<div>Fases, fluxos, CNAE/NCM, relações</div>
</div>
<div style="flex:1;min-width:180px;border:1px solid currentColor;border-radius:10px;padding:16px;text-align:center">
<i data-lucide="users" style="font-size:24px"></i>
<div><strong>Stakeholders</strong></div>
<div>Organizações, pessoas, coletivos, agregados</div>
</div>
<div style="flex:1;min-width:180px;border:1px solid currentColor;border-radius:10px;padding:16px;text-align:center">
<i data-lucide="messages-square" style="font-size:24px"></i>
<div><strong>Vozes e perspectivas</strong></div>
<div>Demandas, interesses, riscos, oportunidades e posições</div>
</div>
</div>
```

Inline static SVG is also accepted:

```html
<svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Circle"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
```

Source and ZIP exports preserve the original HTML, SVG and icon markers. PDF export does not currently render raw HTML layouts. SVG file attachments remain unsupported; paste SVG markup into the source instead.

The formatting toolbar includes **Ícones**, a searchable local Lucide gallery. Search by English icon name and select a result to insert at the saved source selection or the visual editor caret. The inline `documentIcon` node preserves the HTML marker through visual editing and Markdown export. The catalog loads on demand; results are shown in batches of 80.

## Contextual reading edits and language highlighting

Double-clicking a paragraph, heading or code fence in reading opens only that source block inline. Surrounding content stays rendered. Clicking outside the block or pressing Escape restores reading. Active headings show their H1–H6 level in the margin. The explicit whole-note visual editing control remains available separately.

Double-clicking a table cell edits its content directly without showing table delimiters. Tab/Shift-Tab navigate cells; Enter, Escape or a click outside commits the cell and returns to reading. The existing table dialog still handles row/column structure.

Reading and split previews highlight locally bundled Shiki languages; source and local block editors load CodeMirror language parsers on demand. Common aliases include html, python/py, javascript/js, typescript/ts, console/terminal and shell/bash. Unknown languages remain escaped plain text. Syntax colors use the shared code tokens in both themes.

Split view synchronizes scrolling in both directions using rendered block source offsets, preserving the relationship when code or diagrams have different heights from their Markdown.

## Notes commands and heading sections

The Notes header groups note creation, whiteboard creation and search. Its menu retains refresh, note counts and About. A new whiteboard is a regular Markdown document containing an empty Excalidraw fence; replacing an edited note uses the existing save/discard/cancel flow.

The outline now includes H1–H6, with level badges and distinct typography. Each section can be folded from its reading heading or outline row. A single icon beside Close toggles expand-all/collapse-all. Outline rows show disclosure arrows only when they contain deeper headings. Fold state belongs to the open workspace presentation and never changes the saved Markdown. Navigation opens the destination's ancestors, and split scrolling ignores hidden blocks.

Mathematical rendering and import compatibility are documented in [the math evidence](../../../docs/evidence/math/README.md). Formula nodes retain raw source tokens until edited.
