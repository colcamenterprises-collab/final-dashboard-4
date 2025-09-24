import { storage } from './storage';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';

interface HistoricalFormData {
  completedBy: string;
  shift: string;
  date: string;
  cashAtStart: number;
  grab: number;
  foodPanda: number;
  aroiDee: number;
  qrScan: number;
  cashSales: number;
  totalSales: number;
  salaryWages: number;
  shopping: number;
  gasExpense: number;
  description: string;
  totalExpenses: number;
  totalCashInRegister: number;
  burgerBuns: number;
  rollsOrdered: number;
  burgerMeat: number;
  // Stock items
  salad: number;
  tomatos: number;
  whiteCabbage: number;
  purpleCabbage: number;
  onions: number;
  mayonnaise: number;
  mustard: number;
  cajunSpice: number;
  dillPickles: number;
  sweetPickles: number;
  crispyFriedOnions: number;
  bbqSauce: number;
  baconShort: number;
  baconLong: number;
  sweetPotatoFries: number;
  cheese: number;
  chickenNuggets: number;
  onionRings: number;
  frenchFries: number;
  jalapenos: number;
  ketchup: number;
  chiliSauce: number;
  oilFryer: number;
  bbqSauceBottle: number;
  pepper: number;
  salt: number;
  coke: number;
  cokeZero: number;
  schweppesManow: number;
  fantaStrawberry: number;
  orangeFanta: number;
  sprite: number;
  kidsAppleJuice: number;
  kidsOrange: number;
  sodaWater: number;
  bottleWater: number;
  clearFoodWrap: number;
  aluminumFoil: number;
  plasticHandGloves: number;
  rubberGlovesSmall: number;
  rubberGlovesMedium: number;
  rubberGlovesLarge: number;
  alcoholSanitiser: number;
  dishWashingLiquid: number;
  paperTowelLong: number;
  sponge: number;
  paperTowelShort: number;
  rollsStickyTape: number;
  otherItems: string;
  frenchFriesBox: string;
  frenchFriesPaper: number;
  paperFoodBags: number;
  forkKnifeSet: number;
  loadedFriesBoxes: number;
  burgerPaper: number;
  woodenFlagSkewers: number;
  printerRolls: number;
  takeawaySauceContainers: number;
  coleslawContainer: number;
  plasticCarryBags: number;
  packagingLabels: number;
  packagingOther: string;
  confirmRollsOrdered: string;
  timezone: string;
  submissionDate: string;
  url: string;
}

export async function importHistoricalData(): Promise<{ success: boolean; imported: number; errors: string[] }> {
  try {
    console.log('Starting import of historical Daily Sales and Stock forms...');
    
    // Read and parse CSV file
    const csvPath = join(process.cwd(), 'attached_assets', 'Daily Sales and Stock forms - Historical_1751584908473.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} historical records to import`);

    let imported = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        // Parse the historical data
        const historicalData: HistoricalFormData = {
          completedBy: record['Who is Completing Form?: '] || '',
          shift: record['Shift? '] || '',
          date: record['Todays Date:'] || '',
          cashAtStart: parseFloat(record['Cash at Start of Shift']) || 0,
          grab: parseFloat(record['Grab?']) || 0,
          foodPanda: parseFloat(record['Food Panda?']) || 0,
          aroiDee: parseFloat(record['Aroi Dee?']) || 0,
          qrScan: parseFloat(record['QR / Scan?']) || 0,
          cashSales: parseFloat(record['Cash Sales?']) || 0,
          totalSales: parseFloat(record['Total Sales Amount:']) || 0,
          salaryWages: parseFloat(record['Salary / Wages']) || 0,
          shopping: parseFloat(record['Shopping']) || 0,
          gasExpense: parseFloat(record['Gas Expense']) || 0,
          description: record['Description of all Items'] || '',
          totalExpenses: parseFloat(record['Total Expenses (Salary+Shopping+Gas+Other)']) || 0,
          totalCashInRegister: parseFloat(record['Total Cash in the Register']) || 0,
          burgerBuns: parseInt(record['How Many Burger Buns In Stock?']) || 0,
          rollsOrdered: parseInt(record['How Many Rolls Ordered?']) || 0,
          burgerMeat: parseInt(record['Weight of Burger Meat']) || 0,
          salad: parseInt(record['Salad ']) || 0,
          tomatos: parseInt(record['Tomatos ']) || 0,
          whiteCabbage: parseInt(record['White Cabbage ']) || 0,
          purpleCabbage: parseInt(record['Purple Cabbage ']) || 0,
          onions: parseInt(record['Onions ']) || 0,
          mayonnaise: parseInt(record['Mayonnaise']) || 0,
          mustard: parseInt(record['Mustard']) || 0,
          cajunSpice: parseInt(record['Cajun Spice ']) || 0,
          dillPickles: parseInt(record['Dill Pickles']) || 0,
          sweetPickles: parseInt(record['Sweet Pickles ']) || 0,
          crispyFriedOnions: parseInt(record['Crispy Fried Onions ']) || 0,
          bbqSauce: parseInt(record['BBQ Sauce (Smokey)']) || 0,
          baconShort: parseInt(record['Bacon Short']) || 0,
          baconLong: parseInt(record['Bacon Long ']) || 0,
          sweetPotatoFries: parseInt(record['Sweet Potato Fries ']) || 0,
          cheese: parseInt(record['Cheese ']) || 0,
          chickenNuggets: parseInt(record['Chicken Nuggets ']) || 0,
          onionRings: parseInt(record['Onion Rings ']) || 0,
          frenchFries: parseInt(record['French Fries ']) || 0,
          jalapenos: parseInt(record['Jalapenos ']) || 0,
          ketchup: parseInt(record['Ketchup']) || 0,
          chiliSauce: parseInt(record['Chili Sauce (Sriracha) ']) || 0,
          oilFryer: parseInt(record['Oil (Fryer)']) || 0,
          bbqSauceBottle: parseInt(record['BBQ Sauce']) || 0,
          pepper: parseInt(record['Pepper']) || 0,
          salt: parseInt(record['Salt ']) || 0,
          coke: parseInt(record['Coke']) || 0,
          cokeZero: parseInt(record['Coke Zero']) || 0,
          schweppesManow: parseInt(record['Schweppes Manow']) || 0,
          fantaStrawberry: parseInt(record['Fanta Strawberry']) || 0,
          orangeFanta: parseInt(record['Orange Fanta']) || 0,
          sprite: parseInt(record['Sprite']) || 0,
          kidsAppleJuice: parseInt(record['Kids Apple Juice']) || 0,
          kidsOrange: parseInt(record['Kids Orange']) || 0,
          sodaWater: parseInt(record['Soda Water']) || 0,
          bottleWater: parseInt(record['Bottle Water']) || 0,
          clearFoodWrap: parseInt(record['Clear Food Wrap']) || 0,
          aluminumFoil: parseInt(record['Aluminum Foil ']) || 0,
          plasticHandGloves: parseInt(record['Plastic Hand Gloves (Meat) ']) || 0,
          rubberGlovesSmall: parseInt(record['Rubber Gloves (Small)']) || 0,
          rubberGlovesMedium: parseInt(record['Rubber Gloves (Medium)']) || 0,
          rubberGlovesLarge: parseInt(record['Rubber Gloves (Large)']) || 0,
          alcoholSanitiser: parseInt(record['Alcohol Sanitiser ']) || 0,
          dishWashingLiquid: parseInt(record['Dish Washing Liquid ']) || 0,
          paperTowelLong: parseInt(record['Paper Towel (Long) ']) || 0,
          sponge: parseInt(record['Sponge (dish washing) ']) || 0,
          paperTowelShort: parseInt(record['Paper Towel (Short) ']) || 0,
          rollsStickyTape: parseInt(record['Rolls Sticky Tape']) || 0,
          otherItems: record['Any Other Items (Not Listed)'] || '',
          frenchFriesBox: record['French Fries Box'] || '',
          frenchFriesPaper: parseInt(record['French Fries Paper']) || 0,
          paperFoodBags: parseInt(record['Paper Food Bags']) || 0,
          forkKnifeSet: parseInt(record['Fork & Knife Set']) || 0,
          loadedFriesBoxes: parseInt(record['Loaded Fries Boxes']) || 0,
          burgerPaper: parseInt(record['Burger Paper (12 x 14) ']) || 0,
          woodenFlagSkewers: parseInt(record['Wooden Flag Skewers']) || 0,
          printerRolls: parseInt(record['Printer Rolls']) || 0,
          takeawaySauceContainers: parseInt(record['Takeaway Sauce Containers &']) || 0,
          coleslawContainer: parseInt(record['Coleslaw Container']) || 0,
          plasticCarryBags: parseInt(record['Plastic Carry Bags']) || 0,
          packagingLabels: parseInt(record['Packaging Labels']) || 0,
          packagingOther: record['Packaging Other (Not Listed Above)'] || '',
          confirmRollsOrdered: record['Confirm that you have ordered Rolls?'] || '',
          timezone: record['Timezone'] || '',
          submissionDate: record['Submission Date'] || '',
          url: record['URL'] || ''
        };

        // Convert to Daily Stock Sales format - only essential fields
        const dailyStockSales = {
          completedBy: historicalData.completedBy,
          shiftType: historicalData.shift,
          shiftDate: new Date(historicalData.date),
          startingCash: historicalData.cashAtStart.toString(),
          endingCash: historicalData.totalCashInRegister.toString(),
          grabSales: historicalData.grab.toString(),
          foodPandaSales: historicalData.foodPanda.toString(),
          aroiDeeSales: historicalData.aroiDee.toString(),
          qrScanSales: historicalData.qrScan.toString(),
          cashSales: historicalData.cashSales.toString(),
          totalSales: historicalData.totalSales.toString(),
          salaryWages: historicalData.salaryWages.toString(),
          shopping: historicalData.shopping.toString(),
          gasExpense: historicalData.gasExpense.toString(),
          totalExpenses: historicalData.totalExpenses.toString(),
          expenseDescription: historicalData.description,
          burgerBunsStock: historicalData.burgerBuns,
          rollsOrderedCount: historicalData.rollsOrdered,
          meatWeight: historicalData.burgerMeat.toString(),
          drinkStockCount: 0,
          freshFood: JSON.stringify({}),
          frozenFood: JSON.stringify({}),
          shelfItems: JSON.stringify({}),
          wageEntries: JSON.stringify([]),
          shoppingEntries: JSON.stringify([{
            item: historicalData.otherItems || "Historical shopping items",
            amount: historicalData.shopping,
            notes: historicalData.description || "",
            shop: "General Supplier"
          }]),
          rollsOrderedConfirmed: historicalData.confirmRollsOrdered.toLowerCase().includes('yes'),
          isDraft: false
        };

        // Store in the system
        await storage.createDailyStockSales(dailyStockSales);
        
        console.log(`Imported: ${historicalData.completedBy} - ${historicalData.date} - ฿${historicalData.totalSales}`);
        imported++;

      } catch (error) {
        const errorMsg = `Failed to import record for ${record['Todays Date:']}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`✅ Historical data import completed: ${imported} records imported, ${errors.length} errors`);
    return { success: true, imported, errors };

  } catch (error) {
    console.error('❌ Failed to import historical data:', error);
    return { success: false, imported: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}