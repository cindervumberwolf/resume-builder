import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { LaTeXEditor } from "./components/LaTeXEditor";
import { PDFPreview } from "./components/PDFPreview";
import { ModuleLibrary } from "./components/ModuleLibrary";
import { fetchTemplate, saveDraft, loadDraft, compileLaTeX, storeToken, listDrafts } from "./api";

// ── shared palette (mirrors ModuleLibrary) ──────────────────────────────────
const C = {
  bg: "#FFFFFF",
  toolbar: "#F3F3F3",
  border: "#ACA899",
  text: "#000000",
  muted: "#909090",
  keyword: "#091D26",
  comment: "#094044",
  actionBg: "#F4F3EE",
  actionHover: "#E2E0D8",
  actionBorder: "#ACA899",
};
const FONT = '"Times New Roman", "FandolSong", "SimSun", "Songti SC", serif';

type Status = "idle" | "saving" | "saved" | "error";

function getInitialView(): "editor" | "modules" {
  return new URLSearchParams(window.location.search).get("view") === "modules"
    ? "modules"
    : "editor";
}

export default function App() {
  // ── All hooks declared unconditionally ────────────────────────────────────
  const [view, setView] = useState<"editor" | "modules">(getInitialView);
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

  const handleSave = useCallback(async () => {
    setStatus("saving");
    try {
      const saved = await saveDraft(draftId, title, latex);
      setDraftId(saved.draft_id);
      setStatus("saved");
    } catch { setStatus("error"); }
  }, [draftId, title, latex]);

  useEffect(() => {
    if (!latex) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(handleSave, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [latex, handleSave]);

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

  // ── Conditional render (after all hooks) ──────────────────────────────────
  if (view === "modules") {
    return <ModuleLibrary onBack={() => setView("editor")} />;
  }

  const statusText =
    status === "saving" ? "保存中…" :
    status === "saved"  ? "已保存" :
    status === "error"  ? "保存失败" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#2b2b2b" }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.keyword, fontFamily: FONT, marginRight: 8 }}>
          LaTeX 编辑器
        </span>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={titleInputStyle}
          placeholder="草稿标题"
        />

        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          <Btn onClick={() => handleLoadTemplate("zh")}>模板（中文）</Btn>
          <Btn onClick={() => handleLoadTemplate("en")}>Template (EN)</Btn>
          <Btn onClick={handleOpenDrafts}>我的草稿</Btn>
          <Btn onClick={() => setView("modules")}>返回资产库</Btn>
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: C.muted, marginRight: 8, fontFamily: FONT }}>{statusText}</span>
        <Btn onClick={handleSave}>保存</Btn>
        <Btn
          style={{ background: C.keyword, color: "#fff", fontWeight: 700, borderColor: C.keyword }}
          onClick={handleCompile}
          disabled={compiling}
        >
          {compiling ? "编译中…" : "编译 →"}
        </Btn>
        {pdfUrl && (
          <a href={pdfUrl} download="resume.pdf" style={{ ...btnBase, textDecoration: "none" }}>
            ↓ 下载 PDF
          </a>
        )}
      </div>

      {/* Editor + Preview */}
      <div style={{ display: "flex", flex: 1, gap: 8, padding: "8px 12px 12px", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <LaTeXEditor value={latex} onChange={setLatex} />
        </div>
        <div style={{ flex: 1, background: "#fff", borderRadius: 4, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <PDFPreview pdfUrl={pdfUrl} compiling={compiling} error={compileError} />
        </div>
      </div>

      {/* Draft picker modal */}
      {showDrafts && (
        <div style={modalOverlayStyle} onClick={() => setShowDrafts(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontFamily: FONT, fontWeight: 700, color: C.keyword }}>我的草稿</h3>
            {drafts.length === 0 && (
              <p style={{ color: C.muted, fontFamily: FONT, fontSize: 13 }}>暂无保存的草稿。</p>
            )}
            {drafts.map((d) => (
              <div key={d.draft_id} style={draftRowStyle} onClick={() => handlePickDraft(d.draft_id)}>
                <span style={{ fontWeight: 500, fontFamily: FONT }}>{d.title}</span>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>
                  {new Date(d.updated_at).toLocaleString()}
                </span>
              </div>
            ))}
            <Btn style={{ marginTop: 16 }} onClick={() => setShowDrafts(false)}>关闭</Btn>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Shared button component ───────────────────────────────────────────────────
function Btn({ children, onClick, style, disabled }: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...btnBase,
        background: hov && !disabled ? C.actionHover : C.actionBg,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  background: C.toolbar,
  borderBottom: `1px solid ${C.border}`,
  flexShrink: 0,
  fontFamily: FONT,
};

const btnBase: CSSProperties = {
  padding: "4px 12px",
  border: `1px solid ${C.actionBorder}`,
  borderRadius: 4,
  background: C.actionBg,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: FONT,
  color: C.text,
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  transition: "background 0.15s",
};

const titleInputStyle: CSSProperties = {
  padding: "4px 10px",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 13,
  fontFamily: FONT,
  width: 180,
  background: "#fff",
  color: C.text,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const modalStyle: CSSProperties = {
  background: "#fff", borderRadius: 8, padding: 24, minWidth: 420, maxHeight: "70vh",
  overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  border: `1px solid ${C.border}`,
};

const draftRowStyle: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 12px", borderRadius: 6, cursor: "pointer", marginBottom: 4,
  border: `1px solid ${C.border}`,
};
