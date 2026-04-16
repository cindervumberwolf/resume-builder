# Good Old Resume

> AI-powered resume builder for students and new graduates — modular storage, JD matching, and one-click LaTeX PDF compilation.

---

## What It Does

**Good Old Resume** is a ChatGPT Custom GPT backed by a self-hosted REST API. You describe your experiences once; the system stores them as structured modules. When you paste a job description, the GPT retrieves the most relevant modules, assembles a tailored resume, and compiles it into a polished PDF — all without leaving the chat window.

| Capability | How |
|------------|-----|
| Modular experience storage | Each role, project, and activity is stored as an independent module with tagged bullet points |
| JD-based intelligent matching | Scoring model ranks stored modules by tag overlap with the target JD's requirements |
| Server-side LaTeX compilation | XeLaTeX runs inside a Docker container on Railway; no local TeX installation needed |
| Bilingual templates | Separate English and Chinese (xeCJK + Fandol) templates, selected automatically |
| Multi-user isolation | Self-hosted OAuth 2.0 — every user's data is fully isolated |
| Web editor | Browser-based LaTeX editor (CodeMirror) + real-time PDF preview at `/editor` |
| Experience library | Full CRUD UI for managing stored modules at `/editor?view=modules` |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  ChatGPT (Custom GPT)                                            │
│  Instructions + Knowledge files + 11 GPT Actions (OpenAPI 3.1)  │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS REST
┌────────────────────────▼─────────────────────────────────────────┐
│  Express API  ·  Node 22 + TypeScript  ·  Railway                │
│                                                                   │
│  /oauth/*        Self-hosted OAuth 2.0 (login / register)         │
│  /api/modules    Module & bullet CRUD                             │
│  /api/jd         JD storage + structured extraction               │
│  /api/match      Scoring-based module retrieval                   │
│  /api/latex      XeLaTeX compile → in-memory PDF cache            │
│  /canvas/*       LaTeX draft storage (CANVAS_ENABLED)             │
│  /editor         React + Vite SPA (CANVAS_ENABLED)                │
│  /admin/*        Admin tools (ADMIN_SECRET protected)             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│  SQLite  ·  Railway Volume  ·  /app/data/resume_builder.db       │
│  users · auth_tokens · resume_modules · bullets                   │
│  jd_schemas · exemplars · taxonomy_signals · canvas_drafts        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
├── server/               Node.js + TypeScript backend
│   └── src/
│       ├── api.ts        Express app entry point
│       ├── templates.ts  English & Chinese LaTeX templates
│       ├── db/           SQLite schema, client, init, seed
│       ├── routes/       oauth · latex · canvas
│       ├── middleware/   Bearer token auth
│       └── types/        Zod schemas + TypeScript interfaces
│
├── editor/               React + Vite frontend (built by Docker)
│   └── src/
│       ├── App.tsx       LaTeX editor main view
│       ├── api.ts        Frontend API client
│       └── components/   ModuleLibrary · LaTeXEditor · PDFPreview
│
├── gpt/                  GPT configuration (upload to ChatGPT)
│   ├── instructions.md   Custom GPT system prompt
│   ├── openapi.yaml      Actions schema (11 operations)
│   └── knowledge/        Style guide + LaTeX template reference
│
├── data/                 Seed data (taxonomy signals, sample exemplars)
├── docs/                 Architecture notes, retrospective, setup guide
│   └── archive/          Previous drafts and research specs
│
├── resume_eval_benchmark_v1/   Evaluation benchmark (6 profiles, 12 JDs, 24 tasks)
│
├── Dockerfile            Three-stage build (server + editor + runtime with TeX)
├── railway.json          Railway deployment config
└── product_guide.md      Full product documentation (→ start here)
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker (for local full-stack testing with LaTeX)
- A Railway account (for deployment)

### Local Development (API only, no LaTeX)

```bash
# Install server dependencies
npm install

# Compile TypeScript
npx tsc

# Initialize database and seed data
node dist/server/src/db/init.js
node dist/server/src/db/seed.js

# Start the API
node dist/server/src/api.js
# → http://localhost:8787
```

### Local Frontend Development

```bash
cd editor
npm install
npm run dev
# → http://localhost:5173 (proxies API to :8787)
```

### Deploy to Railway

1. Fork this repository.
2. Create a new Railway project and connect the repo.
3. Add a **Volume** mounted at `/app/data`.
4. Set environment variables (see table below).
5. Railway will build and deploy using the `Dockerfile`.

### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OAUTH_CLIENT_ID` | Yes | Must match the value in your ChatGPT GPT Actions config |
| `OAUTH_CLIENT_SECRET` | Yes | Must match the value in your ChatGPT GPT Actions config |
| `ADMIN_SECRET` | Recommended | Bearer token for `/admin/*` endpoints |
| `CANVAS_ENABLED` | Optional | Set `true` to enable the web editor at `/editor` |
| `PUBLIC_BASE_URL` | Optional | Override the base URL used in PDF download links |
| `PORT` | Optional | Default: `8787` |

### Setting Up the Custom GPT

1. Go to [chat.openai.com](https://chat.openai.com) → Explore GPTs → Create.
2. Paste the contents of `gpt/instructions.md` into **Instructions**.
3. Upload `gpt/knowledge/resume_style_guide_v2.md` as a **Knowledge** file.
4. Under **Actions**, import `gpt/openapi.yaml`.
5. Configure OAuth with your Railway deployment URL:
   - Authorization URL: `https://<your-host>/oauth/authorize`
   - Token URL: `https://<your-host>/oauth/token`
   - Privacy Policy URL: `https://<your-host>/privacy`

---

## Key Design Decisions

**Why ChatGPT Custom GPT instead of a standalone app?**  
GPT handles the language reasoning (parsing JDs, rewriting bullets, detecting intent) far better than any rule-based NLP pipeline. The backend focuses on structured storage, matching, and compilation — things where deterministic code is more reliable than a language model.

**Why self-hosted LaTeX instead of a third-party PDF API?**  
XeLaTeX produces publication-quality typography and has full CJK support. No external API has equivalent control over layout. Compiling server-side removes the need for any local tooling.

**Why SQLite instead of a hosted database?**  
At this scale, SQLite with Railway Volumes is simpler, faster for single-server deployments, and eliminates a network round-trip on every query. The WAL journal mode handles concurrent reads without locking.

**Why self-hosted OAuth instead of Auth0 / Clerk?**  
ChatGPT's Custom GPT Actions require a specific OAuth 2.0 authorization code flow with a custom callback URL. Third-party providers add complexity without saving meaningful work at this scale.

---

## Evaluation Benchmark

`resume_eval_benchmark_v1/` contains a synthetic but realistic evaluation set:

- **6 candidate profiles** across different academic backgrounds
- **12 job descriptions** spanning consulting, product, data, finance, and ML
- **24 evaluation tasks** (profile × JD pairings)
- **5-arm blind scoring design** comparing: baseline / vanilla GPT / full system / ablations

See [`resume_eval_benchmark_v1/README.md`](resume_eval_benchmark_v1/README.md) for the full methodology.

---

## Documentation

- **[`product_guide.md`](product_guide.md)** — Complete product documentation: architecture, full user flows, all API endpoints, deployment guide, and known limitations
- **[`docs/dev_retrospective_v1.md`](docs/dev_retrospective_v1.md)** — Development retrospective
- **[`docs/architecture_notes.md`](docs/architecture_notes.md)** — Original architecture planning notes

---

## License

This project is for educational and competition purposes.
