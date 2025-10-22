import { PrismaClient } from '@prisma/client';
import { addDays, format, startOfDay } from 'date-fns';

const prisma = new PrismaClient();

async function backdateData() {
  console.log('🔄 Starting data backdating process...\n');

  const today = startOfDay(new Date());
  const days = 7;

  for (let i = days - 1; i >= 0; i--) {
    const businessDate = addDays(today, -i);
    const formattedDate = format(businessDate, 'dd/MM/yyyy');
    
    console.log(`📅 Processing ${formattedDate}...`);

    // Create a PosBatch for this date
    const batch = await prisma.posBatch.create({
      data: {
        id: `BACKDATE_${format(businessDate, 'yyyy-MM-dd')}`,
        createdAt: businessDate,
        title: `Backdate Shift ${formattedDate}`,
        shiftStart: new Date(businessDate.getTime() + 17 * 60 * 60 * 1000), // 5 PM
        shiftEnd: new Date(businessDate.getTime() + 27 * 60 * 60 * 1000), // 3 AM next day
      },
    });

    // Generate realistic sales figures (varying between 8000-15000 THB)
    const baseSales = 8000 + Math.floor(Math.random() * 7000);
    const cashSales = Math.floor(baseSales * 0.4);
    const qrSales = Math.floor(baseSales * 0.35);
    const grabSales = Math.floor(baseSales * 0.15);
    const otherSales = baseSales - cashSales - qrSales - grabSales;
    const netSales = baseSales;

    // Generate expense figures (10-15% of sales)
    const shoppingExpense = Math.floor(baseSales * (0.05 + Math.random() * 0.05));
    const wagesExpense = Math.floor(baseSales * (0.03 + Math.random() * 0.03));
    const otherExpense = Math.floor(baseSales * (0.02 + Math.random() * 0.02));

    // Create PosShiftReport
    const posShiftReport = await prisma.posShiftReport.create({
      data: {
        batchId: batch.id,
        grossSales: netSales,
        discounts: 0,
        netSales: netSales,
        cashInDrawer: cashSales,
        cashSales: cashSales,
        qrSales: qrSales,
        otherSales: otherSales,
        receiptCount: Math.floor(baseSales / 250), // ~250 THB per receipt
        
        // Daily Review fields
        storeId: 'MAIN_STORE',
        openedAt: batch.shiftStart,
        closedAt: batch.shiftEnd,
        businessDate: businessDate,
        cashTotal: cashSales,
        qrTotal: qrSales,
        grabTotal: grabSales,
        otherTotal: otherSales,
        grandTotal: baseSales,
        shoppingTotal: shoppingExpense,
        wagesTotal: wagesExpense,
        otherExpense: otherExpense,
        startingCash: 3000, // Standard starting cash
      },
    });

    // Create DailySales form
    const dailySales = await prisma.dailySales.create({
      data: {
        shiftDate: formattedDate,
        status: 'submitted',
        completedBy: 'Manager',
        
        // Sales
        cashSales: cashSales + Math.floor((Math.random() - 0.5) * 200), // Add small variance
        qrSales: qrSales + Math.floor((Math.random() - 0.5) * 200),
        grabSales: grabSales + Math.floor((Math.random() - 0.5) * 100),
        aroiSales: 0,
        otherSales: otherSales + Math.floor((Math.random() - 0.5) * 100),
        totalSales: baseSales + Math.floor((Math.random() - 0.5) * 300),
        
        // Cash management
        startingCash: 3000,
        endingCash: 3000 + cashSales + Math.floor((Math.random() - 0.5) * 100),
        cashBanked: cashSales + Math.floor((Math.random() - 0.5) * 100),
        closingCash: 3000,
        qrTransfer: qrSales + Math.floor((Math.random() - 0.5) * 200),
        
        // Expenses
        shoppingTotal: shoppingExpense + Math.floor((Math.random() - 0.5) * 200),
        wagesTotal: wagesExpense + Math.floor((Math.random() - 0.5) * 100),
        othersTotal: otherExpense + Math.floor((Math.random() - 0.5) * 100),
        otherExpense: otherExpense + Math.floor((Math.random() - 0.5) * 100),
        totalExpenses: shoppingExpense + wagesExpense + otherExpense,
        
        // Daily Review fields
        storeId: 'MAIN_STORE',
        businessDate: businessDate,
        submittedAtISO: new Date(businessDate.getTime() + 28 * 60 * 60 * 1000), // 4 AM next day
      },
    });

    console.log(`  ✅ Created POS report: ${netSales} THB`);
    console.log(`  ✅ Created Daily Sales form: ${baseSales} THB`);
    console.log(`  💰 Variance: ~${Math.abs(netSales - baseSales)} THB\n`);
  }

  console.log('✅ Backdating complete!\n');
  
  // Summary
  const posCount = await prisma.posShiftReport.count({
    where: { businessDate: { not: null } }
  });
  const salesCount = await prisma.dailySales.count({
    where: { 
      businessDate: { not: null },
      deletedAt: null
    }
  });
  
  console.log(`📊 Summary:`);
  console.log(`   POS Reports with businessDate: ${posCount}`);
  console.log(`   Daily Sales with businessDate: ${salesCount}`);
  console.log(`\n🎉 Daily Review is now ready with ${days} days of data!`);
}

backdateData()
  .catch((e) => {
    console.error('❌ Error backdating data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
