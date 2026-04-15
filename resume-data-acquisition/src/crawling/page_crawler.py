"""Crawl source pages and extract asset links (PDF, DOCX, etc.)."""
from __future__ import annotations

import logging
import re
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from src.utils.url_normalizer import normalize_url, is_same_domain

logger = logging.getLogger("data_acq.crawling")

FILE_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx"}
TIMEOUT = 30


async def fetch_page(url: str, client: httpx.AsyncClient) -> tuple[int, str, str]:
    """Fetch a page and return (status_code, content_type, html_text)."""
    try:
        resp = await client.get(url, follow_redirects=True, timeout=TIMEOUT)
        content_type = resp.headers.get("content-type", "")
        return resp.status_code, content_type, resp.text
    except Exception as e:
        logger.error("Failed to fetch %s: %s", url, e)
        return 0, "", ""


def extract_page_info(html: str, base_url: str) -> dict:
    """Extract title, body text, and file links from HTML."""
    soup = BeautifulSoup(html, "lxml")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    body_text = soup.get_text(separator="\n", strip=True)

    file_links: list[dict] = []
    page_links: list[str] = []

    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        full_url = urljoin(base_url, href)
        normalized = normalize_url(full_url)
        link_text = a_tag.get_text(strip=True)

        ext = _get_extension(full_url)
        if ext in FILE_EXTENSIONS:
            file_links.append({
                "url": normalized,
                "text": link_text,
                "extension": ext,
            })
        elif _is_resume_related_link(href, link_text):
            page_links.append(normalized)

    return {
        "title": title,
        "body_text": body_text,
        "file_links": file_links,
        "page_links": page_links,
    }


def _get_extension(url: str) -> str:
    path = url.split("?")[0].split("#")[0]
    for ext in FILE_EXTENSIONS:
        if path.lower().endswith(ext):
            return ext
    return ""


def _is_resume_related_link(href: str, text: str) -> bool:
    combined = (href + " " + text).lower()
    return bool(re.search(r"resume|résumé|template|sample", combined))
