import { Router } from "express";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const latexRouter = Router();
export const latexPublicRouter = Router();

const COMPILE_TIMEOUT_MS = 60_000;
const pdfStore = new Map<string, { data: Buffer; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pdfStore) {
    if (now - entry.createdAt > 30 * 60 * 1000) pdfStore.delete(id);
  }
}, 5 * 60 * 1000);

latexRouter.post("/compile", async (req, res) => {
  const { latex_source } = req.body;
  if (!latex_source || typeof latex_source !== "string") {
    res.status(400).json({ error: "Missing latex_source in request body" });
    return;
  }

  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "latex-"));
    const texFile = path.join(tmpDir, "resume.tex");
    await writeFile(texFile, latex_source, "utf-8");

    const pdflatexCmd = process.env.PDFLATEX_CMD ?? "xelatex";

    await new Promise<void>((resolve, reject) => {
      const proc =       execFile(
        pdflatexCmd,
        ["-interaction=nonstopmode", "-halt-on-error", "resume.tex"],
        { cwd: tmpDir!, timeout: COMPILE_TIMEOUT_MS },
        (error, _stdout, stderr) => {
          if (error) {
            const logPath = path.join(tmpDir!, "resume.log");
            readFile(logPath, "utf-8")
              .then(log => {
                const errorLines = log.split("\n").filter(l => l.startsWith("!") || l.includes("Error"));
                reject(new Error(errorLines.slice(0, 10).join("\n") || stderr || error.message));
              })
              .catch(() => reject(error));
            return;
          }
          resolve();
        },
      );
    });

    const pdfPath = path.join(tmpDir, "resume.pdf");
    const pdfData = await readFile(pdfPath);
    const pdfId = randomUUID();
    pdfStore.set(pdfId, { data: pdfData, createdAt: Date.now() });

    const proto = req.get("x-forwarded-proto") ?? req.protocol;
    const baseUrl = `${proto}://${req.get("host")}`;
    res.json({
      success: true,
      pdf_url: `${baseUrl}/api/latex/pdf/${pdfId}`,
      size_bytes: pdfData.length,
    });
  } catch (e: any) {
    res.status(422).json({
      success: false,
      error: "LaTeX compilation failed",
      detail: e.message,
    });
  } finally {
    if (tmpDir) {
      rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

function servePdf(req: import("express").Request, res: import("express").Response): void {
  const id = req.params.id;
  const entry = pdfStore.get(id);
  if (!entry) {
    res.status(404).json({ error: "PDF not found or expired" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
  res.send(entry.data);
}

// Mounted publicly at /api/latex/pdf/:id (no auth needed — UUID is the capability token)
latexPublicRouter.get("/:id", servePdf);

// Also reachable via the auth-gated router for backward compatibility
latexRouter.get("/pdf/:id", servePdf);
