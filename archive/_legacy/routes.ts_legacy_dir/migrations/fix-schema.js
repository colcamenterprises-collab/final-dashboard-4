import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixSchema() {
  try {
    console.log('Starting schema fix...');
    
    // Remove obsolete columns and add missing ones
    await pool.query(`
      -- Remove obsolete columns
      ALTER TABLE daily_stock_sales
      DROP COLUMN IF EXISTS foodpanda_sales;
      
      -- Add missing columns if not exist
      ALTER TABLE daily_stock_sales
      ADD COLUMN IF NOT EXISTS wages jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS shopping jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS drink_stock jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS fresh_food jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS frozen_food jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS shelf_items jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS kitchen_items jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS packaging_items jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS banked_amount decimal(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ending_cash decimal(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_expenses decimal(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gas_expense decimal(10,2) DEFAULT 0;
    `);
    
    console.log('✓ Schema fixed: Removed foodpanda_sales, added all missing columns.');
    
    // Verify schema
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'daily_stock_sales' 
      ORDER BY column_name;
    `);
    
    console.log('Current columns:', result.rows.map(r => r.column_name).join(', '));
    
  } catch (err) {
    console.error('Schema fix error:', err.message);
  } finally {
    await pool.end();
  }
}

fixSchema();