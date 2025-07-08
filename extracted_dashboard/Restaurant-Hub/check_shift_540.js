// Quick check for shift 540 in Loyverse API
const fetch = require('node-fetch');

async function checkShift540() {
  try {
    const response = await fetch('http://localhost:5000/api/loyverse/shift-reports');
    const shifts = await response.json();
    
    console.log('All available shifts:');
    shifts.forEach(shift => {
      console.log(`Shift ${shift.reportData?.shift_number || 'N/A'}: ${shift.shiftDate} - Sales: ${shift.totalSales}`);
    });
    
    // Look for shift 540 specifically
    const shift540 = shifts.find(s => s.reportData?.shift_number === '540');
    if (shift540) {
      console.log('\n🎯 FOUND SHIFT 540:');
      console.log(JSON.stringify(shift540, null, 2));
    } else {
      console.log('\n❌ Shift 540 not found in database');
      console.log('Available shift numbers:', shifts.map(s => s.reportData?.shift_number).filter(Boolean));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkShift540();