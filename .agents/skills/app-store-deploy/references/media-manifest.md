# Read-only media audit contract

Run from this skill directory with Python 3.11+ managed through uv:

```sh
uv run --script scripts/audit_media.py /absolute/release/media-matrix.json \
  --phase local --asset-root /absolute/release/prepared \
  --ffprobe /absolute/ffprobe --output /absolute/release/local-audit.json

uv run --script scripts/audit_media.py /absolute/release/media-matrix.json \
  --phase readback --asset-root /absolute/release/prepared \
  --ffprobe /absolute/ffprobe --output /absolute/release/readback-audit.json

uv run --script evals/test_audit_media.py
```

The script reads local files and supplied evidence. It does not contact Apple, recognize screen language, edit images, upload, submit or authorize a release. Its `ok` result applies only to the declared scope. Do not set evidence booleans merely to make the tool pass.

## Manifest fields

Copy [the empty template](../assets/media-matrix.template.json) into an ignored private release location and adapt it to current requirements.

| Field | Meaning |
| --- | --- |
| `schema_version` | Integer `1` |
| `primary_locale` / `locales` | Actual primary locale and unique requested locale list |
| `devices` | Local slot keys mapped to accepted `screenshot_sizes` and `preview_sizes` arrays of `[width, height]`; not Apple API enums |
| `minimum_screenshots` | Configured quality target per tuple; default 1, maximum accepted count 10 |
| `minimum_previews` | Configured target per tuple; default 0, maximum accepted count 3 |
| `pages` | Unique `{id, kind, locales}` objects; kind is `default` or `custom`; CPP coverage includes primary locale |
| `assets` | Genuine files and their reviewed provenance; the template deliberately supplies none |

All declared devices apply to every declared page-localization. Narrow the scope deliberately or extend the devices for current required slots and orientations. An omitted live device cannot be discovered by this offline tool. Its historical three-slot template does not prove current Duo-inner coverage.

Each asset has the following fields:

```json
{
  "page": "default",
  "locale": "en-US",
  "device": "iphone-medium",
  "kind": "screenshot",
  "position": 1,
  "file": "en-US/iphone-medium/01-reading.png",
  "ui_locale": "en-US",
  "content_locale": "en-US",
  "visual_reviewed": false,
  "language_neutral": false,
  "sha256": "REPLACE_WITH_ACTUAL_FILE_HASH"
}
```

This example deliberately **does not pass**. Set `visual_reviewed` only after inspecting the actual file. Omit `sha256` until available or replace it with the actual digest; the audit computes hashes regardless. Ordinary UI/content locales must exactly match the target. Only explicitly reviewed `language_neutral: true` assets can use `und` and identical bytes across languages. Do not label a screen with text language-neutral.

`kind` is `screenshot`, `app_preview` or `marketing_gif`. Positions are positive, unique and contiguous within a page/locale/device/kind group. A GIF never satisfies preview coverage or needs Apple placement evidence. Asset file paths resolve beneath `--asset-root`, or the manifest directory when omitted; traversal and symlink escapes are rejected.

## What local checks establish

- Manifest shape, declared coverage, limits and ordered positions.
- Actual SHA-256, optional expected checksum, safe local file location, and suspicious cross-locale duplicate bytes.
- Opaque PNG signature, dimensions and chunk checksums. This is header/chunk validation, not full pixel decoding; visual inspection remains required. JPEG is deliberately unsupported by this helper.
- Accepted movie extension/container, H.264 or ProRes 422 HQ profile, dimensions, frame rate, size and 15–30-second container/stream/decoded-frame duration from ffprobe. ffprobe uses a fixed argument vector, file protocols only, no shell or network.
- Declared UI/content language and honest visual-review attestations; no OCR or independent language verification.

Movies need a working ffprobe with decoded frame counts. Parser fixture tests are complemented by a real encoded-movie test when local ffmpeg/ffprobe and an accepted encoder are available. Report any skipped real-movie check; fixture parsing alone does not establish a working encoder.

## Readback evidence

For each screenshot and App Preview, add the actual observed store data after processing, association, save and reload:

```json
{
  "asset_id": "ACTUAL_APPLE_ASSET_ID",
  "state": "COMPLETE",
  "assigned": true,
  "page": "default",
  "locale": "en-US",
  "device": "iphone-medium",
  "confirmed_after_reload": true,
  "inherited": false,
  "fallback": false
}
```

Place this object under the asset's `store` key. Adapt real API/UI states into this normalized evidence only after actual observation; `COMPLETE` is the audit contract, not a promised universal Apple UI label. Keep the original supported API response or UI evidence in the private release record. Record scene order through the asset's verified `position`.

The readback phase checks those supplied fields, including exact destination and explicit absence of inherited/fallback media. It cannot independently prove the declarations, selected binary, metadata, App Review eligibility or final submission. Keep those separate verifications in the release record.

The JSON report includes `ok`, phase/scope, coverage, inspected-file hashes and structured errors. Exit code is nonzero on failed validation. Keep reports outside the source-media directory and preserve them with the release evidence.
