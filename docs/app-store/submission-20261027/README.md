# Scriba — App Review resubmission, October 27, 2026

> Later owner instruction: prepare a separate iPhone Duo revision and wait for the owner's approval before any new submission. The current local candidate is **1.17.0 (29)**. The historical “Remaining UI action” below must not be executed automatically. [Duo review and simulator evidence](../../evidence/iphone-duo-20261027/README.md).

## Verified result

**Scriba 1.16.1 (27) was resubmitted at 20:23 Recife (23:23 UTC).** Both the submission and its app-version item show **Waiting for Review**. Public release remains **manual**; this is not approval or publication.

- App Store Connect app: `6824664840`.
- Bundle identifier: `com.aeonbridge.scriba`.
- Submission: `e2881f7b-04d9-4724-b777-338abc713a70`.
- Selected Apple build: `1daf7e40-7491-4751-a622-5faf5f4d5b47`, version `1.16.1`, build `27`.
- Existing archive: `artifacts/ios/Scriba-1.16.1-build27.xcarchive`, team `8C6F4R5M4J`.

[App Store Connect submission](https://appstoreconnect.apple.com/apps/6824664840/distribution/reviewsubmissions/details/e2881f7b-04d9-4724-b777-338abc713a70) · [Status evidence](waiting-for-review.png) · [Saved review notes](review-notes.txt).

## Review issue and action

Apple reviewed build 27 on October 26 using an iPad Air 11-inch (M3). The new request was **Guideline 2.1(b), Information Needed**, asking four questions about paid subscriptions, previously purchased content and features unlocked outside In-App Purchase.

The owner had already sent a complete response at 10:08 on October 27: the current application is free, with no implemented subscriptions, premium entitlements or purchase mechanism. Read that existing response and preserved it; no duplicate reply was sent.

Saved corresponding answers in App Review Information Notes, including free access to the editor and optional GitHub integration, the absence of mandatory Scriba sign-in, and an accurate reference to the physical-device recording supplied on October 22. Did not present that older recording as new build-specific evidence. All four public privacy URLs and the support URL returned HTTP 200 using Node fetch. Manual release and the existing selected build were preserved.

**Update Review** passed validation and changed the item to **Ready for Review**. **Resubmit to App Review** then changed both statuses to **Waiting for Review**, with the new date and time verified in the returned page. The final action required scrolling the button into view: the earlier offscreen accessibility click did not submit anything.

## Initial build 28 preparation — before the owner signed in

Prepared a separate checkout at `/tmp/scriba-appstore-20261027`, verified standalone remote `ab-orbit/ab-markdow-editor` and source commit `55e8bfa7f0abb024a8d4f41c848b1af44006bf04`. The workspace source matches this checkout's application code. The only release-source modification was incrementing `CURRENT_PROJECT_VERSION` from 27 to 28 in that separate checkout. The workspace project remains at build 27.

The build 28 ARM64 Release archive compiled and passed signature verification. A persistent copy is at `artifacts/ios/Scriba-1.16.1-build28.xcarchive` in the workspace. Its bundle fingerprint is in [the preparation record](build28-preparation.json). **It is not the binary resubmitted above.**

Xcode 27.1 showed an empty Apple Accounts list and requested sign-in before uploading. No password was supplied, extracted or changed. A login request was initially presented, then the sign-in dialog was canceled because resubmitting the current store build did not require a new upload. This extra build preparation was not necessary for the owner's resubmission request.

- TypeScript, four-language checks, web/native bundling and the signed archive succeeded.
- Initial HTTP tests ran before the fresh checkout's web distribution existed and failed their setup. After building that distribution, **all 90 Node/HTTP tests passed**; see [the complete result](build28-node-tests.txt).
- Additional hosted native tests on a new, isolated iPhone 17 Pro Max / iOS 27.0 simulator finished **5 passed, 4 failed**. [Exact test report](build28-native-tests.json). Failures concerned a mobile settings selector, immediate rotation geometry, and UTF-8 BOM expectations during Files reading/renaming. A standalone Foundation probe confirmed that `String(data:encoding:)` and `String(contentsOf:encoding:)` remove the UTF-8 BOM while underlying file bytes remain unchanged. This does not resolve every native failure or prove lossless save behavior. No app-code fixes or physical-device QA are claimed.
- No existing user simulator library was cleared. No new TestFlight distribution, public web deployment or update-manifest promotion was performed.

At that point, build 28 had not been validated or submitted. The following continuation supersedes its initial upload and test status.

## Continuation after owner authentication at 20:37

The owner confirmed that Xcode was connected. Organizer then showed **1.16.1 (28) — Uploaded to Apple**, dated **20:36**. App Store Connect first showed Processing, then **Ready to Submit**. Its Build Metadata page showed **Binary State: Validated**, bundle `com.aeonbridge.scriba`, team `8C6F4R5M4J`, iPhone/iPad, ARM64, the four interface languages and no non-exempt encryption. Apple displays an upload date of **20:38**. The build ID is `9276a5ea-7cc4-43c9-be8f-3b0ea774755c`. [Observed Apple metadata](build28-apple-metadata.json).

Investigated the native failures before replacing the pending official submission. Only the test harness changed; the uploaded application's code and bundled assets did not change:

- Mobile Settings is reached through the actual note menu. The older test queried a desktop-only accessible button directly.
- File-preservation assertions now compare `Data` bytes, rather than using Foundation string initializers that consume an initial UTF-8 BOM. The original Files document and renamed document remain byte-identical in those checks. The native text decoder's existing BOM consumption is explicitly reflected in the text assertion; no promise is made that a newly written copy retains that encoding marker.
- Rotation waits for the native orientation and web viewport to settle before asserting the absence of page overflow. A later targeted run confirmed the orientation test passed.
- The phone UI test used obsolete “Mostrar formatação” / “Ocultar formatação” labels. The current accessible control is “Formatação”. Its actual keyboard, bold control and subsequent text entry were exercised after correcting the selector.

Final validation: **90 Node/HTTP tests**, **9 hosted native tests**, the targeted native rotation test, the iPhone writing/formatting UI test and the iPad keyboard UI test all passed. The iPad test checks the viewport remains above the keyboard in portrait and landscape. These are simulator results, not new physical-device QA. [Native recheck](build28-native-recheck.json) · [Phone final UI result](build28-phone-ui-final.json) · [Tablet UI result](build28-tablet-ui.json). The earlier failed and zero-match runs were not treated as validation success.

The archive's bundled-file fingerprint remains `ec635d882e7893fbbfa330b5875300a3c72fce1e26a4aeb12f1f2d7663f27aaa`, matching the originally prepared build 28. Copied the corrected tests and build number to the workspace; no new binary was built or uploaded after the tests changed.

### Remaining UI action

Before removing build 27 from review, the Chrome control stopped responding. Resetting the computer-use runtime revealed the actual blocker: **the Mac is locked, and automatic unlock failed**. Asked the owner to unlock macOS manually. Build 27 was last observed **Waiting for Review** with manual release. Build 28 is available and validated, but **has not been selected for official review**.

After the owner unlocks: inspect current App Store Connect state, remove the pending version from review if required, replace selected build 27 with **28**, preserve the saved business-model answers and manual release, submit, and verify the selected build and final status. Do not rerun completed tests unless application code or assets change, a new failure appears, or a new concern justifies it.

UI captures, when present: [phone writing](build28-writing-landscape-keyboard.png), [tablet portrait](build28-tablet-writing-portrait.png), [tablet landscape](build28-tablet-writing-landscape.png). These show isolated simulator fixtures.
