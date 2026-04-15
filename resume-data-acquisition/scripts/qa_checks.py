"""Run QA checks on all assets and generate qa_log.jsonl."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.qa.qa_checker import run_qa_checks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

if __name__ == "__main__":
    issues = run_qa_checks()
    print(f"\nQA Check Results: {len(issues)} issues found")
    for issue in issues[:20]:
        print(f"  [{issue['severity'].upper()}] {issue['asset_id']}: {issue['check']} - {issue['detail']}")
    if len(issues) > 20:
        print(f"  ... and {len(issues) - 20} more")
