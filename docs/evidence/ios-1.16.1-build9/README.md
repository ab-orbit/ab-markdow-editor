# Scriba 1.16.1 (9): interface languages

Adds Portuguese, English, German and French interface catalogs, automatic device-language selection with English fallback, and a persisted override in Settings. Changes apply without reloading or rewriting the open note. Excalidraw, dates, messages and accessibility labels use the selected language. iOS declares the four supported bundle localizations.

Translations are bundled for offline use. Existing user and reference-note contents retain their authored language. No runtime translation provider or user-document transmission was added.

Validation:

- 726 literal application messages covered in each translated catalog; all catalog key sets and variable placeholders validated.
- 63 Node tests and nine browser regressions passed.
- Chromium and WebKit verified detection, live selection, persistence, unsupported-language fallback, unchanged content, PDF generation and English/French/German drawing controls.
- Seven native iPhone tests passed on build 7 before the final selection-counter selector fix, including English device-language UI, Files, persistence, rotation and real keyboard editing: [iPhone log](../ios-1.16.1-build7/iphone-tests.log).
- Six native iPad tests passed on the localized build before the final formatting-glyph refinement; the phone keyboard scenario is intentionally skipped: [iPad log](../ios-1.16.1-build7/ipad-localization-tests.log).
- Signed ARM64 archive and App Store IPA export completed. Final archive: `artifacts/ios/Scriba-1.16.1-build9.xcarchive`.
- The export menu now opens inward when desktop controls wrap, and preserves focus on Safari before running the export action.

[Language screenshots and browser checks](../localization/README.md).

This build is for TestFlight validation. The rejected App Store submission has not been resubmitted; physical-device QA and the recording requested by Apple remain separate requirements.

The final mobile German browser scenario verifies that formatting symbols remain B/I/U. A catalog guard enforces those literal symbols in all languages.

Final build 8 additionally removes the Portuguese accessibility-label dependency from selection statistics. Chromium and WebKit verify the exact selected-character count after changing interface languages. The final native manifest declares exactly one localization list with pt-BR, en, de and fr. Catalog validation checks uniqueness and coverage before every build. Upload status is pending.

The separate local Mac wrapper (`com.aeonbridge.markdown`) was updated from the final local-storage build and its ad-hoc signature verified. Existing windows were not closed, preserving unsaved work. The public website was not redeployed.

The final iOS simulator test launches in German and French and verifies English fallback for Japanese. All three native flows passed: [device-language test log](device-language-tests.log). The exported archive metadata was checked for build 9 and all four declared languages.

Xcode confirmed upload on 20 October at 14:02 Recife. Build 10 supersedes it with localized camera/photo permission explanations. Build 9 was not assigned to a tester group.
