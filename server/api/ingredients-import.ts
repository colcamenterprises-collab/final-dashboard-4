import express from 'express';
import multer from 'multer';
import { db } from '../db';
import { shoppingMaster } from '@shared/schema';
import { parseShoppingCSV } from '../lib/csvParser';
import { eq, sql } from 'drizzle-orm';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// POST /api/ingredients/import - Import CSV data into shopping_master
router.post('/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No CSV file provided' 
      });
    }

    const csvContent = req.file.buffer.toString('utf8');
    const parseResult = parseShoppingCSV(csvContent);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'CSV parsing failed',
        details: parseResult.errors
      });
    }

    // Begin transaction for upsert operations
    const results = await db.transaction(async (tx) => {
      let imported = 0;
      let updated = 0;

      // First, mark all existing items as inactive
      await tx.update(shoppingMaster)
        .set({ isActive: false, updatedAt: sql`NOW()` });

      // Process each item from CSV
      for (const item of parseResult.data) {
        try {
          // Try to find existing item by name and category
          const existing = await tx
            .select()
            .from(shoppingMaster)
            .where(
              sql`${shoppingMaster.item} = ${item.item} AND ${shoppingMaster.internalCategory} = ${item.internalCategory}`
            )
            .limit(1);

          if (existing.length > 0) {
            // Update existing item
            await tx
              .update(shoppingMaster)
              .set({
                ...item,
                updatedAt: sql`NOW()`,
                isActive: true
              })
              .where(eq(shoppingMaster.id, existing[0].id));
            updated++;
          } else {
            // Insert new item
            await tx.insert(shoppingMaster).values(item);
            imported++;
          }
        } catch (itemError) {
          console.error(`Error processing item ${item.item}:`, itemError);
        }
      }

      // Count deactivated items (those not in the new CSV)
      const deactivatedResult = await tx
        .select({ count: sql<number>`COUNT(*)` })
        .from(shoppingMaster)
        .where(eq(shoppingMaster.isActive, false));

      const deactivated = deactivatedResult[0]?.count || 0;

      return { imported, updated, deactivated };
    });

    res.json({
      success: true,
      message: `Import completed successfully`,
      imported: results.imported,
      updated: results.updated,
      deactivated: results.deactivated,
      total: parseResult.data.length,
      errors: parseResult.errors
    });

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;