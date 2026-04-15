"""Clean parsed exemplars: remove noise, action verb lists, broken text, and guidance lines."""
import json
import os
import re
import sys
from pathlib import Path

if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding="utf-8")

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("clean")

BASE_DIR = Path(__file__).resolve().parent.parent
INPUT = BASE_DIR / "data" / "exemplars" / "all_exemplars.jsonl"
OUTPUT = BASE_DIR / "data" / "exemplars" / "all_exemplars_clean.jsonl"

NOISE_PATTERNS = [
    re.compile(r"^(analyzed|coordinated|executed|operated|reviewed|managed|developed|created)\s+(analyzed|coordinated|executed|operated|reviewed|managed|developed|created)", re.I),
    re.compile(r"^(create|use|write|review|tailor|consider|include|make sure|remember|try|avoid|check|ensure|focus|think|start|be sure)\b", re.I),
    re.compile(r"extensionsallowed|gsolids", re.I),
    re.compile(r"sample\s+resume|résumé\s+sample|resume\s+sample", re.I),
    re.compile(r"^(education|experience|leadership|skills|awards|interests|languages|activities)\s*$", re.I),
    re.compile(r"copyright|all rights reserved|©|\bpdf\b|\bpage \d", re.I),
    re.compile(r"^(name|first name|last name|email|phone|address|city|state)\b", re.I),
    re.compile(r"your (resume|cv|bullet|experience)|tips for|how to", re.I),
]

NO_SPACE_RATIO_THRESHOLD = 0.15


def is_noise(bullet: str) -> bool:
    for pattern in NOISE_PATTERNS:
        if pattern.search(bullet):
            return True

    words = bullet.split()
    if len(words) < 5:
        return True

    no_space_chars = len(bullet.replace(" ", ""))
    if len(bullet) > 0 and no_space_chars / len(bullet) > 0.95 and len(bullet) > 30:
        return True

    alpha_count = sum(1 for c in bullet if c.isalpha())
    if len(bullet) > 0 and alpha_count / len(bullet) < 0.5:
        return True

    return False


def main():
    with open(INPUT, "r", encoding="utf-8") as f:
        raw = [json.loads(line) for line in f if line.strip()]

    logger.info("Raw exemplars: %d", len(raw))

    clean = []
    removed_reasons: dict[str, int] = {}

    for ex in raw:
        bullet = ex["bullet_text"]
        if is_noise(bullet):
            for p in NOISE_PATTERNS:
                if p.search(bullet):
                    name = p.pattern[:30]
                    removed_reasons[name] = removed_reasons.get(name, 0) + 1
                    break
            else:
                removed_reasons["other"] = removed_reasons.get("other", 0) + 1
            continue
        clean.append(ex)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        for ex in clean:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    logger.info("Clean exemplars: %d (removed %d)", len(clean), len(raw) - len(clean))
    logger.info("Removal reasons:")
    for reason, count in sorted(removed_reasons.items(), key=lambda x: -x[1]):
        logger.info("  %s: %d", reason, count)

    # Stats
    by_track: dict[str, int] = {}
    by_section: dict[str, int] = {}
    quantified = 0
    action_verb = 0
    for ex in clean:
        t = ex["track"]
        by_track[t] = by_track.get(t, 0) + 1
        s = ex["section"]
        by_section[s] = by_section.get(s, 0) + 1
        if ex["style_features"]["quantified"]:
            quantified += 1
        if ex["style_features"]["opens_with_action_verb"]:
            action_verb += 1

    logger.info("\nBy track: %s", by_track)
    logger.info("By section: %s", by_section)
    logger.info("Quantified: %d/%d (%.0f%%)", quantified, len(clean), 100 * quantified / len(clean) if clean else 0)
    logger.info("Action verb: %d/%d (%.0f%%)", action_verb, len(clean), 100 * action_verb / len(clean) if clean else 0)


if __name__ == "__main__":
    main()
