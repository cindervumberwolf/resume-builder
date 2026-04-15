"""Extract text from all downloaded raw assets and save to data/text/."""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.extraction.html_extractor import extract_text_from_html
from src.extraction.pdf_extractor import extract_text_from_pdf
from src.extraction.docx_extractor import extract_text_from_docx
from src.storage.manifest_writer import load_asset_manifest

BASE_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("data_acq.extraction")

EXTRACTORS = {
    ".html": ("html_text", extract_text_from_html),
    ".pdf": ("pdf_text", extract_text_from_pdf),
    ".docx": ("docx_text", extract_text_from_docx),
    ".doc": ("docx_text", extract_text_from_docx),
}


def extract_all(school_ids: list[str] | None = None):
    assets = load_asset_manifest()
    if school_ids:
        assets = [a for a in assets if a.get("school_id") in school_ids]

    success = 0
    failed = 0
    skipped = 0

    updated_assets: list[dict] = []

    for asset in assets:
        raw_path = asset.get("raw_file_path", "")
        file_ext = asset.get("file_ext", "")
        school_id = asset.get("school_id", "unknown")

        if not raw_path or not file_ext:
            skipped += 1
            continue

        abs_raw = BASE_DIR / raw_path
        if not abs_raw.exists():
            logger.warning("Raw file not found: %s", raw_path)
            skipped += 1
            continue

        extractor_info = EXTRACTORS.get(file_ext)
        if not extractor_info:
            skipped += 1
            continue

        subdir, extractor_fn = extractor_info
        text_dir = BASE_DIR / "data" / "text" / subdir / school_id
        text_dir.mkdir(parents=True, exist_ok=True)
        text_filename = abs_raw.stem + ".txt"
        text_path = text_dir / text_filename

        if text_path.exists():
            logger.debug("Already extracted: %s", text_path)
            skipped += 1
            continue

        logger.info("Extracting: %s", raw_path)
        text = extractor_fn(abs_raw)

        if text:
            text_path.write_text(text, encoding="utf-8")
            rel_text_path = str(Path("data") / "text" / subdir / school_id / text_filename)
            asset["extracted_text_path"] = rel_text_path
            asset["text_extraction_status"] = "success"
            success += 1
        else:
            asset["text_extraction_status"] = "failed"
            failed += 1

        updated_assets.append(asset)

    if updated_assets:
        manifest_path = BASE_DIR / "data" / "manifests" / "assets.jsonl"
        all_assets = load_asset_manifest()
        updated_ids = {a["asset_id"] for a in updated_assets}
        updated_map = {a["asset_id"]: a for a in updated_assets}

        with open(manifest_path, "w", encoding="utf-8") as f:
            for a in all_assets:
                if a["asset_id"] in updated_ids:
                    a = updated_map[a["asset_id"]]
                f.write(json.dumps(a, ensure_ascii=False) + "\n")

    logger.info("Extraction complete: %d success, %d failed, %d skipped", success, failed, skipped)


if __name__ == "__main__":
    school_filter = sys.argv[1:] if len(sys.argv) > 1 else None
    extract_all(school_filter)
