const getToken = () =>
  sessionStorage.getItem("canvas_token") ??
  new URLSearchParams(window.location.search).get("token") ?? "";

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export function storeToken(token: string) {
  sessionStorage.setItem("canvas_token", token);
}

export async function fetchTemplate(lang: "en" | "zh"): Promise<string> {
  const url = lang === "zh" ? "/api/template/latex/zh" : "/api/template/latex";
  const res = await fetch(url);
  const data = await res.json();
  return data.template as string;
}

export async function saveDraft(draftId: string | null, title: string, latexSource: string) {
  const res = await fetch("/canvas/draft", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ draft_id: draftId, title, latex_source: latexSource }),
  });
  if (!res.ok) throw new Error("Failed to save draft");
  return res.json();
}

export async function loadDraft(draftId: string) {
  const res = await fetch(`/canvas/draft/${draftId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Draft not found");
  return res.json();
}

export async function listDrafts() {
  const res = await fetch("/canvas/drafts", { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.drafts as { draft_id: string; title: string; updated_at: string }[];
}

// ---- Module library ----

export interface ModuleBullet {
  bullet_id: string;
  parent_module_id: string;
  raw_fact: string;
  evidence_tags: string[];
  skill_tags: string[];
  role_fit_tags: string[];
  rewrite_candidates: string[];
}

export interface ResumeModule {
  module_id: string;
  type: string;
  section: string;
  organization: string;
  title: string;
  date_range: string;
  location?: string;
  context_tags: string[];
  base_priority: number;
  source_type: string;
  bullets: ModuleBullet[];
}

export async function fetchModules(): Promise<ResumeModule[]> {
  const res = await fetch("/api/modules", { headers: authHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.modules as ResumeModule[];
}

export async function patchModuleApi(
  moduleId: string,
  fields: Partial<Pick<ResumeModule, "organization" | "title" | "date_range" | "location" | "section" | "type" | "context_tags" | "base_priority">>,
): Promise<ResumeModule> {
  const res = await fetch(`/api/modules/${moduleId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Failed to update module");
  return res.json();
}

export async function deleteModuleApi(moduleId: string): Promise<void> {
  const res = await fetch(`/api/modules/${moduleId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete module");
}

export async function patchBulletApi(
  moduleId: string,
  bulletId: string,
  fields: Partial<Pick<ModuleBullet, "raw_fact" | "evidence_tags" | "skill_tags" | "role_fit_tags" | "rewrite_candidates">>,
): Promise<ModuleBullet> {
  const res = await fetch(`/api/modules/${moduleId}/bullets/${bulletId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Failed to update bullet");
  return res.json();
}

export async function deleteBulletApi(moduleId: string, bulletId: string): Promise<void> {
  const res = await fetch(`/api/modules/${moduleId}/bullets/${bulletId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete bullet");
}

export async function reorderBulletsApi(moduleId: string, bulletIds: string[]): Promise<void> {
  const res = await fetch(`/api/modules/${moduleId}/bullets/reorder`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ bullet_ids: bulletIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder bullets");
}

const SECTION_TYPE_MAP: Record<string, string> = {
  education: "education", experience: "experience", projects: "project",
  leadership: "leadership", awards: "award", skills: "certification",
};

export async function addModuleApi(section: string): Promise<ResumeModule> {
  const moduleId = crypto.randomUUID();
  const body = {
    modules: [{
      module_id: moduleId,
      type: SECTION_TYPE_MAP[section] ?? "experience",
      section,
      organization: "",
      title: "",
      date_range: "",
      context_tags: [],
      base_priority: 0.5,
      source_type: "manual_input",
    }],
    bullets: [],
  };
  const res = await fetch("/api/modules", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to add module");
  const modRes = await fetch(`/api/modules/${moduleId}`, { headers: authHeaders() });
  if (!modRes.ok) throw new Error("Failed to fetch new module");
  return modRes.json();
}

export async function addBulletApi(moduleId: string): Promise<ModuleBullet> {
  const bulletId = crypto.randomUUID();
  const body = {
    modules: [],
    bullets: [{
      bullet_id: bulletId,
      parent_module_id: moduleId,
      raw_fact: "",
      normalized_fact: { action: "", object: "" },
      evidence_tags: [],
      skill_tags: [],
      role_fit_tags: [],
      strength_score: { clarity: 0, quantification: 0, brand_signal: 0, transferability: 0 },
      rewrite_candidates: [],
    }],
  };
  const res = await fetch("/api/modules", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Failed to add bullet");
  return {
    bullet_id: bulletId, parent_module_id: moduleId, raw_fact: "",
    evidence_tags: [], skill_tags: [], role_fit_tags: [], rewrite_candidates: [],
  };
}

// ---- LaTeX compilation ----

export async function compileLaTeX(latexSource: string): Promise<{ pdf_url: string; size_bytes: number }> {
  const res = await fetch("/api/latex/compile", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ latex_source: latexSource }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.detail ?? "Compilation failed");
  return data;
}
