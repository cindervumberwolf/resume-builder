"""Quick inspection of downloaded asset quality."""
import json
import sys
import os
from pathlib import Path

if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

assets = []
with open("data/manifests/assets.jsonl", "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            assets.append(json.loads(line))

for sid in ["oxford", "stanford", "mit"]:
    school_assets = [a for a in assets if a["school_id"] == sid]
    print(f"\n{'=' * 80}")
    print(f"  {sid.upper()} — {len(school_assets)} assets")
    print(f"{'=' * 80}")

    primary = [a for a in school_assets if a.get("in_primary_dataset")]
    shadow = [a for a in school_assets if not a.get("in_primary_dataset")]
    print(f"  Primary: {len(primary)}, Shadow: {len(shadow)}")

    for a in school_assets:
        flag = "P" if a.get("in_primary_dataset") else "S"
        doc_type = a.get("document_type", "?")[:8]
        res_type = a.get("resource_type", "?")[:20]
        title = (a.get("document_title") or "untitled")[:65]
        print(f"  [{flag}] {doc_type:8s} | {res_type:20s} | {title}")
