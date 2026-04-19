/**
 * bobCanonicalRead — Additive Bob canonical read endpoints.
 * Mounted at /api/ai-ops/bob (after existing aiOpsControl).
 *
 * Endpoints:
 *   GET /shift-window?date=YYYY-MM-DD          — shift window (no auth)
 *   GET /read/shift-canonical?date=YYYY-MM-DD  — full canonical snapshot (auth required)
 *   GET /read/proxy?path=<allowed>&...         — strict allowlist proxy (auth required)
 *
 * Auth: Bearer token via agentAuthMiddleware (agent_tokens table or BOB_READONLY_TOKEN fallback).
 * Read-only: GET only, no writes.
 */

import { Router, Request, Response } from "express";
import { agentAuthMiddleware, readOnlyGuard, envelope, isValidDate } from "../middleware/agentAuth";
import { buildCanonicalSnapshot, buildShiftWindow } from "../services/bobCanonicalReadService";
import { pool } from "../db";

const router = Router();
router.use(readOnlyGuard);

// ── Strict proxy allowlist ────────────────────────────────────────────────────
// Only real canonical read paths used in this app. No broad GET passthrough.

const PROXY_ALLOWLIST: string[] = [
  "/api/agent/read/shift-summary",
  "/api/agent/read/daily-operations",
  "/api/agent/read/receipt-summary",
  "/api/agent/read/purchasing-summary",
  "/api/agent/read/finance-summary",
  "/api/agent/read/reconciliation-summary",
  "/api/bob/read/forms/daily-sales",
  "/api/bob/read/forms/daily-stock",
  "/api/bob/read/shift-snapshot",
  "/api/bob/read/receipts/truth",
  "/api/bob/read/purchasing/items",
  "/api/bob/read/purchasing/tally",
  "/api/bob/read/purchasing/shopping-list",
  "/api/bob/read/operations/expenses",
  "/api/bob/read/analysis/finance",
  "/api/bob/read/system-health",
  "/api/latest-valid-shift",
  "/api/analysis/build-status",
];

// Paths that must never be proxied regardless of allowlist
const PROXY_BLOCKLIST_PATTERNS: RegExp[] = [
  /\/auth/i,
  /\/admin/i,
  /\/payment/i,
  /\/session/i,
  /\/user/i,
  /\/pin/i,
  /\/staff/i,
  /\/upload/i,
  /\/write/i,
  /\/delete/i,
  /\/update/i,
  /\/create/i,
  /\/push/i,
  /\/sync.*write/i,
];

function isProxyAllowed(rawPath: string): boolean {
  const path = rawPath.split("?")[0];
  if (PROXY_BLOCKLIST_PATTERNS.some((re) => re.test(path))) return false;
  return PROXY_ALLOWLIST.some((allowed) => path === allowed || path.startsWith(allowed));
}

// ── GET /shift-window?date=YYYY-MM-DD (no auth) ──────────────────────────────

router.get("/shift-window", (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  if (!date) {
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ ok: false, error: "date must be YYYY-MM-DD" });
  }
  try {
    const win = buildShiftWindow(date);
    console.log(`[bobCanonical] shift-window ${date}`);
    return res.json({ ok: true, shiftDate: date, shiftWindow: win });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /read/shift-canonical?date=YYYY-MM-DD (auth required) ────────────────

router.get("/read/shift-canonical", agentAuthMiddleware, async (req: Request, res: Response) => {
  const date = req.query.date as string | undefined;
  if (!date) {
    return res.status(400).json({ ok: false, error: "date query param required (YYYY-MM-DD)", shiftDate: null, missingSources: [] });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ ok: false, error: "date must be YYYY-MM-DD", shiftDate: date, missingSources: [] });
  }
  try {
    const snapshot = await buildCanonicalSnapshot(date);
    console.log(`[bobCanonical] shift-canonical ${date} → status=${snapshot.status} missing=${snapshot.missingSources.join(",") || "none"}`);
    const httpStatus = snapshot.status === "BLOCKED_BY_APP_ACCESS" ? 503 : 200;
    return res.status(httpStatus).json(snapshot);
  } catch (err: any) {
    console.error(`[bobCanonical] shift-canonical error:`, err.message);
    return res.status(500).json({
      ok: false,
      status: "BLOCKED_BY_APP_ACCESS",
      reason: "Canonical app read surfaces unavailable",
      shiftDate: date,
      missingSources: ["internal_error"],
    });
  }
});

// ── GET /read/proxy?path=<allowed-path>&... (auth required) ──────────────────

router.get("/read/proxy", agentAuthMiddleware, async (req: Request, res: Response) => {
  const rawPath = (req.query.path as string | undefined)?.trim();
  if (!rawPath) {
    console.warn(`[bobCanonical] proxy denied — no path`);
    return res.status(400).json(
      envelope({ source: "bob:canonical-proxy", scope: "proxy", status: "error", data: {},
        blockers: [{ code: "PATH_REQUIRED", message: "path query param required", where: "query.path", canonical_source: "PROXY_ALLOWLIST" }] }),
    );
  }

  if (!isProxyAllowed(rawPath)) {
    console.warn(`[bobCanonical] proxy denied — forbidden path: ${rawPath}`);
    return res.status(403).json(
      envelope({ source: "bob:canonical-proxy", scope: "proxy", status: "error", data: { denied_path: rawPath },
        blockers: [{ code: "PROXY_PATH_DENIED", message: `Path not in allowlist: ${rawPath}`, where: "query.path", canonical_source: "PROXY_ALLOWLIST" }] }),
    );
  }

  // Build the internal URL, forwarding remaining query params except 'path'
  const { path: _path, token: _token, ...fwdParams } = req.query as Record<string, string>;
  const qs = new URLSearchParams(fwdParams).toString();
  const internalUrl = `http://localhost:${process.env.PORT || 5000}${rawPath}${qs ? "?" + qs : ""}`;

  try {
    const authHeader = req.headers.authorization || "";
    const upstream = await fetch(internalUrl, { headers: { authorization: authHeader } });
    const body = await upstream.json().catch(() => null);
    console.log(`[bobCanonical] proxy ${rawPath} → ${upstream.status}`);
    return res.status(upstream.status).json(body);
  } catch (err: any) {
    console.error(`[bobCanonical] proxy error for ${rawPath}:`, err.message);
    return res.status(502).json(
      envelope({ source: "bob:canonical-proxy", scope: "proxy", status: "error", data: {},
        blockers: [{ code: "PROXY_UPSTREAM_ERROR", message: `Upstream error: ${err.message}`, where: rawPath, canonical_source: "internal_fetch" }] }),
    );
  }
});

export default router;
