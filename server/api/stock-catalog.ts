import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const upload = multer({ storage: multer.memoryStorage() });
const prisma = new PrismaClient();

// GET /api/stock-catalog - Read catalog for the form
export async function getStockCatalog(req: Request, res: Response) {
  try {
    const items = await prisma.stockItem.findMany({
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ items });
  } catch (error) {
    console.error('Error fetching stock catalog:', error);
    res.status(500).json({ error: 'Failed to fetch stock catalog' });
  }
}

// POST /api/stock-catalog/import - Import catalog from CSV
export async function importStockCatalog(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvData: any[] = [];
    const stream = Readable.from(file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          console.log('CSV row:', row);
          // Skip header rows and empty rows  
          const itemName = row['Item '] || row['Item'] || '';
          if (itemName && itemName.trim() && !itemName.includes('Item') && itemName !== 'Meat' && itemName !== 'Drinks' && itemName !== 'Fresh Food') {
            csvData.push(row);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    let inserted = 0;
    let updated = 0;
    let displayOrder = 0;

    console.log('Total CSV rows to process:', csvData.length);

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const name = (row['Item '] || row['Item'])?.trim();
      const category = (row['Internal Category'] || row['Category'])?.trim() || 'General';
      
      console.log(`Processing row ${i}: name="${name}", category="${category}"`);
      
      if (!name) continue;

      // Mark first 4 rows as excluded (meat items)
      const isExcluded = i < 4;
      
      // Detect drinks by category keywords
      const isDrink = ['drinks', 'beverage', 'soft drinks', 'soda'].some(
        keyword => category.toLowerCase().includes(keyword.toLowerCase())
      );

      try {
        // Upsert by name (case-insensitive)
        const existingItem = await prisma.stockItem.findFirst({
          where: {
            name: {
              equals: name,
              mode: 'insensitive'
            }
          }
        });

        if (existingItem) {
          await prisma.stockItem.update({
            where: { id: existingItem.id },
            data: {
              category,
              isDrink,
              isExcluded,
              displayOrder: displayOrder++
            }
          });
          updated++;
        } else {
          await prisma.stockItem.create({
            data: {
              name,
              category,
              isDrink,
              isExcluded,
              displayOrder: displayOrder++
            }
          });
          inserted++;
        }
      } catch (itemError) {
        console.error(`Error processing item "${name}":`, itemError);
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (error) {
    console.error('Error importing stock catalog:', error);
    res.status(500).json({ error: 'Failed to import stock catalog' });
  }
}

export const uploadMiddleware = upload.single('file');