"""Parse extracted text from sample resumes into structured exemplar bullets.

Reads text files from data/text/, identifies bullet points,
and outputs structured exemplar records to data/exemplars/.
"""
from __future__ import annotations

import json
import os
import re
import sys
import hashlib
from pathlib import Path

if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logging

BASE_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("exemplar_parser")

# --- Section detection ---

SECTION_PATTERNS = {
    "education": re.compile(r"^(education)\b", re.I),
    "experience": re.compile(r"^(experience|work experience|professional experience|relevant experience)\b", re.I),
    "leadership": re.compile(r"^(leadership|leadership experience|activities|extracurricular)\b", re.I),
    "projects": re.compile(r"^(projects|research|selected projects)\b", re.I),
    "skills": re.compile(r"^(skills|technical skills|skills and interests|computer skills)\b", re.I),
    "awards": re.compile(r"^(awards|honors|awards & interests|awards & honors)\b", re.I),
}

# --- Bullet detection ---

BULLET_PREFIX = re.compile(r"^[•·\-–—]\s*")
MIN_BULLET_LENGTH = 25
MAX_BULLET_LENGTH = 500

# Lines that look like org/title headers, not bullets
HEADER_PATTERN = re.compile(
    r"^[A-Z][A-Z\s&,.'()]+\s+(cambridge|boston|new york|london|oxford|stanford|"
    r"palo alto|san francisco|washington|chicago|los angeles|shanghai|hong kong)",
    re.I,
)
DATE_SUFFIX = re.compile(r"(20\d{2}|19\d{2}|present)\s*$", re.I)
TITLE_LINE = re.compile(r"^(candidate for|bachelor|master|ph\.?d|m\.?b\.?a|b\.?s\.?|b\.?a\.?|m\.?s\.?)\b", re.I)

# --- Seniority detection from filename ---

def detect_seniority(filename: str) -> str:
    f = filename.lower()
    if "first_year" in f or "freshman" in f:
        return "student"
    if "undergrad" in f:
        return "student"
    if "master" in f or "meng" in f or "mba" in f:
        return "student"
    if "phd" in f:
        return "student"
    if "postdoc" in f:
        return "experienced"
    if "alum" in f:
        return "experienced"
    return "student"


def detect_track(filename: str, bullet_text: str) -> str:
    combined = (filename + " " + bullet_text).lower()
    if any(k in combined for k in ["consult", "strategy", "bain", "mckinsey", "bcg"]):
        return "consulting"
    if any(k in combined for k in ["investment bank", "finance", "trading", "valuation", "m&a"]):
        return "finance"
    if any(k in combined for k in ["software", "engineer", "programming", "python", "machine learning", "data science"]):
        return "technology"
    if any(k in combined for k in ["biology", "pharma", "biotech", "lab", "research"]):
        return "research"
    if any(k in combined for k in ["marketing", "product", "brand"]):
        return "marketing"
    if any(k in combined for k in ["design", "creative", "portfolio"]):
        return "creative"
    return "general"


# --- Style feature extraction ---

ACTION_VERBS = {
    "led", "managed", "developed", "created", "built", "designed", "implemented",
    "analyzed", "conducted", "organized", "coordinated", "presented", "prepared",
    "evaluated", "synthesized", "identified", "researched", "trained", "increased",
    "reduced", "improved", "achieved", "launched", "established", "streamlined",
    "collaborated", "mentored", "authored", "produced", "facilitated", "directed",
    "generated", "optimized", "executed", "assessed", "spearheaded", "initiated",
    "restructured", "negotiated", "lobbied", "represented", "oversaw", "delegated",
}

QUANT_PATTERN = re.compile(r"\d+[%$+]|\$\d|#?\d+\s*(percent|people|members|students|clients|users|team|projects|articles|publications)")


def extract_style_features(bullet: str) -> dict:
    words = bullet.split()
    first_word = words[0].lower().rstrip("ed,s") if words else ""
    opens_action = first_word in ACTION_VERBS or (len(words) > 0 and words[0].lower() in ACTION_VERBS)

    quantified = bool(QUANT_PATTERN.search(bullet))
    word_count = len(words)

    if word_count <= 15:
        length_band = "short"
    elif word_count <= 30:
        length_band = "medium"
    else:
        length_band = "long"

    return {
        "opens_with_action_verb": opens_action,
        "result_first": False,
        "quantified": quantified,
        "length_band": length_band,
        "tone": "professional_compact" if word_count <= 20 else "professional_detailed",
    }


def extract_latent_tags(bullet: str) -> list[str]:
    tags = []
    b = bullet.lower()
    tag_signals = {
        "analysis": ["analyz", "analysis", "evaluated", "assessed"],
        "research": ["research", "studied", "investigated", "surveyed"],
        "leadership": ["led", "managed", "directed", "oversaw", "coordinated team"],
        "communication": ["presented", "communicated", "published", "authored", "wrote"],
        "quantification": ["increased", "reduced", "improved", "achieved", "%", "$"],
        "teamwork": ["collaborated", "team", "cross-functional", "worked with"],
        "technical": ["python", "excel", "sql", "model", "database", "algorithm"],
        "strategy": ["strategy", "strategic", "recommended", "proposed"],
        "client_facing": ["client", "stakeholder", "customer"],
        "project_management": ["organized", "coordinated", "scheduled", "timeline"],
        "teaching": ["trained", "mentored", "tutored", "taught"],
        "fundraising": ["raised", "fundrais", "donation"],
    }
    for tag, signals in tag_signals.items():
        if any(s in b for s in signals):
            tags.append(tag)
    return tags


# --- Main parsing ---

def is_bullet_line(line: str) -> bool:
    """Determine if a line is a resume bullet point."""
    stripped = line.strip()
    if not stripped:
        return False
    if len(stripped) < MIN_BULLET_LENGTH:
        return False
    if len(stripped) > MAX_BULLET_LENGTH:
        return False

    if BULLET_PREFIX.match(stripped):
        return True

    if HEADER_PATTERN.match(stripped):
        return False
    if TITLE_LINE.match(stripped):
        return False

    first_word = stripped.split()[0] if stripped.split() else ""
    if first_word.lower().rstrip("ed,s") in ACTION_VERBS or first_word.lower() in ACTION_VERBS:
        if not DATE_SUFFIX.search(stripped):
            return True

    return False


def parse_resume_text(text: str, filename: str, school_id: str, school_name: str, source: str) -> list[dict]:
    """Parse a resume text file and extract structured exemplar bullets."""
    lines = text.split("\n")
    current_section = "experience"
    seniority = detect_seniority(filename)
    exemplars = []

    for line in lines:
        stripped = line.strip()

        for sec_name, sec_pattern in SECTION_PATTERNS.items():
            if sec_pattern.match(stripped):
                current_section = sec_name
                break

        if current_section in ("skills", "education", "awards"):
            continue

        cleaned = BULLET_PREFIX.sub("", stripped).strip()

        if not is_bullet_line(stripped) and not BULLET_PREFIX.match(stripped):
            continue
        if len(cleaned) < MIN_BULLET_LENGTH:
            continue

        track = detect_track(filename, cleaned)
        style = extract_style_features(cleaned)
        tags = extract_latent_tags(cleaned)
        bullet_hash = hashlib.sha256(cleaned.encode()).hexdigest()[:12]

        exemplar = {
            "exemplar_id": f"{school_id}_{bullet_hash}",
            "source": source,
            "track": track,
            "seniority": seniority,
            "section": current_section,
            "bullet_text": cleaned,
            "style_features": style,
            "latent_tags": tags,
            "anti_patterns": [],
        }
        exemplars.append(exemplar)

    return exemplars


def parse_school(school_id: str, school_name: str, source_label: str):
    """Parse all text files for a school and output exemplars."""
    text_dirs = [
        BASE_DIR / "data" / "text" / "pdf_text" / school_id,
        BASE_DIR / "data" / "text" / "docx_text" / school_id,
    ]

    all_exemplars: list[dict] = []
    seen_bullets: set[str] = set()

    for text_dir in text_dirs:
        if not text_dir.exists():
            continue
        for txt_file in sorted(text_dir.glob("*.txt")):
            if "cover_letter" in txt_file.name.lower():
                continue

            text = txt_file.read_text(encoding="utf-8", errors="replace")
            exemplars = parse_resume_text(text, txt_file.name, school_id, school_name, source_label)

            for ex in exemplars:
                if ex["bullet_text"] not in seen_bullets:
                    seen_bullets.add(ex["bullet_text"])
                    all_exemplars.append(ex)

    return all_exemplars


def main():
    schools = [
        ("mit", "Massachusetts Institute of Technology", "MIT CAPD Sample Resumes"),
        ("oxford", "University of Oxford", "Oxford Careers Service"),
    ]

    output_dir = BASE_DIR / "data" / "exemplars"
    output_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for school_id, school_name, source_label in schools:
        logger.info("Parsing %s...", school_name)
        exemplars = parse_school(school_id, school_name, source_label)
        logger.info("  Extracted %d unique bullets", len(exemplars))

        output_file = output_dir / f"{school_id}_exemplars.jsonl"
        with open(output_file, "w", encoding="utf-8") as f:
            for ex in exemplars:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")

        total += len(exemplars)

        if exemplars:
            logger.info("  Sample bullet: %s", exemplars[0]["bullet_text"][:80])

    # Combined output
    combined = output_dir / "all_exemplars.jsonl"
    with open(combined, "w", encoding="utf-8") as f:
        for school_id, _, _ in schools:
            school_file = output_dir / f"{school_id}_exemplars.jsonl"
            if school_file.exists():
                f.write(school_file.read_text(encoding="utf-8"))

    logger.info("=" * 60)
    logger.info("Total exemplar bullets extracted: %d", total)
    logger.info("Output: %s", output_dir)


if __name__ == "__main__":
    main()
