"""Import cleaned exemplars into the MCP Server's SQLite database."""
import json
import os
import sqlite3
import sys
from pathlib import Path

if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding="utf-8")

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("import")

DATA_DIR = Path(__file__).resolve().parent.parent
MCP_DB = DATA_DIR.parent / "data" / "resume_builder.db"
INPUT = DATA_DIR / "data" / "exemplars" / "all_exemplars_clean.jsonl"


def main():
    if not MCP_DB.exists():
        logger.error("MCP database not found at %s", MCP_DB)
        sys.exit(1)

    conn = sqlite3.connect(str(MCP_DB))
    cursor = conn.cursor()

    with open(INPUT, "r", encoding="utf-8") as f:
        exemplars = [json.loads(line) for line in f if line.strip()]

    logger.info("Importing %d exemplars into %s...", len(exemplars), MCP_DB.name)

    count = 0
    for ex in exemplars:
        sf = ex.get("style_features", {})
        tone = sf.get("tone", "professional_compact")
        if tone not in ("professional_compact", "professional_detailed", "academic", "leadership_heavy", "analytical"):
            tone = "professional_compact"

        length_band = sf.get("length_band", "medium")
        if length_band not in ("short", "medium", "long"):
            length_band = "medium"

        section = ex.get("section", "experience")
        if section not in ("experience", "education", "projects", "leadership", "skills"):
            section = "experience"

        seniority = ex.get("seniority", "student")
        if seniority not in ("student", "intern", "entry_level", "experienced"):
            seniority = "student"

        style_features = json.dumps({
            "opens_with_action_verb": sf.get("opens_with_action_verb", False),
            "result_first": sf.get("result_first", False),
            "quantified": sf.get("quantified", False),
            "length_band": length_band,
            "tone": tone,
        })

        try:
            cursor.execute("""
                INSERT OR REPLACE INTO exemplars
                    (exemplar_id, source, track, seniority, section, bullet_text,
                     style_features, latent_tags, anti_patterns)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                ex["exemplar_id"],
                ex["source"],
                ex["track"],
                seniority,
                section,
                ex["bullet_text"],
                style_features,
                json.dumps(ex.get("latent_tags", [])),
                json.dumps(ex.get("anti_patterns", [])),
            ))
            count += 1
        except Exception as e:
            logger.warning("Failed to import %s: %s", ex["exemplar_id"], e)

    conn.commit()

    row_count = cursor.execute("SELECT COUNT(*) FROM exemplars").fetchone()[0]
    logger.info("Successfully imported %d exemplars. Total in DB: %d", count, row_count)

    tracks = cursor.execute("SELECT track, COUNT(*) FROM exemplars GROUP BY track ORDER BY COUNT(*) DESC").fetchall()
    logger.info("By track: %s", dict(tracks))

    conn.close()


if __name__ == "__main__":
    main()
