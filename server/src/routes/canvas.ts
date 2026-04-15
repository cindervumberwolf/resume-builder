import { Router } from "express";
import { randomUUID } from "node:crypto";
import { upsertDraft, getDraft, listDrafts, deleteDraft } from "../db/client.js";
import type { AuthRequest } from "../middleware/auth.js";

export const canvasRouter = Router();

// List all drafts for the authenticated user
canvasRouter.get("/drafts", (req: AuthRequest, res) => {
  const drafts = listDrafts(req.userId!).map(d => ({
    draft_id: d.draft_id,
    title: d.title,
    updated_at: d.updated_at,
    created_at: d.created_at,
  }));
  res.json({ drafts });
});

// Get a single draft
canvasRouter.get("/draft/:draftId", (req: AuthRequest<{ draftId: string }>, res) => {
  const draft = getDraft(req.params.draftId, req.userId!);
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
  res.json(draft);
});

// Create or update a draft
canvasRouter.post("/draft", (req: AuthRequest, res) => {
  const { draft_id, title, latex_source } = req.body;
  if (!latex_source || typeof latex_source !== "string") {
    res.status(400).json({ error: "latex_source is required" }); return;
  }
  const id = draft_id ?? randomUUID();
  const saved = upsertDraft({
    draft_id: id,
    user_id: req.userId!,
    title: title ?? "Untitled",
    latex_source,
  });
  res.json(saved);
});

// Delete a draft
canvasRouter.delete("/draft/:draftId", (req: AuthRequest<{ draftId: string }>, res) => {
  deleteDraft(req.params.draftId, req.userId!);
  res.json({ deleted: req.params.draftId });
});
