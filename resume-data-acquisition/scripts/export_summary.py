"""Export a human-readable summary of the data acquisition state."""
from __future__ import annotations

import csv
import logging
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.storage.manifest_writer import load_source_inventory, load_asset_manifest, load_exceptions

BASE_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")


def main():
    sources = load_source_inventory()
    assets = load_asset_manifest()
    exceptions = load_exceptions()

    schools_path = BASE_DIR / "data" / "schools" / "schools_master.csv"
    with open(schools_path, "r", encoding="utf-8") as f:
        schools = {row["school_id"]: row for row in csv.DictReader(f)}

    sources_by_school = defaultdict(list)
    for s in sources:
        sources_by_school[s.get("school_id", "unknown")].append(s)

    assets_by_school = defaultdict(list)
    for a in assets:
        assets_by_school[a.get("school_id", "unknown")].append(a)

    exceptions_by_school = defaultdict(list)
    for e in exceptions:
        exceptions_by_school[e.get("school_id", "unknown")].append(e)

    print("=" * 70)
    print("RESUME DATA ACQUISITION SUMMARY")
    print("=" * 70)
    print(f"\nTotal schools in master: {len(schools)}")
    print(f"Total sources discovered: {len(sources)}")
    print(f"Total assets collected: {len(assets)}")
    print(f"Total exceptions logged: {len(exceptions)}")

    primary = [a for a in assets if a.get("in_primary_dataset")]
    shadow = [a for a in assets if not a.get("in_primary_dataset")]
    print(f"\nPrimary dataset: {len(primary)} assets")
    print(f"Shadow queue: {len(shadow)} assets")

    by_type = defaultdict(int)
    for a in assets:
        by_type[a.get("document_type", "unknown")] += 1
    print(f"\nAssets by type:")
    for t, c in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")

    print(f"\n{'School':<40} {'Sources':>8} {'Assets':>8} {'Errors':>8}")
    print("-" * 70)
    for sid in sorted(schools.keys()):
        name = schools[sid]["school_name"][:38]
        src_count = len(sources_by_school.get(sid, []))
        asset_count = len(assets_by_school.get(sid, []))
        exc_count = len(exceptions_by_school.get(sid, []))
        print(f"  {name:<38} {src_count:>8} {asset_count:>8} {exc_count:>8}")

    no_data = [sid for sid in schools if sid not in assets_by_school or len(assets_by_school[sid]) == 0]
    if no_data:
        print(f"\nSchools with NO assets yet: {', '.join(no_data)}")


if __name__ == "__main__":
    main()
