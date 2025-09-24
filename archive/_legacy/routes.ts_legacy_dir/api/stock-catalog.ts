import type { Request, Response } from "express";
import { loadCatalogFromCSV } from "../lib/stockCatalog";

export async function getStockCatalog(req: Request, res: Response) {
  try {
    console.log("[stock-catalog] Loading stock items from database...");
    const items = loadCatalogFromCSV();
    console.log("[stock-catalog] Found", items.length, "active items");
    // Sort server‑side for stability
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    console.log("[stock-catalog] First 3 items:", items.slice(0, 3));
    res.json({ ok: true, items });
  } catch (err) {
    console.error("[stock-catalog] error:", err);
    res.status(500).json({ ok: false, error: "Failed to load stock catalog" });
  }
}

// Add missing functions for compatibility
export async function importStockCatalog(req: Request, res: Response) {
  try {
    console.log("[stock-catalog] Import functionality not implemented yet");
    res.status(501).json({ ok: false, error: "Import functionality not implemented" });
  } catch (err) {
    console.error("[stock-catalog] import error:", err);
    res.status(500).json({ ok: false, error: "Failed to import stock catalog" });
  }
}

export const uploadMiddleware = (req: any, res: any, next: any) => {
  console.log("[stock-catalog] Upload middleware not implemented yet");
  next(new Error("Upload middleware not implemented"));
};