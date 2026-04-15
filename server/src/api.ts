import express from "express";
import {
  db, upsertJd, getJd, listJds,
  upsertModule, upsertBullet, listModules, getModuleWithBullets,
  searchExemplars, findMatchingSignals,
} from "./db/client.js";
import { JdSchema, ExperienceModuleSchema, BulletModuleSchema } from "./types/index.js";
import { latexRouter } from "./routes/latex.js";
import { oauthRouter } from "./routes/oauth.js";
import { requireAuth, type AuthRequest } from "./middleware/auth.js";

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

// --- OAuth (public) ---
app.use("/oauth", oauthRouter);

// --- Template (public, read-only) ---
const LATEX_TEMPLATE = `\\documentclass[10pt,a4paper]{article}

% ---------- Packages ----------
\\usepackage[margin=0.62in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{setspace}
\\usepackage{verbatim}
\\usepackage{xeCJK}
\\setCJKmainfont{Noto Sans CJK SC}
\\setCJKsansfont{Noto Sans CJK SC}
\\setCJKmonofont{Noto Sans CJK SC}

\\pagenumbering{gobble}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\setstretch{1.2}

% ---------- Section formatting ----------
\\titleformat{\\section}{\\large}{}{0pt}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{6pt}{4pt}

% ---------- List formatting ----------
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=0pt, partopsep=0pt}

% ---------- Custom commands ----------
\\newcommand{\\subheading}[4]{
    \\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r}
        \\textbf{#1} | \\textit{#3} #2 & \\textit{#4} \\\\
    \\end{tabular*}
}

\\begin{document}

\t% ---------- Header ----------
\t\\begin{center}
\t    {\\huge [Your Name]}\\\\
\t    \\vspace{0.26em}
\t    \\href{mailto:[your\\_email@example.com]}{[your\\_email@example.com]}
\t    \\hspace{6pt}|\\hspace{6pt}
\t    [Your Phone Number]
\t    \\hspace{6pt}|\\hspace{6pt}
\t    \\href{[Your Link]}{[Your Link]}
\t\\end{center}

\t% ---------- Education ----------
\t\\section*{Education}
\t\\textbf{[University Name]}
\t\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
\t\t[Major] \\;|\\; \\textit{GPA: XX/4.00} & \\textit{Expected Graduation: Month Year} \\\\
\t\t\\multicolumn{2}{@{}l@{}}{\\textit{Relevant Coursework: Course 1, Course 2}}
\t\\end{tabular*}
\t\\vspace{0.2em}

\t% ---------- Professional Experience ----------
\t\\section*{Professional Experience}
\t\\subheading{[Company Name]}{[City, Country]}{[Role, Department]}{[Month Year -- Month Year]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %bullet
\t\t    \\item %bullet
\t\t\\end{itemize}
\t\\vspace{1em}

\t% ---------- Project Experience ----------
\t\\section*{Project Experience}
\t\\subheading{[Project Name]}{}{[Your Role]}{[Month Year -- Month Year]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %bullet
\t\t    \\item %bullet
\t\t\\end{itemize}
\t\\vspace{0.5em}

\t% ---------- Activities ----------
\t\\section*{Activities}
\t\\subheading{[Activity / Organization Name]}{}{[Your Role]}{[Month Year -- Month Year]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %bullet
\t\t\\end{itemize}
\t\\vspace{0.5em}

\t% ---------- Skills ----------
\t\\section*{Skills}
\t\\textbf{Research \\& Analysis:} [Skill 1], [Skill 2], [Skill 3]
\t\\vspace{0.2em}
\t\\textbf{Tools \\& Programming:} [Tool 1]; [Tool 2]; [Tool 3]
\t\\vspace{0.2em}
\t\\textbf{Languages:} [Language 1]; [Language 2]
\t\\vspace{0.5em}

\\end{document}`;

app.get("/api/template/latex", (_req, res) => {
  res.json({
    template: LATEX_TEMPLATE,
    instructions: "Fill all [placeholder] fields with actual content. Keep all LaTeX commands, packages, and structure unchanged.",
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
      for (const bullet of bullets) {
        const validated = BulletModuleSchema.parse(bullet);
        upsertBullet(validated, userId);
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

// --- Match ---
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

  const allModules = listModules(userId);
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

// --- LaTeX (auth required for compile; template is public above) ---
app.use("/api/latex", requireAuth, latexRouter);

// --- Start ---
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Resume Builder API v3.0 listening on http://localhost:${port}`);
});
