import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

let stockMasterCache: any = null;

export default function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Load from cache if available
    if (!stockMasterCache) {
      const filePath = join(process.cwd(), 'data', 'stock_master.json');
      const fileContent = readFileSync(filePath, 'utf-8');
      stockMasterCache = JSON.parse(fileContent);
    }

    res.json(stockMasterCache);
  } catch (error) {
    console.error('Error loading stock master:', error);
    res.status(500).json({ error: 'Failed to load stock master data' });
  }
}