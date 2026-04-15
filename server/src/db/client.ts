import Database from "better-sqlite3";
import { getDb, initializeDatabase } from "./schema.js";
import type { Jd, ExperienceModule, BulletModule, Exemplar, Taxonomy } from "../types/index.js";

// ---- Row interfaces ----

interface UserRow {
  user_id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface AuthTokenRow {
  token: string;
  user_id: string;
  token_type: string;
  redirect_uri: string | null;
  expires_at: string;
  created_at: string;
}

interface JdRow {
  job_id: string;
  user_id: string;
  raw_text: string;
  meta: string;
  hard_requirements: string;
  soft_requirements: string;
  preferred_signals: string;
  domain_tags: string;
  evidence_targets: string;
  style_constraints: string;
  created_at: string;
}

interface ModuleRow {
  module_id: string;
  user_id: string;
  type: string;
  section: string;
  organization: string;
  title: string;
  date_range: string;
  context_tags: string;
  base_priority: number;
  source_type: string;
  created_at: string;
}

interface BulletRow {
  bullet_id: string;
  parent_module_id: string;
  user_id: string;
  raw_fact: string;
  normalized_fact: string;
  evidence_tags: string;
  skill_tags: string;
  role_fit_tags: string;
  strength_score: string;
  rewrite_candidates: string;
  created_at: string;
}

interface ExemplarRow {
  exemplar_id: string;
  source: string;
  track: string;
  seniority: string;
  section: string;
  bullet_text: string;
  style_features: string;
  latent_tags: string;
  anti_patterns: string;
  created_at: string;
}

interface TaxonomyRow {
  signal_name: string;
  aliases: string;
}

// ---- Singleton DB ----

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (!_db) {
    _db = getDb();
    initializeDatabase(_db);
  }
  return _db;
}

// ---- Parse helpers ----

function parseJdRow(row: JdRow): Jd {
  return {
    job_id: row.job_id,
    raw_text: row.raw_text,
    meta: JSON.parse(row.meta),
    hard_requirements: JSON.parse(row.hard_requirements),
    soft_requirements: JSON.parse(row.soft_requirements),
    preferred_signals: JSON.parse(row.preferred_signals),
    domain_tags: JSON.parse(row.domain_tags),
    evidence_targets: JSON.parse(row.evidence_targets),
    style_constraints: JSON.parse(row.style_constraints),
  };
}

function parseBulletRow(row: BulletRow): BulletModule {
  return {
    bullet_id: row.bullet_id,
    parent_module_id: row.parent_module_id,
    raw_fact: row.raw_fact,
    normalized_fact: JSON.parse(row.normalized_fact),
    evidence_tags: JSON.parse(row.evidence_tags),
    skill_tags: JSON.parse(row.skill_tags),
    role_fit_tags: JSON.parse(row.role_fit_tags),
    strength_score: JSON.parse(row.strength_score),
    rewrite_candidates: JSON.parse(row.rewrite_candidates),
  };
}

function parseExemplarRow(row: ExemplarRow): Exemplar {
  return {
    exemplar_id: row.exemplar_id,
    source: row.source,
    track: row.track,
    seniority: row.seniority as Exemplar["seniority"],
    section: row.section as Exemplar["section"],
    bullet_text: row.bullet_text,
    style_features: JSON.parse(row.style_features),
    latent_tags: JSON.parse(row.latent_tags),
    anti_patterns: JSON.parse(row.anti_patterns),
  };
}

// ---- User operations ----

export function createUser(userId: string, email: string, passwordHash: string): void {
  db().prepare(
    `INSERT INTO users (user_id, email, password_hash) VALUES (?, ?, ?)`
  ).run(userId, email.toLowerCase().trim(), passwordHash);
}

export function getUserByEmail(email: string): UserRow | null {
  return db().prepare(
    `SELECT * FROM users WHERE email = ?`
  ).get(email.toLowerCase().trim()) as UserRow | null;
}

export function getUserById(userId: string): UserRow | null {
  return db().prepare(
    `SELECT * FROM users WHERE user_id = ?`
  ).get(userId) as UserRow | null;
}

// ---- Auth token operations ----

export function createAuthToken(
  token: string,
  userId: string,
  tokenType: "access" | "refresh" | "code",
  expiresAt: string,
  redirectUri?: string,
): void {
  db().prepare(
    `INSERT INTO auth_tokens (token, user_id, token_type, expires_at, redirect_uri) VALUES (?, ?, ?, ?, ?)`
  ).run(token, userId, tokenType, expiresAt, redirectUri ?? null);
}

export function getAuthToken(token: string): AuthTokenRow | null {
  return db().prepare(
    `SELECT * FROM auth_tokens WHERE token = ? AND expires_at > datetime('now')`
  ).get(token) as AuthTokenRow | null;
}

export function deleteAuthToken(token: string): void {
  db().prepare(`DELETE FROM auth_tokens WHERE token = ?`).run(token);
}

export function deleteUserTokensByType(userId: string, tokenType: string): void {
  db().prepare(
    `DELETE FROM auth_tokens WHERE user_id = ? AND token_type = ?`
  ).run(userId, tokenType);
}

// ---- JD operations ----

export function upsertJd(jd: Jd, userId: string): void {
  db().prepare(`
    INSERT OR REPLACE INTO jd_schemas
      (job_id, user_id, raw_text, meta, hard_requirements, soft_requirements,
       preferred_signals, domain_tags, evidence_targets, style_constraints)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jd.job_id, userId, jd.raw_text, JSON.stringify(jd.meta),
    JSON.stringify(jd.hard_requirements), JSON.stringify(jd.soft_requirements),
    JSON.stringify(jd.preferred_signals), JSON.stringify(jd.domain_tags),
    JSON.stringify(jd.evidence_targets), JSON.stringify(jd.style_constraints),
  );
}

export function getJd(jobId: string, userId: string): Jd | null {
  const row = db().prepare(
    `SELECT * FROM jd_schemas WHERE job_id = ? AND user_id = ?`
  ).get(jobId, userId) as JdRow | undefined;
  return row ? parseJdRow(row) : null;
}

export function listJds(userId: string): Jd[] {
  const rows = db().prepare(
    `SELECT * FROM jd_schemas WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId) as JdRow[];
  return rows.map(parseJdRow);
}

// ---- Module operations ----

export function upsertModule(mod: ExperienceModule, userId: string): void {
  db().prepare(`
    INSERT OR REPLACE INTO resume_modules
      (module_id, user_id, type, section, organization, title, date_range,
       context_tags, base_priority, source_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mod.module_id, userId, mod.type, mod.section, mod.organization,
    mod.title, mod.date_range, JSON.stringify(mod.context_tags),
    mod.base_priority, mod.source_type,
  );
}

export function upsertBullet(bullet: BulletModule, userId: string): void {
  db().prepare(`
    INSERT OR REPLACE INTO bullets
      (bullet_id, parent_module_id, user_id, raw_fact, normalized_fact,
       evidence_tags, skill_tags, role_fit_tags, strength_score, rewrite_candidates)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bullet.bullet_id, bullet.parent_module_id, userId, bullet.raw_fact,
    JSON.stringify(bullet.normalized_fact), JSON.stringify(bullet.evidence_tags),
    JSON.stringify(bullet.skill_tags), JSON.stringify(bullet.role_fit_tags),
    JSON.stringify(bullet.strength_score), JSON.stringify(bullet.rewrite_candidates),
  );
}

export function listModules(userId: string): (ExperienceModule & { bullets: BulletModule[] })[] {
  const modules = db().prepare(
    `SELECT * FROM resume_modules WHERE user_id = ? ORDER BY base_priority DESC`
  ).all(userId) as ModuleRow[];
  return modules.map(mod => {
    const bulletRows = db().prepare(
      `SELECT * FROM bullets WHERE parent_module_id = ? AND user_id = ?`
    ).all(mod.module_id, userId) as BulletRow[];
    return {
      module_id: mod.module_id,
      type: mod.type as ExperienceModule["type"],
      section: mod.section as ExperienceModule["section"],
      organization: mod.organization,
      title: mod.title,
      date_range: mod.date_range,
      context_tags: JSON.parse(mod.context_tags),
      base_priority: mod.base_priority,
      source_type: mod.source_type as ExperienceModule["source_type"],
      bullets: bulletRows.map(parseBulletRow),
    };
  });
}

export function getModuleWithBullets(moduleId: string, userId: string) {
  const mod = db().prepare(
    `SELECT * FROM resume_modules WHERE module_id = ? AND user_id = ?`
  ).get(moduleId, userId) as ModuleRow | undefined;
  if (!mod) return null;
  const bulletRows = db().prepare(
    `SELECT * FROM bullets WHERE parent_module_id = ? AND user_id = ?`
  ).all(moduleId, userId) as BulletRow[];
  return {
    module_id: mod.module_id,
    type: mod.type,
    section: mod.section,
    organization: mod.organization,
    title: mod.title,
    date_range: mod.date_range,
    context_tags: JSON.parse(mod.context_tags),
    base_priority: mod.base_priority,
    source_type: mod.source_type,
    bullets: bulletRows.map(parseBulletRow),
  };
}

// ---- Exemplar operations (global, not user-scoped) ----

export function upsertExemplar(ex: Exemplar): void {
  db().prepare(`
    INSERT OR REPLACE INTO exemplars
      (exemplar_id, source, track, seniority, section, bullet_text,
       style_features, latent_tags, anti_patterns)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ex.exemplar_id, ex.source, ex.track, ex.seniority, ex.section,
    ex.bullet_text, JSON.stringify(ex.style_features),
    JSON.stringify(ex.latent_tags), JSON.stringify(ex.anti_patterns),
  );
}

export function searchExemplars(track: string, tags: string[]): Exemplar[] {
  const rows = db().prepare(
    `SELECT * FROM exemplars WHERE track = ? OR track = 'general' ORDER BY exemplar_id`
  ).all(track) as ExemplarRow[];
  const parsed = rows.map(parseExemplarRow);
  if (tags.length === 0) return parsed;
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  return parsed
    .map(ex => ({
      ...ex,
      _score: ex.latent_tags.filter(t => tagSet.has(t.toLowerCase())).length,
    }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);
}

// ---- Taxonomy operations (global) ----

export function upsertTaxonomySignal(signal: string, aliases: string[]): void {
  db().prepare(
    `INSERT OR REPLACE INTO taxonomy_signals (signal_name, aliases) VALUES (?, ?)`
  ).run(signal, JSON.stringify(aliases));
}

export function loadTaxonomy(): Taxonomy {
  const rows = db().prepare(`SELECT * FROM taxonomy_signals`).all() as TaxonomyRow[];
  const signal_taxonomy: Record<string, string[]> = {};
  for (const row of rows) {
    signal_taxonomy[row.signal_name] = JSON.parse(row.aliases);
  }
  return { signal_taxonomy };
}

// ---- Canvas drafts ----

export interface DraftRow {
  draft_id: string;
  user_id: string;
  title: string;
  latex_source: string;
  created_at: string;
  updated_at: string;
}

export function upsertDraft(draft: { draft_id: string; user_id: string; title: string; latex_source: string }): DraftRow {
  db().prepare(`
    INSERT INTO canvas_drafts (draft_id, user_id, title, latex_source, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(draft_id) DO UPDATE SET
      title = excluded.title,
      latex_source = excluded.latex_source,
      updated_at = datetime('now')
    WHERE canvas_drafts.user_id = excluded.user_id
  `).run(draft.draft_id, draft.user_id, draft.title, draft.latex_source);
  return getDraft(draft.draft_id, draft.user_id)!;
}

export function getDraft(draftId: string, userId: string): DraftRow | undefined {
  return db().prepare(
    "SELECT * FROM canvas_drafts WHERE draft_id = ? AND user_id = ?"
  ).get(draftId, userId) as DraftRow | undefined;
}

export function listDrafts(userId: string): DraftRow[] {
  return db().prepare(
    "SELECT * FROM canvas_drafts WHERE user_id = ? ORDER BY updated_at DESC"
  ).all(userId) as DraftRow[];
}

export function deleteDraft(draftId: string, userId: string): void {
  db().prepare("DELETE FROM canvas_drafts WHERE draft_id = ? AND user_id = ?").run(draftId, userId);
}

export function findMatchingSignals(terms: string[]): string[] {
  const taxonomy = loadTaxonomy();
  const lowerTerms = terms.map(t => t.toLowerCase());
  const matched: string[] = [];
  for (const [signal, aliases] of Object.entries(taxonomy.signal_taxonomy)) {
    const allTerms = [signal, ...aliases].map(a => a.toLowerCase());
    if (lowerTerms.some(t => allTerms.some(a => a.includes(t) || t.includes(a)))) {
      matched.push(signal);
    }
  }
  return matched;
}
