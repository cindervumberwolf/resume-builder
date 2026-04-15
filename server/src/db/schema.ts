import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "resume_builder.db");

export function getDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jd_schemas (
      job_id        TEXT PRIMARY KEY,
      raw_text      TEXT NOT NULL,
      meta          TEXT NOT NULL,  -- JSON
      hard_requirements   TEXT NOT NULL,  -- JSON array
      soft_requirements   TEXT NOT NULL,  -- JSON array
      preferred_signals   TEXT NOT NULL,  -- JSON array
      domain_tags         TEXT NOT NULL,  -- JSON array
      evidence_targets    TEXT NOT NULL,  -- JSON array of objects
      style_constraints   TEXT NOT NULL,  -- JSON
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resume_modules (
      module_id     TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      section       TEXT NOT NULL,
      organization  TEXT NOT NULL,
      title         TEXT NOT NULL,
      date_range    TEXT NOT NULL,
      context_tags  TEXT NOT NULL,  -- JSON array
      base_priority REAL NOT NULL DEFAULT 0.5,
      source_type   TEXT NOT NULL DEFAULT 'master_resume',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bullets (
      bullet_id         TEXT PRIMARY KEY,
      parent_module_id  TEXT NOT NULL REFERENCES resume_modules(module_id),
      raw_fact          TEXT NOT NULL,
      normalized_fact   TEXT NOT NULL,  -- JSON
      evidence_tags     TEXT NOT NULL,  -- JSON array
      skill_tags        TEXT NOT NULL,  -- JSON array
      role_fit_tags     TEXT NOT NULL,  -- JSON array
      strength_score    TEXT NOT NULL,  -- JSON
      rewrite_candidates TEXT NOT NULL DEFAULT '[]',  -- JSON array
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exemplars (
      exemplar_id    TEXT PRIMARY KEY,
      source         TEXT NOT NULL,
      track          TEXT NOT NULL,
      seniority      TEXT NOT NULL,
      section        TEXT NOT NULL,
      bullet_text    TEXT NOT NULL,
      style_features TEXT NOT NULL,  -- JSON
      latent_tags    TEXT NOT NULL,  -- JSON array
      anti_patterns  TEXT NOT NULL DEFAULT '[]',  -- JSON array
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS taxonomy_signals (
      signal_name   TEXT PRIMARY KEY,
      aliases       TEXT NOT NULL  -- JSON array
    );
  `);
}
