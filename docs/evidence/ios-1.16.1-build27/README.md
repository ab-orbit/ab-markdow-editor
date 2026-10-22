# Scriba 1.16.1 (27) — mobile drawing and note workflows

## Implemented and verified

- Tablet document/view controls occupy deliberate rows; long names truncate without overlapping icons. Touch libraries are explicitly opened and dismiss on document interaction, selection or rotation.
- UIKit keyboard layout guide resizes the native web frame. Real iPad portrait/landscape keyboard tests passed with 18 document lines; the caret remains above the keyboard and root chrome stays on screen.
- Return-to-note action keeps its document icon visible beside its label. Library selection has an explicit Add selected action and inserts actual elements without leaving the app.
- Drawing import uses a distinct image-file icon and a visible Import drawing label. The chooser accepts `.excalidraw`; wrong extensions, invalid scenes and library content have actionable localized messages. Existing canvas content is preserved on rejection.
- Appearance is reachable from both mobile menus and settings: Light, Dark and Automatic. Automatic follows live system changes and releases UIKit's forced appearance override. Preference persists after reload.
- Make a copy saves the original, writes a separately versioned sibling with a timestamp and opens it. Browser workflow tests verified unsaved text, a PNG attachment, a Mermaid diagram and reload persistence in Chromium and WebKit.

[Browser and library evidence](../library-insertion/README.md) · [Toolbar and native keyboard evidence](../toolbar-layout/README.md)

Validation: 88 Node/HTTP/data tests passed. Chromium/WebKit palette checks passed at 390, 1024 and 1440 px. Insertion/import, appearance, copy and document-name browser journeys passed. Hosted native automatic-appearance and actual iPad keyboard UI tests passed on iOS 18.6. Signed Release archive and Debug simulator builds succeeded. No user simulator data was cleared.

## Delivery status

- Commits `78b33ea` and `6b9f004` pushed to main.
- Web release `/var/www/scriba/releases/20261022T145300Z-public-1.16.1-build27` deployed atomically. Served index SHA-256 `c377c44ede42f3ca8b0ba586c0e0939c076171d912e2ee3753dcfcc883bd2c86` matches the artifact. Production navigation/dialog/settings journeys passed in both appearances.
- Local Mac resources updated; signature and HTTP file-service health verified.
- Build 27 installed and metadata verified on the existing iPad Pro 11-inch and iPhone 16 Pro Max simulators, preserving data. Launch through native UI could not be verified after macOS window observations became unavailable.
- Build 26 uploaded successfully at `2026-10-22T14:34:10Z`; its Processing state was observed in App Store Connect. Build 25 was observed as Complete / Ready to Submit without groups. Build 17 remains the last verified Testing build for both groups; the update manifest intentionally retains it.
- **Build 27 upload blocked:** two exports failed with `Failed to Use Accounts` and App Store Connect access required for the authorized team. Existing Xcode account reauthentication is required before upload can continue. No credentials were extracted or changed. Signed archive: `artifacts/ios/Scriba-1.16.1-build27.xcarchive`.
- TestFlight availability for build 27 is not claimed. Official App Store resubmission remains blocked by the previously requested Guideline 2.1 physical-device QA/recording evidence; simulator checks do not replace it.
