# Scriba 1.16.1 (23)

This candidate consolidates the Apple interface foundation, regular Glass material on functional surfaces, localized welcome files and automatic welcome navigation, first-launch opening/pinning, safe web-update activation and the revised Scriba/company identity.

## Verification

- 83 Node/HTTP tests pass, including repository preservation, synchronization, locale resources and welcome ownership.
- Native simulator XCTest: bundled editor/private persistence and first-launch welcome/personal-draft restoration pass on iOS 18.6. The native artifact is signed for App Store distribution; simulator tests do not replace physical-device QA.
- Chrome and WebKit: mobile menus, keyboard navigation/focus return, actual text contrast on regular glass (including light/dark extreme backdrops), opaque accessibility fallback, portrait/landscape, 200% UI text, statistics, outline and settings.
- Desktop/tablet: five editing modes, note/export/heading menus, link/icon/About dialogs, GitHub settings entry; both appearances. About uses the current tagline, official GitHub mark and Aeon Bridge logo/signature.
- Welcome browser journeys: four authored files, unsupported-device English fallback, automatic locale switching while a welcome is open, saving welcome edits before switching, unchanged ordinary notes, preserved deletion/unpinning and draft restoration.
- Whiteboard: workspace drawing/text input, active-text saves, multiple scenes, original-source preservation, all exports, phone/tablet/desktop sizes and both appearances. A pending canvas import blocks replacement until flushed.
- Font picker: full picker and touch targets at 390, 440 and 1440px.
- Web update: explicit activation preserves the latest draft; an already activated shared worker reloads safely rather than reporting a stale error. Worker activation remains opt-in and private API data is not cached.

[Interface screenshots and audit](../apple-design/README.md) · [Welcome screenshots](../welcome-texts/README.md).

## Distribution

Upload succeeded at 12:17:27 UTC on 22 October 2026. App Store Connect processing/group assignment is not yet verified because repeated Chrome window changes interrupted the UI session. No new public update notice is promoted until the build is actually available to both groups.

Production web release: `/var/www/scriba/releases/20261022T121600Z-public-1.16.1-build23`; served index SHA-256 `01a686706a8b25f4ffe4c52baa49b824d510da36ddc9d1ecb8d356f39d9af16f`, verified against the built artifact. The isolated production About/navigation and mobile Glass journeys pass. Local Mac resources and the simulator preview are also updated.

Distribution status is recorded in `docs/app-store/metadata.pt-BR.json` only after verification in App Store Connect. Intermediate builds 18–22 were not promoted to the existing beta groups or the public update manifest.

The official review still requires the actual supported-device QA and launch-to-use recording requested under Guideline 2.1. This record does not claim that evidence or an official approval.
