// Test script to send email with latest form data
import { sendManagementSummary } from './server/gmailService.js';
import { storage } from './server/storage.js';

async function testEmail() {
  try {
    console.log('📧 Testing email template with sample form data...');
    
    // Create sample form data for testing
    const sampleFormData = {
      id: 999,
      completedBy: 'Test Manager',
      shiftType: 'Night Shift',
      shiftDate: new Date('2025-07-10'),
      totalSales: '12500.00',
      cashSales: '6250.00',
      grabSales: '3125.00',
      qrScanSales: '2000.00',
      foodPandaSales: '1125.00',
      aroiDeeSales: '0.00',
      startingCash: '5000.00',
      endingCash: '11250.00',
      expenseDescription: 'Test email template with professional Smash Brothers branding.',
      rollsOrderedCount: 50,
      burgerBunsStock: 25,
      meatWeight: 5000,
      drinkStockCount: 20
    };

    console.log(`✅ Created sample form data for ${sampleFormData.completedBy}`);
    console.log(`📊 Shift: ${sampleFormData.shiftType}, Total Sales: ฿${sampleFormData.totalSales}`);

    const emailData = {
      formData: sampleFormData,
      shoppingList: [],
      submissionTime: new Date()
    };

    console.log('📤 Sending test email with sample data...');
    const success = await sendManagementSummary(emailData);
    
    if (success) {
      console.log('✅ Test email sent successfully!');
      console.log('📧 Check your email for the new template with:');
      console.log(`   - Completed by: ${sampleFormData.completedBy}`);
      console.log(`   - Shift: ${sampleFormData.shiftType}`);
      console.log(`   - Total Sales: ฿${sampleFormData.totalSales}`);
      console.log(`   - Cash Sales: ฿${sampleFormData.cashSales}`);
      console.log(`   - Starting Cash: ฿${sampleFormData.startingCash}`);
      console.log(`   - Ending Cash: ฿${sampleFormData.endingCash}`);
    } else {
      console.error('❌ Failed to send test email');
    }
  } catch (error) {
    console.error('❌ Test email error:', error.message);
    console.error('❌ Full error:', error);
  }
}

testEmail();