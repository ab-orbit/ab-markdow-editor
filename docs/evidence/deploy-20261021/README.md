# Public release — 21 October 2026

Production: https://scriba.aeonbridge.app/

Source release: `ff3ed5c` on `ab-orbit/ab-markdow-editor/main`.
Active directory: `/var/www/scriba/releases/20261021T120200Z-public-1.16.1-build13`.
Previous release retained: `/var/www/scriba/releases/20261020T125400Z-public-1.16.1-ui`.

Public build: `VITE_STORAGE_MODE=browser npm run build`. Only static `dist/` files were uploaded. Nginx configuration passed validation; the active symlink was replaced atomically and nginx reloaded. Gateway and visitor data were preserved.

SHA-256 of the local, uploaded and HTTPS-served HTML: `02ce8ed7ca2c37e9c49c9acec4d47db1c078c532db4a88bc3b469f5caae8b0d9`.

Live HTTPS checks:

- [Desktop mandatory background autosave](desktop.txt): legacy opt-out ignored, commit prompts skipped, focus preserved through consecutive saves.
- [WebKit mobile flow](mobile.txt): cursor preservation, three menu actions, two information tabs, hierarchy folding, heading navigation, export and Settings.
- [Offline and privacy checks](offline.txt): service-worker offline save, persistence after reload, isolated browser contexts and no local filesystem API traffic. `/api/files` returns 404. [Offline mobile capture](offline-mobile.png).
- [Visual evidence in dark/light themes](../mobile-simplification/README.md).

The iOS upload is separate: [1.16.1 (13)](../ios-1.16.1-build13/README.md). Successful upload does not itself establish availability to testers.
