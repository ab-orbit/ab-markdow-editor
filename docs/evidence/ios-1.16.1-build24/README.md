# Scriba 1.16.1 (24) — updated brand

The signed App Store archive was uploaded successfully at **13:25:27 UTC on 22 October 2026**. Apple reported that the uploaded package was processing. TestFlight processing/group distribution has not been verified through App Store Connect; the update manifest remains on the last verified Testing build.

- New cream scribe/glasses and orange pen artwork, external black frame removed.
- 34 PNG variants, a seven-size ICO and a macOS ICNS. Rounded artwork has transparent outer corners; Apple/store and maskable artwork uses opaque navy. Critical adaptive artwork is inside a 39% radius.
- Active UI, PDF, PWA/HTML, installer and native app-icon references use `profile-v4`.
- README and [brand asset documentation](../../BRAND-ASSETS.md) updated.
- 86 Node/HTTP/asset tests passed. Asset tests decode real PNG scanlines and verify alpha, bounds, absence of black framing, the maskable safe circle, ICO payloads and platform links.
- Native bundled-editor/private-persistence XCTest passed on iOS 18.6; distribution archive succeeded. Simulator verification does not replace actual-device QA.
- Isolated desktop/tablet production journeys passed in both appearances. [Interface evidence](../apple-design/README.md).
- Public release: `/var/www/scriba/releases/20261022T132400Z-public-1.16.1-build24`.
- Served index SHA-256: `cdb3141935c1d252911b3931f86564712c666aedc74b2ea1b7b7f3e66b14f988`, matching the built artifact. Served 512px logo also matched its source hash.
- Installed local Mac icon and generated ICNS hashes match; application signature verified after updating resources.

Official submission remains subject to the unresolved Guideline 2.1 physical-device evidence request. No official resubmission or beta availability is claimed here.
