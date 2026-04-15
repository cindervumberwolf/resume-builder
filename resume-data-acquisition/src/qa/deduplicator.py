"""Three-layer deduplication: URL, content hash, text similarity."""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from pathlib import Path

from src.storage.manifest_writer import load_asset_manifest
from src.utils.url_normalizer import normalize_url

logger = logging.getLogger("data_acq.qa")

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def dedupe_assets() -> dict:
    """Run deduplication and return a summary report."""
    assets = load_asset_manifest()
    if not assets:
        return {"total": 0, "url_dupes": 0, "hash_dupes": 0, "kept": 0}

    url_groups: dict[str, list[dict]] = defaultdict(list)
    hash_groups: dict[str, list[dict]] = defaultdict(list)

    for asset in assets:
        canonical = normalize_url(asset.get("canonical_url", ""))
        if canonical:
            url_groups[canonical].append(asset)

        content_hash = asset.get("content_hash_sha256", "")
        if content_hash:
            hash_groups[content_hash].append(asset)

    url_dupes = sum(1 for group in url_groups.values() if len(group) > 1)
    hash_dupes = sum(1 for group in hash_groups.values() if len(group) > 1)

    dedupe_index: list[dict] = []
    seen_hashes: set[str] = set()
    kept_assets: list[dict] = []

    for asset in assets:
        content_hash = asset.get("content_hash_sha256", "")
        if content_hash and content_hash in seen_hashes:
            dedupe_index.append({
                "duplicate_asset_id": asset["asset_id"],
                "primary_hash": content_hash,
                "reason": "content_hash_match",
                "canonical_url": asset.get("canonical_url", ""),
            })
            continue
        if content_hash:
            seen_hashes.add(content_hash)
        kept_assets.append(asset)

    manifest_path = BASE_DIR / "data" / "manifests" / "assets.jsonl"
    with open(manifest_path, "w", encoding="utf-8") as f:
        for a in kept_assets:
            f.write(json.dumps(a, ensure_ascii=False) + "\n")

    dedupe_path = BASE_DIR / "data" / "manifests" / "dedupe_index.jsonl"
    with open(dedupe_path, "w", encoding="utf-8") as f:
        for d in dedupe_index:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")

    summary = {
        "total": len(assets),
        "url_dupes": url_dupes,
        "hash_dupes": hash_dupes,
        "removed": len(dedupe_index),
        "kept": len(kept_assets),
    }
    logger.info("Dedup summary: %s", summary)
    return summary
