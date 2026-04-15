"""Download files and save with normalized naming."""
from __future__ import annotations

import logging
import re
from pathlib import Path

import httpx

from src.utils.hasher import sha256_bytes, short_hash

logger = logging.getLogger("data_acq.crawling")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
TIMEOUT = 30
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

EXT_TO_DIR = {
    ".pdf": "pdf",
    ".doc": "docx",
    ".docx": "docx",
    ".ppt": "other",
    ".pptx": "other",
    ".html": "html",
}


def slugify(text: str, max_len: int = 40) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text[:max_len]


async def download_file(
    url: str,
    school_id: str,
    issuing_unit_slug: str,
    resource_type: str,
    short_title: str,
    ext: str,
    client: httpx.AsyncClient,
) -> tuple[str, str, str, int] | None:
    """Download a file and save to data/raw/. Returns (raw_path, hash, mime_type, status)."""
    try:
        resp = await client.get(url, follow_redirects=True, timeout=TIMEOUT)
        if resp.status_code != 200:
            logger.warning("Download failed (%d): %s", resp.status_code, url)
            return None

        content = resp.content
        if len(content) > MAX_SIZE_BYTES:
            logger.warning("File too large (%d bytes): %s", len(content), url)
            return None

        content_hash = sha256_bytes(content)
        hash8 = short_hash(content)
        mime_type = resp.headers.get("content-type", "")

        if not ext:
            ext = _guess_ext_from_mime(mime_type)

        dir_name = EXT_TO_DIR.get(ext, "other")
        unit_slug = slugify(issuing_unit_slug) if issuing_unit_slug else "unknown"
        type_slug = slugify(resource_type)
        title_slug = slugify(short_title)

        filename = f"{school_id}__{unit_slug}__{type_slug}__{title_slug}__{hash8}{ext}"
        rel_dir = Path("data") / "raw" / dir_name / school_id
        abs_dir = BASE_DIR / rel_dir
        abs_dir.mkdir(parents=True, exist_ok=True)

        file_path = abs_dir / filename
        file_path.write_bytes(content)

        rel_path = str(rel_dir / filename)
        logger.info("Downloaded: %s -> %s", url, rel_path)
        return rel_path, content_hash, mime_type, resp.status_code

    except Exception as e:
        logger.error("Download error for %s: %s", url, e)
        return None


def save_html_raw(
    html: str,
    school_id: str,
    issuing_unit_slug: str,
    resource_type: str,
    short_title: str,
) -> tuple[str, str]:
    """Save raw HTML to data/raw/html/. Returns (raw_path, content_hash)."""
    content = html.encode("utf-8")
    content_hash = sha256_bytes(content)
    hash8 = short_hash(content)

    unit_slug = slugify(issuing_unit_slug) if issuing_unit_slug else "unknown"
    type_slug = slugify(resource_type)
    title_slug = slugify(short_title)

    filename = f"{school_id}__{unit_slug}__{type_slug}__{title_slug}__{hash8}.html"
    rel_dir = Path("data") / "raw" / "html" / school_id
    abs_dir = BASE_DIR / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)

    file_path = abs_dir / filename
    file_path.write_text(html, encoding="utf-8")

    return str(rel_dir / filename), content_hash


def _guess_ext_from_mime(mime: str) -> str:
    mime = mime.lower().split(";")[0].strip()
    mapping = {
        "application/pdf": ".pdf",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "text/html": ".html",
    }
    return mapping.get(mime, "")
