# Production — GitHub destination simplification

22 October 2026. Implementation: `99ffbcf` on `ab-orbit/ab-markdow-editor` main.

Public release: `/var/www/scriba/releases/20261022T102100Z-public-1.16.1-build17`, activated atomically at `/var/www/scriba/current`; previous release retained. Public build uses `VITE_STORAGE_MODE=browser`. Live and built index SHA-256 match: `6d4d3c0baa354af49139fa28b66de5646e53af232040216b2e7e708b66baf5ad`. Nginx configuration validation passed.

[Actual HTTPS WebKit journey](picker-webkit.txt): isolated synthetic GitHub responses verify the deployed UI at desktop/mobile sizes, immediate activation, failure/retry, default folder, switching and no viewport overflow. No customer repository was read or modified. [Screenshots](../github-picker/README.md).

Local Mac `/Applications/Scriba.app` frontend resources updated separately from the public browser build. Ad-hoc signature verified with strict/deep checks; local `/health` responded successfully. Existing user state was preserved.

Native 1.16.1 (17) archive succeeded and App Store Connect upload succeeded at 10:21:57 UTC. TestFlight processing/availability is recorded in [native evidence](../ios-1.16.1-build17/README.md).
