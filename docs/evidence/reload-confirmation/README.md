# Confirmed source reload — 1.13.1

The reload confirmation previously blocked itself: the source guard rejects an operation while any dialog is open, including the confirmation approving that operation. The confirming button now closes its own native dialog before calling the existing reload handler. Other modal, revision and in-flight request guards remain in place.

Production release: `/var/www/scriba/releases/20261020T012238Z-public-1.13.1`.

Product commit: `9b6d685`.

Validation completed on 19 October 2026:

- `VITE_STORAGE_MODE=browser npm run build`: passed.
- `npm test`: 60 passed, 0 failed.
- `node tests/browser-reload.smoke.mjs`: private library and device-folder reload passed, including cancellation, confirmation, version reuse on save and source deletion protection.
- `node tests/shortcuts-browser.smoke.mjs`: save/close, discard, reopen and autosave confirmation guards passed.
- `SCRIBA_EXPECTED_VERSION=1.13.1 node tests/reload-confirmation-production.smoke.mjs`: four production journeys passed on Chromium/WebKit, desktop/phone, without a simulated clock or picker. Each verifies the actual saved browser record before and after reload.
- Production HTML matched the locally tested public build before running the production journeys.

[Structured production verification](verification.json)

| Journey | Screenshot |
|---|---|
| Desktop Chromium, saved after confirmed reload | [1440×900](reload-1440x900-chromium.png) |
| Phone Chromium, saved after confirmed reload | [390×844](reload-390x844-chromium.png) |
| Desktop WebKit, saved after confirmed reload | [1440×900](reload-1440x900-webkit.png) |
| Phone WebKit, saved after confirmed reload | [390×844](reload-390x844-webkit.png) |

All documents were synthetic, in isolated browser contexts. Physical iOS Files providers were not involved.
