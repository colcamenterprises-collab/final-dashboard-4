import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import type { Request, Response } from "express";

const mem = multer({ storage: multer.memoryStorage() });
export const importRouter = Router();

/**
 * Column mapping functions for different POS systems
 */
export function mapLoyverseColumns(mode: string, rows: any[]) {
  if (mode === "items") {
    return rows.map((r) => ({
      name: r["Item"] ?? r["Item name"] ?? "",
      sku: r["SKU"] ?? "",
      category: r["Category"] ?? "",
      price: r["Price"] ?? r["Gross sales"] ?? "",
      quantity: r["Quantity"] ?? r["Qty"] ?? "",
      paymentType: r["Payment type"] ?? r["Payment"] ?? "",
    }));
  }
  if (mode === "modifiers") {
    return rows.map((r) => ({
      modifier: r["Modifier"] ?? r["Modifier name"] ?? "",
      quantity: r["Quantity"] ?? r["Qty"] ?? 0,
      sales: r["Sales"] ?? r["Gross sales"] ?? 0,
    }));
  }
  // sales summary / default
  return rows.map((r) => ({ ...r }));
}

export function mapGrabColumns(mode: string, rows: any[]) {
  if (mode === "items") {
    return rows.map((r) => ({
      name: r["Item Name"] ?? r["Product Name"] ?? "",
      sku: r["SKU"] ?? r["Product ID"] ?? "",
      category: r["Category"] ?? "",
      price: r["Price"] ?? "",
      quantity: r["Quantity"] ?? r["Qty"] ?? "",
    }));
  }
  // For other modes, use Loyverse mapping as fallback
  return mapLoyverseColumns(mode, rows);
}

/**
 * POST /api/import/menu?source=grab|loyverse&mode=items|modifiers|sales
 * Body: multipart/form-data { file: CSV }
 * Returns parsed rows; does NOT persist until user confirms.
 */
importRouter.post("/menu", mem.single("file"), async (req: Request, res: Response) => {
  const { source = "loyverse", mode = "items" } = req.query as any;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const text = req.file.buffer.toString("utf8");
    const rows = parse(text, { columns: true, skip_empty_lines: true });

    // normalize columns to unified shape the UI understands
    let normalized: any[] = [];
    if (source === "grab") normalized = mapGrabColumns(mode as string, rows);
    else normalized = mapLoyverseColumns(mode as string, rows);

    return res.json({ 
      rows: normalized, 
      count: normalized.length, 
      source, 
      mode,
      headers: Object.keys(rows[0] || {})
    });
  } catch (error) {
    console.error("CSV parsing error:", error);
    return res.status(400).json({ error: "Failed to parse CSV file" });
  }
});

/**
 * POST /api/import/menu/commit
 * Body: { source, mode, mappings, rows }  // mappings are user-confirmed columns
 */
importRouter.post("/menu/commit", async (req: Request, res: Response) => {
  const { rows, mappings, source, mode } = req.body;
  if (!rows?.length) return res.status(400).json({ error: "No rows to import" });

  try {
    // TODO: Implement actual database upsert based on your schema
    // This is a placeholder for the actual implementation
    console.log(`Importing ${rows.length} ${mode} from ${source}`, { mappings });
    
    // Example implementation would be:
    // const mappedRows = rows.map(row => ({
    //   name: row[mappings.name],
    //   sku: row[mappings.sku],
    //   price: parseFloat(row[mappings.price]) || 0,
    //   category: row[mappings.category] || 'Uncategorized',
    //   platform: source
    // }));
    
    // await db.menuItem.createMany({ data: mappedRows });

    return res.json({ 
      ok: true, 
      imported: rows.length, 
      source, 
      mode 
    });
  } catch (error) {
    console.error("Import commit error:", error);
    return res.status(500).json({ error: "Failed to import data" });
  }
});