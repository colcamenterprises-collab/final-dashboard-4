import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Test shift analytics processing with direct SQL
async function testShiftAnalytics() {
  try {
    console.log('Testing shift analytics processing...');
    
    // Use July 12, 2025 for testing (has 246 receipts)
    const shiftDateStr = '2025-07-12';
    
    console.log('Processing shift for date:', shiftDateStr);
    
    // Get shift period (6pm to 3am next day) - receipts are at 6:50 AM = shift from July 11 6pm to July 12 3am
    const shiftStart = new Date('2025-07-11T11:00:00.000Z'); // 6pm Bangkok July 11 = 11am UTC
    const shiftEnd = new Date('2025-07-12T20:00:00.000Z'); // 3am Bangkok July 12 = 8pm UTC
    
    console.log('Shift period:', shiftStart.toISOString(), 'to', shiftEnd.toISOString());
    
    // Get receipts for the shift period
    const receipts = await sql`
      SELECT 
        lr.receipt_number,
        lr.total_amount,
        lr.items
      FROM loyverse_receipts lr
      WHERE lr.created_at >= ${shiftStart.toISOString()}
      AND lr.created_at < ${shiftEnd.toISOString()}
      ORDER BY lr.created_at
    `;
    
    console.log(`Found ${receipts.length} receipts for shift period`);
    
    if (receipts.length === 0) {
      console.log('No receipts found for this shift period');
      return;
    }
    
    // Process receipt data
    const itemTotals = new Map();
    const modifierTotals = new Map();
    const categoryCounts = {
      BURGERS: 0,
      DRINKS: 0,
      SIDE_ORDERS: 0,
      BURGER_EXTRAS: 0,
      OTHER: 0
    };
    
    let totalSales = 0;
    let totalReceipts = receipts.length;
    
    receipts.forEach(receipt => {
      try {
        const items = Array.isArray(receipt.items) ? receipt.items : JSON.parse(receipt.items || '[]');
        totalSales += parseFloat(receipt.total_amount);
        
        items.forEach(item => {
          const category = item.category || 'OTHER';
          const key = `${category}:${item.item_name}`;
          
          if (!itemTotals.has(key)) {
            itemTotals.set(key, { quantity: 0, sales: 0 });
          }
          
          const current = itemTotals.get(key);
          current.quantity += item.quantity;
          current.sales += item.line_total;
          
          // Count categories
          if (categoryCounts[category] !== undefined) {
            categoryCounts[category] += item.quantity;
          } else {
            categoryCounts.OTHER += item.quantity;
          }
          
          // Process modifiers
          if (item.modifiers) {
            item.modifiers.forEach(modifier => {
              if (!modifierTotals.has(modifier.name)) {
                modifierTotals.set(modifier.name, { quantity: 0, sales: 0 });
              }
              
              const modCurrent = modifierTotals.get(modifier.name);
              modCurrent.quantity += modifier.quantity;
              modCurrent.sales += modifier.unit_cost * modifier.quantity;
            });
          }
        });
      } catch (error) {
        console.error('Error processing receipt:', receipt.receipt_number, error);
      }
    });
    
    console.log('Analytics Summary:');
    console.log('Total Sales:', totalSales);
    console.log('Total Receipts:', totalReceipts);
    console.log('Category Counts:', categoryCounts);
    console.log('Unique Items:', itemTotals.size);
    console.log('Unique Modifiers:', modifierTotals.size);
    
    // Clear existing data
    await sql`DELETE FROM shift_summary WHERE shift_date = ${shiftDateStr}`;
    await sql`DELETE FROM shift_item_sales WHERE shift_date = ${shiftDateStr}`;
    await sql`DELETE FROM shift_modifier_sales WHERE shift_date = ${shiftDateStr}`;
    
    // Insert shift summary
    await sql`
      INSERT INTO shift_summary (
        shift_date, burgers_sold, drinks_sold, sides_sold, 
        extras_sold, other_sold, total_sales, total_receipts
      ) VALUES (
        ${shiftDateStr}, ${categoryCounts.BURGERS}, ${categoryCounts.DRINKS}, 
        ${categoryCounts.SIDE_ORDERS}, ${categoryCounts.BURGER_EXTRAS}, 
        ${categoryCounts.OTHER}, ${totalSales}, ${totalReceipts}
      )
    `;
    
    // Insert item sales data
    for (const [key, data] of itemTotals) {
      const [category, itemName] = key.split(':');
      await sql`
        INSERT INTO shift_item_sales (shift_date, category, item_name, quantity, sales_total)
        VALUES (${shiftDateStr}, ${category}, ${itemName}, ${data.quantity}, ${data.sales})
      `;
    }
    
    // Insert modifier sales data
    for (const [modifierName, data] of modifierTotals) {
      await sql`
        INSERT INTO shift_modifier_sales (shift_date, modifier_name, quantity, sales_total)
        VALUES (${shiftDateStr}, ${modifierName}, ${data.quantity}, ${data.sales})
      `;
    }
    
    console.log('✅ Shift analytics processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testShiftAnalytics().then(() => {
  console.log('Test completed');
  process.exit(0);
});