import type { CSSProperties } from "react";

interface Props {
  pdfUrl: string | null;
  compiling: boolean;
  error: string | null;
}

export function PDFPreview({ pdfUrl, compiling, error }: Props) {
  if (compiling) {
    return (
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <p style={{ marginTop: 16, color: "#666" }}>Compiling with XeLaTeX…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...centerStyle, alignItems: "flex-start", padding: 24 }}>
        <p style={{ color: "#c0392b", fontWeight: 600, marginBottom: 8 }}>Compilation error</p>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "#666", maxWidth: "100%" }}>{error}</pre>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div style={centerStyle}>
        <p style={{ color: "#999", fontSize: 14 }}>Press <strong>Compile</strong> to preview the PDF</p>
      </div>
    );
  }

  return (
    <iframe
      src={pdfUrl}
      style={{ width: "100%", height: "100%", border: "none" }}
      title="PDF Preview"
    />
  );
}

const centerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  background: "#fafafa",
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  border: "3px solid #e0e0e0",
  borderTop: "3px solid #333",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};
