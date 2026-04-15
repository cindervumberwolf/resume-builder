"""QA checks on assets: flag suspicious records for review."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from src.storage.manifest_writer import load_asset_manifest

logger = logging.getLogger("data_acq.qa")

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def run_qa_checks() -> list[dict]:
    """Run all QA checks and return flagged issues."""
    assets = load_asset_manifest()
    issues: list[dict] = []

    for asset in assets:
        asset_id = asset.get("asset_id", "unknown")
        school_id = asset.get("school_id", "unknown")

        raw_path = asset.get("raw_file_path", "")
        if raw_path:
            abs_path = BASE_DIR / raw_path
            if not abs_path.exists():
                issues.append({
                    "asset_id": asset_id, "school_id": school_id,
                    "check": "file_missing", "severity": "high",
                    "detail": f"Raw file not found: {raw_path}",
                })
            elif abs_path.stat().st_size == 0:
                issues.append({
                    "asset_id": asset_id, "school_id": school_id,
                    "check": "file_empty", "severity": "high",
                    "detail": f"Raw file is empty: {raw_path}",
                })
            elif abs_path.stat().st_size < 100:
                issues.append({
                    "asset_id": asset_id, "school_id": school_id,
                    "check": "file_too_small", "severity": "medium",
                    "detail": f"Raw file suspiciously small ({abs_path.stat().st_size} bytes): {raw_path}",
                })

        if asset.get("text_extraction_status") == "failed":
            issues.append({
                "asset_id": asset_id, "school_id": school_id,
                "check": "extraction_failed", "severity": "medium",
                "detail": "Text extraction failed for this asset",
            })

        text_path = asset.get("extracted_text_path", "")
        if text_path:
            abs_text = BASE_DIR / text_path
            if abs_text.exists() and abs_text.stat().st_size < 50:
                issues.append({
                    "asset_id": asset_id, "school_id": school_id,
                    "check": "text_too_short", "severity": "low",
                    "detail": f"Extracted text very short ({abs_text.stat().st_size} bytes)",
                })

        if not asset.get("content_hash_sha256"):
            issues.append({
                "asset_id": asset_id, "school_id": school_id,
                "check": "missing_hash", "severity": "low",
                "detail": "No content hash recorded",
            })

        if asset.get("functional_type") == "ambiguous":
            issues.append({
                "asset_id": asset_id, "school_id": school_id,
                "check": "ambiguous_type", "severity": "low",
                "detail": "Functional type is ambiguous, needs manual review",
            })

    qa_path = BASE_DIR / "data" / "logs" / "qa_log.jsonl"
    qa_path.parent.mkdir(parents=True, exist_ok=True)
    with open(qa_path, "w", encoding="utf-8") as f:
        for issue in issues:
            f.write(json.dumps(issue, ensure_ascii=False) + "\n")

    logger.info("QA complete: %d issues found", len(issues))
    by_severity = {}
    for issue in issues:
        sev = issue.get("severity", "unknown")
        by_severity[sev] = by_severity.get(sev, 0) + 1
    logger.info("By severity: %s", by_severity)

    return issues
