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
  location: string | null;
  context_tags: string;
  base_priority: number;
  source_type: string;
  gpa: string | null;
  coursework: string | null;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  github_url: string;
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
  sort_order: number;
  created_at: string;
}

interface ChildModuleRow {
  child_module_id: string;
  user_id: string;
  parent_module_id: string;
  section: string;
  organization: string;
  title: string;
  date_range: string;
  location: string | null;
  context_tags: string;
  created_at: string;
}

interface ChildBulletRow {
  child_bullet_id: string;
  child_module_id: string;
  parent_bullet_id: string | null;
  user_id: string;
  raw_fact: string;
  evidence_tags: string;
  skill_tags: string;
  role_fit_tags: string;
  sort_order: number;
  created_at: string;
}

interface ChildJdLinkRow {
  child_module_id: string;
  job_id: string;
  user_id: string;
  linked_at: string;
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
       location, context_tags, base_priority, source_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mod.module_id, userId, mod.type, mod.section, mod.organization,
    mod.title, mod.date_range, mod.location ?? null,
    JSON.stringify(mod.context_tags),
    mod.base_priority, mod.source_type,
  );
}

export function upsertBullet(bullet: BulletModule, userId: string, sortOrder?: number): void {
  // Preserve existing sort_order on update if not explicitly provided
  const existing = sortOrder === undefined
    ? db().prepare("SELECT sort_order FROM bullets WHERE bullet_id = ?").get(bullet.bullet_id) as { sort_order: number } | undefined
    : undefined;
  const order = sortOrder ?? existing?.sort_order ?? 0;

  db().prepare(`
    INSERT OR REPLACE INTO bullets
      (bullet_id, parent_module_id, user_id, raw_fact, normalized_fact,
       evidence_tags, skill_tags, role_fit_tags, strength_score, rewrite_candidates, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bullet.bullet_id, bullet.parent_module_id, userId, bullet.raw_fact,
    JSON.stringify(bullet.normalized_fact), JSON.stringify(bullet.evidence_tags),
    JSON.stringify(bullet.skill_tags), JSON.stringify(bullet.role_fit_tags),
    JSON.stringify(bullet.strength_score), JSON.stringify(bullet.rewrite_candidates),
    order,
  );
}

export function listModules(userId: string): (ExperienceModule & { bullets: BulletModule[] })[] {
  const modules = db().prepare(
    `SELECT * FROM resume_modules WHERE user_id = ? ORDER BY base_priority DESC`
  ).all(userId) as ModuleRow[];
  return modules.map(mod => {
    const bulletRows = db().prepare(
      `SELECT * FROM bullets WHERE parent_module_id = ? AND user_id = ? ORDER BY sort_order ASC, created_at ASC`
    ).all(mod.module_id, userId) as BulletRow[];
    return {
      module_id: mod.module_id,
      type: mod.type as ExperienceModule["type"],
      section: mod.section as ExperienceModule["section"],
      organization: mod.organization,
      title: mod.title,
      date_range: mod.date_range,
      location: mod.location ?? undefined,
      context_tags: JSON.parse(mod.context_tags),
      base_priority: mod.base_priority,
      source_type: mod.source_type as ExperienceModule["source_type"],
      gpa: mod.gpa ?? undefined,
      coursework: mod.coursework ?? undefined,
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
    `SELECT * FROM bullets WHERE parent_module_id = ? AND user_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(moduleId, userId) as BulletRow[];
  return {
    module_id: mod.module_id,
    type: mod.type,
    section: mod.section,
    organization: mod.organization,
    title: mod.title,
    date_range: mod.date_range,
    location: mod.location ?? undefined,
    context_tags: JSON.parse(mod.context_tags),
    base_priority: mod.base_priority,
    source_type: mod.source_type,
    gpa: mod.gpa ?? undefined,
    coursework: mod.coursework ?? undefined,
    bullets: bulletRows.map(parseBulletRow),
  };
}

export function deleteModule(moduleId: string, userId: string): boolean {
  const tx = db().transaction(() => {
    db().prepare("DELETE FROM bullets WHERE parent_module_id = ? AND user_id = ?").run(moduleId, userId);
    const result = db().prepare("DELETE FROM resume_modules WHERE module_id = ? AND user_id = ?").run(moduleId, userId);
    return result.changes > 0;
  });
  return tx();
}

export function deleteBullet(bulletId: string, userId: string): boolean {
  const result = db().prepare("DELETE FROM bullets WHERE bullet_id = ? AND user_id = ?").run(bulletId, userId);
  return result.changes > 0;
}

export function patchModule(
  moduleId: string,
  userId: string,
  fields: Partial<Pick<ExperienceModule, "organization" | "title" | "date_range" | "location" | "section" | "type" | "context_tags" | "base_priority"> & { gpa?: string | null; coursework?: string | null }>,
) {
  const mod = db().prepare(
    "SELECT * FROM resume_modules WHERE module_id = ? AND user_id = ?"
  ).get(moduleId, userId) as ModuleRow | undefined;
  if (!mod) return null;

  const updated = {
    organization: fields.organization ?? mod.organization,
    title: fields.title ?? mod.title,
    date_range: fields.date_range ?? mod.date_range,
    location: fields.location ?? mod.location,
    section: fields.section ?? mod.section,
    type: fields.type ?? mod.type,
    context_tags: fields.context_tags ? JSON.stringify(fields.context_tags) : mod.context_tags,
    base_priority: fields.base_priority ?? mod.base_priority,
    gpa: "gpa" in fields ? fields.gpa ?? null : mod.gpa,
    coursework: "coursework" in fields ? fields.coursework ?? null : mod.coursework,
  };

  db().prepare(`
    UPDATE resume_modules
    SET organization = ?, title = ?, date_range = ?, location = ?,
        section = ?, type = ?, context_tags = ?, base_priority = ?,
        gpa = ?, coursework = ?
    WHERE module_id = ? AND user_id = ?
  `).run(
    updated.organization, updated.title, updated.date_range, updated.location,
    updated.section, updated.type, updated.context_tags, updated.base_priority,
    updated.gpa, updated.coursework,
    moduleId, userId,
  );

  return getModuleWithBullets(moduleId, userId);
}

export function patchBullet(
  bulletId: string,
  userId: string,
  fields: Partial<Pick<BulletModule, "raw_fact" | "evidence_tags" | "skill_tags" | "role_fit_tags" | "rewrite_candidates">>,
) {
  const row = db().prepare(
    "SELECT * FROM bullets WHERE bullet_id = ? AND user_id = ?"
  ).get(bulletId, userId) as BulletRow | undefined;
  if (!row) return null;

  const updated = {
    raw_fact: fields.raw_fact ?? row.raw_fact,
    evidence_tags: fields.evidence_tags ? JSON.stringify(fields.evidence_tags) : row.evidence_tags,
    skill_tags: fields.skill_tags ? JSON.stringify(fields.skill_tags) : row.skill_tags,
    role_fit_tags: fields.role_fit_tags ? JSON.stringify(fields.role_fit_tags) : row.role_fit_tags,
    rewrite_candidates: fields.rewrite_candidates ? JSON.stringify(fields.rewrite_candidates) : row.rewrite_candidates,
  };

  db().prepare(`
    UPDATE bullets
    SET raw_fact = ?, evidence_tags = ?, skill_tags = ?, role_fit_tags = ?, rewrite_candidates = ?
    WHERE bullet_id = ? AND user_id = ?
  `).run(
    updated.raw_fact, updated.evidence_tags, updated.skill_tags,
    updated.role_fit_tags, updated.rewrite_candidates,
    bulletId, userId,
  );

  return parseBulletRow(
    db().prepare("SELECT * FROM bullets WHERE bullet_id = ? AND user_id = ?")
      .get(bulletId, userId) as BulletRow
  );
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

// ---- Bullet reorder ----

export function reorderBullets(moduleId: string, userId: string, bulletIds: string[]): void {
  const tx = db().transaction(() => {
    bulletIds.forEach((bulletId, idx) => {
      db().prepare(
        "UPDATE bullets SET sort_order = ? WHERE bullet_id = ? AND parent_module_id = ? AND user_id = ?"
      ).run(idx, bulletId, moduleId, userId);
    });
  });
  tx();
}

// ---- Child asset operations ----

export interface ChildModule {
  child_module_id: string;
  parent_module_id: string;
  section: string;
  organization: string;
  title: string;
  date_range: string;
  location?: string;
  context_tags: string[];
  created_at: string;
}

export interface ChildBullet {
  child_bullet_id: string;
  child_module_id: string;
  parent_bullet_id: string | null;
  raw_fact: string;
  evidence_tags: string[];
  skill_tags: string[];
  role_fit_tags: string[];
  sort_order: number;
}

export function upsertChildModule(
  mod: { child_module_id: string; parent_module_id: string; section: string; organization: string; title: string; date_range: string; location?: string; context_tags: string[] },
  userId: string,
): void {
  db().prepare(`
    INSERT OR REPLACE INTO child_modules
      (child_module_id, user_id, parent_module_id, section, organization, title, date_range, location, context_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mod.child_module_id, userId, mod.parent_module_id, mod.section,
    mod.organization, mod.title, mod.date_range, mod.location ?? null,
    JSON.stringify(mod.context_tags),
  );
}

export function upsertChildBullet(
  bullet: { child_bullet_id: string; child_module_id: string; parent_bullet_id?: string; raw_fact: string; evidence_tags: string[]; skill_tags: string[]; role_fit_tags: string[] },
  userId: string,
  sortOrder?: number,
): void {
  db().prepare(`
    INSERT OR REPLACE INTO child_bullets
      (child_bullet_id, child_module_id, parent_bullet_id, user_id, raw_fact, evidence_tags, skill_tags, role_fit_tags, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bullet.child_bullet_id, bullet.child_module_id, bullet.parent_bullet_id ?? null,
    userId, bullet.raw_fact,
    JSON.stringify(bullet.evidence_tags), JSON.stringify(bullet.skill_tags),
    JSON.stringify(bullet.role_fit_tags), sortOrder ?? 0,
  );
}

export function linkChildJd(childModuleId: string, jobId: string, userId: string): void {
  db().prepare(`
    INSERT OR IGNORE INTO child_jd_links (child_module_id, job_id, user_id) VALUES (?, ?, ?)
  `).run(childModuleId, jobId, userId);
}

function parseChildBulletRow(row: ChildBulletRow): ChildBullet {
  return {
    child_bullet_id: row.child_bullet_id,
    child_module_id: row.child_module_id,
    parent_bullet_id: row.parent_bullet_id,
    raw_fact: row.raw_fact,
    evidence_tags: JSON.parse(row.evidence_tags),
    skill_tags: JSON.parse(row.skill_tags),
    role_fit_tags: JSON.parse(row.role_fit_tags),
    sort_order: row.sort_order,
  };
}

export function listChildModules(userId: string, jobId?: string): (ChildModule & { bullets: ChildBullet[]; source_jd_ids: string[] })[] {
  let modRows: ChildModuleRow[];
  if (jobId) {
    modRows = db().prepare(`
      SELECT cm.* FROM child_modules cm
      JOIN child_jd_links cjl ON cm.child_module_id = cjl.child_module_id AND cm.user_id = cjl.user_id
      WHERE cm.user_id = ? AND cjl.job_id = ?
      ORDER BY cm.created_at DESC
    `).all(userId, jobId) as ChildModuleRow[];
  } else {
    modRows = db().prepare(
      `SELECT * FROM child_modules WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId) as ChildModuleRow[];
  }

  return modRows.map(mod => {
    const bulletRows = db().prepare(
      `SELECT * FROM child_bullets WHERE child_module_id = ? AND user_id = ? ORDER BY sort_order ASC, created_at ASC`
    ).all(mod.child_module_id, userId) as ChildBulletRow[];

    const jdLinks = db().prepare(
      `SELECT job_id FROM child_jd_links WHERE child_module_id = ? AND user_id = ?`
    ).all(mod.child_module_id, userId) as { job_id: string }[];

    return {
      child_module_id: mod.child_module_id,
      parent_module_id: mod.parent_module_id,
      section: mod.section,
      organization: mod.organization,
      title: mod.title,
      date_range: mod.date_range,
      location: mod.location ?? undefined,
      context_tags: JSON.parse(mod.context_tags),
      created_at: mod.created_at,
      bullets: bulletRows.map(parseChildBulletRow),
      source_jd_ids: jdLinks.map(l => l.job_id),
    };
  });
}

export function getChildModuleWithBullets(childModuleId: string, userId: string) {
  const mod = db().prepare(
    `SELECT * FROM child_modules WHERE child_module_id = ? AND user_id = ?`
  ).get(childModuleId, userId) as ChildModuleRow | undefined;
  if (!mod) return null;

  const bulletRows = db().prepare(
    `SELECT * FROM child_bullets WHERE child_module_id = ? AND user_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(childModuleId, userId) as ChildBulletRow[];

  const jdLinks = db().prepare(
    `SELECT job_id FROM child_jd_links WHERE child_module_id = ? AND user_id = ?`
  ).all(childModuleId, userId) as { job_id: string }[];

  return {
    child_module_id: mod.child_module_id,
    parent_module_id: mod.parent_module_id,
    section: mod.section,
    organization: mod.organization,
    title: mod.title,
    date_range: mod.date_range,
    location: mod.location ?? undefined,
    context_tags: JSON.parse(mod.context_tags),
    created_at: mod.created_at,
    bullets: bulletRows.map(parseChildBulletRow),
    source_jd_ids: jdLinks.map(l => l.job_id),
  };
}

export function deleteChildModule(childModuleId: string, userId: string): boolean {
  const tx = db().transaction(() => {
    db().prepare("DELETE FROM child_bullets WHERE child_module_id = ? AND user_id = ?").run(childModuleId, userId);
    db().prepare("DELETE FROM child_jd_links WHERE child_module_id = ? AND user_id = ?").run(childModuleId, userId);
    const result = db().prepare("DELETE FROM child_modules WHERE child_module_id = ? AND user_id = ?").run(childModuleId, userId);
    return result.changes > 0;
  });
  return tx();
}

export function patchChildModule(
  childModuleId: string,
  userId: string,
  fields: Partial<Pick<ChildModule, "organization" | "title" | "date_range" | "location" | "section" | "context_tags">>,
) {
  const mod = db().prepare(
    "SELECT * FROM child_modules WHERE child_module_id = ? AND user_id = ?"
  ).get(childModuleId, userId) as ChildModuleRow | undefined;
  if (!mod) return null;

  db().prepare(`
    UPDATE child_modules
    SET organization = ?, title = ?, date_range = ?, location = ?, section = ?, context_tags = ?
    WHERE child_module_id = ? AND user_id = ?
  `).run(
    fields.organization ?? mod.organization,
    fields.title ?? mod.title,
    fields.date_range ?? mod.date_range,
    fields.location ?? mod.location,
    fields.section ?? mod.section,
    fields.context_tags ? JSON.stringify(fields.context_tags) : mod.context_tags,
    childModuleId, userId,
  );

  return getChildModuleWithBullets(childModuleId, userId);
}

export function patchChildBullet(
  childBulletId: string,
  userId: string,
  fields: Partial<Pick<ChildBullet, "raw_fact" | "evidence_tags" | "skill_tags" | "role_fit_tags">>,
) {
  const row = db().prepare(
    "SELECT * FROM child_bullets WHERE child_bullet_id = ? AND user_id = ?"
  ).get(childBulletId, userId) as ChildBulletRow | undefined;
  if (!row) return null;

  db().prepare(`
    UPDATE child_bullets SET raw_fact = ?, evidence_tags = ?, skill_tags = ?, role_fit_tags = ?
    WHERE child_bullet_id = ? AND user_id = ?
  `).run(
    fields.raw_fact ?? row.raw_fact,
    fields.evidence_tags ? JSON.stringify(fields.evidence_tags) : row.evidence_tags,
    fields.skill_tags ? JSON.stringify(fields.skill_tags) : row.skill_tags,
    fields.role_fit_tags ? JSON.stringify(fields.role_fit_tags) : row.role_fit_tags,
    childBulletId, userId,
  );

  return parseChildBulletRow(
    db().prepare("SELECT * FROM child_bullets WHERE child_bullet_id = ? AND user_id = ?")
      .get(childBulletId, userId) as ChildBulletRow
  );
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

// ---- User profile ----

export function getProfile(userId: string): UserProfile | null {
  return db().prepare("SELECT * FROM user_profile WHERE user_id = ?").get(userId) as UserProfile | null;
}

export function upsertProfile(userId: string, fields: Partial<Omit<UserProfile, "user_id">>): UserProfile {
  const existing = getProfile(userId);
  const data = {
    display_name: fields.display_name ?? existing?.display_name ?? "",
    email: fields.email ?? existing?.email ?? "",
    phone: fields.phone ?? existing?.phone ?? "",
    linkedin_url: fields.linkedin_url ?? existing?.linkedin_url ?? "",
    github_url: fields.github_url ?? existing?.github_url ?? "",
  };
  db().prepare(`
    INSERT INTO user_profile (user_id, display_name, email, phone, linkedin_url, github_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = excluded.display_name,
      email = excluded.email,
      phone = excluded.phone,
      linkedin_url = excluded.linkedin_url,
      github_url = excluded.github_url,
      updated_at = excluded.updated_at
  `).run(userId, data.display_name, data.email, data.phone, data.linkedin_url, data.github_url);
  return { user_id: userId, ...data };
}
