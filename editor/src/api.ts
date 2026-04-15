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
