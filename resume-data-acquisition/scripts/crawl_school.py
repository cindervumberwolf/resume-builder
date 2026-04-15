"""Crawl accepted source pages, download assets, and build asset manifest."""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.crawling.page_crawler import fetch_page, extract_page_info
from src.crawling.file_downloader import download_file, save_html_raw, slugify
from src.discovery.source_filter import classify_page_content, get_profile_for_domain
from src.models import AssetRecord, ExceptionRecord
from src.storage.manifest_writer import (
    load_source_inventory, append_asset, append_exception,
    get_existing_asset_urls,
)

BASE_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("data_acq.crawling")


def generate_asset_id(school_id: str, index: int) -> str:
    return f"asset_{school_id}_{index:04d}"


def generate_exception_id(school_id: str, index: int) -> str:
    return f"exc_{school_id}_{index:04d}"


async def crawl_sources(school_ids: list[str] | None = None):
    sources = load_source_inventory()

    if school_ids:
        sources = [s for s in sources if s.get("school_id") in school_ids]

    accepted = [s for s in sources if s.get("status") in ("candidate", "accepted", "needs_review")]
    logger.info("Crawling %d source pages...", len(accepted))

    existing_urls = get_existing_asset_urls()
    asset_index = len(existing_urls) + 1
    exc_index = 1

    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        follow_redirects=True,
        timeout=30,
    ) as client:
        domain_profiles: dict[str, dict | None] = {}
        for src in accepted:
            school_id = src["school_id"]
            school_name = src["school_name"]
            source_id = src["source_id"]
            source_url = src["source_url"]
            source_level = src.get("source_level", "other")
            source_domain = src.get("source_domain", "")

            if source_domain not in domain_profiles:
                domain_profiles[source_domain] = get_profile_for_domain(source_domain)
            profile = domain_profiles[source_domain]

            logger.info("Processing: %s (%s)", source_url, school_name)

            status_code, content_type, html = await fetch_page(source_url, client)

            if status_code == 0 or status_code >= 400:
                append_exception(ExceptionRecord(
                    exception_id=generate_exception_id(school_id, exc_index),
                    school_id=school_id,
                    url=source_url,
                    issue_type="broken_link",
                    severity="medium",
                    description=f"HTTP {status_code}",
                    next_action="skip",
                ))
                exc_index += 1
                continue

            if "login" in html.lower()[:2000] and "sign in" in html.lower()[:2000]:
                append_exception(ExceptionRecord(
                    exception_id=generate_exception_id(school_id, exc_index),
                    school_id=school_id,
                    url=source_url,
                    issue_type="login_required",
                    severity="medium",
                    description="Page appears to require login",
                    next_action="manual_review",
                ))
                exc_index += 1
                continue

            page_info = extract_page_info(html, source_url)
            classification = classify_page_content(page_info["title"], page_info["body_text"], source_url, profile)

            if classification["status"] == "rejected":
                logger.info("  Rejected: %s (%s)", page_info["title"][:60], classification["functional_type"])
                continue

            if classification["resume_keyword_count"] > 0 or classification["status"] == "accepted":
                raw_path, content_hash = save_html_raw(
                    html, school_id,
                    src.get("issuing_unit") or "career",
                    classification["resource_types"][0],
                    page_info["title"][:60] or "page",
                )

                if source_url not in existing_urls:
                    append_asset(AssetRecord(
                        asset_id=generate_asset_id(school_id, asset_index),
                        source_id=source_id,
                        school_id=school_id,
                        school_name=school_name,
                        issuing_unit=src.get("issuing_unit"),
                        source_level=source_level,
                        document_title=page_info["title"],
                        document_type="html_page",
                        resource_type=classification["resource_types"][0],
                        term_used=classification["term_used"],
                        functional_type=classification["functional_type"],
                        language="en",
                        canonical_url=source_url,
                        download_url=source_url,
                        file_ext=".html",
                        mime_type="text/html",
                        http_status=status_code,
                        content_hash_sha256=content_hash,
                        raw_file_path=raw_path,
                        in_primary_dataset=classification["in_primary_dataset"],
                    ))
                    existing_urls.add(source_url)
                    asset_index += 1

            for file_link in page_info["file_links"]:
                file_url = file_link["url"]
                if file_url in existing_urls:
                    continue

                result = await download_file(
                    file_url, school_id,
                    src.get("issuing_unit") or "career",
                    classification["resource_types"][0] if classification["resource_types"] else "mixed",
                    file_link["text"][:60] or "document",
                    file_link["extension"],
                    client,
                )

                if result is None:
                    append_exception(ExceptionRecord(
                        exception_id=generate_exception_id(school_id, exc_index),
                        school_id=school_id,
                        url=file_url,
                        issue_type="download_failed",
                        severity="medium",
                        description="File download failed",
                        next_action="retry",
                    ))
                    exc_index += 1
                    continue

                raw_path, content_hash, mime_type, dl_status = result
                ext = file_link["extension"]

                append_asset(AssetRecord(
                    asset_id=generate_asset_id(school_id, asset_index),
                    source_id=source_id,
                    school_id=school_id,
                    school_name=school_name,
                    issuing_unit=src.get("issuing_unit"),
                    source_level=source_level,
                    document_title=file_link["text"] or None,
                    document_type=ext.lstrip(".") if ext else "other",
                    resource_type=classification["resource_types"][0] if classification["resource_types"] else "mixed",
                    term_used=classification["term_used"],
                    functional_type=classification["functional_type"],
                    language="en",
                    canonical_url=file_url,
                    download_url=file_url,
                    file_ext=ext,
                    mime_type=mime_type,
                    http_status=dl_status,
                    content_hash_sha256=content_hash,
                    raw_file_path=raw_path,
                    in_primary_dataset=classification["in_primary_dataset"],
                ))
                existing_urls.add(file_url)
                asset_index += 1

            await asyncio.sleep(2)

    logger.info("Crawling complete. Assets: %d", asset_index - 1)


if __name__ == "__main__":
    school_filter = sys.argv[1:] if len(sys.argv) > 1 else None
    asyncio.run(crawl_sources(school_filter))
