# Scriba 1.16.1 (6): interface languages

Adds Portuguese, English, German and French interface catalogs, automatic device-language selection with English fallback, and a persisted override in Settings. Changes apply without reloading or rewriting the open note. Excalidraw, dates, messages and accessibility labels use the selected language. iOS declares the four supported bundle localizations.

Translations are bundled for offline use. Existing user and reference-note contents retain their authored language. No runtime translation provider or user-document transmission was added.

Validation:

- 726 literal application messages covered in each translated catalog; all catalog key sets and variable placeholders validated.
- 63 Node tests and nine browser regressions passed.
- Chromium and WebKit verified detection, live selection, persistence, unsupported-language fallback, unchanged content, PDF generation and English/French/German drawing controls.
- Seven native iPhone tests passed, including English device-language UI, Files, persistence, rotation and real keyboard editing: [iPhone log](iphone-tests.log).
- Six native iPad tests passed; the phone keyboard scenario is intentionally skipped: [iPad log](ipad-tests.log).
- Signed ARM64 archive and App Store IPA export completed. Final archive: `artifacts/ios/Scriba-1.16.1-build6-final.xcarchive`.
- The export menu now opens inward when desktop controls wrap, and preserves focus on Safari before running the export action.

[Language screenshots and browser checks](../localization/README.md).

This build is for TestFlight validation. The rejected App Store submission has not been resubmitted; physical-device QA and the recording requested by Apple remain separate requirements.

Xcode confirmed upload of build 6 on 20 October 2026 at 13:43 Recife. It was not added to a tester group; build 8 supersedes it with literal B/I/U formatting symbols and language-independent selection statistics.
