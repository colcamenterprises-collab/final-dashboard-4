#!/usr/bin/env tsx

import { syncSupplierCSV } from '../server/syncSupplierCSV';

async function runSync() {
  console.log('🔄 Starting ingredient CSV sync...');
  
  try {
    const result = await syncSupplierCSV();
    
    console.log('\n📊 Sync Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📦 Imported: ${result.imported} new ingredients`);
    console.log(`🔄 Updated: ${result.updated} existing ingredients`);
    console.log(`📋 Total Processed: ${result.totalProcessed} rows`);
    console.log(`❌ Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (result.success) {
      console.log('\n🎉 Ingredient database successfully updated!');
    } else {
      console.log('\n⚠️ Sync completed with issues');
    }
    
  } catch (error) {
    console.error('💥 Sync failed:', error);
    process.exit(1);
  }
}

runSync();