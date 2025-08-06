#!/usr/bin/env tsx

import { syncSupplierCSV } from '../server/syncSupplierCSV';

// Change to project root directory
process.chdir('..');

async function main() {
  console.log('🔄 Starting CSV sync script...');
  
  try {
    const result = await syncSupplierCSV();
    
    console.log('\n📊 CSV Sync Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📥 Imported: ${result.imported} new ingredients`);
    console.log(`🔄 Updated: ${result.updated} existing ingredients`);
    console.log(`📋 Total Processed: ${result.totalProcessed} rows`);
    
    if (result.errors.length > 0) {
      console.log(`❌ Errors: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎉 CSV sync completed!');
  } catch (error) {
    console.error('❌ CSV sync failed:', error);
    process.exit(1);
  }
}

main();