# Localized privacy policies

Published on October 22, 2026. Public URLs:

- Portuguese (Brazil): https://scriba.aeonbridge.app/privacy/pt-BR.html
- English (U.S.): https://scriba.aeonbridge.app/privacy/en-US.html
- German: https://scriba.aeonbridge.app/privacy/de-DE.html
- French: https://scriba.aeonbridge.app/privacy/fr-FR.html

The existing `/privacy.html` remains Portuguese and includes language navigation. All pages are static HTML, accessible without login or JavaScript, with canonical and alternate language links. The translations preserve the existing policy’s factual scope. Source paragraphs are in this folder; `node scripts/build-privacy-pages.mjs` regenerates the pages.

Validation: `node scripts/check-privacy-pages.mjs` checks four locales at 1440×900 and 390×844, HTTP status, document language, five policy sections, nine paragraphs, contact links, language navigation, legacy URL and horizontal overflow. Set `PRIVACY_ORIGIN=https://scriba.aeonbridge.app` to verify production. Screenshots are in `docs/evidence/privacy-localization/`.

The production change added only privacy HTML files to the active static release. The previous root policy was backed up on the server; application bundles and native builds were not replaced.
