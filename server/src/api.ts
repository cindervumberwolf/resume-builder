import express from "express";
import {
  db, upsertJd, getJd, listJds,
  upsertModule, upsertBullet, listModules, getModuleWithBullets,
  searchExemplars, findMatchingSignals,
} from "./db/client.js";
import { JdSchema, ExperienceModuleSchema, BulletModuleSchema } from "./types/index.js";
import { latexRouter } from "./routes/latex.js";

const app = express();
app.set("trust proxy", 1); // respect X-Forwarded-Proto from Railway's reverse proxy
app.use(express.json({ limit: "2mb" }));

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

db();

// --- Health ---
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "resume-builder-api", version: "2.0.0" });
});

// --- Modules ---
app.post("/api/modules", (req, res) => {
  try {
    const { modules, bullets } = req.body;
    let moduleCount = 0;
    let bulletCount = 0;

    if (modules && Array.isArray(modules)) {
      for (const mod of modules) {
        const validated = ExperienceModuleSchema.parse(mod);
        upsertModule(validated);
        moduleCount++;
      }
    }
    if (bullets && Array.isArray(bullets)) {
      for (const bullet of bullets) {
        const validated = BulletModuleSchema.parse(bullet);
        upsertBullet(validated);
        bulletCount++;
      }
    }

    res.json({ success: true, modules_stored: moduleCount, bullets_stored: bulletCount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/modules", (_req, res) => {
  const modules = listModules();
  res.json({ modules, count: modules.length });
});

app.get("/api/modules/:id", (req, res) => {
  const mod = getModuleWithBullets(req.params.id);
  if (!mod) { res.status(404).json({ error: "Module not found" }); return; }
  res.json(mod);
});

// --- JD ---
app.post("/api/jd", (req, res) => {
  try {
    const validated = JdSchema.parse(req.body);
    upsertJd(validated);
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

app.get("/api/jd", (_req, res) => {
  const jds = listJds();
  res.json({ jds, count: jds.length });
});

app.get("/api/jd/:id", (req, res) => {
  const jd = getJd(req.params.id);
  if (!jd) { res.status(404).json({ error: "JD not found" }); return; }
  res.json(jd);
});

// --- Match ---
app.post("/api/match", (req, res) => {
  const { job_id, domain_tags, required_signals, max_modules = 5, max_bullets_per_module = 3 } = req.body;

  let jdTags = new Set<string>();
  let evidenceSignals = new Set<string>();

  if (job_id) {
    const jd = getJd(job_id);
    if (jd) {
      [...jd.hard_requirements, ...jd.soft_requirements, ...jd.preferred_signals, ...jd.domain_tags]
        .forEach(t => jdTags.add(t.toLowerCase()));
      for (const et of jd.evidence_targets) {
        evidenceSignals.add(et.signal.toLowerCase());
        et.examples.forEach(e => evidenceSignals.add(e.toLowerCase()));
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

  const allModules = listModules();
  const scored = allModules.map(mod => {
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
      matched_tags: mod.context_tags.filter(t => jdTags.has(t.toLowerCase())),
      bullets: bulletScores.map(b => ({
        bullet_id: b.bullet_id,
        raw_fact: b.raw_fact,
        relevance_score: b.relevance_score,
        evidence_tags: b.evidence_tags,
      })),
    };
  }).sort((a, b) => b.score - a.score).slice(0, max_modules);

  res.json({ ranked_modules: scored });
});

// --- LaTeX ---
app.use("/api/latex", latexRouter);

// --- Start ---
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Resume Builder API listening on http://localhost:${port}`);
});
