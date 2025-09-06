import { Pool, neonConfig } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function checkSchema() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    console.log('🔍 Checking database schema consistency...');
    
    // Check daily_sales_v2 table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'daily_sales_v2'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Current daily_sales_v2 columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}${row.is_nullable === 'YES' ? ', nullable' : ', not null'})`);
    });

    // Expected critical columns
    const expectedColumns = [
      'id', 'shiftDate', 'completedBy', 'createdAt', 'submittedAtISO', 'payload'
    ];

    const missingColumns = expectedColumns.filter(col => 
      !result.rows.some(row => row.column_name === col)
    );

    if (missingColumns.length > 0) {
      console.log('\n❌ Missing critical columns:');
      missingColumns.forEach(col => console.log(`  - ${col}`));
      console.log('\n💡 Run: npm run db:push --force to sync schema');
    } else {
      console.log('\n✅ All critical columns present');
    }

    // Check indexes
    const indexResult = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename = 'daily_sales_v2';
    `);

    console.log('\n📊 Current indexes:');
    if (indexResult.rows.length > 0) {
      indexResult.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
    } else {
      console.log('  No custom indexes found');
    }

    console.log('\n🎯 Schema check completed');

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the check
checkSchema().catch(console.error);