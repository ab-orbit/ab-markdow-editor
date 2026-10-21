# Document loading and converter-response recovery

## Investigated input

The supplied `Agentic GraphRAG Integrating Knowledge Graphs, Reasoning, and Agency for Enterprise AI.md` is a 925,510-byte converter response envelope, not a Markdown document. Its JSON contains a roughly 847,000-character line; the actual Markdown is `data.cleaned_text` (835,281 characters, 10,002 lines, 1,026 headings). The supplied book is not copied into this repository or its screenshots.

Two independent mechanisms explained the slowdown and permanent freeze:

1. Treating the envelope as Markdown exposes the GFM parser to a very large escaped line. An isolated raw parse was stopped after 25 seconds; parsing the extracted Markdown took about 450–500 ms.
2. The legacy math scanner returned the starting offset for an unclosed `{` group. Its caller then retried the same offset forever. The minimal input `x = {` reproduced the stall in a child process stopped after two seconds; the supplied book also stalled in that transform after its initial parse. Unclosed groups now return the failure sentinel, and both scanning branches require forward progress.

## Changes

- Only the explicit successful `convert_to_markdown` response format is unwrapped. Ordinary Markdown, arbitrary JSON, malformed envelopes and code examples remain unchanged. JSON decoding restores real line breaks without globally replacing escapes inside code or formulas.
- Converter imports, saved library notes and recovered legacy drafts open a separate ` (Markdown).md` copy. Existing copies receive an incremental suffix. The original source/file is preserved, including when autosave is enabled. Explicit conflict handling still protects a pre-existing destination.
- File imports select reading mode before publishing the new source, avoiding a transient full-book rich-editor initialization.
- Whiteboard detection skips full Markdown parsing when no Excalidraw fence is present. Heading information is obtained lazily if the user later adds a board; BOM-prefixed scenes and comment-only canvas documents remain supported.
- The reading view retains its Markdown-render element across unrelated state updates. Context still updates folding, editing controls and assets. Offscreen book sections use progressive browser layout where supported.
- Loading yields a painted frame before preparation. The exact Polis Brand/HypathiaLoader plume and three-particle cycle are reused, with the existing `--oil` orange token and both themes. Loading also covers note switching and draft recovery. Reduced-motion preferences are respected. The animation is an indeterminate activity indicator, not a fabricated percentage.

## Verification and observed timing

Isolated browser contexts, local Vite development server, supplied input, same machine:

| Browser/layout | Open | Subsequent UI action | Reload/restore |
| --- | ---: | ---: | --- |
| Chromium, desktop | 2,012 ms | 482 ms | Passed |
| WebKit, 390 × 844 | 2,218 ms | 903 ms | 5,179 ms |

These are single-run observations, not physical-device benchmarks or guaranteed latency. Each test checked that the loader painted, the import stayed out of the rich editor, the exact extracted Markdown was saved and restored, the interface responded after opening, and the original input file's SHA-256 stayed unchanged.

- `npm test`: 78 Node tests passed, including incomplete math groups and converter recognition.
- Seven browser regressions passed: local editing/source preservation, split synchronization, HTML/SVG sanitization and Markdown/ZIP exports.
- Loader journeys passed in Chromium and WebKit, both themes and reduced motion.
- Legacy draft/library recovery checks passed in Chromium and WebKit, preserving original stored bytes/version and incrementing copy collisions. Whiteboard fast-path checks cover BOM scenes, comment-only documents and deferred heading labels.

Commands:

```sh
node tests/document-loading.smoke.mjs
MARKDOWN_BROWSER=webkit node tests/document-loading.smoke.mjs
node tests/conversion-recovery.smoke.mjs
SCRIBA_PERFORMANCE_FILE='/path/to/the/supplied.md' node tests/large-document.smoke.mjs
MARKDOWN_BROWSER=webkit SCRIBA_PERFORMANCE_FILE='/path/to/the/supplied.md' node tests/large-document.smoke.mjs
```

Without `SCRIBA_PERFORMANCE_FILE`, the performance journey generates a synthetic converter response. [Metrics and nonprivate loader captures](evidence/document-loading/README.md).
