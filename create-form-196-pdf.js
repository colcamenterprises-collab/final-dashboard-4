// Generate PDF for Form 196 specifically
import fs from 'fs';
import PDFDocument from 'pdfkit';

// Form 196 data from the logs
const form196Data = {
  id: 196,
  completedBy: "Ale",
  shiftType: "night", 
  shiftDate: "2025-08-01",
  startingCash: 2500.00,
  grabSales: 8186.00,
  aroiDeeSales: 0.00,
  qrScanSales: 2402.00,
  cashSales: 5316.00,
  totalSales: 15904.00,
  wages: [
    {name: "Ael", amount: 800, type: "Wages"},
    {name: "Nikki", amount: 700, type: "Wages"}, 
    {name: "Mamm", amount: 600, type: "Wages"}
  ],
  shopping: [
    {item: "Foil", amount: 74, shop: ""},
    {item: "Transfer", amount: 15, shop: ""}
  ],
  gasExpense: 0.00,
  totalExpenses: 2189.00,
  endingCash: 5627.00,
  bankedAmount: 3127.00,
  inventory: {
    "Burger Rolls Stock": 10,
    "Meat Stock": 2520,
    "Coke": 9,
    "Coke Zero": 11,
    "Sprite": 6,
    "Schweppes Manow": 11,
    "Fanta Orange": 9,
    "Fanta Strawberry": 8,
    "Soda Water": 5,
    "Bottled Water": 10,
    "Kids Juice Orange": 7,
    "Kids Juice Apple": 24,
    "Salad (Iceberg Lettuce)": 2,
    "Burger Bun": 50,
    "Onions (small bags)": 1,
    "Cheese": 2,
    "Bacon Long": 2,
    "French Fries 7mm": 3,
    "Chicken Nuggets": 1,
    "Chicken Fillets": 1,
    "Sweet Potato Fries": 2,
    "Mustard": 1,
    "Mayonnaise": 3,
    "Tomato Sauce": 1,
    "Oil (Fryer)": 1,
    "Plastic Meat Gloves": 2,
    "French Fries Box": 0
  }
};

function createForm196PDF() {
  const doc = new PDFDocument({ margin: 40 });
  const filename = `form-196-daily-shift-report.pdf`;
  
  // Stream to file
  doc.pipe(fs.createWriteStream(filename));
  
  // Header
  doc.fontSize(20).font('Helvetica-Bold')
     .text('SMASH BROTHERS BURGERS', 40, 40);
  
  doc.fontSize(16).font('Helvetica')
     .text('Daily Shift Report', 40, 70)
     .fontSize(12)
     .text(`Form ID: ${form196Data.id}`, 40, 95)
     .text(`Date: ${form196Data.shiftDate}`, 40, 110)
     .text(`Shift: ${form196Data.shiftType}`, 40, 125)
     .text(`Completed by: ${form196Data.completedBy}`, 40, 140);

  let y = 170;

  // Sales Information
  doc.fontSize(14).font('Helvetica-Bold')
     .text('SALES BREAKDOWN', 40, y);
  y += 25;
  
  doc.fontSize(11).font('Helvetica')
     .text(`Grab Sales: ฿${form196Data.grabSales.toFixed(2)}`, 40, y)
     .text(`QR Scan Sales: ฿${form196Data.qrScanSales.toFixed(2)}`, 200, y)
     .text(`Cash Sales: ฿${form196Data.cashSales.toFixed(2)}`, 350, y);
  y += 20;
  
  doc.text(`Aroi Dee Sales: ฿${form196Data.aroiDeeSales.toFixed(2)}`, 40, y)
     .text(`TOTAL SALES: ฿${form196Data.totalSales.toFixed(2)}`, 200, y);
  y += 40;

  // Cash Management
  doc.fontSize(14).font('Helvetica-Bold')
     .text('CASH MANAGEMENT', 40, y);
  y += 25;
  
  doc.fontSize(11).font('Helvetica')
     .text(`Starting Cash: ฿${form196Data.startingCash.toFixed(2)}`, 40, y)
     .text(`Ending Cash: ฿${form196Data.endingCash.toFixed(2)}`, 200, y)
     .text(`Banked Amount: ฿${form196Data.bankedAmount.toFixed(2)}`, 350, y);
  y += 40;

  // Staff Wages
  doc.fontSize(14).font('Helvetica-Bold')
     .text('STAFF WAGES', 40, y);
  y += 25;
  
  form196Data.wages.forEach(wage => {
    doc.fontSize(11).font('Helvetica')
       .text(`${wage.name}: ฿${wage.amount.toFixed(2)}`, 40, y);
    y += 15;
  });
  y += 15;

  // Shopping Expenses
  doc.fontSize(14).font('Helvetica-Bold')
     .text('SHOPPING EXPENSES', 40, y);
  y += 25;
  
  form196Data.shopping.forEach(item => {
    doc.fontSize(11).font('Helvetica')
       .text(`${item.item}: ฿${item.amount.toFixed(2)}`, 40, y);
    y += 15;
  });
  
  doc.text(`TOTAL EXPENSES: ฿${form196Data.totalExpenses.toFixed(2)}`, 40, y);
  y += 40;

  // Start new page for inventory
  doc.addPage();
  y = 40;

  // Inventory Section
  doc.fontSize(16).font('Helvetica-Bold')
     .text('INVENTORY STOCK LEVELS', 40, y);
  y += 30;

  // Drinks
  doc.fontSize(14).font('Helvetica-Bold')
     .text('BEVERAGES', 40, y);
  y += 20;
  
  const drinks = ['Coke', 'Coke Zero', 'Sprite', 'Schweppes Manow', 'Fanta Orange', 
                  'Fanta Strawberry', 'Soda Water', 'Bottled Water', 'Kids Juice Orange', 'Kids Juice Apple'];
  
  drinks.forEach(drink => {
    if (form196Data.inventory[drink] !== undefined) {
      doc.fontSize(10).font('Helvetica')
         .text(`${drink}: ${form196Data.inventory[drink]}`, 40, y);
      y += 12;
    }
  });
  y += 20;

  // Food Items
  doc.fontSize(14).font('Helvetica-Bold')
     .text('FOOD INVENTORY', 40, y);
  y += 20;
  
  const foodItems = ['Burger Rolls Stock', 'Meat Stock', 'Salad (Iceberg Lettuce)', 
                     'Burger Bun', 'Onions (small bags)', 'Cheese', 'Bacon Long',
                     'French Fries 7mm', 'Chicken Nuggets', 'Chicken Fillets', 'Sweet Potato Fries'];
  
  foodItems.forEach(item => {
    if (form196Data.inventory[item] !== undefined) {
      doc.fontSize(10).font('Helvetica')
         .text(`${item}: ${form196Data.inventory[item]}`, 40, y);
      y += 12;
    }
  });
  y += 20;

  // Condiments & Supplies
  doc.fontSize(14).font('Helvetica-Bold')
     .text('CONDIMENTS & SUPPLIES', 40, y);
  y += 20;
  
  const supplies = ['Mustard', 'Mayonnaise', 'Tomato Sauce', 'Oil (Fryer)', 
                    'Plastic Meat Gloves', 'French Fries Box'];
  
  supplies.forEach(item => {
    if (form196Data.inventory[item] !== undefined) {
      doc.fontSize(10).font('Helvetica')
         .text(`${item}: ${form196Data.inventory[item]}`, 40, y);
      y += 12;
    }
  });

  // Footer
  doc.fontSize(8).font('Helvetica')
     .text(`Generated: ${new Date().toLocaleString()}`, 40, doc.page.height - 50)
     .text('Smash Brothers Burgers - Daily Operations Report', 40, doc.page.height - 35);

  doc.end();
  console.log(`PDF created: ${filename}`);
  return filename;
}

// Generate the PDF
createForm196PDF();