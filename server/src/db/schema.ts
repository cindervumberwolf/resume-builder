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
    CREATE TABLE IF NOT EXISTS users (
      user_id    TEXT PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      token_type TEXT NOT NULL CHECK(token_type IN ('access', 'refresh', 'code')),
      redirect_uri TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jd_schemas (
      job_id        TEXT NOT NULL,
      user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      raw_text      TEXT NOT NULL,
      meta          TEXT NOT NULL,
      hard_requirements   TEXT NOT NULL,
      soft_requirements   TEXT NOT NULL,
      preferred_signals   TEXT NOT NULL,
      domain_tags         TEXT NOT NULL,
      evidence_targets    TEXT NOT NULL,
      style_constraints   TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS resume_modules (
      module_id     TEXT NOT NULL,
      user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type          TEXT NOT NULL,
      section       TEXT NOT NULL,
      organization  TEXT NOT NULL,
      title         TEXT NOT NULL,
      date_range    TEXT NOT NULL,
      location      TEXT,
      context_tags  TEXT NOT NULL,
      base_priority REAL NOT NULL DEFAULT 0.5,
      source_type   TEXT NOT NULL DEFAULT 'master_resume',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS bullets (
      bullet_id         TEXT PRIMARY KEY,
      parent_module_id  TEXT NOT NULL,
      user_id           TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      raw_fact          TEXT NOT NULL,
      normalized_fact   TEXT NOT NULL,
      evidence_tags     TEXT NOT NULL,
      skill_tags        TEXT NOT NULL,
      role_fit_tags     TEXT NOT NULL,
      strength_score    TEXT NOT NULL,
      rewrite_candidates TEXT NOT NULL DEFAULT '[]',
      sort_order        INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exemplars (
      exemplar_id    TEXT PRIMARY KEY,
      source         TEXT NOT NULL,
      track          TEXT NOT NULL,
      seniority      TEXT NOT NULL,
      section        TEXT NOT NULL,
      bullet_text    TEXT NOT NULL,
      style_features TEXT NOT NULL,
      latent_tags    TEXT NOT NULL,
      anti_patterns  TEXT NOT NULL DEFAULT '[]',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS taxonomy_signals (
      signal_name   TEXT PRIMARY KEY,
      aliases       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canvas_drafts (
      draft_id    TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      title       TEXT NOT NULL DEFAULT 'Untitled',
      latex_source TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate legacy tables that may exist without user_id
  migrateLegacyTables(db);
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('${table}') WHERE name = ?`
  ).get(column) as { cnt: number };
  return row.cnt > 0;
}

function migrateLegacyTables(db: Database.Database): void {
  // If old jd_schemas has job_id as sole PK (no user_id), rename and recreate
  if (!columnExists(db, "jd_schemas", "user_id")) {
    db.exec(`
      ALTER TABLE jd_schemas RENAME TO jd_schemas_legacy;
      DROP TABLE IF EXISTS jd_schemas_legacy;
    `);
  }
  if (!columnExists(db, "resume_modules", "user_id")) {
    db.exec(`
      ALTER TABLE resume_modules RENAME TO resume_modules_legacy;
      DROP TABLE IF EXISTS resume_modules_legacy;
    `);
  }
  if (!columnExists(db, "resume_modules", "location")) {
    db.exec(`ALTER TABLE resume_modules ADD COLUMN location TEXT`);
  }
  if (!columnExists(db, "bullets", "sort_order")) {
    db.exec(`ALTER TABLE bullets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists(db, "bullets", "user_id")) {
    db.exec(`
      ALTER TABLE bullets RENAME TO bullets_legacy;
      DROP TABLE IF EXISTS bullets_legacy;
    `);
  }
}
