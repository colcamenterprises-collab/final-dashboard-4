import { PostgresStorage } from './server/storage.js';

async function regenerateShoppingList() {
  try {
    console.log('🔄 Creating storage instance...');
    const storage = new PostgresStorage();
    
    // Get the last completed form directly from database
    console.log('🔍 Fetching last completed form...');
    const forms = await storage.searchDailyStockSales('');
    
    if (!forms || forms.length === 0) {
      console.log('❌ No completed forms found');
      return;
    }
    
    const lastForm = forms[forms.length - 1];
    console.log(`📋 Found last completed form: ID ${lastForm.id} by ${lastForm.completedBy}`);
    
    // Check if form has shopping entries
    const shoppingEntries = lastForm.shoppingEntries || [];
    console.log(`🛒 Form has ${shoppingEntries.length} shopping entries`);
    
    if (shoppingEntries.length === 0) {
      console.log('⚠️ No shopping entries found in the last form');
      return;
    }
    
    // Generate shopping list
    console.log('🔄 Generating shopping list...');
    const shoppingList = await storage.generateShoppingList(lastForm);
    console.log(`✅ Generated ${shoppingList.length} shopping list items`);
    
    // Show the shopping list
    console.log('\n🛍️ Shopping List Generated:');
    shoppingList.forEach((item, index) => {
      console.log(`${index + 1}. ${item.itemName} - ฿${item.totalPrice} (${item.supplier})`);
      if (item.notes) console.log(`   Notes: ${item.notes}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

regenerateShoppingList();