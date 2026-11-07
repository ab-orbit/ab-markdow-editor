"""Check real exported PDFs for clipping, missing cells and page orientation.

Run with the bundled Python/pdfplumber after pdf-tables.smoke.mjs. The comparison
ignores layout whitespace, preserving identifiers split into multiple PDF lines.
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber


def compact(value: str) -> str:
    """Normalize only layout whitespace and soft hyphens, never cell content."""
    return re.sub(r"\s+", "", value.replace("\u00ad", ""))


records = sorted(Path(sys.argv[1]).glob("*-chromium.json")) + sorted(Path(sys.argv[1]).glob("*-webkit.json"))
results = []
for record_file in records:
    record = json.loads(record_file.read_text())
    if not isinstance(record, dict) or "pdf" not in record:
        continue
    with pdfplumber.open(record["pdf"]) as document:
        orientations = []
        page_texts = []
        cell_texts = []
        for number, page in enumerate(document.pages, 1):
            orientations.append("landscape" if page.width > page.height else "portrait")
            text = page.extract_text(x_tolerance=1, use_text_flow=True) or ""
            page_texts.append(text)
            # Text-flow order preserves complete cells with mixed Roboto/Courier
            # baselines. Exclude footer text inside a cell continuing on another page.
            top = 0
            if record["case"] == "tall-row" and number > 1:
                words = page.extract_words(use_text_flow=True)
                first_top = words[0]["top"]
                top = max(word["bottom"] for word in words if abs(word["top"] - first_top) < 1) + .01
            cell_texts.append(page.crop((0, top, page.width, page.height - 58)).extract_text(x_tolerance=1, use_text_flow=True) or "")
            assert "powered by Aeon Bridge Co." in text, f"{record['case']} p{number}: missing footer"
            body = [char for char in page.chars if char["top"] < page.height - 50 and char["text"].strip()]
            assert body, f"{record['case']} p{number}: blank or footer-only page"
            for char in body:
                assert char["x0"] >= 41.4 and char["x1"] <= page.width - 41.4, (
                    record["case"], number, "horizontal clipping", char["text"], char["x0"], char["x1"], page.width
                )
                assert char["top"] >= 41.4 and char["bottom"] <= page.height - 57.4, (
                    record["case"], number, "vertical clipping", char["text"], char["top"], char["bottom"]
                )
            if orientations[-1] == "landscape":
                assert min(char["size"] for char in body) >= 9.9, "Table text must not be shrunk to fit."
        full_text = compact("\n".join(cell_texts))
        cell_count = 0
        for table in record["tables"]:
            for cell in table["cells"]:
                assert compact(cell) in full_text, (record["case"], "missing cell", cell[:150])
                cell_count += 1
        expected = record["expected"]
        assert ("landscape" in orientations) == expected["landscape"], (record["case"], orientations)
        assert ("portrait" in orientations) == expected["portrait"], (record["case"], orientations)
        if expected.get("returnToPortrait"):
            assert orientations[0] == orientations[-1] == "portrait", (record["case"], orientations)
        if "pages" in expected:
            assert len(orientations) == expected["pages"], (record["case"], orientations)
        if record["case"] in {"mixed", "tall-row", "signals-benchmark"}:
            headers = record["tables"][1 if record["case"] == "mixed" else -1]["headers"]
            for orientation, text in zip(orientations, page_texts):
                if orientation == "landscape":
                    assert all(compact(header) in compact(text) for header in headers), (record["case"], "missing continuation header")
        results.append({"case": record["case"], "engine": record["engine"], "pages": len(orientations), "orientations": orientations, "completeCells": cell_count, "clipping": False})
        print(f"PASS {record['engine']}: {record['case']}, {len(orientations)} pages, {cell_count} complete cells, no clipping: {orientations}")
assert results, "No PDF export records found."
(Path(sys.argv[1]) / "pdf-validation.json").write_text(json.dumps(results, indent=2) + "\n")
