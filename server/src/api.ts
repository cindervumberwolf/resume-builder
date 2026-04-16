import express from "express";
import {
  db, upsertJd, getJd, listJds,
  upsertModule, upsertBullet, listModules, getModuleWithBullets,
  deleteModule, deleteBullet, patchModule, patchBullet, reorderBullets,
  upsertChildModule, upsertChildBullet, linkChildJd,
  listChildModules, getChildModuleWithBullets, deleteChildModule,
  patchChildModule, patchChildBullet,
  searchExemplars, findMatchingSignals,
} from "./db/client.js";
import { JdSchema, ExperienceModuleSchema, BulletModuleSchema } from "./types/index.js";
import { latexRouter, latexPublicRouter } from "./routes/latex.js";
import { oauthRouter } from "./routes/oauth.js";
import { requireAuth, type AuthRequest } from "./middleware/auth.js";
import { LATEX_TEMPLATE, LATEX_TEMPLATE_ZH } from "./templates.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true })); // needed for OAuth form POSTs

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

db();

// --- Health (public) ---
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "resume-builder-api", version: "3.0.0" });
});

// --- Privacy Policy (public) ---
app.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy – Resume Builder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 60px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 1.8rem; margin-bottom: 4px; }
    .updated { color: #666; font-size: 0.9rem; margin-bottom: 40px; }
    h2 { font-size: 1.1rem; margin-top: 32px; }
    p, li { font-size: 0.97rem; }
    ul { padding-left: 20px; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: April 2026</p>

  <p>This Privacy Policy describes how <strong>Resume Builder</strong> ("we", "our", or "the Service") collects, uses, and protects information when you use our ChatGPT-integrated resume optimization service.</p>

  <h2>1. Information We Collect</h2>
  <ul>
    <li><strong>Account credentials</strong>: email address and hashed password when you register.</li>
    <li><strong>Resume content</strong>: job descriptions, resume modules, and bullet points you submit through the GPT interface.</li>
    <li><strong>Compiled outputs</strong>: LaTeX source and generated PDF files created during your session.</li>
    <li><strong>Authentication tokens</strong>: short-lived access tokens and refresh tokens used to maintain your session.</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>To provide and personalize the resume building service.</li>
    <li>To store and retrieve your resume modules across sessions.</li>
    <li>To compile your resume into PDF format on our servers.</li>
    <li>We do <strong>not</strong> sell, rent, or share your data with third parties.</li>
    <li>We do <strong>not</strong> use your resume content to train AI models.</li>
  </ul>

  <h2>3. Data Storage</h2>
  <p>Your data is stored in an encrypted SQLite database hosted on Railway (railway.app) within the United States. Persistent storage is provided via Railway Volumes. We retain your data as long as your account is active.</p>

  <h2>4. Data Deletion</h2>
  <p>You may request deletion of your account and all associated data at any time by contacting us. Upon request, all your resume modules, job descriptions, and authentication records will be permanently deleted within 30 days.</p>

  <h2>5. Security</h2>
  <p>Passwords are stored using bcrypt hashing. All API communication is encrypted over HTTPS. Access tokens expire after 1 hour; refresh tokens expire after 30 days.</p>

  <h2>6. Third-Party Services</h2>
  <p>This service integrates with <strong>OpenAI ChatGPT</strong> via the Custom GPT Actions framework. Please refer to <a href="https://openai.com/policies/privacy-policy" target="_blank">OpenAI's Privacy Policy</a> for information on how OpenAI processes data within ChatGPT.</p>

  <h2>7. Changes to This Policy</h2>
  <p>We may update this policy from time to time. The "Last updated" date above will reflect any changes.</p>

  <h2>8. Contact</h2>
  <p>For privacy-related questions or data deletion requests, please reach out via the ChatGPT interface or the service administrator.</p>
</body>
</html>`);
});

// --- OAuth (public) ---
app.use("/oauth", oauthRouter);

// --- Template (public, read-only) ---

app.get("/api/template/latex", (_req, res) => {
  res.json({
    template: LATEX_TEMPLATE,
    instructions: "Fill all [placeholder] fields with actual content. Keep all LaTeX commands, packages, and structure unchanged.",
  });
});

// --- Auth: editor link (requires auth, returns pre-built URL with token embedded) ---
app.get("/api/auth/editor-link", requireAuth, (req: AuthRequest, res) => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  const base = process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
  res.json({
    editor_url: `${base}/editor?token=${token}`,
    modules_url: `${base}/editor?token=${token}&view=modules`,
  });
});

// --- All API routes below require authentication ---

// --- Modules ---
app.post("/api/modules", requireAuth, (req: AuthRequest, res) => {
  try {
    const { modules, bullets } = req.body;
    const userId = req.userId!;
    let moduleCount = 0;
    let bulletCount = 0;

    if (modules && Array.isArray(modules)) {
      for (const mod of modules) {
        const validated = ExperienceModuleSchema.parse(mod);
        upsertModule(validated, userId);
        moduleCount++;
      }
    }
    if (bullets && Array.isArray(bullets)) {
      // Track sort_order per module based on array position
      const moduleOrderCounter: Record<string, number> = {};
      for (const bullet of bullets) {
        const validated = BulletModuleSchema.parse(bullet);
        const sortOrder = moduleOrderCounter[validated.parent_module_id] ?? 0;
        moduleOrderCounter[validated.parent_module_id] = sortOrder + 1;
        upsertBullet(validated, userId, sortOrder);
        bulletCount++;
      }
    }

    res.json({ success: true, modules_stored: moduleCount, bullets_stored: bulletCount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/modules", requireAuth, (req: AuthRequest, res) => {
  const modules = listModules(req.userId!);
  res.json({ modules, count: modules.length });
});

app.get("/api/modules/:id", requireAuth, (req: AuthRequest, res) => {
  const mod = getModuleWithBullets(String(req.params.id), req.userId!);
  if (!mod) { res.status(404).json({ error: "Module not found" }); return; }
  res.json(mod);
});

app.patch("/api/modules/:id", requireAuth, (req: AuthRequest, res) => {
  try {
    const result = patchModule(String(req.params.id), req.userId!, req.body);
    if (!result) { res.status(404).json({ error: "Module not found" }); return; }
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete("/api/modules/:id", requireAuth, (req: AuthRequest, res) => {
  const deleted = deleteModule(String(req.params.id), req.userId!);
  if (!deleted) { res.status(404).json({ error: "Module not found" }); return; }
  res.status(204).end();
});

// Must be defined before /:bid routes to avoid "reorder" matching :bid
app.post("/api/modules/:mid/bullets/reorder", requireAuth, (req: AuthRequest, res) => {
  const { bullet_ids } = req.body;
  if (!Array.isArray(bullet_ids)) {
    res.status(400).json({ error: "bullet_ids must be an array" }); return;
  }
  reorderBullets(String(req.params.mid), req.userId!, bullet_ids as string[]);
  res.json({ success: true });
});

app.patch("/api/modules/:mid/bullets/:bid", requireAuth, (req: AuthRequest, res) => {
  try {
    const result = patchBullet(String(req.params.bid), req.userId!, req.body);
    if (!result) { res.status(404).json({ error: "Bullet not found" }); return; }
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete("/api/modules/:mid/bullets/:bid", requireAuth, (req: AuthRequest, res) => {
  const deleted = deleteBullet(String(req.params.bid), req.userId!);
  if (!deleted) { res.status(404).json({ error: "Bullet not found" }); return; }
  res.status(204).end();
});

// --- Child assets ---
app.post("/api/children", requireAuth, (req: AuthRequest, res) => {
  try {
    const { modules, bullets, job_id } = req.body;
    const userId = req.userId!;
    let moduleCount = 0;
    let bulletCount = 0;

    if (modules && Array.isArray(modules)) {
      for (const mod of modules) {
        upsertChildModule(mod, userId);
        if (job_id) linkChildJd(mod.child_module_id, job_id, userId);
        moduleCount++;
      }
    }
    if (bullets && Array.isArray(bullets)) {
      const orderCounter: Record<string, number> = {};
      for (const bullet of bullets) {
        const order = orderCounter[bullet.child_module_id] ?? 0;
        orderCounter[bullet.child_module_id] = order + 1;
        upsertChildBullet(bullet, userId, order);
        bulletCount++;
      }
    }

    res.json({ success: true, child_modules_stored: moduleCount, child_bullets_stored: bulletCount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/children", requireAuth, (req: AuthRequest, res) => {
  const jobId = req.query.job_id ? String(req.query.job_id) : undefined;
  const modules = listChildModules(req.userId!, jobId);
  res.json({ modules, count: modules.length });
});

app.get("/api/children/:id", requireAuth, (req: AuthRequest, res) => {
  const mod = getChildModuleWithBullets(String(req.params.id), req.userId!);
  if (!mod) { res.status(404).json({ error: "Child module not found" }); return; }
  res.json(mod);
});

app.patch("/api/children/:id", requireAuth, (req: AuthRequest, res) => {
  try {
    const result = patchChildModule(String(req.params.id), req.userId!, req.body);
    if (!result) { res.status(404).json({ error: "Child module not found" }); return; }
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete("/api/children/:id", requireAuth, (req: AuthRequest, res) => {
  const deleted = deleteChildModule(String(req.params.id), req.userId!);
  if (!deleted) { res.status(404).json({ error: "Child module not found" }); return; }
  res.status(204).end();
});

app.post("/api/children/:cid/link-jd", requireAuth, (req: AuthRequest, res) => {
  const { job_id } = req.body;
  if (!job_id) { res.status(400).json({ error: "job_id is required" }); return; }
  linkChildJd(String(req.params.cid), job_id, req.userId!);
  res.json({ success: true });
});

app.patch("/api/children/:cid/bullets/:bid", requireAuth, (req: AuthRequest, res) => {
  try {
    const result = patchChildBullet(String(req.params.bid), req.userId!, req.body);
    if (!result) { res.status(404).json({ error: "Child bullet not found" }); return; }
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// --- JD ---
app.post("/api/jd", requireAuth, (req: AuthRequest, res) => {
  try {
    const validated = JdSchema.parse(req.body);
    upsertJd(validated, req.userId!);
    res.json({
      success: true,
      job_id: validated.job_id,
      role: validated.meta.role_title,
      company: validated.meta.company,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/jd", requireAuth, (req: AuthRequest, res) => {
  const jds = listJds(req.userId!);
  res.json({ jds, count: jds.length });
});

app.get("/api/jd/:id", requireAuth, (req: AuthRequest, res) => {
  const jd = getJd(String(req.params.id), req.userId!);
  if (!jd) { res.status(404).json({ error: "JD not found" }); return; }
  res.json(jd);
});

// --- Match (searches both master + child assets) ---
app.post("/api/match", requireAuth, (req: AuthRequest, res) => {
  const { job_id, domain_tags, required_signals, max_modules = 5, max_bullets_per_module = 3 } = req.body;
  const userId = req.userId!;

  let jdTags = new Set<string>();
  let evidenceSignals = new Set<string>();

  if (job_id) {
    const jd = getJd(job_id, userId);
    if (jd) {
      [...jd.hard_requirements, ...jd.soft_requirements, ...jd.preferred_signals, ...jd.domain_tags]
        .forEach(t => jdTags.add(t.toLowerCase()));
      for (const et of jd.evidence_targets) {
        evidenceSignals.add(et.signal.toLowerCase());
        et.examples.forEach((e: string) => evidenceSignals.add(e.toLowerCase()));
      }
    }
  }
  if (domain_tags) (domain_tags as string[]).forEach(t => jdTags.add(t.toLowerCase()));
  if (required_signals) {
    (required_signals as string[]).forEach(s => {
      jdTags.add(s.toLowerCase());
      evidenceSignals.add(s.toLowerCase());
      findMatchingSignals([s]).forEach(e => evidenceSignals.add(e.toLowerCase()));
    });
  }

  // Score master modules
  const allModules = listModules(userId);
  const masterScored = allModules.map(mod => {
    const bulletScores = mod.bullets.map(b => {
      let score = 0;
      const allTags = [...b.evidence_tags, ...b.skill_tags, ...b.role_fit_tags].map(t => t.toLowerCase());
      for (const tag of allTags) {
        if (jdTags.has(tag)) score += 1;
        if (evidenceSignals.has(tag)) score += 1.5;
      }
      const ss = b.strength_score;
      score += (ss.clarity + ss.quantification + ss.brand_signal + ss.transferability) * 0.5;
      return { ...b, relevance_score: score };
    }).sort((a, b) => b.relevance_score - a.relevance_score).slice(0, max_bullets_per_module);

    const tagOverlap = mod.context_tags.filter(t => jdTags.has(t.toLowerCase())).length;
    const avgBullet = bulletScores.length > 0
      ? bulletScores.reduce((s, b) => s + b.relevance_score, 0) / bulletScores.length : 0;
    const score = (mod.base_priority * 2) + (tagOverlap * 1.5) + avgBullet;

    return {
      module_id: mod.module_id,
      organization: mod.organization,
      title: mod.title,
      section: mod.section,
      date_range: mod.date_range,
      score,
      is_child: false as const,
      parent_module_id: null as string | null,
      source_jd_ids: [] as string[],
      matched_tags: mod.context_tags.filter(t => jdTags.has(t.toLowerCase())),
      bullets: bulletScores.map(b => ({
        bullet_id: b.bullet_id,
        raw_fact: b.raw_fact,
        relevance_score: b.relevance_score,
        evidence_tags: b.evidence_tags,
      })),
    };
  });

  // Score child modules (bonus +3 for being JD-optimized)
  const CHILD_BONUS = 3;
  const childModules = listChildModules(userId);
  const childScored = childModules.map(cm => {
    const bulletScores = cm.bullets.map(b => {
      let score = 0;
      const allTags = [...b.evidence_tags, ...b.skill_tags, ...b.role_fit_tags].map(t => t.toLowerCase());
      for (const tag of allTags) {
        if (jdTags.has(tag)) score += 1;
        if (evidenceSignals.has(tag)) score += 1.5;
      }
      return { bullet_id: b.child_bullet_id, raw_fact: b.raw_fact, relevance_score: score, evidence_tags: b.evidence_tags };
    }).sort((a, b) => b.relevance_score - a.relevance_score).slice(0, max_bullets_per_module);

    const tagOverlap = cm.context_tags.filter(t => jdTags.has(t.toLowerCase())).length;
    const avgBullet = bulletScores.length > 0
      ? bulletScores.reduce((s, b) => s + b.relevance_score, 0) / bulletScores.length : 0;
    const score = (tagOverlap * 1.5) + avgBullet + CHILD_BONUS;

    return {
      module_id: cm.child_module_id,
      organization: cm.organization,
      title: cm.title,
      section: cm.section,
      date_range: cm.date_range,
      score,
      is_child: true as const,
      parent_module_id: cm.parent_module_id,
      source_jd_ids: cm.source_jd_ids,
      matched_tags: cm.context_tags.filter(t => jdTags.has(t.toLowerCase())),
      bullets: bulletScores,
    };
  });

  type ScoredModule = {
    module_id: string; organization: string; title: string; section: string;
    date_range: string; score: number; is_child: boolean;
    parent_module_id: string | null; source_jd_ids: string[];
    matched_tags: string[]; bullets: { bullet_id: string; raw_fact: string; relevance_score: number; evidence_tags: string[] }[];
  };

  // Merge: if a master module already has a higher-scoring child version, prefer it
  const childByParent = new Map<string, ScoredModule>();
  for (const c of childScored) {
    const existing = childByParent.get(c.parent_module_id);
    if (!existing || c.score > existing.score) {
      childByParent.set(c.parent_module_id, c);
    }
  }

  const merged: ScoredModule[] = [];
  const usedChildIds = new Set<string>();

  for (const m of masterScored) {
    const childVersion = childByParent.get(m.module_id);
    if (childVersion && childVersion.score > m.score) {
      merged.push(childVersion);
      usedChildIds.add(childVersion.module_id);
    } else {
      merged.push(m);
    }
  }

  for (const c of childScored) {
    if (!usedChildIds.has(c.module_id)) {
      merged.push(c);
    }
  }

  const ranked = merged.sort((a, b) => b.score - a.score).slice(0, max_modules);
  res.json({ ranked_modules: ranked });
});

// --- LaTeX: PDF download is public (UUID acts as capability token); compile requires auth ---
app.use("/api/latex/pdf", latexPublicRouter);
app.use("/api/latex", requireAuth, latexRouter);

// --- Admin (protected by ADMIN_SECRET env var) ---
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) { res.status(503).json({ error: "Admin not configured" }); return; }
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${secret}`) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

import fs from "fs";
import path from "path";

app.get("/admin/health", requireAdmin, (_req, res) => {
  const dbPath = path.resolve("data/resume_builder.db");
  const exists = fs.existsSync(dbPath);
  const size = exists ? fs.statSync(dbPath).size : 0;
  res.json({ db_exists: exists, db_size_bytes: size, db_path: dbPath });
});

app.get("/admin/users", requireAdmin, (_req, res) => {
  const rows = db().prepare("SELECT user_id, email, created_at FROM users ORDER BY created_at DESC").all();
  res.json({ users: rows, count: rows.length });
});

app.delete("/admin/users/:userId", requireAdmin, (req, res) => {
  const { userId } = req.params;
  db().prepare("DELETE FROM users WHERE user_id = ?").run(userId);
  res.json({ deleted: userId });
});

app.get("/admin/stats", requireAdmin, (_req, res) => {
  const database = db();
  const tables = ["users", "auth_tokens", "jd_schemas", "resume_modules", "bullets", "exemplars", "taxonomy"];
  const stats: Record<string, number> = {};
  for (const t of tables) {
    try {
      stats[t] = (database.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number }).c;
    } catch { stats[t] = -1; }
  }
  res.json({ table_counts: stats });
});

app.get("/admin/db/download", requireAdmin, (_req, res) => {
  const dbPath = path.resolve("data/resume_builder.db");
  if (!fs.existsSync(dbPath)) { res.status(404).json({ error: "DB file not found" }); return; }
  res.download(dbPath, "resume_builder.db");
});

// --- Canvas Editor (toggle via CANVAS_ENABLED=true) ---
if (process.env.CANVAS_ENABLED === "true") {
  import("./routes/canvas.js").then(({ canvasRouter }) => {
    app.use("/canvas", requireAuth, canvasRouter);
    app.use("/editor", express.static(path.resolve("editor-dist")));
    // SPA fallback: any /editor/* path returns index.html
    app.get("/editor/*splat", (_req, res) => {
      const indexPath = path.resolve("editor-dist/index.html");
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else res.status(503).json({ error: "Canvas editor not built" });
    });
    console.log("Canvas editor enabled at /editor");
  });
}

// --- Start ---
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Resume Builder API v3.0 listening on http://localhost:${port}`);
});
