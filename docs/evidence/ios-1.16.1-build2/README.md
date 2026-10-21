# iOS 1.16.1 (2) — TestFlight upload

20 October 2026. Bundle: `com.aeonbridge.scriba`; existing App Store Connect record: `6824664840`.

The signed ARM64 archive and App Store IPA were generated with `SCRIBA_APPLE_TEAM_ID` selected from the existing authorized export settings and `SCRIBA_IOS_BUILD_NUMBER=2 npm run ios:archive`. Previous artifacts were preserved in `artifacts/ios-1.13.0-build1/`.

Validation:

- [63 Node tests passed](unit-tests.txt).
- [iPhone 16 Pro Max simulator: four hosted tests and one UI rotation test passed](iphone-tests.txt).
- [iPad Pro 13-inch simulator: four hosted tests and one UI rotation test passed](ipad-tests.txt).
- [Archive and export succeeded](archive-summary.txt).

Xcode Organizer's App Store Connect distribution reported **App upload complete: App 1.16.1 (2) uploaded**. After closing the success sheet, the archive showed **Uploaded to Apple**, build **2**, **20 October 2026 at 10:09 Recife time**.

This confirms upload receipt, not completion of Apple's asynchronous processing, assignment to a tester group, or external Beta App Review approval. App Store Connect browser access was unavailable in this session. The rejected App Store submission was not resubmitted or released.

Physical-device QA and recording remain for the owner's TestFlight testing; simulator results do not replace Apple's requested physical-device evidence.
