# Scriba 1.16.1 (11): mathematical rendering

Adds offline KaTeX rendering to reading, split preview, table-cell previews and visual writing. Supports standard math delimiters, math/latex/tex fences, and compatibility with the owner-selected imported differential-privacy guide. Exact source tokens survive mode changes and unchanged formula focus; editing one formula preserves neighboring content.

[Mathematical rendering evidence](../math/README.md): 69 Node tests, nine existing browser regressions, and Chromium/WebKit desktop/mobile scenarios against the actual local reference file. The original file is never written. No physical-device math QA is claimed by browser checks.

The signed archive and App Store IPA export succeeded. The archive declares all four UI languages and includes local KaTeX WOFF2 assets. The separate local Mac application was updated and its ad-hoc signature verified. No public-site deployment or App Review resubmission was performed.

The custom PDF exporter still renders math source as text; Markdown export preserves exact original notation.

Xcode confirmed successful upload at 14:44 Recife on 20 October 2026. Apple reports processing; tester-group availability is not yet verified. [Upload log](upload.log).
