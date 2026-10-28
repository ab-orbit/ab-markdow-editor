# Scriba 1.17.0 (29) — iPhone Duo App Review submission

**Submitted on October 28, 2026 at 07:37 Recife (10:37 UTC).** App Store Connect confirms **Waiting for Review** for both the submission and its only item, **iOS App 1.17.0 (29)**. Public release remains **manual**. Submission is not approval or public availability.

[Open the Apple submission](https://appstoreconnect.apple.com/apps/6824664840/distribution/reviewsubmissions/details/636cc434-8891-4b13-b43d-f4f521e01689) · [Submission evidence](waiting-for-review.jpg) · [Saved review notes](review-notes.txt) · [Machine-readable receipt](submission.json).

## Authorization and selected binary

The owner explicitly approved submission on October 28: “ok, pode submeter para review com foco na versao disponivel para duo”. This supersedes the earlier hold on this candidate. Version 1.16.1 (27) was still Waiting for Review when inspected; it was removed from review to replace it with the approved Duo revision. Build 28 was not selected.

| Field | Verified value |
|---|---|
| App Store Connect app | `6824664840` |
| Bundle identifier | `com.aeonbridge.scriba` |
| Signing team | `8C6F4R5M4J` |
| Source branch | `codex/iphone-duo-review` |
| Application source commit | `d634e0a3b27dac66df6e9542605ae9f7e1fff45b` |
| Selected version / build | **1.17.0 / 29** |
| Apple build ID | `8a98cd67-d531-41f6-a009-cc2ff84b240e` |
| Submission ID | `636cc434-8891-4b13-b43d-f4f521e01689` |
| Binary State | **Validated** |
| Public release | **Manually release this version** |

The exact approved archive was uploaded through Xcode Organizer using **App Store Connect** distribution, not the internal-testing-only option. Organizer confirmed “App 1.17.0 (29) uploaded” at 07:33 Recife; Apple Build Metadata reports upload at 07:34. [Validated Apple metadata](build29-validated.jpg).

Persistent archive: `artifacts/ios/Scriba-1.17.0-build29-candidate.xcarchive`. The preparation copy opened by Organizer was `/private/tmp/scriba-appstore-20261027/artifacts/ios/Scriba-1.17.0-build29-candidate-r4.xcarchive`.

Before upload, strict/deep signature verification passed. The executable SHA-256 is `5d65336dbccd0e029f1102af04f43f1c682eb3f3ac70c1c0b0876a00fe5143c2`; the 957-file native public bundle fingerprint is `d17fcbb30f3a0458846779ad128ac1eb731cc4f14acff0923102c9768439dd7f`. No application code, bundled assets or binary changed during this submission. [Candidate provenance](../../evidence/iphone-duo-20261027/archive-candidate.json).

## Review focus and final checks

Saved 3,916 characters of review notes, then re-opened the version after submission and verified the saved text, build 29, absence of required Scriba sign-in and manual release. Notes explain actual Duo adaptation and a reproducible review path: outer/inner displays, partially open postures, portrait/landscape, library, outline, reading continuity, native toolbars, keyboard, Files and save destinations. They retain the four business-model answers requested under Guideline 2.1(b): this version is free, has no purchase flow or premium entitlement, and optional GitHub access does not unlock paid content.

The existing four listing localizations and product assets were retained. The support URL and all four localized privacy URLs returned HTTP 200 during this submission. **Add for Review** passed Apple's validation and produced Ready for Review; the separate **Submit for Review** action returned “1 Item Submitted”. The resulting submission page confirms Waiting for Review, its timestamp and selected 1.17.0 (29). The version page independently confirms the same selection and manual release.

Existing [Duo simulator evidence](../../evidence/iphone-duo-20261027/README.md) remains the validation record: real Device Hub posture controls, keyboard, touch scrolling, reading continuity, native regression and older iPad keyboard coverage. The review notes explicitly distinguish simulator QA from physical-device QA. Active inner-camera and cross-app Split View sessions were not exercised; multiwindow document editing is not enabled. The owner-provided physical-iPhone video from October 22 remains historical evidence, not footage of build 29.

No new TestFlight group distribution, tester invitation, production website deployment or public update-manifest promotion was performed by this submission task.
