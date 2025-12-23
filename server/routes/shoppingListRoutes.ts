// PATCH 2 — SHOPPING LIST PROTECTION & TRIPWIRES
// ONLY retrieval is allowed via this route.
// Mutation is strictly forbidden.
// Uses canonical shopping_list table (not shopping_list_v2)

import { Router } from "express";
import { db as drizzleDb } from "../db";
import { sql } from "drizzle-orm";
import { generateShoppingListPDF } from "../services/shoppingListPDF";
import { generateShoppingListZip } from "../services/shoppingListZip";

const router = Router();

// Tripwire — Block all non-GET methods
router.use((req, res, next) => {
  if (req.method !== "GET") {
    console.error("BLOCKED: Unauthorized shopping list mutation attempt.");
    return res.status(403).json({
      error: "Shopping List is protected. Only GET operations are permitted.",
    });
  }
  next();
});

router.get("/latest", async (req, res) => {
  try {
    const result = await drizzleDb.execute(sql`
      SELECT sl.*, 
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', sli.id,
            'name', sli.ingredient_name,
            'quantity', sli.requested_qty,
            'unit', sli.requested_unit,
            'notes', sli.notes
          ))
          FROM shopping_list_items sli 
          WHERE sli.shopping_list_id = sl.id), '[]'::json
        ) as items
      FROM shopping_list sl
      ORDER BY sl.created_at DESC
      LIMIT 1
    `);

    const row = result.rows?.[0];
    if (!row) return res.status(200).json({ items: [] });

    return res.status(200).json({
      id: (row as any).id,
      createdAt: (row as any).created_at,
      date: (row as any).list_date || (row as any).created_at,
      items: (row as any).items || [],
    });
  } catch (err) {
    console.error("ShoppingList fetch error:", err);
    res.status(500).json({ error: "Failed to fetch shopping list" });
  }
});

router.get("/pdf/latest", async (req, res) => {
  try {
    const pdfStream = await generateShoppingListPDF();

    if (!pdfStream) {
      return res.status(404).json({ error: "No shopping list available." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=shopping-list.pdf"
    );

    pdfStream.pipe(res);
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.get("/pdf/range", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "start and end query params required" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=shopping-lists.zip"
    );

    const ok = await generateShoppingListZip(String(start), String(end), res);

    if (!ok) {
      return res.status(404).json({ error: "No shopping lists found in range" });
    }
  } catch (err) {
    console.error("ZIP export error:", err);
    res.status(500).json({ error: "Failed to generate ZIP" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const result = await drizzleDb.execute(sql`
      SELECT sl.id, sl.created_at, sl.list_date,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', sli.id,
            'name', sli.ingredient_name,
            'quantity', sli.requested_qty,
            'unit', sli.requested_unit
          ))
          FROM shopping_list_items sli 
          WHERE sli.shopping_list_id = sl.id), '[]'::json
        ) as items
      FROM shopping_list sl
      ORDER BY sl.created_at DESC
      LIMIT 50
    `);

    const lists = (result.rows || []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      date: row.list_date || row.created_at,
      items: row.items || [],
    }));

    res.json({ lists });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
