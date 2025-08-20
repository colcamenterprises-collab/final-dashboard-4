import type { Request, Response } from "express";
import { loadCatalogFromCSV } from "../lib/stockCatalog";

export async function getStockCatalog(req: Request, res: Response) {
  try {
    console.log("[stockCatalog] Loading CSV catalog...");
    const items = loadCatalogFromCSV();
    console.log("[stockCatalog] Loaded items:", items.length);
    // Sort server‑side for stability
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    console.log("[stockCatalog] First 3 items:", items.slice(0, 3));
    res.json({ ok: true, items });
  } catch (err) {
    console.error("[stockCatalog] error:", err);
    res.status(500).json({ ok: false, error: "Failed to load stock catalog" });
  }
}