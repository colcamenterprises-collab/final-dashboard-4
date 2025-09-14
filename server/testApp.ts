const axios = require('axios');
axios.defaults.baseURL = 'http://localhost:3000'; // Adjust port if needed

async function test() {
  // Base tests from project summary
  try {
    const ing = await axios.get('/api/ingredients');
    console.log('Ingredients count: ' + ing.data.length);
  } catch (e) { console.log('Ingredients error: ' + e.message); }

  try {
    const shop = await axios.get('/api/shopping-list');
    console.log('Shopping drinks: ' + (shop.data.groupedList.Drinks?.length || 0));
  } catch (e) { console.log('Shopping error: ' + e.message); }

  try {
    const recipe = await axios.post('/api/recipes', { name: 'Test', ingredients: [{id: 'beef', portion: 95, unit: 'g'}] });
    console.log('Beef cost: ' + recipe.data.ingredients[0].cost);
  } catch (e) { console.log('Recipe error: ' + e.message); }

  // Add invalid sales test
  try {
    const invalidSales = await axios.post('/api/forms/daily-sales/v2', { completedBy: '' });
    console.log('Invalid sales success (unexpected): ' + invalidSales.data.success);
  } catch (e) {
    console.log('Expected sales error: ' + e.response.data.error);
  }

  // Valid sales
  try {
    const validSales = await axios.post('/api/forms/daily-sales/v2', { completedBy: 'TestStaff', startingCash: 1000, cashSales: 5000, qrSales: 2000, grabSales: 3000, otherSales: 1000, totalSales: 11000 });
    console.log('Valid sales success: ' + validSales.data.success);
  } catch (e) { console.log('Sales error: ' + e.message); }

  // Invalid stock
  try {
    const invalidStock = await axios.post('/api/forms/daily-stock', { rollsEnd: -1, meatCount: '', drinksEnd: [] });
    console.log('Invalid stock success (unexpected): ' + invalidStock.data.success);
  } catch (e) {
    console.log('Expected stock error: ' + e.response.data.error);
  }

  // Valid stock
  try {
    const validStock = await axios.post('/api/forms/daily-stock', { rollsEnd: 50, meatCount: 20, drinksEnd: [{drink:'Coke',qty:10}], requisition: [{id:'beef',qty:5},{id:'cheese',qty:0}] });
    console.log('Valid stock success: ' + validStock.data.success);
  } catch (e) { console.log('Stock error: ' + e.message); }
}
test();