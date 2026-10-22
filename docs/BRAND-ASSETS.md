# Scriba brand assets

<img src="../public/icons/profile-v4/scribe-256.png" alt="Scriba" width="128" height="128">

The current logo is the cream scribe with glasses and orange pen on navy. The supplied artwork was cleaned to remove the external black frame; the cleaned rounded master is packaged deterministically by `npm run icons`. Active URLs use `profile-v4` to avoid reusing cached favicons and installation icons. Earlier revisions remain for compatibility with already-open clients.

| Use | Files |
| --- | --- |
| Rounded PNG / README / application chrome | `public/icons/profile-v4/scribe-{size}.png` |
| Browser favicon | [`favicon.ico`](../public/icons/profile-v4/favicon.ico), with real PNG entries at 16, 24, 32, 48, 64, 128 and 256px |
| PWA standard icons | [`192px`](../public/icons/profile-v4/scribe-192.png), [`512px`](../public/icons/profile-v4/scribe-512.png) |
| PWA adaptive / maskable | `scribe-maskable-{192,512,1024}.png` — opaque navy; critical artwork inside the central 39% radius |
| Apple touch icons | `scribe-apple-touch-{120,152,167,180}.png` — opaque navy |
| iPhone / iPad / App Store | [`scribe-store-1024.png`](../public/icons/profile-v4/scribe-store-1024.png) — square, opaque; the system supplies its mask |
| macOS / Finder | [`Scriba.icns`](../public/icons/profile-v4/Scriba.icns) — 16–1024px representations |
| Editable raster master | [`scribe-source.png`](../public/icons/scribe-source.png) |

Rounded PNG sizes: **16, 20, 24, 29, 32, 40, 48, 58, 60, 64, 72, 76, 80, 87, 96, 120, 128, 144, 152, 167, 180, 192, 256, 384, 512 and 1024px**.

The PWA manifest, HTML favicon and Apple touch links, About/empty-state branding, exported-PDF branding, Mac installer and native asset preparation all consume this revision. The supplied original remains untouched. The welcome illustration remains a separate editorial image.

## Validation

`node --test tests/brand-assets.test.mjs` decodes the actual PNG pixels to check dimensions, transparent rounded corners, tight bounds, absence of visible black frame pixels, opaque Apple/maskable corners and the adaptive mark's safe circle. It also checks the ICO directory/payloads and active platform references.

Regenerate on macOS using `npm run icons`; the Swift/ImageIO pipeline does not require an additional image-processing package. Native-only `.icns` files and the full raster source are not precached in the PWA shell.

Platform references: [Apple app icons](https://developer.apple.com/design/human-interface-guidelines/app-icons/) and [PWA maskable safe zone](https://web.dev/articles/maskable-icon).
