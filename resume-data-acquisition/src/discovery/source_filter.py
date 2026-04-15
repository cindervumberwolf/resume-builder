"""Filter and classify discovered URLs into source inventory records.

V2: Score-based filtering with source profiles, strong/weak signals,
    negative pattern rejection, and actionable-resource gating.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

from src.utils.url_normalizer import normalize_url, is_same_domain

logger = logging.getLogger("data_acq.discovery")

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_rules_cache: dict | None = None


def _load_rules() -> dict:
    global _rules_cache
    if _rules_cache is None:
        path = _BASE_DIR / "config" / "source_rules.yaml"
        with open(path, "r", encoding="utf-8") as f:
            _rules_cache = yaml.safe_load(f)
    return _rules_cache


def get_profile_for_domain(domain: str) -> dict | None:
    rules = _load_rules()
    profiles = rules.get("source_profiles", {})
    domain_lower = domain.lower()
    for profile_domain, profile in profiles.items():
        if domain_lower == profile_domain or domain_lower.endswith("." + profile_domain):
            return profile
    return None


# --- Compiled patterns ---

RESUME_KEYWORDS = re.compile(
    r"\b(resume|résumé)\b", re.IGNORECASE,
)

CV_KEYWORDS = re.compile(
    r"\b(cv|curriculum\s+vitae)\b", re.IGNORECASE,
)

STRONG_RESOURCE_PATTERNS = {
    "resume_template": re.compile(
        r"(resume|résumé|cv).{0,30}(template|sample)|"
        r"(template|sample).{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "resume_guide": re.compile(
        r"(resume|résumé|cv).{0,30}(guide|writing|how to write)|"
        r"(guide|writing|how to write).{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "sample_resume": re.compile(
        r"sample\s+(resume|résumé|cv)|(resume|résumé|cv)\s+sample|"
        r"(resume|résumé|cv)\s+example",
        re.I,
    ),
    "checklist": re.compile(
        r"(resume|résumé|cv).{0,30}checklist|"
        r"checklist.{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "action_verbs": re.compile(r"action\s+verbs?", re.I),
    "format_guide": re.compile(
        r"(resume|résumé|cv).{0,30}(format|formatting)|"
        r"(format|formatting).{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "resume_tool": re.compile(r"(vmock|resume\s+review\s+tool|resume\s+optimizer)", re.I),
    "cv_guide": re.compile(
        r"cv\s+(guide|writing|how to write)|"
        r"(guide|writing|how to write)\s+.{0,10}cv",
        re.I,
    ),
    "cv_template": re.compile(r"cv\s+template|template\s+.{0,10}cv", re.I),
}

CATALOG_PATTERNS = re.compile(
    r"\b(searchworks|catalog\s+record|call\s+number|isbn\s*:|"
    r"available\s+at\s+library|request\s+from\s+offsite|"
    r"in\s+searchworks\s+catalog)\b",
    re.IGNORECASE,
)

INDIRECT_PATTERNS = re.compile(
    r"\b(employment\s+report|annual\s+report|alumni\s+q&a|"
    r"student\s+stor(y|ies)|webinar|career\s+fair|podcast)\b",
    re.IGNORECASE,
)

ACADEMIC_CV_PATTERNS = re.compile(
    r"\b(academic\s+cv|narrative\s+cv|research\s+cv|publication\s+list)\b",
    re.IGNORECASE,
)

URL_REJECT_PATTERNS = [
    "searchworks", "/search?", "/catalog/", "/blog/", "/news/",
    "/events/", "/event/", "/podcast/", "/stories/",
    "reddit.com", "quora.com",
]

STRONG_URL_PATTERNS = re.compile(
    r"(resume|résumé|cv|curriculum-vitae|resume-template|"
    r"cv-template|sample-resume|sample-cv|action-verbs)",
    re.IGNORECASE,
)

WEAK_URL_PATTERNS = re.compile(r"\b(career|careers)\b", re.IGNORECASE)


# --- URL classification ---

def classify_url(url: str, domain: str, profile: dict | None = None) -> str | None:
    """Return 'accept', 'needs_review', or None (reject).
    
    Uses scoring: strong URL pattern = +3, preferred host = +3,
    weak URL pattern = +1. Threshold: >=4 accept, >=1 review.
    """
    url_lower = url.lower()

    if not is_same_domain(url, domain):
        return None

    if any(p in url_lower for p in URL_REJECT_PATTERNS):
        return None

    if profile:
        for host in profile.get("reject_hosts", []):
            if host.lower() in url_lower:
                return None

    score = 0

    if profile:
        for host in profile.get("preferred_hosts", []):
            if host.lower() in url_lower:
                score += 3
                break

    if STRONG_URL_PATTERNS.search(url_lower):
        score += 3
    elif WEAK_URL_PATTERNS.search(url_lower):
        score += 1

    if score >= 4:
        return "accept"
    if score >= 1:
        return "needs_review"
    return None


# --- Page content classification ---

def _make_reject(reason: str) -> dict:
    return {
        "status": "rejected",
        "term_used": "unknown",
        "functional_type": reason,
        "in_primary_dataset": False,
        "resource_types": [],
        "resume_keyword_count": 0,
    }


def _make_accepted(term_used: str, in_primary: bool, functional_type: str, resource_types: list[str], keyword_count: int) -> dict:
    return {
        "status": "accepted",
        "term_used": term_used,
        "functional_type": functional_type,
        "in_primary_dataset": in_primary,
        "resource_types": resource_types or ["mixed"],
        "resume_keyword_count": keyword_count,
    }


def _make_review(reason: str) -> dict:
    return {
        "status": "needs_review",
        "term_used": "unknown",
        "functional_type": reason,
        "in_primary_dataset": False,
        "resource_types": ["mixed"],
        "resume_keyword_count": 0,
    }


def classify_page_content(
    title: str,
    body_text: str,
    url: str = "",
    profile: dict | None = None,
) -> dict:
    """Analyze page content with scoring, negative filtering, and resource gating."""
    text = f"{title or ''}\n{body_text or ''}"
    text_lower = text.lower()
    title_lower = (title or "").lower()
    inspect_region = text_lower[:5000]

    # --- Hard rejection: catalog / library pages ---
    if CATALOG_PATTERNS.search(inspect_region):
        return _make_reject("catalog_like")

    # --- Hard rejection: indirect career content ---
    if INDIRECT_PATTERNS.search(title_lower):
        return _make_reject("indirect_career_content")

    # --- Profile-specific title rejections ---
    if profile:
        for kw in profile.get("reject_title_keywords", []):
            if kw.lower() in title_lower:
                return _make_reject("profile_title_reject")

    # --- Academic / narrative CV demotion ---
    if ACADEMIC_CV_PATTERNS.search(inspect_region):
        return {
            "status": "needs_review",
            "term_used": "cv",
            "functional_type": "academic_or_narrative_cv",
            "in_primary_dataset": False,
            "resource_types": ["mixed"],
            "resume_keyword_count": 0,
        }

    # --- Detect signals ---
    has_resume = bool(RESUME_KEYWORDS.search(inspect_region))
    has_cv = bool(CV_KEYWORDS.search(inspect_region))
    resume_count = len(RESUME_KEYWORDS.findall(inspect_region))
    cv_count = len(CV_KEYWORDS.findall(inspect_region))

    # Detect actionable resource types
    detected_types: list[str] = []
    for rtype, pattern in STRONG_RESOURCE_PATTERNS.items():
        if pattern.search(inspect_region):
            detected_types.append(rtype)
    has_actionable = len(detected_types) > 0

    cv_as_primary = bool(profile and profile.get("cv_as_primary"))

    # --- Classification logic ---
    if has_resume and has_actionable:
        return _make_accepted(
            term_used="resume",
            in_primary=True,
            functional_type="strict_resume",
            resource_types=detected_types,
            keyword_count=resume_count,
        )

    if has_cv and has_actionable:
        return _make_accepted(
            term_used="cv",
            in_primary=cv_as_primary,
            functional_type="resume_equivalent_primary" if cv_as_primary else "resume_equivalent_review",
            resource_types=detected_types,
            keyword_count=cv_count,
        )

    if has_resume and not has_actionable:
        if resume_count >= 3:
            return _make_accepted(
                term_used="resume",
                in_primary=True,
                functional_type="strict_resume",
                resource_types=["resume_guide"],
                keyword_count=resume_count,
            )
        return _make_review("resume_mention_only")

    if has_cv and not has_actionable:
        if cv_as_primary and cv_count >= 3:
            return _make_accepted(
                term_used="cv",
                in_primary=True,
                functional_type="resume_equivalent_primary",
                resource_types=["cv_guide"],
                keyword_count=cv_count,
            )
        return _make_review("cv_mention_only")

    return _make_review("ambiguous")


# --- Issuing unit detection ---

UNIT_RULES: list[tuple[list[str], str, str]] = [
    # (url_patterns, unit_name, source_level)
    (["careers.ox.ac.uk"], "Oxford Careers Service", "central_career"),
    (["careers.cam.ac.uk"], "Cambridge Careers Service", "central_career"),
    (["capd.mit.edu"], "MIT CAPD", "central_career"),
    (["cdo.mit.edu"], "MIT CDO (Sloan)", "school_career"),
    (["beam.stanford.edu", "careered.stanford.edu"], "Stanford BEAM", "central_career"),
    (["searchworks.stanford.edu"], "Stanford SearchWorks", "library"),
    (["imperial.ac.uk/careers"], "Imperial Careers", "central_career"),
    (["ucl.ac.uk/careers"], "UCL Careers", "central_career"),
]

GENERIC_CAREER_PATTERNS = ["career", "capd", "beam", "cdo", "ocs", "cpd"]
SCHOOL_PATTERNS = ["business", "mba", "gsb", "hbs", "wharton", "sloan"]
LIBRARY_PATTERNS = ["library", "searchworks", "catalog"]
ALUMNI_PATTERNS = ["alumni", "podcast", "stories"]
NEWS_PATTERNS = ["news", "events", "event"]


def guess_issuing_unit(url: str) -> tuple[str | None, str]:
    """Guess the issuing unit and source level from the URL."""
    url_lower = url.lower()

    for patterns, unit_name, level in UNIT_RULES:
        if any(p in url_lower for p in patterns):
            return unit_name, level

    if any(k in url_lower for k in LIBRARY_PATTERNS):
        return None, "library"

    if any(k in url_lower for k in ALUMNI_PATTERNS):
        return None, "alumni_or_story"

    if any(k in url_lower for k in NEWS_PATTERNS):
        return None, "news_or_events"

    if any(k in url_lower for k in SCHOOL_PATTERNS):
        return None, "school_career"

    if any(k in url_lower for k in GENERIC_CAREER_PATTERNS):
        return None, "central_career"

    return None, "other"
