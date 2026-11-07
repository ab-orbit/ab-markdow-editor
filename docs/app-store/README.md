# Scriba for iPhone and iPad

Publication workflow: [repository-versioned app-store-deploy skill](../../.agents/skills/app-store-deploy/SKILL.md). Use it for current release work; inspect App Store Connect for live status. This page and the linked receipts describe dated observations.

Latest receipt found during the **7 November 2026 documentation audit**: **1.17.2 (31)** plus four Custom Product Pages, with **5 Items Submitted** at **03:53 UTC / 00:53 Recife**, public release **manual**. The [pinned receipt](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261106/review-submission.json) and [media record](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261106/README.md) live in a later release branch rather than this page's original October snapshot. These establish historical submission, not current approval or public availability.

Earlier App Review submission: **1.17.0 (29), iPhone Duo revision**, observed Waiting for Review after submission on **October 28, 2026 at 07:37 Recife (10:37 UTC)**. The selected Apple build then was `8a98cd67-d531-41f6-a009-cc2ff84b240e`; public release was **manual**. [Submission receipt, review notes and evidence](submission-20261028/README.md) · [Implementation, real-posture simulator evidence and validation limits](../evidence/iphone-duo-20261027/README.md).

Previous store action: **1.16.1 (27) resubmitted on October 27, 2026 at 20:23 Recife**, after Apple requested business-model clarification under Guideline 2.1(b). It was withdrawn on October 28 to submit the approved Duo revision above. Build **1.16.1 (28)** was uploaded and validated but was not selected for review. [Store history and evidence](submission-20261027/README.md).

Historical October 22 upload and review action: **1.16.1 (27)** on 22 October 2026 at 13:25 Recife, through Xcode Organizer. Processing completed and build 27 was observed **Testing** in Equipe Scriba (internal) and Scriba Beta (external). The owner supplied a physical-iPhone recording; reply, attachment and Notes were sent before resubmission at **13:55 Recife**, when both submission and item showed **Waiting for Review**, with manual release. [Dated evidence](submission-20261022/README.md). Inspect the current update manifest and groups before promoting another build.

The iOS application bundles the editor, renderers, fonts and reference notes with Capacitor 8.5.3. It does not load the production website as its application shell. The web/PWA and local Mac application remain separate builds and separate private libraries.

## Build and test

Requirements: macOS, the repository's supported Node version, Xcode and an installed compatible iOS simulator. The initial October preparation used Xcode 27 and iOS 18.6; build 31 later used Xcode/iPhoneOS SDK 27.1. Discover the toolchain and available simulator before reusing a historical command. Package resolution is committed, including the native Capacitor framework revision.

```sh
npm ci
npm run ios:sync
npm run ios:open
xcodebuild -project ios/App/App.xcodeproj -scheme Scriba \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' \
  -derivedDataPath /tmp/scriba-ios-derived ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO test
```

`ios:sync` compiles the private browser-storage implementation into `dist-ios`, applies a restrictive content security policy and copies the bundle to Xcode. It does not overwrite the Mac/public `dist` directory. Native builds do not register a service worker or download updated executable application code. Release version comes from `package.json`; set `SCRIBA_IOS_BUILD_NUMBER` to a new numeric build before a later submission.

## Native capabilities

- Directory selection uses the system Files picker and a private security-scoped bookmark. Existing Markdown is read from the chosen directory and its `scriba` child. New saved copies go to `scriba`; the parent originals are preserved.
- Coordinated atomic writes compare the last acknowledged content digest. An external edit prevents an overwrite and can be reloaded through the editor's existing reload control.
- Notes, raster attachments, drawings, drafts and preferences retain the editor's local-first behavior. The operating system may suspend the app; background GitHub synchronization is not promised.
- Markdown, ZIP, SVG, PNG and editable Excalidraw exports use the native share sheet, including Save to Files. PNG transparency and SVG embedding use the same renderers as the web version.
- GitHub authorization uses `ASWebAuthenticationSession`, an ephemeral browser session, S256 challenge/verifier binding and a ten-minute one-time server handoff. The native gateway cookie is device-bound in Keychain. OAuth access and refresh tokens never cross the JavaScript bridge. The optional manually entered personal token passes through the input/bridge once and is not persisted in web storage. Native bridge logging is disabled, including in debug builds. Gateway transport accepts only the dedicated HTTPS host and allowed API routes.
- The system status/home-indicator areas are reserved in UIKit. Theme colors for native chrome come from the actual CSS tokens.

Files import supports UTF-8 Markdown up to 5 MB, local PNG/JPEG/GIF/WebP images up to 10 MB each, 50 attachments/40 MB per note, 10 directory levels and up to 1000 candidate notes. Hidden metadata, traversal and symlink escapes are rejected. Third-party Files providers and security-scoped bookmarks also need physical-device coverage during TestFlight validation; simulator checks do not establish provider-specific availability.

## App Store preparation

- Registered bundle identifier: `com.aeonbridge.scriba`, associated with App Store Connect record `6824664840` in the owner's authorized team.
- Brand/copyright: **Aeon Bridge Co.** Review/support contact: **contact@aeonbridge.com**. Select the owner's authorized signing team locally; the brand is independent of the Apple Developer team name. Do not infer a Team ID from the company name or email.
- Portuguese listing draft: [metadata.pt-BR.json](metadata.pt-BR.json). Review notes describe useful offline and native features, not a website-only wrapper. Release is manual.
- Public support and privacy pages: `https://scriba.aeonbridge.app/support.html` and `https://scriba.aeonbridge.app/privacy.html`.
- `PrivacyInfo.xcprivacy` declares private UserDefaults (`CA92.1`), in-container file metadata (`C617.1`) and user-selected directory metadata (`3B52.1`). Optional GitHub synchronization is accounted for in the data declarations. The privacy manifest is not a substitute for answering the App Store Connect privacy questionnaire.
- No account is required for Scriba itself. Optional GitHub login accesses the user's third-party repository content; it is not the app's primary identity account. The review notes explain this context for guideline 4.8.
- The app uses platform HTTPS, CryptoKit digesting and Security/Keychain. `ITSAppUsesNonExemptEncryption=false` is the proposed standard-platform-encryption declaration; the account holder must confirm the final export-compliance answers for the distributed binary.
- TestFlight recipients supplied by the owner stay in an **ignored local release file**, not this public repository. They have not been invited merely by adding that file.

Signing/export command, once the authorized team is available in Xcode:

```sh
SCRIBA_APPLE_TEAM_ID=ABCDEFGHIJ npm run ios:archive
```

This creates an archive and exports an IPA; it does not silently submit an incomplete app or accept new legal agreements. App Store distribution requires a valid distribution signature, an App Store Connect record and the required listing, review-contact, age/privacy and screenshot fields. Physical-device and TestFlight checks complement simulator verification, especially for third-party Files providers. An unsigned simulator build cannot be uploaded as an App Store binary.

The signed ARM64 build 1.16.1 (24), including the updated brand, was uploaded on 22 October 2026 at 13:25:27 UTC. That record did not establish processing or beta-group assignment. See [build 24 validation](../evidence/ios-1.16.1-build24/README.md).

The October 22 record later observed build 1.16.1 (27) Testing in both groups and Waiting for Review after localized privacy/metadata corrections, the physical-iPhone attachment, sent reply and Notes. See [that historical submission](submission-20261022/README.md). Historical build 17 evidence remains in [the earlier release record](../evidence/ios-1.16.1-build17/README.md). None of these receipts substitutes for a current account check.

## PWA Builder

PWABuilder is optional for App Store distribution. The PWA already has a versioned offline service worker; registration now starts from an external script before React initialization. The manifest declares `orientation: any` and actual desktop/mobile screenshots. An automated report is useful diagnostics, not Apple's eligibility or approval test. The native package works independently of browser installation and service-worker availability.

## Official references checked on 19 October 2026

- [Apple submission workflow](https://developer.apple.com/app-store/submitting/)
- [App Review, including minimum functionality and login services](https://developer.apple.com/app-store/review/guidelines/)
- [Privacy labels and the meaning of collected data](https://developer.apple.com/app-store/app-privacy-details/)
- [Required-reason API declarations](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)
- [Screenshot dimensions](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Capacitor iOS](https://capacitorjs.com/docs/ios) and [native distribution](https://capacitorjs.com/docs/ios/deploying-to-app-store)

## Product page creative templates

[Creative assets and editable templates](creative-assets/README.md): three Scriba concepts in four locales, exported as opaque PNG and editable SVG at 5244×2950, 3840×2560 and 1920×1280. Includes current responsive-UI captures with fictional content, exact-size/alpha validation and a local gallery. These creative placements are separate from native device screenshots.

## Localized privacy and reusable deployment

Four public privacy URLs are documented in [privacy pages](../privacy/README.md). The canonical [app-store-deploy skill](../../.agents/skills/app-store-deploy/SKILL.md) is versioned in this project, including a changelog, official source index, media validator and offline evaluations. A separately installed copy in a user profile is not synchronized automatically. The skill distinguishes native upload, TestFlight distribution, App Review submission and public release.

[Skill 1.0.0 validation and comparison](../evidence/app-store-deploy-skill-20261107/README.md): 27 media regression tests and four paired offline workflow scenarios, with the actual scope and limitations recorded.
