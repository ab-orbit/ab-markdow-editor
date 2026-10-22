# Scriba 1.16.1 (17)

Simplifies optional GitHub setup to connect → select repository → active automatic saving. A single searchable list replaces the autocomplete/select pair. The note folder defaults to `scriba`; customization and authorization controls are under Advanced options. Active destinations offer switching and disconnection.

Validation: 82 Node tests pass. Chromium and WebKit browser journeys cover desktop/mobile selection, keyboard activation, error recovery and switching. Storage destination regression tests pass. Locales and TypeScript checks pass. The real bundled WKWebView/private persistence simulator test also passes after updating its old storage-screen assertions to match the current destination flow. Screenshots use synthetic repositories: [visual evidence](../github-picker/README.md).

App Store Connect preparation: official version changed from 1.13.0 to 1.16.1 and review notes updated. Release remains manual. Apple's Guideline 2.1 request still requires QA and a recording on a supported physical device running the latest OS, starting with launch from the app icon. No physical-device evidence is claimed and no incomplete official resubmission has been made.

Signed archive `artifacts/ios/Scriba-1.16.1-build17.xcarchive` succeeded; archived CFBundleVersion independently verified as 17. App Store Connect upload succeeded at 10:21:57 UTC on 22 October 2026. App Store Connect confirms Build 17 as **Testing** in **Equipe Scriba** and **Scriba Beta**, with automatic tester notification enabled. Build UUID: `5052e9ce-622f-4501-ba84-008e9be70ea4`. The public update manifest promotes 17, expiring 20 January 2027 at 10:21:57 UTC.

[Production and local Mac deployment](../deploy-20261022-build17/README.md).

App Store readiness checks on 22 October: support/privacy URLs return HTTP 200; App Privacy is already Published; age ratings are populated (global 4+ with regional classifications); the developer is identified as a trader in App Information (this is not proof of completed DSA account verification). Official release remains manual. Official version 1.16.1 is now associated with build 17 (saved in App Store Connect); the prior build 1 association was removed without deleting the uploaded binary. Official resubmission remains pending the physical-device evidence required by Guideline 2.1.
