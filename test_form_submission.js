import { pool } from './server/db.ts';

async function testFormSubmission() {
  try {
    // Test 1: Create a sample form submission
    const testFormData = {
      completedBy: "Test Staff",
      shiftType: "Night Shift",
      shiftDate: new Date(),
      startingCash: "500.00",
      endingCash: "1200.00",
      grabSales: "800.00",
      foodPandaSales: "200.00",
      aroiDeeSales: "300.00",
      qrScanSales: "150.00",
      cashSales: "250.00",
      totalSales: "1700.00",
      salaryWages: "800.00",
      shopping: "150.00",
      gasExpense: "50.00",
      totalExpenses: "1000.00",
      expenseDescription: "Test submission",
      wageEntries: JSON.stringify([
        { name: "Test Staff", amount: 800, notes: "Full shift" }
      ]),
      shoppingEntries: JSON.stringify([
        { item: "Burger Buns", amount: 100, notes: "Daily supply", shop: "Makro" },
        { item: "Cheese", amount: 50, notes: "Fresh cheese", shop: "Lotus" }
      ]),
      freshFood: JSON.stringify({
        "Salad": 5,
        "Tomatos": 10,
        "White Cabbage": 3
      }),
      frozenFood: JSON.stringify({
        "Bacon Short": 2,
        "Cheese": 4
      }),
      shelfItems: JSON.stringify({
        "Mayonnaise": 1,
        "Mustard": 1,
        "Cajun Spice": 1
      }),
      burgerBunsStock: 25,
      rollsOrderedCount: 50,
      meatWeight: "15.5",
      drinkStockCount: 30,
      rollsOrderedConfirmed: true,
      receiptPhotos: JSON.stringify([]),
      isDraft: false
    };

    console.log('🧪 Inserting test form data...');
    
    const insertQuery = `
      INSERT INTO daily_stock_sales (
        completed_by, shift_type, shift_date, starting_cash, ending_cash,
        grab_sales, food_panda_sales, aroi_dee_sales, qr_scan_sales, cash_sales, total_sales,
        salary_wages, shopping, gas_expense, total_expenses, expense_description,
        wage_entries, shopping_entries, fresh_food, frozen_food, shelf_items,
        burger_buns_stock, rolls_ordered_count, meat_weight, drink_stock_count,
        rolls_ordered_confirmed, receipt_photos, is_draft
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
      ) RETURNING *
    `;

    const values = [
      testFormData.completedBy, testFormData.shiftType, testFormData.shiftDate,
      testFormData.startingCash, testFormData.endingCash,
      testFormData.grabSales, testFormData.foodPandaSales, testFormData.aroiDeeSales,
      testFormData.qrScanSales, testFormData.cashSales, testFormData.totalSales,
      testFormData.salaryWages, testFormData.shopping, testFormData.gasExpense,
      testFormData.totalExpenses, testFormData.expenseDescription,
      testFormData.wageEntries, testFormData.shoppingEntries, testFormData.freshFood,
      testFormData.frozenFood, testFormData.shelfItems, testFormData.burgerBunsStock,
      testFormData.rollsOrderedCount, testFormData.meatWeight, testFormData.drinkStockCount,
      testFormData.rollsOrderedConfirmed, testFormData.receiptPhotos, testFormData.isDraft
    ];

    const result = await pool.query(insertQuery, values);
    console.log('✅ Test form created successfully:', result.rows[0]);

    // Test 2: Query the form back
    console.log('\n🔍 Querying saved form...');
    const queryResult = await pool.query(
      'SELECT * FROM daily_stock_sales WHERE completed_by = $1 ORDER BY created_at DESC LIMIT 1',
      ['Test Staff']
    );
    console.log('✅ Form found:', queryResult.rows[0] ? 'YES' : 'NO');

    // Test 3: Check if shopping list items were created
    console.log('\n🛒 Checking shopping list...');
    const shoppingResult = await pool.query('SELECT * FROM shopping_list ORDER BY id DESC LIMIT 10');
    console.log('✅ Shopping list items found:', shoppingResult.rows.length);
    if (shoppingResult.rows.length > 0) {
      console.log('Recent shopping items:');
      shoppingResult.rows.forEach((item, index) => {
        console.log(`${index + 1}. ${item.item_name} - Qty: ${item.quantity} - Supplier: ${item.supplier}`);
      });
    }

    // Test 4: Search functionality
    console.log('\n🔍 Testing search functionality...');
    const searchResult = await pool.query(`
      SELECT * FROM daily_stock_sales 
      WHERE completed_by ILIKE '%Test%' 
      ORDER BY shift_date DESC
    `);
    console.log('✅ Search results found:', searchResult.rows.length);

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testFormSubmission();