import { Router, Request, Response } from "express";
import { createHmac } from "crypto";

const router = Router();

const COOKIE_NAME = "sbb_ui_session";
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

function computeToken(password: string): string {
  return createHmac("sha256", password).update("sbb_ui_auth_v1").digest("hex");
}

function getExpectedToken(): string | null {
  const pwd = process.env.INTERNAL_APP_PASSWORD;
  if (!pwd) return null;
  return computeToken(pwd);
}

function getCookieValue(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    if (name !== COOKIE_NAME) continue;
    return decodeURIComponent(trimmed.slice(eqIdx + 1));
  }
  return null;
}

router.get("/check", (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "development") {
    return res.json({ authenticated: true, configured: true, devBypass: true });
  }
  const expected = getExpectedToken();
  if (!expected) {
    return res.json({ authenticated: false, configured: false });
  }
  const value = getCookieValue(req);
  res.json({ authenticated: value === expected, configured: true });
});

router.post("/login", (req: Request, res: Response) => {
  const expected = getExpectedToken();
  if (!expected) {
    return res.status(503).json({ error: "App password not configured. Set INTERNAL_APP_PASSWORD in environment secrets." });
  }
  const { password } = req.body as { password?: string };
  if (!password || computeToken(password) !== expected) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  res.cookie(COOKIE_NAME, expected, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ authenticated: true });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ authenticated: false });
});

export default router;
