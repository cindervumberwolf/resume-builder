"""Run the full pipeline: discover -> crawl -> extract -> dedupe -> QA.

Usage:
    python scripts/run_pipeline.py                     # all 30 schools
    python scripts/run_pipeline.py mit stanford oxford  # specific schools
    python scripts/run_pipeline.py --pilot              # 3 pilot schools
    python scripts/run_pipeline.py --phase2             # 10 schools
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.discover_sources import main as discover_main
from scripts.crawl_school import crawl_sources
from scripts.extract_text import extract_all
from src.qa.deduplicator import dedupe_assets
from src.qa.qa_checker import run_qa_checks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("data_acq.pipeline")

PILOT_SCHOOLS = ["mit", "stanford", "oxford"]

PHASE2_SCHOOLS = PILOT_SCHOOLS + [
    "harvard", "cambridge", "eth_zurich", "nus",
    "tsinghua", "peking", "ucl",
]


async def run_pipeline(school_ids: list[str] | None = None):
    logger.info("=" * 60)
    logger.info("PIPELINE START")
    logger.info("Schools: %s", school_ids or "ALL")
    logger.info("=" * 60)

    logger.info("\n>>> Step 1: Source Discovery")
    await discover_main(school_ids)

    logger.info("\n>>> Step 2: Crawl & Download")
    await crawl_sources(school_ids)

    logger.info("\n>>> Step 3: Text Extraction")
    extract_all(school_ids)

    logger.info("\n>>> Step 4: Deduplication")
    dedupe_summary = dedupe_assets()

    logger.info("\n>>> Step 5: QA Checks")
    qa_issues = run_qa_checks()

    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETE")
    logger.info("  Dedupe: %d kept, %d removed", dedupe_summary["kept"], dedupe_summary["removed"])
    logger.info("  QA issues: %d", len(qa_issues))
    logger.info("=" * 60)


def main():
    args = sys.argv[1:]

    if "--pilot" in args:
        school_ids = PILOT_SCHOOLS
    elif "--phase2" in args:
        school_ids = PHASE2_SCHOOLS
    elif args:
        school_ids = args
    else:
        school_ids = None

    asyncio.run(run_pipeline(school_ids))


if __name__ == "__main__":
    main()
