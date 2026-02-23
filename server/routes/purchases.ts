import { Router } from "express";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import { Readable } from "stream";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { purchasingItems, shoppingPurchaseV2 } from "../schema";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^\d.\-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

async function parseCsvStream(stream: NodeJS.ReadableStream): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    stream
      .pipe(csvParser())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

router.post("/import-purchases", upload.single("file"), async (req, res) => {
  if (!db) {
    return res.status(503).json({ ok: false, error: "Database unavailable" });
  }

  const salesId = req.body.salesId;
  if (!salesId) {
    return res.status(400).json({ ok: false, error: "salesId is required" });
  }

  let stream: NodeJS.ReadableStream | null = null;
  if (req.file) {
    stream = Readable.from(req.file.buffer);
  } else if (req.body.csvPath) {
    const csvPath = String(req.body.csvPath);
    if (!fs.existsSync(csvPath)) {
      return res.status(400).json({ ok: false, error: "csvPath does not exist" });
    }
    stream = fs.createReadStream(csvPath);
  }

  if (!stream) {
    return res.status(400).json({ ok: false, error: "CSV file or csvPath is required" });
  }

  try {
    const rows = await parseCsvStream(stream);
    const summary = {
      itemsUpserted: 0,
      purchasesInserted: 0,
      purchasesSkipped: 0,
      errors: [] as string[],
    };

    for (const row of rows) {
      const sku = row.sku || row.SKU || row.itemSku || row.item_sku || row["item sku"];
      const itemName = row.item || row.name || row.itemName || row["item name"];
      const costValue = parseNumber(row.cost || row.amount || row.price);
      const shop = row.shop || row.store || row.supplier || req.body.shop;
      const supplier = row.supplier || req.body.supplier || "Makro";

      if (!itemName) {
        summary.errors.push("Missing item name in CSV row.");
        continue;
      }

      if (!shop) {
        summary.errors.push(`Missing shop for item "${itemName}".`);
        continue;
      }

      if (costValue === null) {
        summary.errors.push(`Missing cost for item "${itemName}".`);
        continue;
      }

      if (!sku) {
        summary.errors.push(`Missing sku for item "${itemName}".`);
      } else {
        const existingItem = await db
          .select({ id: purchasingItems.id })
          .from(purchasingItems)
          .where(eq(purchasingItems.supplierSku, sku))
          .limit(1);

        if (existingItem.length === 0) {
          await db.insert(purchasingItems).values({
            item: itemName,
            supplier,
            supplierName: supplier,
            supplierSku: sku,
            active: true,
          });
          summary.itemsUpserted += 1;
        } else {
          await db
            .update(purchasingItems)
            .set({
              item: itemName,
              supplier,
              supplierName: supplier,
              updatedAt: new Date(),
            })
            .where(eq(purchasingItems.id, existingItem[0].id));
          summary.itemsUpserted += 1;
        }
      }

      const existingPurchase = await db
        .select({ id: shoppingPurchaseV2.id })
        .from(shoppingPurchaseV2)
        .where(
          and(
            eq(shoppingPurchaseV2.salesId, salesId),
            eq(shoppingPurchaseV2.item, itemName),
            eq(shoppingPurchaseV2.cost, costValue.toFixed(2)),
            eq(shoppingPurchaseV2.shop, shop)
          )
        )
        .limit(1);

      if (existingPurchase.length > 0) {
        summary.purchasesSkipped += 1;
        continue;
      }

      await db.insert(shoppingPurchaseV2).values({
        item: itemName,
        cost: costValue.toFixed(2),
        shop,
        salesId,
      });
      summary.purchasesInserted += 1;
    }

    return res.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[/api/purchases/import-purchases] Error:", error);
    return res.status(500).json({ ok: false, error: "Failed to import purchases" });
  }
});

export default router;
