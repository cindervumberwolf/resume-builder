from __future__ import annotations
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class SourceRecord:
    source_id: str
    school_id: str
    school_name: str
    discovered_via: str  # search_engine | site_crawl | manual_seed
    seed_query: str | None
    source_url: str
    source_domain: str
    issuing_unit: str | None
    source_level: str  # central_career | school | faculty | college | program | other
    page_title: str | None
    candidate_resource_types: list[str] = field(default_factory=list)
    officiality_score: float = 0.0
    public_access: str = "public"  # public | login_required | unclear
    status: str = "candidate"  # candidate | accepted | rejected | needs_review
    rejection_reason: str | None = None
    discovered_at: str = field(default_factory=_now_iso)

    def to_jsonl(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)


@dataclass
class AssetRecord:
    asset_id: str
    source_id: str
    school_id: str
    school_name: str
    issuing_unit: str | None
    source_level: str
    document_title: str | None
    document_type: str  # html_page | pdf | doc | docx | ppt | other
    resource_type: str  # resume_guide | resume_template | sample_resume | checklist | action_verbs | format_guide | mixed
    term_used: str = "resume"  # resume | résumé | cv | mixed | unknown
    functional_type: str = "strict_resume"  # strict_resume | resume_equivalent_review | ambiguous
    target_audience: str = "all"  # all | undergraduate | masters | mba | phd | law | engineering | unknown
    language: str = "en"
    public_access: str = "public"
    canonical_url: str = ""
    download_url: str = ""
    file_ext: str = ""
    mime_type: str = ""
    http_status: int = 200
    content_hash_sha256: str = ""
    raw_file_path: str = ""
    extracted_text_path: str = ""
    text_extraction_status: str = "not_applicable"  # success | failed | not_applicable
    in_primary_dataset: bool = True
    needs_manual_review: bool = False
    notes: str | None = None
    captured_at: str = field(default_factory=_now_iso)

    def to_jsonl(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)


@dataclass
class ExceptionRecord:
    exception_id: str
    school_id: str
    url: str
    issue_type: str  # login_required | broken_link | ambiguous_cv | download_failed | parse_failed | officiality_unclear | duplicate_conflict
    severity: str = "medium"  # low | medium | high
    description: str = ""
    next_action: str = "manual_review"  # manual_review | skip | retry | add_shadow_record
    created_at: str = field(default_factory=_now_iso)

    def to_jsonl(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)
