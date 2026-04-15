import Database from "better-sqlite3";
import { getDb, initializeDatabase } from "./schema.js";
import type { Jd, ExperienceModule, BulletModule, Exemplar, Taxonomy } from "../types/index.js";

interface JdRow {
  job_id: string;
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

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (!_db) {
    _db = getDb();
    initializeDatabase(_db);
  }
  return _db;
}

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

// --- JD operations ---

export function upsertJd(jd: Jd): void {
  db().prepare(`
    INSERT OR REPLACE INTO jd_schemas
      (job_id, raw_text, meta, hard_requirements, soft_requirements,
       preferred_signals, domain_tags, evidence_targets, style_constraints)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jd.job_id, jd.raw_text, JSON.stringify(jd.meta),
    JSON.stringify(jd.hard_requirements), JSON.stringify(jd.soft_requirements),
    JSON.stringify(jd.preferred_signals), JSON.stringify(jd.domain_tags),
    JSON.stringify(jd.evidence_targets), JSON.stringify(jd.style_constraints),
  );
}

export function getJd(jobId: string): Jd | null {
  const row = db().prepare("SELECT * FROM jd_schemas WHERE job_id = ?").get(jobId) as JdRow | undefined;
  return row ? parseJdRow(row) : null;
}

export function listJds(): Jd[] {
  const rows = db().prepare("SELECT * FROM jd_schemas ORDER BY created_at DESC").all() as JdRow[];
  return rows.map(parseJdRow);
}

// --- Module operations ---

export function upsertModule(mod: ExperienceModule): void {
  db().prepare(`
    INSERT OR REPLACE INTO resume_modules
      (module_id, type, section, organization, title, date_range,
       context_tags, base_priority, source_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mod.module_id, mod.type, mod.section, mod.organization,
    mod.title, mod.date_range, JSON.stringify(mod.context_tags),
    mod.base_priority, mod.source_type,
  );
}

export function upsertBullet(bullet: BulletModule): void {
  db().prepare(`
    INSERT OR REPLACE INTO bullets
      (bullet_id, parent_module_id, raw_fact, normalized_fact,
       evidence_tags, skill_tags, role_fit_tags, strength_score, rewrite_candidates)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bullet.bullet_id, bullet.parent_module_id, bullet.raw_fact,
    JSON.stringify(bullet.normalized_fact), JSON.stringify(bullet.evidence_tags),
    JSON.stringify(bullet.skill_tags), JSON.stringify(bullet.role_fit_tags),
    JSON.stringify(bullet.strength_score), JSON.stringify(bullet.rewrite_candidates),
  );
}

export function listModules(): (ExperienceModule & { bullets: BulletModule[] })[] {
  const modules = db().prepare("SELECT * FROM resume_modules ORDER BY base_priority DESC").all() as ModuleRow[];
  return modules.map(mod => {
    const bulletRows = db().prepare("SELECT * FROM bullets WHERE parent_module_id = ?").all(mod.module_id) as BulletRow[];
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

export function getModuleWithBullets(moduleId: string) {
  const mod = db().prepare("SELECT * FROM resume_modules WHERE module_id = ?").get(moduleId) as ModuleRow | undefined;
  if (!mod) return null;
  const bulletRows = db().prepare("SELECT * FROM bullets WHERE parent_module_id = ?").all(moduleId) as BulletRow[];
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

// --- Exemplar operations ---

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
  const rows = db().prepare(`
    SELECT * FROM exemplars WHERE track = ? OR track = 'general' ORDER BY exemplar_id
  `).all(track) as ExemplarRow[];

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

// --- Taxonomy operations ---

export function upsertTaxonomySignal(signal: string, aliases: string[]): void {
  db().prepare(`
    INSERT OR REPLACE INTO taxonomy_signals (signal_name, aliases) VALUES (?, ?)
  `).run(signal, JSON.stringify(aliases));
}

export function loadTaxonomy(): Taxonomy {
  const rows = db().prepare("SELECT * FROM taxonomy_signals").all() as TaxonomyRow[];
  const signal_taxonomy: Record<string, string[]> = {};
  for (const row of rows) {
    signal_taxonomy[row.signal_name] = JSON.parse(row.aliases);
  }
  return { signal_taxonomy };
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
