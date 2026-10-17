# Markdown editing

Reusable client components for Next.js 16 / React 19. The lab is available at `/lab/markdown` and linked from `/lab`.

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

`MarkdownEditor` can be used separately with `value`, `onChange`, `livePreview`, `readOnly`, optional `assets` and `onImageFiles`. Its optional ref exposes `command`, `selection`, `replace` and `tables` for programmatic integration. `MarkdownReadingView` accepts `value`, optional registered `assets`, `onEditTable` and `onToggleTask`. The host owns source persistence. The workbench owns its session asset registry and package import/export. Its `initialMode` is read once on mount. Set `readOnly` to prevent interactive edits and imports.

## Editing tools

- Heading levels 1–3 and paragraph style; bold, italic, strikethrough, inline code and fenced code.
- Quotes, bullet/numbered/task lists, indentation/outdentation and horizontal rules.
- Undo/redo, keyboard shortcuts `Mod-B`, `Mod-I`, `Mod-Shift-X`, and collapsible heading/code sections through the editor gutter.
- Link dialog with selection preservation and protocol validation; footnote insertion with an unused numeric identifier and its definition.
- GFM tables: insertion plus **Editar tabela** in Visão/Ler. The modal edits cells, adds/deletes rows and columns, changes column alignment and sorts body rows. Applying performs one source replacement; canceling leaves source untouched. The visual editor accepts up to 20 columns and 100 rows; larger tables remain editable as source.
- Task checkboxes in Visão/Ler update the corresponding source marker and are undoable.

## Images and portable packages

Insert **PNG, JPEG, GIF or WebP** with the Imagem picker, paste image files, or drop them into the source editor. Limits: 50 images, 10 MiB per image, 40 MiB total image bytes. Image signatures are checked; SVG/HEIC and arbitrary attachments are not supported.

Source contains durable relative references, for example `![Description](assets/<unique-id>-image.png)`. Local object URLs exist only in the session registry; they are revoked when opening another document or unmounting. Retained assets remain available for redo after removing an image from the source. Unreferenced registered assets are also included in the package.

In Escrever, a standalone image line outside the selection becomes an image widget. Click **Editar descrição / caminho** to reveal its Markdown. Fonte keeps image syntax visible; Visão/Ler display the resolved local image. Unknown relative paths and remote URLs remain described placeholders, without automatic network requests.

**Baixar .md** exports source only. **Baixar pacote** exports a ZIP containing `text.md`, `info.json`, and the original image bytes under `assets/`. Reopen that ZIP through **Abrir .md / ZIP** to restore both source and images. One nested TextBundle ZIP/`.bear` with raster assets can also be opened. This is a portable source-and-assets package, not an export of the Bear database.

Package imports are limited to 50 MiB compressed and uncompressed data, 200 ZIP entries and a single `text.md`; traversal paths and oversized/unsupported images are rejected. The decoded Markdown is limited to 5 MiB. No archive is extracted to the filesystem and no document bytes are uploaded.

## Implementation

- CodeMirror 6 owns selection, undo/redo, keyboard input, syntax parsing and editable text. The React wrapper mounts the editor in an effect, destroys it on unmount and synchronizes external changes without emitting feedback changes. Switching modes preserves the mounted editor and its history.
- Syntax-tree decorations hide heading, emphasis, inline-code and strikethrough delimiters outside selected lines; registered standalone images use block widgets. These do not change the document. Fenced-code delimiters remain explicit. The CodeMirror grammar includes GFM tables, tasks and strikethrough.
- `react-markdown` + `remark-gfm`, already used by this application, render the reading view. Raw HTML is skipped and the default URL filter remains active. Image components resolve only the local registry. Ordinary links open in another tab when clicked; footnote anchors stay in this document.
- The split view is labeled **Visão**. Both columns stay aligned at the top even when their rendered heights differ. Defined footnotes retain their generated IDs and navigate within the page in both directions. Undefined markers such as `[^20]` are shown as `[20?]` with an accessible explanation; no source is fabricated and the original Markdown is unchanged. Code literals are not annotated.
- All colors, fonts, radii and font scaling use the platform tokens. CSS variables also resolve inside CodeMirror, so platform and embed themes apply without remounting the editor. Styles are isolated in a CSS Module.
- `readMarkdownFile` accepts `.md`, `.markdown`, `.mdown`, up to 5 MiB, with strict UTF-8 decoding. A freshly opened file retains decoded CRLF/BOM in the parent's value. CodeMirror edits may normalize line endings to LF. The downloader exports the current value as UTF-8, without another transformation. The browser downloads a new file; it does not overwrite the input file.
- Opening another file asks before replacing a changed document. A `beforeunload` warning covers browser reload/close. It does not guard Next.js client-side navigation; there is no automatic draft storage. Download before leaving. Filenames/initial values for a new document should be changed together by the host.

This is an independent browser implementation inspired by Bear's native attributed-text editing; no Bear code, fonts or assets are included. It does not reproduce all native attachments, wiki-link semantics, math/diagram rendering, arbitrary file imports, sync or every native editing feature. Tables are edited through a source-backed modal, rather than Bear's native embedded cell views.

## Checks

```sh
npx vitest run src/components/Markdown src/lib/markdown
npx tsc --noEmit
npx eslint src/components/Markdown src/components/Lab/markdown src/app/lab/markdown src/lib/markdown
# Requires the existing local app at localhost:3100; no backend session is needed.
npx playwright test --config playwright.markdown.config.ts
```

Browser checks cover formatting, undo/redo, links, footnotes, tasks, table cell edits, image picker/paste/drop, live image widgets, original image byte preservation, ZIP reopening, invalid-image rejection, the Lab entry and desktop/mobile native/embed themes. Screenshots are saved under `docs/evidence/markdown-lab/`.
