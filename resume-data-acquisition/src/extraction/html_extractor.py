"""Extract clean text from raw HTML files."""
from __future__ import annotations

import logging
from pathlib import Path

from bs4 import BeautifulSoup

logger = logging.getLogger("data_acq.extraction")


def extract_text_from_html(html_path: str | Path) -> str | None:
    try:
        path = Path(html_path)
        html = path.read_text(encoding="utf-8", errors="replace")
        soup = BeautifulSoup(html, "lxml")

        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)
    except Exception as e:
        logger.error("HTML extraction failed for %s: %s", html_path, e)
        return None
