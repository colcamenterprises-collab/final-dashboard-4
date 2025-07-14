import fetch from 'node-fetch';

async function generateShoppingListFromLastForm() {
  try {
    console.log('🔍 Fetching last completed form...');
    
    // Get all completed forms
    const formsResponse = await fetch('http://localhost:5000/api/daily-stock-sales/search');
    const forms = await formsResponse.json();
    
    if (!forms || forms.length === 0) {
      console.log('❌ No completed forms found');
      return;
    }
    
    // Get the last form (most recent)
    const lastForm = forms[forms.length - 1];
    console.log(`📋 Found last completed form: ID ${lastForm.id} by ${lastForm.completedBy} on ${lastForm.shiftDate}`);
    
    // Check if form has shopping entries
    const shoppingEntries = lastForm.shoppingEntries || [];
    console.log(`🛒 Form has ${shoppingEntries.length} shopping entries`);
    
    if (shoppingEntries.length === 0) {
      console.log('⚠️ No shopping entries found in the last form');
      return;
    }
    
    // Log the shopping entries
    console.log('\n📝 Shopping entries found:');
    shoppingEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.item} - ฿${entry.amount} (${entry.shop})`);
      if (entry.notes) console.log(`   Notes: ${entry.notes}`);
    });
    
    // Manually call the generateShoppingList function
    console.log('\n🔄 Generating shopping list from this form...');
    
    // Import and call the storage function directly
    const { PostgresStorage } = await import('./server/storage.js');
    const storage = new PostgresStorage();
    
    const shoppingList = await storage.generateShoppingList(lastForm);
    console.log(`✅ Generated ${shoppingList.length} shopping list items`);
    
    if (shoppingList.length > 0) {
      console.log('\n🛍️ Shopping list generated:');
      shoppingList.forEach((item, index) => {
        console.log(`${index + 1}. ${item.itemName} - ฿${item.totalPrice} (${item.supplier})`);
        if (item.notes) console.log(`   Notes: ${item.notes}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating shopping list:', error);
  }
}

generateShoppingListFromLastForm();