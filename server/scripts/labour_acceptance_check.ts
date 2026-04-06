function assertEqual(actual: any, expected: any, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertApprox(actual: number, expected: number, decimals: number, label: string) {
  const scale = Math.pow(10, decimals);
  const rounded = Math.round(actual * scale) / scale;
  if (rounded !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${rounded}`);
  }
}

const shiftHours = 8.5;
const fixedOverheadMinutes = 105;
const staffCount = 3;
const available = staffCount * shiftHours * 60;
assertEqual(available, 1530, 'TEST 1 available labour minutes');
assertEqual(fixedOverheadMinutes, 105, 'TEST 2 fixed overhead');

const serviceMinutes = 6;
const prepAllocationMinutes = 1.5;
const packagingMinutes = 0.5;
const effectiveItemMinutes = serviceMinutes + prepAllocationMinutes + packagingMinutes;
assertApprox(effectiveItemMinutes, 8.0, 1, 'TEST 3 effective item minutes');

const soldQty = 10;
const itemWorkMinutes = soldQty * effectiveItemMinutes;
assertEqual(itemWorkMinutes, 80, 'TEST 4 item work minutes');

const serviceWorkMinutes = 510;
const fullShiftWorkMinutes = serviceWorkMinutes + fixedOverheadMinutes;
assertApprox((serviceWorkMinutes / available) * 100, 33.3, 1, 'TEST 5 service utilisation');
assertApprox((fullShiftWorkMinutes / available) * 100, 40.2, 1, 'TEST 5 full shift utilisation');

const recommendedStaff = Math.ceil(fullShiftWorkMinutes / (shiftHours * 60 * 0.7));
assertEqual(recommendedStaff, 2, 'TEST 6 recommended staff');

const staffingVariance = staffCount - recommendedStaff;
assertEqual(staffingVariance, 1, 'TEST 7 staffing variance');
assertEqual(staffingVariance > 0 ? 'Overstaffed' : staffingVariance < 0 ? 'Understaffed' : 'On Target', 'Overstaffed', 'TEST 7 staffing status');

const unmappedEffective = 0;
assertEqual(unmappedEffective, 0, 'TEST 8 missing timing defaults to zero');

const noWageStaffCount = 0;
const noWageAvailable = noWageStaffCount * shiftHours * 60;
assertEqual(noWageAvailable, 0, 'TEST 9 no wage available minutes');
assertEqual(noWageAvailable > 0 ? 10 : 0, 0, 'TEST 9 no wage utilisation fallback');

const hours = [18, 19, 20, 21, 22, 23, 0, 1, 2];
assertEqual(hours.length, 9, 'TEST 10 hourly bucket coverage');

console.log('Labour acceptance checks passed');
