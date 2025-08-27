import express from 'express';
import { db } from '../../lib/prisma';
import { parse } from 'csv-parse/sync';

const router = express.Router();

interface IngredientRow {
  Name: string;
  Category: string;
  Unit: string;
  Cost: string;
  Supplier: string;
  Portions?: string;
}

interface IngredientRecord {
  id: string;
  name: string;
  category: string;
}

// POST /api/ingredients/upload - CSV import with upsert and removal
router.post('/', async (req, res) => {
  try {
    const csv = typeof req.body === "string" ? req.body : req.body?.csv;
    if (!csv) {
      return res.status(400).json({ ok: false, error: 'No CSV data provided' });
    }

    const records = parse(csv, { 
      columns: true, 
      skip_empty_lines: true 
    }) as IngredientRow[];

    const incomingKeys = new Set(records.map(r => `${r.Name}|||${r.Category}`));

    await db().$transaction(async (tx) => {
      // Upsert present rows
      for (const r of records) {
        await tx.ingredientV2.upsert({
          where: { 
            name_category: { 
              name: r.Name, 
              category: r.Category 
            } 
          },
          update: {
            unit: r.Unit,
            cost: Number(r.Cost ?? 0),
            supplier: r.Supplier ?? "",
            portions: r.Portions ? Number(r.Portions) : null
          },
          create: {
            name: r.Name,
            category: r.Category,
            unit: r.Unit,
            cost: Number(r.Cost ?? 0),
            supplier: r.Supplier ?? "",
            portions: r.Portions ? Number(r.Portions) : null
          }
        });
      }

      // Remove absent rows
      const all = await tx.ingredientV2.findMany({ 
        select: { id: true, name: true, category: true } 
      });
      const toDelete = all
        .filter((a: IngredientRecord) => !incomingKeys.has(`${a.name}|||${a.category}`))
        .map((a: IngredientRecord) => a.id);
      
      if (toDelete.length) {
        await tx.ingredientV2.deleteMany({ 
          where: { id: { in: toDelete } } 
        });
      }
    });

    res.json({ ok: true, count: records.length });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to import CSV',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export async function uploadIngredients(req: express.Request, res: express.Response) {
  try {
    const csv = typeof req.body === "string" ? req.body : req.body?.csv;
    if (!csv) {
      return res.status(400).json({ ok: false, error: 'No CSV data provided' });
    }

    const records = parse(csv, { 
      columns: true, 
      skip_empty_lines: true 
    }) as IngredientRow[];

    const incomingKeys = new Set(records.map(r => `${r.Name}|||${r.Category}`));

    await db().$transaction(async (tx) => {
      // Upsert present rows
      for (const r of records) {
        await tx.ingredientV2.upsert({
          where: { 
            name_category: { 
              name: r.Name, 
              category: r.Category 
            } 
          },
          update: {
            unit: r.Unit,
            cost: Number(r.Cost ?? 0),
            supplier: r.Supplier ?? "",
            portions: r.Portions ? Number(r.Portions) : null
          },
          create: {
            name: r.Name,
            category: r.Category,
            unit: r.Unit,
            cost: Number(r.Cost ?? 0),
            supplier: r.Supplier ?? "",
            portions: r.Portions ? Number(r.Portions) : null
          }
        });
      }

      // Remove absent rows
      const all = await tx.ingredientV2.findMany({ 
        select: { id: true, name: true, category: true } 
      });
      const toDelete = all
        .filter((a: IngredientRecord) => !incomingKeys.has(`${a.name}|||${a.category}`))
        .map((a: IngredientRecord) => a.id);
      
      if (toDelete.length) {
        await tx.ingredientV2.deleteMany({ 
          where: { id: { in: toDelete } } 
        });
      }
    });

    res.json({ ok: true, count: records.length });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to import CSV',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default router;