# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=11"]
# ///
"""Prepare localized App Store media from verified native simulator captures."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def run(arguments):
    return subprocess.check_output(arguments, text=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("category", choices=["iphone-medium", "iphone-duo", "ipad-13"])
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--ffprobe", required=True)
    args = parser.parse_args()
    manifest = json.loads((args.source / f"{args.category}-manifest.json").read_text())
    locales = ["pt-BR", "en-US", "de-DE", "fr-FR"]
    scenes = ["reading", "writing", "outline", "diagrams", "whiteboard"]
    sizes = {"iphone-medium": (1206, 2622), "iphone-duo": (1398, 2034), "ipad-13": (2064, 2752)}
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    receipts = []
    for locale in locales:
        captures = [item for item in manifest["captures"] if item["locale"] == locale]
        captured_scenes = {item["label"] for item in captures if item["kind"] == "screenshot"}
        if not set(scenes).issubset(captured_scenes):
            raise ValueError(f"Incomplete native capture session for {locale}")
        destination = args.output / "screenshots" / args.category / locale
        destination.mkdir(parents=True, exist_ok=True)
        for stale in destination.glob("*.png"):
            stale.unlink()
        contact = Image.new("RGB", (900, 1340), "#eeeeee")
        draw = ImageDraw.Draw(contact)
        for index, scene in enumerate(scenes):
            source = args.source / args.category / locale / f"{scene}.png"
            with Image.open(source) as original:
                if original.size != sizes[args.category]:
                    raise ValueError(f"Unexpected native dimensions for {source}: {original.size}")
                if "A" in original.getbands() and original.getchannel("A").getextrema() != (255, 255):
                    raise ValueError(f"Transparent screenshot: {source}")
                image = original.convert("RGB")
            output = destination / f"{locale}-{args.category}-{index + 1:02d}-{scene}.png"
            image.save(output, optimize=True)
            receipts.append({"locale": locale, "scene": scene, "file": str(output), "dimensions": image.size,
                             "sha256": hashlib.sha256(output.read_bytes()).hexdigest()})
            image.thumbnail((280, 610))
            x, y = (index % 3) * 300 + 10, (index // 3) * 670 + 40
            contact.paste(image, (x + (280 - image.width) // 2, y))
            draw.text((x, y - 28), f"{locale} · {scene}", fill="#202020", font=font)
        contact_directory = args.output / "contact-sheets"
        contact_directory.mkdir(exist_ok=True)
        contact.save(contact_directory / f"{args.category}-{locale}.jpg", quality=92)

        raw = args.source / args.category / locale / "workflow-raw.mp4"
        probe = json.loads(run([args.ffprobe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(raw)]))
        duration = float(probe["format"]["duration"])
        if duration < 15:
            raise ValueError(f"Native workflow is too short for App Preview: {duration}")
        length = min(duration, 29.5)
        gif = args.output / "gifs" / args.category / locale / "scriba-workflow.gif"
        gif.parent.mkdir(parents=True, exist_ok=True)
        run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-t", str(length),
             "-filter_complex", "fps=8,scale=420:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
             "-loop", "0", str(gif)])
        receipts.append({"locale": locale, "file": str(gif), "duration": length, "sourceDuration": duration})
        # Apple requires the standard phone video size for Duo App Previews as well.
        width, height = (1200, 1600) if args.category == "ipad-13" else (886, 1920)
        preview = args.output / "previews" / args.category / locale / "AppPreview.mp4"
        preview.parent.mkdir(parents=True, exist_ok=True)
        # Simulator containers may include an empty leading edit. Hold the final real frame
        # to produce a verified 20-second preview without changing the demonstrated actions.
        run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
             "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", "20",
             "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease:flags=lanczos,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=20",
             "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
             "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-b:v", "10M", "-maxrate", "12M", "-bufsize", "20M", "-movflags", "+faststart", str(preview)])
        encoded = json.loads(run([args.ffprobe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(preview)]))
        if not 19.9 <= float(encoded["format"]["duration"]) <= 20.1:
            raise ValueError(f"Unexpected encoded App Preview duration: {preview}")
        upload_video = destination / f"{locale}-{args.category}-00-AppPreview.mp4"
        upload_video.unlink(missing_ok=True)
        upload_video.hardlink_to(preview)
        receipts.append({"locale": locale, "file": str(preview), "dimensions": [width, height], "duration": 20,
                         "editing": "Final native frame held to reach 20 seconds. Silent stereo AAC track added."})
    (args.output / f"{args.category}-prepared.json").write_text(json.dumps({"source": manifest, "prepared": receipts}, indent=2) + "\n")
    print(f"Prepared {args.category}: 20 screenshots and 4 GIFs" + " and 4 App Previews")


if __name__ == "__main__":
    main()
