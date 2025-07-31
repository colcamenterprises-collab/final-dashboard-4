import { loyverseAPI } from './server/loyverseAPI.js';

// Fetch latest shifts to find shift 540
async function fetchShift540() {
  try {
    console.log('🔍 Fetching latest shifts from Loyverse API...');
    
    // Get shifts from July 4-6 to capture shift 540
    const startTime = '2025-07-04T00:00:00Z'; // July 4th UTC
    const endTime = '2025-07-06T00:00:00Z';   // July 6th UTC
    
    const shiftsResponse = await loyverseAPI.getShifts({
      start_time: startTime,
      end_time: endTime,
      limit: 50
    });
    
    console.log(`📊 Found ${shiftsResponse.shifts.length} shifts`);
    
    // Look for shift 540 in the data
    const shift540 = shiftsResponse.shifts.find(shift => 
      shift.id.includes('540') || 
      shift.opening_time.includes('2025-07-04') ||
      shift.closing_time?.includes('2025-07-05')
    );
    
    if (shift540) {
      console.log('🎯 FOUND SHIFT 540:');
      console.log('Opening time:', shift540.opening_time);
      console.log('Closing time:', shift540.closing_time);
      console.log('Full data:', JSON.stringify(shift540, null, 2));
    } else {
      console.log('❌ Shift 540 not found');
      console.log('Available shifts:');
      shiftsResponse.shifts.forEach(shift => {
        console.log(`- ID: ${shift.id}, Opening: ${shift.opening_time}, Closing: ${shift.closing_time || 'Open'}`);
      });
    }
    
  } catch (error) {
    console.error('Error fetching shifts:', error);
  }
}

fetchShift540();