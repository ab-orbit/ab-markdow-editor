#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Exercise real local PNG files, supplied readback and parsed/decoded video checks."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib


sys.dont_write_bytecode = True
SKILL = Path(__file__).resolve().parents[1]
SCRIPT = SKILL / "scripts" / "audit_media.py"
SPEC = importlib.util.spec_from_file_location("audit_media", SCRIPT)
MEDIA = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MEDIA)


def png(width=2, height=3, *, color=2, transparency=False, tag="English"):
    """Create an actual tiny, decodable PNG with independently checksummed chunks."""
    def chunk(name, data):
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)

    channels = {2: 3, 6: 4}[color]
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, color, 0, 0, 0))
    data += chunk(b"tEXt", b"Language\x00" + tag.encode())
    if transparency:
        data += chunk(b"tRNS", struct.pack(">HHH", 0, 0, 0))
    rows = b"".join(b"\x00" + bytes([120] * width * channels) for _ in range(height))
    return data + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def video_fixture():
    return {"streams": [{"codec_type": "video", "codec_name": "h264", "profile": "High",
                         "width": 2, "height": 4, "avg_frame_rate": "30/1",
                         "r_frame_rate": "30/1", "nb_read_frames": "450", "duration": "15.0"}],
            "format": {"duration": "15.0", "format_name": "mov,mp4,m4a,3gp,3g2,mj2"}}


class MediaAuditTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)
        (self.root / "english.png").write_bytes(png())
        self.manifest = {
            "schema_version": 1, "primary_locale": "en-US", "locales": ["en-US"],
            "devices": {"phone": {"screenshot_sizes": [[2, 3]], "preview_sizes": [[2, 4]]}},
            "pages": [{"id": "default", "kind": "default", "locales": ["en-US"]}],
            "assets": [self.asset()],
        }

    def asset(self, **changes):
        item = {"page": "default", "locale": "en-US", "device": "phone", "kind": "screenshot",
                "position": 1, "file": "english.png", "ui_locale": "en-US",
                "content_locale": "en-US", "visual_reviewed": True}
        item.update(changes)
        return item

    def audit(self, phase="local", **kwargs):
        return MEDIA.audit(self.manifest, manifest_dir=self.root, phase=phase, **kwargs)

    def codes(self, report):
        return {error["code"] for error in report["errors"]}

    def store(self, asset=None):
        item = asset or self.manifest["assets"][0]
        return {"asset_id": "observed-id", "state": "COMPLETE", "assigned": True,
                "page": item["page"], "locale": item["locale"], "device": item["device"],
                "confirmed_after_reload": True, "inherited": False, "fallback": False}

    def test_valid_png_and_actual_hash_are_reported(self):
        report = self.audit()
        self.assertTrue(report["ok"], report)
        self.assertEqual(report["coverage"][0]["counts"]["screenshot"], 1)
        self.assertEqual(report["inspected_files"][0]["sha256"], MEDIA.sha256(self.root / "english.png"))
        self.assertIn("not OCR", report["scope"])

    def test_malformed_png_is_not_accepted(self):
        for payload in (b"not a PNG", png()[:-3], png()[:20]):
            with self.subTest(payload=payload[:20]):
                (self.root / "english.png").write_bytes(payload)
                self.assertIn("MEDIA_INSPECTION", self.codes(self.audit()))

    def test_alpha_and_transparency_are_rejected(self):
        for payload in (png(color=6), png(transparency=True)):
            with self.subTest(alpha=len(payload)):
                (self.root / "english.png").write_bytes(payload)
                self.assertIn("MEDIA_INSPECTION", self.codes(self.audit()))

    def test_wrong_dimensions_fail_despite_png_extension(self):
        (self.root / "english.png").write_bytes(png(3, 2))
        self.assertIn("SCREENSHOT_SIZE", self.codes(self.audit()))

    def test_jpeg_is_explicitly_unchecked_instead_of_passing(self):
        (self.root / "photo.jpg").write_bytes(b"\xff\xd8\xff\xd9")
        self.manifest["assets"][0]["file"] = "photo.jpg"
        self.assertIn("SCREENSHOT_UNCHECKED_FORMAT", self.codes(self.audit()))

    def test_checksum_mismatch_and_missing_visual_attestation_fail(self):
        self.manifest["assets"][0].update(sha256="0" * 64, visual_reviewed=False)
        codes = self.codes(self.audit())
        self.assertIn("CHECKSUM_MISMATCH", codes)
        self.assertIn("VISUAL_REVIEW_REQUIRED", codes)

    def test_ui_and_document_language_both_require_correct_locale(self):
        for field in ("ui_locale", "content_locale"):
            with self.subTest(field=field):
                self.manifest["assets"][0] = self.asset(**{field: "pt-BR"})
                self.assertIn("LOCALE_MISMATCH", self.codes(self.audit()))

    def test_duplicate_wrong_language_bytes_across_locales_fail(self):
        self.manifest["locales"].append("pt-BR")
        self.manifest["pages"][0]["locales"].append("pt-BR")
        self.manifest["assets"].append(self.asset(locale="pt-BR", ui_locale="pt-BR", content_locale="pt-BR"))
        self.assertIn("CROSS_LOCALE_DUPLICATE", self.codes(self.audit()))
        for asset in self.manifest["assets"]:
            asset.update(language_neutral=True, ui_locale="und", content_locale="und")
        self.assertTrue(self.audit()["ok"])
        self.manifest["assets"][1]["visual_reviewed"] = False
        self.assertFalse(self.audit()["ok"])

    def test_same_locale_can_reuse_actual_media_across_pages(self):
        self.manifest["pages"].append({"id": "campaign", "kind": "custom", "locales": ["en-US"]})
        self.manifest["assets"].append(self.asset(page="campaign"))
        report = self.audit()
        self.assertTrue(report["ok"], report)
        self.assertEqual(len(report["inspected_files"]), 1)

    def test_declared_duo_cannot_be_missing_from_coverage(self):
        self.manifest["devices"]["duo-outer"] = {"screenshot_sizes": [[1398, 2034]], "preview_sizes": [[886, 1920]]}
        report = self.audit()
        self.assertIn("COVERAGE_COUNT", self.codes(report))
        self.assertEqual({c["device"] for c in report["coverage"]}, {"phone", "duo-outer"})

    def test_custom_page_requires_primary_locale_and_its_coverage(self):
        self.manifest["locales"].append("fr-FR")
        self.manifest["pages"].append({"id": "french", "kind": "custom", "locales": ["fr-FR"]})
        self.assertIn("CPP_PRIMARY_MISSING", self.codes(self.audit()))

    def test_duplicate_and_noncontiguous_positions_fail(self):
        self.manifest["assets"].append(self.asset())
        self.assertIn("DUPLICATE_POSITION", self.codes(self.audit()))
        self.manifest["assets"][1]["position"] = 3
        self.assertIn("POSITION_GAP", self.codes(self.audit()))

    def test_counts_follow_project_minimum_and_apple_maximum(self):
        self.manifest["minimum_screenshots"] = 5
        self.assertIn("COVERAGE_COUNT", self.codes(self.audit()))
        self.manifest["assets"] = [self.asset(position=n) for n in range(1, 12)]
        self.assertIn("COVERAGE_COUNT", self.codes(self.audit()))

    def test_path_traversal_and_symlink_escape_fail(self):
        self.manifest["assets"][0]["file"] = "../english.png"
        self.assertIn("ASSET_PATH", self.codes(self.audit()))
        with tempfile.TemporaryDirectory() as outside:
            foreign = Path(outside) / "foreign.png"
            foreign.write_bytes(png())
            (self.root / "link.png").symlink_to(foreign)
            self.manifest["assets"][0]["file"] = "link.png"
            self.assertIn("MEDIA_INSPECTION", self.codes(self.audit()))

    def test_missing_file_fails(self):
        self.manifest["assets"][0]["file"] = "missing.png"
        self.assertIn("MEDIA_INSPECTION", self.codes(self.audit()))

    def test_local_phase_does_not_claim_store_readback(self):
        self.assertTrue(self.audit()["ok"])
        self.assertIn("STORE_EVIDENCE_MISSING", self.codes(self.audit("readback")))

    def test_complete_assigned_readback_can_pass(self):
        self.manifest["assets"][0]["store"] = self.store()
        self.assertTrue(self.audit("readback")["ok"])

    def test_processing_unassigned_wrong_locale_fallback_readback_fails(self):
        item = self.manifest["assets"][0]
        for changes, expected in (
            ({"state": "PROCESSING"}, "STORE_PROCESSING"),
            ({"assigned": False}, "STORE_UNASSIGNED"),
            ({"locale": "pt-BR"}, "STORE_SCOPE_MISMATCH"),
            ({"confirmed_after_reload": False}, "STORE_RELOAD_UNCONFIRMED"),
            ({"fallback": True}, "STORE_INHERITED_OR_FALLBACK"),
            ({"inherited": True}, "STORE_INHERITED_OR_FALLBACK"),
            ({"asset_id": ""}, "STORE_ASSET_ID"),
        ):
            with self.subTest(changes=changes):
                item["store"] = {**self.store(), **changes}
                self.assertIn(expected, self.codes(self.audit("readback")))

    def test_gif_is_marketing_and_never_preview_coverage(self):
        (self.root / "demo.gif").write_bytes(b"GIF89a\x01\x00\x01\x00\x00\x00\x00;")
        self.manifest["minimum_previews"] = 1
        self.manifest["assets"].append(self.asset(kind="marketing_gif", file="demo.gif"))
        report = self.audit()
        self.assertIn("COVERAGE_COUNT", self.codes(report))
        self.assertEqual(report["coverage"][0]["counts"]["app_preview"], 0)
        self.manifest["assets"][1]["kind"] = "app_preview"
        self.assertIn("PREVIEW_FORMAT", self.codes(self.audit()))

    def test_marketing_gif_skips_store_proof_but_retains_local_checks(self):
        (self.root / "demo.gif").write_bytes(b"GIF89a\x01\x00\x01\x00\x00\x00\x00;")
        self.manifest["assets"][0]["store"] = self.store()
        gif = self.asset(kind="marketing_gif", file="demo.gif")
        self.manifest["assets"].append(gif)
        report = self.audit("readback")
        self.assertTrue(report["ok"], report)
        self.assertEqual(report["coverage"][0]["counts"]["app_preview"], 0)
        self.assertEqual(len(report["inspected_files"]), 2)
        gif.update(sha256="0" * 64, content_locale="pt-BR", visual_reviewed=False)
        codes = self.codes(self.audit("readback"))
        self.assertTrue({"CHECKSUM_MISMATCH", "LOCALE_MISMATCH", "VISUAL_REVIEW_REQUIRED"} <= codes)
        self.assertNotIn("STORE_EVIDENCE_MISSING", codes)
        self.manifest["minimum_previews"] = 1
        self.assertIn("COVERAGE_COUNT", self.codes(self.audit("readback")))

    def test_missing_ffprobe_fails_closed(self):
        (self.root / "preview.mp4").write_bytes(b"fake-movie")
        self.manifest["assets"].append(self.asset(kind="app_preview", file="preview.mp4"))
        self.assertIn("MEDIA_INSPECTION", self.codes(self.audit(ffprobe="/missing/ffprobe")))

    def test_parsed_video_validates_codec_decoded_duration_and_metadata(self):
        self.assertEqual(MEDIA.video_info(video_fixture(), ".mp4")["decoded_duration"], 15)
        for field, value in (("nb_read_frames", "30"), ("avg_frame_rate", "60/1"),
                             ("r_frame_rate", "60/1"), ("codec_name", "hevc"),
                             ("duration", "31"), ("nb_read_frames", "N/A")):
            with self.subTest(field=field, value=value):
                fixture = video_fixture()
                fixture["streams"][0][field] = value
                with self.assertRaises(ValueError):
                    MEDIA.video_info(fixture, ".mp4")
        fixture = video_fixture()
        fixture["format"]["duration"] = "14.9"
        with self.assertRaises(ValueError):
            MEDIA.video_info(fixture, ".mp4")
        fixture = video_fixture()
        fixture["format"]["format_name"] = "matroska,webm"
        with self.assertRaises(ValueError):
            MEDIA.video_info(fixture, ".mp4")

    def test_prores_hq_requires_mov_and_correct_profile(self):
        fixture = video_fixture()
        fixture["streams"][0].update(codec_name="prores", profile="HQ")
        self.assertEqual(MEDIA.video_info(fixture, ".mov")["codec"], "prores")
        with self.assertRaises(ValueError):
            MEDIA.video_info(fixture, ".mp4")
        fixture["streams"][0]["profile"] = "Standard"
        with self.assertRaises(ValueError):
            MEDIA.video_info(fixture, ".mov")

    def test_video_probe_uses_static_argv_count_frames_no_shell(self):
        result = subprocess.CompletedProcess([], 0, json.dumps(video_fixture()), "")
        with patch.object(MEDIA.subprocess, "run", return_value=result) as run:
            MEDIA.probe_video(self.root / "movie;not-shell.mp4", "ffprobe")
        args, kwargs = run.call_args
        self.assertIsInstance(args[0], list)
        self.assertIn("-count_frames", args[0])
        self.assertEqual(args[0][args[0].index("-protocol_whitelist") + 1], "file")
        self.assertNotIn("shell", kwargs)
        self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)

    def test_invalid_manifest_shapes_return_structured_errors(self):
        for payload in ([], {}, {"schema_version": 1}, {**self.manifest, "schema_version": True}):
            with self.subTest(payload=payload):
                self.assertIn("MANIFEST_SCHEMA", self.codes(MEDIA.audit(payload, manifest_dir=self.root)))

    def test_cli_writes_report_and_does_not_overwrite_manifest(self):
        path, output = self.root / "matrix.json", self.root / "report.json"
        path.write_text(json.dumps(self.manifest))
        command = [sys.executable, str(SCRIPT), str(path), "--phase", "local", "--output", str(output)]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(output.read_text())["ok"])
        original = path.read_bytes()
        result = subprocess.run(command[:-1] + [str(path)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(path.read_bytes(), original)
        self.assertIn("OUTPUT_PATH", self.codes(json.loads(result.stdout)))

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "Optional real media binaries unavailable")
    def test_real_accepted_movie_is_decoded_and_audited(self):
        encoders = subprocess.run([shutil.which("ffmpeg"), "-hide_banner", "-encoders"],
                                  capture_output=True, text=True, timeout=10)
        if encoders.returncode:
            self.skipTest("ffmpeg is present but not runnable")
        if "libx264" in encoders.stdout:
            codec_args, extension = ["-c:v", "libx264", "-pix_fmt", "yuv420p"], ".mp4"
        elif "prores_ks" in encoders.stdout:
            codec_args, extension = ["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"], ".mov"
        else:
            self.skipTest("No available software H.264 or ProRes 422 HQ encoder")
        video = self.root / ("real" + extension)
        command = [shutil.which("ffmpeg"), "-hide_banner", "-loglevel", "error", "-f", "lavfi",
                   "-i", "color=c=blue:s=16x16:r=30:d=15", *codec_args, str(video)]
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.manifest["devices"]["phone"]["preview_sizes"] = [[16, 16]]
        self.manifest["minimum_previews"] = 1
        self.manifest["assets"].append(self.asset(kind="app_preview", file=video.name))
        report = self.audit(ffprobe=shutil.which("ffprobe"))
        self.assertTrue(report["ok"], report)
        movie = next(item for item in report["inspected_files"] if item["file"].endswith(video.name))
        self.assertEqual(movie["decoded_frames"], 450)


if __name__ == "__main__":
    unittest.main(verbosity=2)
