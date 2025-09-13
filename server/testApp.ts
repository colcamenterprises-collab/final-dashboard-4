// Test implementation as specified in warnings file
import axios from 'axios';

export async function testDailyStockValidation() {
  try {
    console.log('Testing Daily Stock validation...');
    
    // Test invalid data (should fail)
    const stockRes = await axios.post('/api/forms/daily-stock', { 
      rollsEnd: '', 
      meatCount: -1, 
      drinksEnd: [] 
    });
    console.log('Stock error (expected): ' + stockRes.data.error);
    
    // Test valid data (should succeed)
    const validStock = await axios.post('/api/forms/daily-stock', { 
      rollsEnd: 50, 
      meatCount: 20, 
      drinksEnd: [{drink:'Coke',qty:10}], 
      requisition: [{id:'item1',qty:2}] 
    });
    console.log('Valid stock success: ' + validStock.data.success);
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Auto-run test if this file is executed directly
if (require.main === module) {
  testDailyStockValidation();
}