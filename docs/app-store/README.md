# Scriba for iPhone and iPad

Latest confirmed upload: **1.16.1 (13)** on 21 October 2026 at 09:01 Recife. Xcode confirmed successful upload. This build adds mandatory background autosave on desktop/mobile, compact mobile actions and lighter Statistics/Outline navigation. Apple processing completed and build 13 is assigned to the existing internal **Equipe Scriba** group, where App Store Connect confirms **Testing**. [Release evidence](../evidence/ios-1.16.1-build13/README.md).

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

Release preparation includes a signed ARM64 archive and an exported App Store IPA, six normalized store screenshots, five native tests on each original simulator family, two additional iPhone 16 Pro checks, 54 HTTP/Git tests and offline Chrome/WebKit checks. The App Store Connect record is `6824664840`; Apple has processed build 1 and an internal TestFlight invitation has been sent. Version 1.13.0 (1) was submitted to both App Store Review and external Beta App Review on 19 October 2026; both show **Waiting for Review**. The owner's EU DSA trader declaration, verified email/phone and supporting company documentation were submitted and show **In Review**. See [release evidence and pending Apple decisions](../evidence/app-store/README.md) for the current listing, invitation and review status; submission and public release are separate states.

## PWA Builder

PWABuilder is optional for App Store distribution. The PWA already has a versioned offline service worker; registration now starts from an external script before React initialization. The manifest declares `orientation: any` and actual desktop/mobile screenshots. An automated report is useful diagnostics, not Apple's eligibility or approval test. The native package works independently of browser installation and service-worker availability.

## Official references checked on 19 October 2026

- [Apple submission workflow](https://developer.apple.com/app-store/submitting/)
- [App Review, including minimum functionality and login services](https://developer.apple.com/app-store/review/guidelines/)
- [Privacy labels and the meaning of collected data](https://developer.apple.com/app-store/app-privacy-details/)
- [Required-reason API declarations](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)
- [Screenshot dimensions](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Capacitor iOS](https://capacitorjs.com/docs/ios) and [native distribution](https://capacitorjs.com/docs/ios/deploying-to-app-store)
