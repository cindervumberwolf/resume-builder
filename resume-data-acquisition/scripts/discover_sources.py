"""Discover resume-related source pages for target schools via Google search."""
from __future__ import annotations

import asyncio
import csv
import logging
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.discovery.google_search import search_google
from src.discovery.source_filter import classify_url, guess_issuing_unit, get_profile_for_domain
from src.models import SourceRecord
from src.storage.manifest_writer import append_source, get_existing_source_urls
from src.utils.url_normalizer import normalize_url, extract_domain

BASE_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("data_acq.discovery")


def load_schools(school_ids: list[str] | None = None) -> list[dict]:
    path = BASE_DIR / "data" / "schools" / "schools_master.csv"
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        schools = list(reader)
    if school_ids:
        schools = [s for s in schools if s["school_id"] in school_ids]
    return schools


def load_query_templates() -> dict:
    path = BASE_DIR / "config" / "query_templates.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_settings() -> dict:
    path = BASE_DIR / "config" / "settings.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_queries(school: dict, templates: dict) -> list[str]:
    domain = school["official_main_domain"]
    queries = []
    for section in ["primary_domain_queries", "career_center_queries", "school_level_queries"]:
        for tmpl in templates.get(section, []):
            queries.append(tmpl.replace("{domain}", domain))
    return queries


def generate_source_id(school_id: str, index: int) -> str:
    return f"src_{school_id}_{index:04d}"


async def discover_school(school: dict, templates: dict, settings: dict) -> int:
    school_id = school["school_id"]
    school_name = school["school_name"]
    domain = school["official_main_domain"]

    logger.info("=" * 60)
    logger.info("Discovering sources for: %s (%s)", school_name, domain)
    logger.info("=" * 60)

    queries = build_queries(school, templates)
    logger.info("Generated %d queries", len(queries))

    search_cfg = settings.get("search", {})
    search_results = await search_google(
        queries,
        delay_min=search_cfg.get("delay_min_sec", 5),
        delay_max=search_cfg.get("delay_max_sec", 15),
        max_queries=search_cfg.get("max_queries_per_session", 25),
    )

    profile = get_profile_for_domain(domain)
    existing_urls = get_existing_source_urls()
    seen_normalized: set[str] = set()
    count = 0
    source_index = len([u for u in existing_urls if school_id in u]) + 1

    for query, urls in search_results.items():
        for url in urls:
            normalized = normalize_url(url)
            if normalized in seen_normalized or normalized in existing_urls:
                continue
            seen_normalized.add(normalized)

            classification = classify_url(url, domain, profile)
            if classification is None:
                continue

            issuing_unit, source_level = guess_issuing_unit(url)

            status_map = {
                "accept": "candidate",
                "needs_review": "needs_review",
            }

            record = SourceRecord(
                source_id=generate_source_id(school_id, source_index),
                school_id=school_id,
                school_name=school_name,
                discovered_via="search_engine",
                seed_query=query,
                source_url=normalized,
                source_domain=extract_domain(url),
                issuing_unit=issuing_unit,
                source_level=source_level,
                page_title=None,
                candidate_resource_types=[],
                officiality_score=0.9 if classification == "accept" else 0.5,
                public_access="public",
                status=status_map.get(classification, "needs_review"),
            )
            append_source(record)
            source_index += 1
            count += 1

    logger.info("Discovered %d new source URLs for %s", count, school_name)
    return count


async def main(school_ids: list[str] | None = None):
    schools = load_schools(school_ids)
    if not schools:
        logger.error("No schools found. Check schools_master.csv and school_ids filter.")
        return

    templates = load_query_templates()
    settings = load_settings()

    total = 0
    for school in schools:
        count = await discover_school(school, templates, settings)
        total += count

    logger.info("=" * 60)
    logger.info("Discovery complete. Total new sources: %d", total)
    logger.info("=" * 60)


if __name__ == "__main__":
    pilot_schools = ["mit", "stanford", "oxford"]

    if len(sys.argv) > 1:
        pilot_schools = sys.argv[1:]

    asyncio.run(main(pilot_schools))
