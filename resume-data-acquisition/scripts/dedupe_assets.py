"""Run deduplication on the asset manifest."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.qa.deduplicator import dedupe_assets

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

if __name__ == "__main__":
    summary = dedupe_assets()
    print(f"\nDeduplication Summary:")
    print(f"  Total assets:   {summary['total']}")
    print(f"  URL duplicates: {summary['url_dupes']}")
    print(f"  Hash duplicates:{summary['hash_dupes']}")
    print(f"  Removed:        {summary['removed']}")
    print(f"  Kept:           {summary['kept']}")
