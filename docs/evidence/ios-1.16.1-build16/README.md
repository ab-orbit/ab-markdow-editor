# Scriba 1.16.1 (16)

Source implementation commits: `0dcadee` and `ce6b56f`, pushed to `ab-orbit/ab-markdow-editor` main. Release archive and App Store Connect upload succeeded on 22 October 2026. Archived CFBundleVersion independently verified as 16. Build 15 was superseded before tester assignment by the final import-save scheduling adjustment.

Contains unified storage destinations, silent successful autosaves, nonrepeating compact error feedback, safe integration and preservation of concurrent note versions, five labeled desktop editing modes, readable document sizes, and mobile imports that save the current note, show the imported note and close the sidebar. PDF conversion integration is not included.

82 Node tests pass. Chromium/WebKit mobile import tests and an isolated WebKit same-note concurrency journey pass. Native archive compilation passed. No physical-device QA is claimed.

Archive (ignored local artifact): `artifacts/ios/Scriba-1.16.1-build16.xcarchive`.

[Production deployment and browser verification](../deploy-20261022/README.md).

Availability: Apple processing completed. App Store Connect shows Build 16 as **Testing**, assigned to **Equipe Scriba** (internal) and **Scriba Beta** (external). External beta submission completed with tester notification enabled. Verified on 22 October 2026. Build UUID: `33194cfc-0006-4cb8-91bc-4d0e6f162129`. The public update manifest now promotes build 16, expiring 20 January 2027 at 08:43:11 UTC.
