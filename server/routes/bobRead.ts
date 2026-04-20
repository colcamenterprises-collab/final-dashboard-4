import express, { Request, Response } from "express";
import fetch from "node-fetch";
import { bobAuth } from "../middleware/bobAuth";

const router = express.Router();

/**
 * INTERNAL HELPER
 * Calls existing app endpoints
 */
async function proxyInternal(path: string, req: Request) {
  const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
  const [pathname, rawQuery = ""] = path.split("?");
  const query = new URLSearchParams(rawQuery);

  for (const [key, raw] of Object.entries(req.query || {})) {
    if (Array.isArray(raw)) {
      for (const value of raw) {
        query.append(key, String(value));
      }
    } else if (raw !== undefined && raw !== null) {
      query.append(key, String(raw));
    }
  }

  const queryString = query.toString();
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.BOB_READ_PROXY_TIMEOUT_MS || 20000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${baseUrl}${fullPath}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`GET ${fullPath} failed with ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * GENERIC PROXY
 * Example:
 * /api/bob/read/proxy?path=/api/daily-stock-sales
 */
router.get("/proxy", bobAuth, async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string;

    if (!path || !path.startsWith("/api/")) {
      return res.status(400).json({ error: "Invalid path" });
    }

    const data = await proxyInternal(path, req);
    res.json(data);
  } catch (err) {
    console.error("BOB PROXY ERROR:", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

/**
 * SHIFT REPORT (CRITICAL FIRST ENDPOINT)
 */
router.get("/shift-report/latest", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/shift-report/latest", req);
    res.json(data);
  } catch (err) {
    console.error("SHIFT REPORT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch shift report" });
  }
});

/**
 * DAILY SALES
 */
router.get("/daily-sales", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/daily-stock-sales", req);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily sales" });
  }
});

/**
 * DAILY STOCK
 */
router.get("/daily-stock", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/daily-stock-sales", req);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch daily stock" });
  }
});

/**
 * PURCHASE HISTORY
 */
router.get("/purchase-history", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal("/api/analysis/stock-review/purchase-history", req);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch purchase history" });
  }
});

/**
 * STOCK USAGE
 */
router.get("/stock-usage", bobAuth, async (req: Request, res: Response) => {
  try {
    const data = await proxyInternal(
      `/api/ai-ops/bob/proxy-read?path=analysis/stock-usage&token=${encodeURIComponent(process.env.BOB_READONLY_TOKEN || "")}`,
      req
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stock usage" });
  }
});

export default router;
