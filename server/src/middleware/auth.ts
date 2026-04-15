import type { Request, Response, NextFunction } from "express";
import { getAuthToken } from "../db/client.js";

export interface AuthRequest<P = Record<string, string>> extends Request<P> {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", detail: "Missing Bearer token" });
    return;
  }
  const token = authHeader.slice(7);
  const tokenRow = getAuthToken(token);
  if (!tokenRow || tokenRow.token_type !== "access") {
    res.status(401).json({ error: "Unauthorized", detail: "Invalid or expired token" });
    return;
  }
  req.userId = tokenRow.user_id;
  next();
}
