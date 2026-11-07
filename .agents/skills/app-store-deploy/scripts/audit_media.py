#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Audit declared local media and supplied store readback evidence, without mutation.

This tool performs no OCR, network access, uploads, image changes or Apple actions.
Visual and store assertions are supplied evidence, not independently observed facts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
from fractions import Fraction
import zlib


SCOPE = (
    "Pass means only that the declared local files, coverage and supplied readback "
    "evidence passed this narrow audit. It does not establish Apple approval, "
    "submission, publication, authentication, privacy compliance or release readiness. "
    "visual_reviewed and store fields are supplied attestations, not OCR or live "
    "App Store Connect verification. Marketing GIFs have no App Store readback "
    "requirement and never satisfy preview coverage. PNG headers/chunks are checked; JPEG is not "
    "implemented. Device identifiers are local slot IDs, not ASC API enums."
)
VIDEO_EXTENSIONS = {".mov", ".m4v", ".mp4"}
KINDS = {"screenshot", "app_preview", "marketing_gif"}


def png_info(path: Path) -> dict:
    """Read validated PNG chunk headers; reject transparency and malformed chunks."""
    payload = path.read_bytes()
    if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Invalid PNG signature")
    offset, dimensions, has_data, ended = 8, None, False, False
    while offset < len(payload):
        if offset + 12 > len(payload):
            raise ValueError("Truncated PNG chunk")
        size = struct.unpack_from(">I", payload, offset)[0]
        name = payload[offset + 4:offset + 8]
        finish = offset + size + 12
        if finish > len(payload):
            raise ValueError("Truncated PNG chunk data")
        data = payload[offset + 8:offset + 8 + size]
        checksum = struct.unpack_from(">I", payload, offset + 8 + size)[0]
        if zlib.crc32(name + data) & 0xFFFFFFFF != checksum:
            raise ValueError("PNG chunk checksum mismatch")
        if dimensions is None and name != b"IHDR":
            raise ValueError("PNG must start with IHDR")
        if name == b"IHDR":
            if dimensions is not None or size != 13:
                raise ValueError("Invalid or repeated PNG IHDR")
            width, height, depth, color, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", data
            )
            allowed_depths = {0: {1, 2, 4, 8, 16}, 2: {8, 16},
                              3: {1, 2, 4, 8}, 4: {8, 16}, 6: {8, 16}}
            if (width < 1 or height < 1 or depth not in allowed_depths.get(color, set())
                    or compression != 0 or filtering != 0 or interlace not in {0, 1}):
                raise ValueError("Invalid PNG image header")
            if color in {4, 6}:
                raise ValueError("PNG has an alpha channel; screenshots must be opaque")
            dimensions = [width, height]
        elif name == b"tRNS":
            raise ValueError("PNG has transparency; screenshots must be opaque")
        elif name == b"IDAT":
            has_data = has_data or bool(data)
        elif name == b"IEND":
            if size != 0 or finish != len(payload):
                raise ValueError("Invalid PNG end or trailing data")
            ended = True
            break
        offset = finish
    if not ended or not has_data or dimensions is None:
        raise ValueError("PNG requires IHDR, image data and IEND")
    return {"pixels": dimensions, "opaque": True, "format": "png"}


def number(value: object) -> float:
    """Parse ffprobe rational values, rejecting missing or non-positive results."""
    try:
        result = float(Fraction(str(value)))
    except (ValueError, ZeroDivisionError, OverflowError) as exc:
        raise ValueError(f"Invalid numeric video value: {value!r}") from exc
    if not 0 < result < float("inf"):
        raise ValueError(f"Invalid numeric video value: {value!r}")
    return result


def video_info(probe: dict, suffix: str) -> dict:
    """Validate decoded frame count and video metadata from ffprobe JSON."""
    streams = probe.get("streams") if isinstance(probe, dict) else None
    if not isinstance(streams, list) or any(not isinstance(s, dict) for s in streams):
        raise ValueError("ffprobe requires a streams array of objects")
    videos = [s for s in streams if s.get("codec_type") == "video"]
    if len(videos) != 1:
        raise ValueError("Exactly one probed video stream is required")
    stream = videos[0]
    codec, profile = stream.get("codec_name"), str(stream.get("profile", ""))
    prores_hq = codec == "prores" and profile.casefold() in {"hq", "422 hq", "prores 422 hq"}
    if codec != "h264" and not prores_hq:
        raise ValueError("Preview must use H.264 or ProRes 422 HQ")
    if prores_hq and suffix != ".mov":
        raise ValueError("ProRes 422 HQ requires a MOV container")
    width, height = stream.get("width"), stream.get("height")
    if not all(isinstance(v, int) and not isinstance(v, bool) and v > 0
               for v in (width, height)):
        raise ValueError("Missing actual video pixel dimensions")
    fps = number(stream.get("avg_frame_rate"))
    nominal_fps = number(stream.get("r_frame_rate"))
    if max(fps, nominal_fps) > 30 + 1e-6:
        raise ValueError("Preview frame rate exceeds 30 fps")
    raw_frames = str(stream.get("nb_read_frames", ""))
    if not raw_frames.isdigit() or int(raw_frames) < 1:
        raise ValueError("A positive decoded frame count from -count_frames is required")
    decoded_duration = int(raw_frames) / fps
    stream_duration = number(stream.get("duration"))
    container = probe.get("format")
    if not isinstance(container, dict):
        raise ValueError("Missing ffprobe container information")
    container_names = str(container.get("format_name", "")).split(",")
    if not {"mov", "mp4", "m4v"}.intersection(container_names):
        raise ValueError("Actual container must be a probed MOV/M4V/MP4 format")
    container_duration = number(container.get("duration"))
    if any(not 15 - 1e-6 <= value <= 30 + 1e-6
           for value in (decoded_duration, stream_duration, container_duration)):
        raise ValueError("Decoded, stream and container durations must each be 15–30 seconds")
    return {"pixels": [width, height], "codec": codec, "profile": profile,
            "fps": fps, "decoded_frames": int(raw_frames),
            "decoded_duration": decoded_duration, "stream_duration": stream_duration,
            "container_duration": container_duration, "container_format": container["format_name"]}


def probe_video(path: Path, executable: str) -> dict:
    """Run ffprobe with a static argument vector, no shell, and no stdin."""
    command = [executable, "-v", "error", "-protocol_whitelist", "file", "-count_frames", "-show_entries",
               "format=duration,format_name:stream=codec_type,codec_name,profile,width,height,"
               "r_frame_rate,avg_frame_rate,nb_read_frames,duration", "-of", "json", str(path)]
    try:
        result = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, check=True, timeout=45)
        data = json.loads(result.stdout)
        if not isinstance(data, dict):
            raise ValueError("ffprobe did not return an object")
        return video_info(data, path.suffix.lower())
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to probe preview: {type(exc).__name__}") from exc


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def audit(manifest: dict, *, manifest_dir: Path, phase: str = "local",
          asset_root: Path | None = None, ffprobe: str = "ffprobe") -> dict:
    """Audit only explicitly declared scope; never infer absent live store devices."""
    errors, coverage, inspected = [], [], {}

    def fail(code: str, message: str, asset: int | None = None) -> None:
        issue = {"code": code, "message": message}
        if asset is not None:
            issue["asset"] = asset
        errors.append(issue)

    def finish() -> dict:
        return {"schema_version": 1, "phase": phase, "ok": not errors, "scope": SCOPE,
                "coverage": coverage, "inspected_files": list(inspected.values()), "errors": errors}

    if (not isinstance(manifest, dict) or type(manifest.get("schema_version")) is not int
            or manifest["schema_version"] != 1 or phase not in {"local", "readback"}):
        fail("MANIFEST_SCHEMA", "Manifest must be an object with schema_version=1")
        return finish()
    primary, locales = manifest.get("primary_locale"), manifest.get("locales")
    devices, pages, assets = (manifest.get(key) for key in ("devices", "pages", "assets"))
    if (not isinstance(locales, list) or not locales
            or not all(isinstance(v, str) and v for v in locales)
            or len(set(locales)) != len(locales) or primary not in locales
            or not isinstance(devices, dict) or not devices
            or not isinstance(pages, list) or not pages or not isinstance(assets, list)):
        fail("MANIFEST_SCHEMA", "Declare unique locales including primary, devices, pages and assets")
        return finish()
    minima = {}
    for kind, key, default in (("screenshot", "minimum_screenshots", 1),
                                ("app_preview", "minimum_previews", 0)):
        value = manifest.get(key, default)
        if type(value) is not int or value < (1 if kind == "screenshot" else 0):
            fail("MANIFEST_SCHEMA", f"{key} must be a valid non-negative integer (screenshots >=1)")
        else:
            minima[kind] = value
    if errors:
        return finish()
    for name, settings in devices.items():
        if not isinstance(name, str) or not name or not isinstance(settings, dict):
            fail("MANIFEST_SCHEMA", "Each local device slot requires a settings object")
            continue
        for key in ("screenshot_sizes", "preview_sizes"):
            sizes = settings.get(key)
            if (not isinstance(sizes, list) or (not sizes and minima["screenshot" if key == "screenshot_sizes" else "app_preview"])
                    or any(not isinstance(size, list) or len(size) != 2
                           or any(type(v) is not int or v < 1 for v in size) for size in sizes)):
                fail("MANIFEST_SCHEMA", f"Device {name}: {key} must contain positive [width,height] pairs")
    page_map = {}
    for page in pages:
        if (not isinstance(page, dict) or not isinstance(page.get("id"), str) or not page["id"]
                or page.get("kind") not in {"default", "custom"}
                or not isinstance(page.get("locales"), list) or not page["locales"]
                or not all(isinstance(v, str) and v in locales for v in page["locales"])
                or len(set(page["locales"])) != len(page["locales"])):
            fail("MANIFEST_SCHEMA", "Each page needs a unique ID, kind and declared locale subset")
            continue
        if page["id"] in page_map:
            fail("MANIFEST_SCHEMA", f"Repeated page ID: {page['id']}")
        page_map[page["id"]] = page
        if page["kind"] == "custom" and primary not in page["locales"]:
            fail("CPP_PRIMARY_MISSING", f"Custom page {page['id']} must include the primary locale {primary}")
    if errors and any(e["code"] == "MANIFEST_SCHEMA" for e in errors):
        return finish()
    root = (asset_root or manifest_dir).resolve()
    buckets, positions, fingerprints = {}, set(), {}
    for index, item in enumerate(assets):
        if not isinstance(item, dict):
            fail("ASSET_SCHEMA", "Asset must be an object", index)
            continue
        page, locale, device, kind = (item.get(key) for key in ("page", "locale", "device", "kind"))
        if (not all(isinstance(v, str) for v in (page, locale, device, kind))
                or page not in page_map or locale not in page_map[page]["locales"]
                or device not in devices or kind not in KINDS):
            fail("ASSET_SCOPE", "Asset must match a declared page, locale, local device slot and kind", index)
            continue
        key = (page, locale, device, kind)
        buckets[key] = buckets.get(key, 0) + 1
        position = item.get("position")
        if type(position) is not int or position < 1:
            fail("ASSET_POSITION", "Asset position must be a positive integer", index)
        elif (*key, position) in positions:
            fail("DUPLICATE_POSITION", f"Repeated position {position} for {key}", index)
        else:
            positions.add((*key, position))
        reviewed, neutral = item.get("visual_reviewed") is True, item.get("language_neutral") is True
        if not reviewed:
            fail("VISUAL_REVIEW_REQUIRED", "Set visual_reviewed=true only after honest manual visual review; no OCR is performed", index)
        for field in ("ui_locale", "content_locale"):
            if item.get(field) not in ({locale, "und"} if neutral and reviewed else {locale}):
                fail("LOCALE_MISMATCH", f"{field} must match {locale}; reviewed language-neutral media may use und", index)
        if phase == "readback" and kind != "marketing_gif":
            store = item.get("store")
            if not isinstance(store, dict):
                fail("STORE_EVIDENCE_MISSING", "Readback requires a store evidence object", index)
            else:
                if not isinstance(store.get("asset_id"), str) or not store["asset_id"].strip():
                    fail("STORE_ASSET_ID", "Readback requires a nonempty store asset ID", index)
                if store.get("state") != "COMPLETE":
                    fail("STORE_PROCESSING", "Store processing state must be COMPLETE", index)
                if store.get("assigned") is not True:
                    fail("STORE_UNASSIGNED", "Asset must be assigned to the product-page placement", index)
                if any(store.get(field) != item[field] for field in ("page", "locale", "device")):
                    fail("STORE_SCOPE_MISMATCH", "Store page, locale and device must exactly match the declaration", index)
                if store.get("confirmed_after_reload") is not True:
                    fail("STORE_RELOAD_UNCONFIRMED", "Readback must be confirmed after reload", index)
                if store.get("inherited") is not False or store.get("fallback") is not False:
                    fail("STORE_INHERITED_OR_FALLBACK", "Explicit inherited=false and fallback=false evidence is required", index)
        filename = item.get("file")
        if not isinstance(filename, str) or not filename or ".." in Path(filename).parts:
            fail("ASSET_PATH", "Asset file must be a nonempty path without traversal", index)
            continue
        try:
            path = (root / filename).resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError("Asset must be an existing regular file under asset root")
            resolved = str(path)
            if resolved not in inspected:
                inspected[resolved] = {"file": resolved, "sha256": sha256(path), "bytes": path.stat().st_size}
            info = inspected[resolved]
            digest = info["sha256"]
            if "sha256" in item and item["sha256"] != digest:
                fail("CHECKSUM_MISMATCH", "Supplied SHA256 does not match actual file bytes", index)
            fingerprints.setdefault(digest, []).append((index, locale, neutral and reviewed))
            suffix = path.suffix.lower()
            if kind == "screenshot":
                if suffix != ".png":
                    fail("SCREENSHOT_UNCHECKED_FORMAT", "This helper validates PNG only; JPEG is Apple-supported but not audited here", index)
                    continue
                if "pixels" not in info:
                    info.update(png_info(path))
                if info["pixels"] not in devices[device]["screenshot_sizes"]:
                    fail("SCREENSHOT_SIZE", f"Actual pixels {info['pixels']} do not match local slot {device}", index)
            elif kind == "app_preview":
                if suffix not in VIDEO_EXTENSIONS:
                    fail("PREVIEW_FORMAT", "App Previews require MOV/M4V/MP4; GIF never counts as an App Preview", index)
                    continue
                if info["bytes"] > 500_000_000:
                    fail("PREVIEW_SIZE_LIMIT", "Preview exceeds the conservative 500 MB decimal limit", index)
                if "codec" not in info:
                    info.update(probe_video(path, ffprobe))
                if info["pixels"] not in devices[device]["preview_sizes"]:
                    fail("PREVIEW_DIMENSIONS", f"Actual pixels {info['pixels']} do not match preview sizes for {device}", index)
            elif suffix != ".gif" or path.read_bytes()[:6] not in {b"GIF87a", b"GIF89a"}:
                fail("MARKETING_GIF_FORMAT", "Marketing GIF must be an actual GIF; it is not an App Preview", index)
        except (OSError, ValueError, struct.error) as exc:
            fail("MEDIA_INSPECTION", str(exc), index)
    for digest, entries in fingerprints.items():
        if len({locale for _, locale, _ in entries}) > 1 and not all(neutral for _, _, neutral in entries):
            fail("CROSS_LOCALE_DUPLICATE", f"Identical SHA256 {digest} spans locales without reviewed language_neutral=true on every use", entries[0][0])
    for key, count in buckets.items():
        present = {position[-1] for position in positions if position[:-1] == key}
        if present != set(range(1, count + 1)):
            fail("POSITION_GAP", f"Positions for {key} must cover 1..{count} exactly")
    for page in pages:
        for locale in page["locales"]:
            for device in devices:
                counts = {kind: buckets.get((page["id"], locale, device, kind), 0) for kind in minima}
                coverage.append({"page": page["id"], "locale": locale, "device": device,
                                 "counts": counts, "minimum": dict(minima)})
                for kind, minimum in minima.items():
                    count = counts[kind]
                    maximum = 10 if kind == "screenshot" else 3
                    if count < minimum or count > maximum:
                        fail("COVERAGE_COUNT", f"{page['id']}/{locale}/{device}: {kind} count {count}, required {minimum}..{maximum}")
    return finish()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--phase", choices=("local", "readback"), required=True)
    parser.add_argument("--asset-root", type=Path)
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    try:
        manifest = json.loads(args.manifest.read_text())
        report = audit(manifest, manifest_dir=args.manifest.resolve().parent,
                       phase=args.phase, asset_root=args.asset_root, ffprobe=args.ffprobe)
    except (OSError, json.JSONDecodeError) as exc:
        report = {"schema_version": 1, "phase": args.phase, "ok": False, "scope": SCOPE,
                  "coverage": [], "inspected_files": [],
                  "errors": [{"code": "MANIFEST_READ", "message": str(exc)}]}
    protected = {args.manifest.resolve()}
    protected.update(Path(item["file"]).resolve() for item in report["inspected_files"])
    if args.output and args.output.resolve() in protected:
        report["ok"] = False
        report["errors"].append({"code": "OUTPUT_PATH", "message": "Report output cannot overwrite the manifest or inspected media"})
        args.output = None
    output = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        try:
            args.output.write_text(output)
        except OSError as exc:
            report["ok"] = False
            report["errors"].append({"code": "OUTPUT_WRITE", "message": str(exc)})
            sys.stdout.write(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    else:
        sys.stdout.write(output)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
