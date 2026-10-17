# Public deployment

Production: https://scriba.aeonbridge.app/

The public build uses `VITE_STORAGE_MODE=browser npm run build`. Nginx serves `dist/` and proxies `/github/` to the isolated synchronization gateway. No local filesystem API or server Git checkout is published. Notes, attachments, pins, and preferences live in the visitor's origin-scoped IndexedDB. Clearing site data removes them. Export ZIP backups; no cross-device synchronization is implemented.

The default local build (`npm run build`, `./install.sh`) retains the local Git backend. The public/mobile app offers a separate GitHub gateway; see [GitHub operations](GITHUB.md). Google Drive remains planned.

## VPS

Uses the existing Amara VPS. Configuration: `deploy/scriba.nginx.conf`. Cloudflare proxies the domain; the existing wildcard Origin CA certificate covers it. Releases are directories under `/var/www/scriba/releases/`; `/var/www/scriba/current` points to the active static release. Switch the symlink atomically, validate `nginx -t`, and reload nginx. Rollback by switching the link to a previous public release. Do not publish a local-mode build.

Deploy only built static files. Do not copy application state, notes, credentials, `node_modules`, or the local server into the public document root.

## Verification

`node tests/public-production.smoke.mjs` exercises the HTTPS origin in Chrome: editing, save/reload, private browser-context isolation, offline save, no API requests, and mobile overflow. Override `SCRIBA_URL` to test another origin.

## Optional device folder

Settings → Selecionar pasta em Files uses `showDirectoryPicker` when available. The app creates `scriba/` beneath the selected directory, copies saved notes/images there, and mirrors subsequent saves. The directory handle and successful file revisions persist privately in IndexedDB. Reauthorization requires a user click. Revoked permissions and external edits preserve the browser copy and report a pending folder write. Disconnecting never deletes files.

Safari/iOS does not expose this writable directory picker to PWAs. Those users retain private browser notes and ZIP export to Files; arbitrary continuous Files access would require a native wrapper. Feature detection, rather than device name, controls availability.

`node tests/device-folder.smoke.mjs` against a public-mode build served at localhost:43999 checks actual browser filesystem operations with a simulated OS picker. This is not a physical mobile picker test.
