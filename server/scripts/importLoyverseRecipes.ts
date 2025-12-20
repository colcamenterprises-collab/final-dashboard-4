// PATCH D — Import Recipes from Loyverse CSV
// Idempotent script: matches on name, skips duplicates, no deletions

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { pool } from "../db";

interface LoyverseRow {
  "Item Name": string;
  SKU: string;
  Category: string;
  Description: string;
  Price: string;
}

const CSV_PATH = path.join(
  process.cwd(),
  "attached_assets/All Menu Items- SKU and Categories - Loyverse_1762489025094.csv"
);

async function importLoyverseRecipes(): Promise<{ inserted: number; skipped: number }> {
  console.log("[IMPORT] Starting Loyverse recipe import...");

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const records: LoyverseRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`[IMPORT] Found ${records.length} rows in CSV`);
  console.log("✓ Database connection established");

  let inserted = 0;
  let skipped = 0;

  for (const row of records) {
    const name = (row["Item Name"] || "").trim();
    
    // Skip rows with empty names
    if (!name) {
      console.log(`[IMPORT] Skipped: empty name`);
      skipped++;
      continue;
    }

    const category = (row["Category"] || "").trim();
    const description = (row["Description"] || "").trim();
    const price = parseFloat(row["Price"]) || 0;

    // Check if recipe already exists by name (case-insensitive)
    const existing = await pool.query(
      `SELECT id FROM recipes WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [name]
    );

    if (existing.rows.length > 0) {
      console.log(`[IMPORT] Skipped (exists): ${name}`);
      skipped++;
      continue;
    }

    // Insert new recipe with available fields
    await pool.query(
      `INSERT INTO recipes (
        name, 
        category, 
        description, 
        menu_price_thb,
        yield_quantity,
        yield_unit,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        name,
        category || "Uncategorized",
        description || null,
        price,
        1,
        "servings",
        true,
      ]
    );

    console.log(`[IMPORT] Inserted: ${name} (${category}) @ ${price} THB`);
    inserted++;
  }

  console.log(`\n[IMPORT] Complete: ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped };
}

// Run directly
importLoyverseRecipes()
  .then((result) => {
    console.log(`\n✅ Import complete: ${result.inserted} recipes imported`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Import failed:", err);
    process.exit(1);
  });
