import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedSuppliers() {
  try {
    console.log('Starting supplier seeding...');
    
    // Check if suppliers.json exists
    const suppliersPath = path.join(__dirname, '../data/suppliers.json');
    if (!fs.existsSync(suppliersPath)) {
      console.log('suppliers.json not found, skipping seeding');
      return;
    }
    
    const suppliersData = JSON.parse(fs.readFileSync(suppliersPath, 'utf8'));
    
    for (const supplier of suppliersData) {
      await pool.query(`
        INSERT INTO suppliers (item, category, supplier, brand, cost, unit_measurement, minimum_stock_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (item) DO UPDATE SET 
          cost = EXCLUDED.cost,
          category = EXCLUDED.category,
          supplier = EXCLUDED.supplier,
          updated_at = NOW();
      `, [
        supplier.item,
        supplier.category,
        supplier.supplier || '',
        supplier.brand || '',
        parseFloat(supplier.cost) || 0,
        supplier.unitMeasurement || '',
        supplier.minimumStockAmount || ''
      ]);
    }
    
    console.log(`✓ Successfully seeded ${suppliersData.length} suppliers`);
    
  } catch (err) {
    console.error('Seeding error:', err.message);
  } finally {
    await pool.end();
  }
}

seedSuppliers();