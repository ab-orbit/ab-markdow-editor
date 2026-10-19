# Excalidraw in Scriba

The official React SDK **0.18.1** is pinned, with React 19 peer support. Primary sources: [upstream release](https://github.com/excalidraw/excalidraw/tree/v0.18.1), [integration](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration), [local fonts](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation), [restore](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore), [export](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export), and [element skeleton API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton).

## Document model and editing

An `excalidraw` fence contains ordinary scene JSON (`type`, `version`, `elements`, portable `appState`, embedded raster `files`). A separate dialect leaves the Mermaid/Pele/Beautiful picker and its saved preferences unchanged. Reading, split view, CodeMirror live widgets and natural editing share the same visual canvas. Opening, zooming, exporting or applying an untouched canvas preserves the original Markdown bytes. Applying a changed scene replaces its fence body; other blocks, comments, BOM and CRLF remain intact in reading/natural editing. CodeMirror retains its existing LF normalization for source edits.

The canvas is a full-screen native dialog, with explicit apply/cancel, pending-change confirmation and origin-local IndexedDB recovery drafts. Drafts are keyed by document, content and occurrence, never submitted to Excalidraw services. Libraries persist separately in this origin. An active canvas blocks automatic source reload at both request and response time, including a file check already in flight. A failed apply retains the recovery draft.

## Rendering, performance and fonts

Only visible diagrams execute the lazy SDK renderer. Ordinary Markdown does not import the SDK, font manifest or canvas stylesheet. SVG results are deduplicated and cached (16 entries / 12 MB). Canvas mounts only for editing; pan, wheel zoom and magnification reuse the existing SVG. Large scenes retain readable labels with horizontal navigation.

All 230 bundled font faces/subsets are hosted under `/excalidraw/0.18.1/fonts/` and precached with the application shell. The checked-in manifest comes from the matching upstream font descriptors; only subsets needed by scene text load into the document. Unicode ranges and font weights are preserved. Font licenses/notices and SDK MIT license ship in `public/licenses/`.

An exact-version Vite adapter removes the SDK's unconditional CDN font fallback, including from `FontFace` construction. An adapter mismatch fails the build. The preview uses `exportToSvg(skipInliningFonts: true)`. Portable SVG exports embed the relevant original WOFF2 subsets directly, avoiding the SDK's optional WASM font subsetter and its worker/eval requirements. PNG uses the SDK canvas exporter, with no background, bounded to 8192 px and 16 megapixels. The full drawing exports independently of preview zoom/pan. Scene exports preserve editable elements, groups, frames, bindings and referenced raster files.

## Content boundaries

JSON is validated before SDK restore: at most 8 MB / 2,000 elements, bounded geometry and point lists, valid IDs and finite values. Allowed scene elements are rectangle, ellipse, diamond, text, line, arrow, freedraw, image and frame. Images must be embedded PNG/JPEG/GIF/WebP with matching raster signatures. Reading a scene never loads external images or embeds a website. Scripts, foreignObject, active links, animations and external SVG paint resources are removed from preview output with a separate DOMPurify policy; the stricter Mermaid policy is unchanged. Runtime viewport/selection/collaboration state and file-system handles are not imported.

Real-time collaboration, rooms, public share links, Excalidraw+, AI services and website embeds are outside this integration. Saving a Markdown note through GitHub remains file/version synchronization. Legacy locally provided fonts depend on platform availability; use the bundled modern fonts for portable results.

## Reference and maintenance

`docs/Scriba-Diagramas.md` is the canonical pinned manual. Its versioned `excalidraw-v1` extension contains **29 original contextual scenes**, exercises and interpretation. `scripts/build-excalidraw-reference.mjs` expands authored skeletons with the pinned official SDK and validates SVG output; resulting fences use the standard JSON format. Regeneration uses Chrome and a temporary Vite server, without personal notes or remote drawing services.

Reference migration tracks Excalidraw independently from the previous ZenUML extension, so it does not restore an intentionally removed older section. Native/Git and browser/GitHub migrations preserve source annotations, unpinning, deletion, collision handling and optimistic revision checks. Browser network preparation runs outside IndexedDB transactions and rechecks the local snapshot before applying.
