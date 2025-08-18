#!/usr/bin/env tsx

import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

async function importStockCSV() {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.error('Usage: npm run import-stock <path-to-csv>');
    process.exit(1);
  }

  if (!fs.existsSync(csvFilePath)) {
    console.error(`File not found: ${csvFilePath}`);
    process.exit(1);
  }

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(csvFilePath));

    const response = await fetch('http://localhost:5173/api/stock-catalog/import', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const result: any = await response.json();
    
    if (response.ok) {
      console.log('✅ Import successful!');
      console.log(`📊 Inserted: ${result.inserted}, Updated: ${result.updated}`);
    } else {
      console.error('❌ Import failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Import error:', error);
    process.exit(1);
  }
}

importStockCSV();