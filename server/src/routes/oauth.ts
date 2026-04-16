import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import {
  createUser, getUserByEmail,
  createAuthToken, getAuthToken, deleteAuthToken, deleteUserTokensByType,
} from "../db/client.js";

export const oauthRouter = Router();

const CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? "resume-builder-gpt";
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "change-me-in-production";

// Token TTLs
const ACCESS_TOKEN_SECONDS = 7 * 86400;     // 7 days
const REFRESH_TOKEN_SECONDS = 30 * 86400;   // 30 days
const AUTH_CODE_SECONDS = 300;              // 5 minutes

function isoExpiry(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace("T", " ").slice(0, 19);
}

// ─── Login page HTML ───────────────────────────────────────────────────────────
function loginPage(params: { state: string; redirect_uri: string; client_id: string; error?: string }): string {
  const { state, redirect_uri, client_id, error } = params;
  const errorHtml = error
    ? `<div class="error">${error}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Good Old Resume — Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      padding: 40px 36px;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 6px; color: #111; }
    p.subtitle { font-size: 14px; color: #666; margin-bottom: 28px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #333; margin-bottom: 6px; }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      transition: border .15s;
      margin-bottom: 18px;
    }
    input:focus { border-color: #000; }
    .btn {
      width: 100%;
      padding: 11px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 10px;
    }
    .btn-primary { background: #111; color: #fff; }
    .btn-primary:hover { background: #333; }
    .btn-secondary { background: #f0f0f0; color: #111; }
    .btn-secondary:hover { background: #e0e0e0; }
    .divider { text-align: center; color: #aaa; font-size: 13px; margin: 6px 0 14px; }
    .error {
      background: #fff0f0;
      color: #c00;
      border: 1px solid #fcc;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 18px;
    }
    .footer { font-size: 12px; color: #aaa; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Good Old Resume</h1>
    <p class="subtitle">Sign in to access your personal resume data.</p>
    ${errorHtml}
    <form method="POST" action="/oauth/login">
      <input type="hidden" name="state" value="${encodeURIComponent(state)}"/>
      <input type="hidden" name="redirect_uri" value="${encodeURIComponent(redirect_uri)}"/>
      <input type="hidden" name="client_id" value="${encodeURIComponent(client_id)}"/>
      <label for="email">Email</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" required autocomplete="email"/>
      <label for="password">Password</label>
      <input id="password" type="password" name="password" placeholder="••••••••" required autocomplete="current-password"/>
      <button class="btn btn-primary" type="submit">Sign In</button>
    </form>
    <div class="divider">— or —</div>
    <form method="POST" action="/oauth/register">
      <input type="hidden" name="state" value="${encodeURIComponent(state)}"/>
      <input type="hidden" name="redirect_uri" value="${encodeURIComponent(redirect_uri)}"/>
      <input type="hidden" name="client_id" value="${encodeURIComponent(client_id)}"/>
      <input type="email" name="email" placeholder="Email" required autocomplete="email"/>
      <input type="password" name="password" placeholder="Create password (min 8 chars)" required autocomplete="new-password"/>
      <button class="btn btn-secondary" type="submit">Create Account</button>
    </form>
    <p class="footer">Your data is stored privately and never shared.</p>
  </div>
</body>
</html>`;
}

// ─── GET /oauth/authorize ──────────────────────────────────────────────────────
oauthRouter.get("/authorize", (req, res) => {
  const { state = "", redirect_uri = "", client_id = "" } = req.query as Record<string, string>;
  if (client_id !== CLIENT_ID) {
    res.status(400).send("Invalid client_id");
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.send(loginPage({ state, redirect_uri, client_id }));
});

// ─── POST /oauth/login ─────────────────────────────────────────────────────────
oauthRouter.post("/login", async (req, res) => {
  const { email, password, state, redirect_uri, client_id } = req.body as Record<string, string>;
  const decodedState = decodeURIComponent(state ?? "");
  const decodedRedirect = decodeURIComponent(redirect_uri ?? "");

  const user = getUserByEmail(email ?? "");
  if (!user || !(await bcrypt.compare(password ?? "", user.password_hash))) {
    res.setHeader("Content-Type", "text/html");
    res.send(loginPage({
      state: decodedState,
      redirect_uri: decodedRedirect,
      client_id: decodeURIComponent(client_id ?? ""),
      error: "Invalid email or password.",
    }));
    return;
  }

  const code = randomUUID();
  createAuthToken(code, user.user_id, "code", isoExpiry(AUTH_CODE_SECONDS), decodedRedirect);
  const callbackUrl = new URL(decodedRedirect);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", decodedState);
  res.redirect(callbackUrl.toString());
});

// ─── POST /oauth/register ──────────────────────────────────────────────────────
oauthRouter.post("/register", async (req, res) => {
  const { email, password, state, redirect_uri, client_id } = req.body as Record<string, string>;
  const decodedState = decodeURIComponent(state ?? "");
  const decodedRedirect = decodeURIComponent(redirect_uri ?? "");
  const decodedClientId = decodeURIComponent(client_id ?? "");

  if (!email || !password || password.length < 8) {
    res.setHeader("Content-Type", "text/html");
    res.send(loginPage({
      state: decodedState, redirect_uri: decodedRedirect, client_id: decodedClientId,
      error: "Password must be at least 8 characters.",
    }));
    return;
  }

  const existing = getUserByEmail(email);
  if (existing) {
    res.setHeader("Content-Type", "text/html");
    res.send(loginPage({
      state: decodedState, redirect_uri: decodedRedirect, client_id: decodedClientId,
      error: "An account with this email already exists. Please sign in.",
    }));
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  createUser(userId, email, passwordHash);

  const code = randomUUID();
  createAuthToken(code, userId, "code", isoExpiry(AUTH_CODE_SECONDS), decodedRedirect);
  const callbackUrl = new URL(decodedRedirect);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", decodedState);
  res.redirect(callbackUrl.toString());
});

// ─── POST /oauth/token ─────────────────────────────────────────────────────────
oauthRouter.post("/token", async (req, res) => {
  const { grant_type, code = "", refresh_token = "", client_id = "", client_secret = "" } = req.body as Record<string, string>;

  if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  // Authorization code exchange
  if (grant_type === "authorization_code") {
    const tokenRow = getAuthToken(code ?? "");
    if (!tokenRow || tokenRow.token_type !== "code") {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }
    deleteAuthToken(code);

    const accessToken = randomUUID();
    const newRefreshToken = randomUUID();
    createAuthToken(accessToken, tokenRow.user_id, "access", isoExpiry(ACCESS_TOKEN_SECONDS));
    deleteUserTokensByType(tokenRow.user_id, "refresh");
    createAuthToken(newRefreshToken, tokenRow.user_id, "refresh", isoExpiry(REFRESH_TOKEN_SECONDS));

    res.json({
      access_token: accessToken,
      token_type: "bearer",
      refresh_token: newRefreshToken,
      expires_in: ACCESS_TOKEN_SECONDS,
    });
    return;
  }

  // Refresh token exchange
  if (grant_type === "refresh_token") {
    const tokenRow = getAuthToken(refresh_token ?? "");
    if (!tokenRow || tokenRow.token_type !== "refresh") {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    const accessToken = randomUUID();
    createAuthToken(accessToken, tokenRow.user_id, "access", isoExpiry(ACCESS_TOKEN_SECONDS));

    res.json({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
    });
    return;
  }

  res.status(400).json({ error: "unsupported_grant_type" });
});
