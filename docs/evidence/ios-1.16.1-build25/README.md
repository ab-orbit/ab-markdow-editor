# Scriba 1.16.1 (25) — whiteboard and document workflow

Apple accepted the signed archive at **14:10:33 UTC on 22 October 2026** and reported that the package was processing. Processing completion and distribution to internal/external TestFlight groups remain unverified: App Store Connect UI attempts were interrupted by active-window changes and timed out. The public update manifest remains on the last verified Testing build.

- New notes and whiteboards use stable creation timestamps. Version-checked rename preserves images, pins and unrelated Git work in private storage, local Git, GitHub and native Files. Occupied targets and stale versions are rejected.
- Modal text editing no longer forwards events to the canvas. Native iOS Paste/Select actions remain available.
- Application form styles are isolated from SDK grids. Drawing chrome uses the shared material, accent and accessibility tokens. Color/shade swatches passed overlap, clipping and viewport checks in Chromium/WebKit at 390, 1024 and 1440 px.
- Seven bundled MIT libraries provide 187 symbols from local assets; personal symbols and subsequent deletion/clearing are preserved.
- Returning from Whiteboard enters visual editing and focuses an editable paragraph below the drawing, with a preceding paragraph where needed. Phone users have an explicit Note/Whiteboard action.
- Save, warning and failure messages respect the four interface languages. Validation now covers dynamic backend/native errors: 887 strings.
- 88 Node/HTTP/data tests passed. Chromium/WebKit workflow tests passed on phone and desktop, including drawing, immediate typing, double-click reopening, real rename and reload. [Evidence and commands](../whiteboard-colors/README.md).
- Three real WKWebView/Swift bridge tests passed on an isolated iOS 18.6 simulator: private persistence, first-launch/draft recovery, native Files rename with images and conflict rejection. The signed distribution archive succeeded.
- Asset-symbol generation and additional compiler warnings enabled. iOS 15 remains the intentional minimum: SDK 27.1 supports it although Xcode recommends iOS 17. That compatibility recommendation is not a compilation error.
- Build 25 installed on the existing iPhone 16 Pro Max and iPad Pro 11-inch simulators without clearing their data. Installed versions were verified from container metadata. Launch through Device Hub could not be confirmed because its changing UI timed out.
- Web and local Mac releases updated; local signature and file-service health verified. Production desktop/tablet UI journeys passed in both appearances.
- Public release: `/var/www/scriba/releases/20261022T140500Z-public-1.16.1-build25`.
- Served index SHA-256: `4f9ec4a3900bf93e5b4122f871c377b14f042c57a08419043500440310fc8482`, matching the built artifact. Served library catalog and representative library hashes also match.

TestFlight availability and official resubmission are not claimed. Official submission still requires the physical-device evidence requested under Guideline 2.1; simulator checks do not replace that evidence.
