import { pool } from './server/database.js';

async function analyzeAuthenticReceipts() {
  console.log('Analyzing authentic receipts for July 11th, 2025...\n');
  
  const client = await pool.connect();
  
  try {
    // Get all receipts for July 11th
    const receiptsResult = await client.query(`
      SELECT 
        receipt_number,
        created_at AT TIME ZONE 'Asia/Bangkok' as receipt_time,
        total_amount,
        items
      FROM loyverse_receipts 
      WHERE DATE(created_at AT TIME ZONE 'Asia/Bangkok') = '2025-07-11'
      ORDER BY created_at
    `);
    
    console.log(`Found ${receiptsResult.rows.length} receipts for July 11th, 2025\n`);
    
    let totalBurgers = 0;
    let totalPatties = 0;
    const itemSummary = {};
    
    // Analyze each receipt
    for (const receipt of receiptsResult.rows) {
      const items = receipt.items || [];
      
      console.log(`Receipt ${receipt.receipt_number} (${receipt.receipt_time.toLocaleString()}) - ฿${receipt.total_amount}:`);
      
      for (const item of items) {
        const itemName = item.item_name;
        const quantity = item.quantity || 1;
        
        console.log(`  - ${itemName} (${quantity}x) - ฿${item.total_money}`);
        
        // Count burgers and patties
        if (itemName.includes('Single') && itemName.includes('Burger')) {
          totalBurgers += quantity;
          totalPatties += quantity; // Single patty
        } else if (itemName.includes('Double') && itemName.includes('Burger')) {
          totalBurgers += quantity;
          totalPatties += quantity * 2; // Double patty
        } else if (itemName.includes('Ultimate Double')) {
          totalBurgers += quantity;
          totalPatties += quantity * 2; // Double patty
        } else if (itemName.includes('Super Double')) {
          totalBurgers += quantity;
          totalPatties += quantity * 2; // Double patty
        } else if (itemName.includes('Meal Set') || itemName.includes('Set')) {
          // Meal sets contain burgers
          totalBurgers += quantity;
          totalPatties += quantity; // Assume single patty unless specified
        }
        
        // Summary count
        if (itemSummary[itemName]) {
          itemSummary[itemName] += quantity;
        } else {
          itemSummary[itemName] = quantity;
        }
      }
      
      console.log('');
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Total Burgers Sold: ${totalBurgers}`);
    console.log(`Total Patties Used: ${totalPatties}`);
    console.log(`Total Revenue: ฿${receiptsResult.rows.reduce((sum, r) => sum + parseFloat(r.total_amount), 0).toFixed(2)}`);
    
    console.log('\n=== ITEM BREAKDOWN ===');
    Object.entries(itemSummary)
      .sort(([,a], [,b]) => b - a)
      .forEach(([item, count]) => {
        console.log(`${item}: ${count}x`);
      });
    
  } catch (error) {
    console.error('Error analyzing receipts:', error);
  } finally {
    client.release();
  }
}

analyzeAuthenticReceipts().catch(console.error);