"""Extract text from PDF files using pdfplumber."""
from __future__ import annotations

import logging
from pathlib import Path

import pdfplumber

logger = logging.getLogger("data_acq.extraction")


def extract_text_from_pdf(pdf_path: str | Path) -> str | None:
    try:
        path = Path(pdf_path)
        text_parts: list[str] = []

        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

        if not text_parts:
            logger.warning("No text extracted from PDF: %s", pdf_path)
            return None

        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error("PDF extraction failed for %s: %s", pdf_path, e)
        return None
