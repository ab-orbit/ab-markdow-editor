# Scriba 1.13 — native iOS and PWA release evidence

Verified on 19 October 2026 with Xcode 27, iOS 18.6 simulators, Chrome and WebKit. The native app bundles its editor, reference notes, renderers and fonts; it does not load the production website as its application shell.

## Results

- **54 HTTP/Git tests passed**, including native OAuth handoff, expiry, verifier/client binding, replay rejection, encrypted credentials and logout.
- **Five native tests passed on each device family**: four hosted bridge/integration cases and an actual device-rotation UI case. They exercised private persistence, native Files round trips, external-edit conflicts, reload, safe paths, the system directory/share sheets, Mermaid, ZenUML and Excalidraw.
- **Portrait and landscape passed** on iPhone 16 Pro Max and iPad Pro 13 M4. Captures use fictional content from the bundled test reference. Full-display capture normalizes UIKit's orientation metadata before writing PNGs.
- **Two additional native checks passed on iPhone 16 Pro**: the bundled reference/diagram/system-sheet case and the portrait/landscape capture case. These provide actual 6.3-inch captures for the current App Store media slots.
- **Offline Chrome and WebKit passed** after service-worker installation: first drawing SDK/font/canvas load, image rendering, visual editing, private save/reload and self-contained SVG export. No external drawing resources or local filesystem API were requested.
- **ARM64 Release archive signed and App Store IPA exported**, version 1.13.0, build 1, identifier `com.aeonbridge.scriba`. The 26,517,862-byte IPA passed deep signature verification and checks for an App Store profile, the expected application identifier, debugging disabled and no device-limited provisioning. Generated archives, credentials and export artifacts are ignored by Git.
- **App Store Connect record created** as `6824664840`, with the Portuguese name and primary locale from the listing draft. Apple's creation request succeeded before the first immediate record lookup became consistent; the upload was resumed against the existing record.
- **Upload and Apple processing completed**: Xcode Organizer confirmed “App upload complete” and “App 1.13.0 (1) uploaded”. App Store Connect subsequently showed the build as **Ready to Test** for internal testing and **Ready to Submit** for external testing. Build 1 is linked to store version 1.13.0. This is not a public App Store release.
- **Store information saved**: Portuguese description, keywords, support/marketing links, subtitle, Productivity/Utilities categories, content rights, free pricing and manual release. Six actual native screenshots were uploaded across iPhone medium/large and iPad 13-inch slots. Age ratings were calculated as **4+ with regional exceptions**; the app is not categorized as Made for Kids.
- **Privacy responses published**: optional GitHub account identifiers, synchronized free-form notes/images and technical connection/security diagnostics are declared for app functionality, linked to the user and not used for tracking. Local-only notes are not represented as server collection. The diagnostics declaration also covers the gateway's Cloudflare infrastructure; the binary does not embed an analytics SDK. The public privacy policy URL is configured.
- **Internal TestFlight invitation sent** to one existing authorized account user in **Equipe Scriba**, with build 1.13.0 (1) ready to test. One external tester is registered in **Scriba Beta**, but has no available build or invitation yet. External beta review still needs the review contact phone. Testers' addresses remain private.
- The production web release is `/var/www/scriba/releases/20261019T202549Z-public-1.13.0`. The Mac installation was updated to 1.13.0 and its bundle signature verified. Existing notes and the bundled Node runtime signature were preserved.

The source [build and distribution guide](../../app-store/README.md) documents reproducible commands and native capabilities. [Machine-readable results](verification.json) record the release and checks without credentials or testers' addresses.

## Captures

| Device | Portrait | Landscape |
| --- | --- | --- |
| iPhone 6.3-inch | [1206 × 2622](../../app-store/screenshots/iphone-6.3-reading.png) | [2622 × 1206](../../app-store/screenshots/iphone-6.3-landscape.png) |
| iPhone 6.9-inch | [1320 × 2868](../../app-store/screenshots/iphone-6.9-reading.png) | [2868 × 1320](../../app-store/screenshots/iphone-6.9-landscape.png) |
| iPad 13-inch | [2064 × 2752](../../app-store/screenshots/ipad-13-reading.png) | [2752 × 2064](../../app-store/screenshots/ipad-13-landscape.png) |

![Native iPhone reading view](../../app-store/screenshots/iphone-6.9-reading.png)

![Native iPad landscape view](../../app-store/screenshots/ipad-13-landscape.png)

The public manifest also contains [desktop](../../../public/screenshots/editor-desktop.png) and [mobile](../../../public/screenshots/editor-mobile.png) screenshots captured from the browser build.

## Distribution still requires

Authenticated App Store Connect access is working. The portal's “Add for Review” validation reports one missing section: **Contact Information**. The review name and email are prepared; the owner must supply a phone number with country code before those review details can be saved. External Beta App Review has the same contact requirement. The account holder also needs to declare their EU Digital Services Act trader status; a trader declaration requires verified public business contact information. No trader choice or business address was inferred or submitted.

Physical-device validation, including third-party Files providers/iCloud, remains pending; simulator success is not evidence of those provider-specific behaviors. Internal testers can now perform those checks through TestFlight. The app remains **Prepare for Submission**, with manual release selected. [verification.json](verification.json) distinguishes upload, processing, invitations, review and release.

References for the declarations: [Apple privacy definitions](https://developer.apple.com/app-store/app-privacy-details/), [Apple age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/), [EU trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/) and [Cloudflare security-event data](https://developers.cloudflare.com/waf/analytics/security-events/).
