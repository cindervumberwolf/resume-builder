import json
from pathlib import Path
from src.models import SourceRecord, AssetRecord, ExceptionRecord

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _append_jsonl(path: Path, line: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def append_source(record: SourceRecord) -> None:
    path = BASE_DIR / "data" / "inventory" / "source_inventory.jsonl"
    _append_jsonl(path, record.to_jsonl())


def append_asset(record: AssetRecord) -> None:
    path = BASE_DIR / "data" / "manifests" / "assets.jsonl"
    _append_jsonl(path, record.to_jsonl())


def append_exception(record: ExceptionRecord) -> None:
    path = BASE_DIR / "data" / "logs" / "exceptions_log.jsonl"
    _append_jsonl(path, record.to_jsonl())


def append_crawl_log(entry: dict) -> None:
    path = BASE_DIR / "data" / "logs" / "crawl_log.jsonl"
    _append_jsonl(path, json.dumps(entry, ensure_ascii=False))


def load_source_inventory() -> list[dict]:
    return _load_jsonl(BASE_DIR / "data" / "inventory" / "source_inventory.jsonl")


def load_asset_manifest() -> list[dict]:
    return _load_jsonl(BASE_DIR / "data" / "manifests" / "assets.jsonl")


def load_exceptions() -> list[dict]:
    return _load_jsonl(BASE_DIR / "data" / "logs" / "exceptions_log.jsonl")


def get_existing_source_urls() -> set[str]:
    records = load_source_inventory()
    return {r["source_url"] for r in records if "source_url" in r}


def get_existing_asset_urls() -> set[str]:
    records = load_asset_manifest()
    urls = set()
    for r in records:
        if r.get("canonical_url"):
            urls.add(r["canonical_url"])
        if r.get("download_url"):
            urls.add(r["download_url"])
    return urls
