import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { LaTeXEditor } from "./components/LaTeXEditor";
import { PDFPreview } from "./components/PDFPreview";
import { ModuleLibrary } from "./components/ModuleLibrary";
import { fetchTemplate, saveDraft, loadDraft, compileLaTeX, storeToken, listDrafts } from "./api";

type Status = "idle" | "saving" | "saved" | "compiling" | "error";

function getInitialView(): "editor" | "modules" {
  return new URLSearchParams(window.location.search).get("view") === "modules" ? "modules" : "editor";
}

export default function App() {
  const [view, setView] = useState<"editor" | "modules">(getInitialView);

  if (view === "modules") {
    return <ModuleLibrary onBack={() => setView("editor")} />;
  }
  const [latex, setLatex] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [drafts, setDrafts] = useState<{ draft_id: string; title: string; updated_at: string }[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: read token + draft from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const draft = params.get("draft");
    if (token) storeToken(token);

    if (draft) {
      loadDraft(draft)
        .then((d) => { setLatex(d.latex_source); setDraftId(d.draft_id); setTitle(d.title); })
        .catch(() => {});
    }
  }, []);

  const handleLoadTemplate = async (lang: "en" | "zh") => {
    try {
      const tmpl = await fetchTemplate(lang);
      setLatex(tmpl);
      setPdfUrl(null);
      setCompileError(null);
    } catch { setStatus("error"); }
  };

  const handleCompile = async () => {
    setCompiling(true);
    setCompileError(null);
    setPdfUrl(null);
    try {
      const result = await compileLaTeX(latex);
      setPdfUrl(result.pdf_url);
    } catch (e: any) {
      setCompileError(e.message);
    } finally {
      setCompiling(false);
    }
  };

  const handleSave = useCallback(async () => {
    setStatus("saving");
    try {
      const saved = await saveDraft(draftId, title, latex);
      setDraftId(saved.draft_id);
      setStatus("saved");
    } catch { setStatus("error"); }
  }, [draftId, title, latex]);

  // Auto-save 2 seconds after last edit
  useEffect(() => {
    if (!latex) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(handleSave, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [latex]);

  const handleOpenDrafts = async () => {
    const list = await listDrafts();
    setDrafts(list);
    setShowDrafts(true);
  };

  const handlePickDraft = async (id: string) => {
    const d = await loadDraft(id);
    setLatex(d.latex_source);
    setDraftId(d.draft_id);
    setTitle(d.title);
    setPdfUrl(null);
    setCompileError(null);
    setShowDrafts(false);
  };

  const statusText = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save error" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f5f5f5" }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <span style={{ fontWeight: 600, fontSize: 15, marginRight: 16 }}>Resume Editor</span>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={titleInputStyle}
          placeholder="Draft title"
        />

        <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
          <button style={btnStyle} onClick={() => handleLoadTemplate("zh")}>模板 (中文)</button>
          <button style={btnStyle} onClick={() => handleLoadTemplate("en")}>Template (EN)</button>
          <button style={btnStyle} onClick={handleOpenDrafts}>My Drafts</button>
          <button style={btnStyle} onClick={() => setView("modules")}>Module Library</button>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: "#999", marginRight: 12 }}>{statusText}</span>
        <button style={btnStyle} onClick={handleSave}>Save</button>
        <button
          style={{ ...btnStyle, background: "#1a1a1a", color: "#fff", fontWeight: 600 }}
          onClick={handleCompile}
          disabled={compiling}
        >
          {compiling ? "Compiling…" : "Compile →"}
        </button>
        {pdfUrl && (
          <a href={pdfUrl} download="resume.pdf" style={{ ...btnStyle, textDecoration: "none" }}>
            ↓ Download PDF
          </a>
        )}
      </div>

      {/* Editor + Preview */}
      <div style={{ display: "flex", flex: 1, gap: 8, padding: "8px 12px 12px", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <LaTeXEditor value={latex} onChange={setLatex} />
        </div>
        <div style={{ flex: 1, background: "#fff", borderRadius: 4, border: "1px solid #e0e0e0", overflow: "hidden" }}>
          <PDFPreview pdfUrl={pdfUrl} compiling={compiling} error={compileError} />
        </div>
      </div>

      {/* Draft picker modal */}
      {showDrafts && (
        <div style={modalOverlayStyle} onClick={() => setShowDrafts(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>My Drafts</h3>
            {drafts.length === 0 && <p style={{ color: "#999" }}>No saved drafts yet.</p>}
            {drafts.map((d) => (
              <div key={d.draft_id} style={draftRowStyle} onClick={() => handlePickDraft(d.draft_id)}>
                <span style={{ fontWeight: 500 }}>{d.title}</span>
                <span style={{ fontSize: 12, color: "#999" }}>{new Date(d.updated_at).toLocaleString()}</span>
              </div>
            ))}
            <button style={{ ...btnStyle, marginTop: 16 }} onClick={() => setShowDrafts(false)}>Close</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  background: "#fff",
  borderBottom: "1px solid #e0e0e0",
  flexShrink: 0,
};

const btnStyle: CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #d0d0d0",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const titleInputStyle: CSSProperties = {
  padding: "5px 10px",
  border: "1px solid #d0d0d0",
  borderRadius: 6,
  fontSize: 13,
  width: 200,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const modalStyle: CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 24, minWidth: 420, maxHeight: "70vh",
  overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
};

const draftRowStyle: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 12px", borderRadius: 6, cursor: "pointer", marginBottom: 4,
  border: "1px solid #e0e0e0",
};
