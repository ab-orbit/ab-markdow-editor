# Scriba for iPhone and iPad

Latest confirmed upload: **1.16.1 (17)** on 22 October 2026 at 07:21 Recife. Apple processing completed and build 17 is **Testing** in both Equipe Scriba (internal) and Scriba Beta (external), with tester notifications enabled. The public update manifest promotes build 17. [Release evidence](../evidence/ios-1.16.1-build17/README.md). Official version and review notes are prepared as 1.16.1, with manual release; the existing Guideline 2.1 request still needs physical-device QA and a launch-to-use recording before resubmission.

The iOS application bundles the editor, renderers, fonts and reference notes with Capacitor 8.5.3. It does not load the production website as its application shell. The web/PWA and local Mac application remain separate builds and separate private libraries.

## Build and test

Requirements: macOS, Node 22.12+, Xcode 26+ and an installed iOS simulator. This release was prepared with Xcode 27 and the iOS 18.6 simulator. Package resolution is committed, including the native Capacitor framework revision.

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

The signed ARM64 build 1.16.1 (24), including the updated brand, was uploaded successfully on 22 October 2026 at 13:25:27 UTC. Processing and beta-group assignment still require verification in App Store Connect; the public update manifest remains on the last verified Testing build. See [build 24 validation](../evidence/ios-1.16.1-build24/README.md).

The previously distributed signed ARM64 build 1.16.1 (17) has completed Apple processing and is Testing in both existing TestFlight groups. It is also selected in the official App Store version draft, with updated review notes and manual release. The previous 1.13.0 (1) submission was rejected under Guideline 2.1 with a request for more information and a physical-device recording. Updating the draft does not resolve that request; no incomplete official resubmission has been made. See [current release evidence](../evidence/ios-1.16.1-build17/README.md). Historical submission details remain in [initial App Store evidence](../evidence/app-store/README.md).

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
