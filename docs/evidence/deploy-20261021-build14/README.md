# Production release — 21 October 2026

Source commit: `758e63e` in `ab-orbit/ab-markdow-editor`, pushed to main.

Published `VITE_STORAGE_MODE=browser npm run build` to https://scriba.aeonbridge.app/.

Active static release: `/var/www/scriba/releases/20261021T180200Z-public-1.16.1-build14`. Previous releases retained. Nginx configuration validated and reloaded; no gateway or notes database changed.

Built and HTTPS-served index SHA-256 match: `53b0990d7e70ec4ac10446694a3c4d531971d27cb536ea251ade592358633aa5`.

[Production journey](production-smoke.txt) passes actual HTTPS autosave/reload, isolated notes, offline service-worker save and compact mobile menu. The correction and its synthetic screenshots are documented in [document loading evidence](../document-loading/README.md); release update notices in [update notice evidence](../app-updates/README.md). Prior development validation: 78 unit tests and 7 browser regressions passed; supplied conversion envelope tested in Chromium desktop and WebKit mobile without modifying its source.

No PDF conversion integration is enabled. [PDF assessment](../../PDF-IMPORT-ANALYSIS.md).
