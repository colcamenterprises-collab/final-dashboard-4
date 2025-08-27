// server/services/analytics/processReceiptData.js - Simple analytics processor
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function processReceiptAnalytics() {
  try {
    // Get all receipts from the last 48 hours
    const since = new Date(Date.now() - 48 * 3600_000);
    const receipts = await prisma.receipt.findMany({
      where: { 
        provider: 'LOYVERSE',
        createdAtUTC: { gte: since } 
      },
      include: { items: true, payments: true },
      orderBy: { createdAtUTC: 'desc' }
    });

    console.log(`📊 Processing ${receipts.length} receipts from last 48 hours...`);

    // Group receipts by date for daily analysis
    const dailyStats = {};
    let totalRevenue = 0;
    let totalReceipts = receipts.length;

    // Payment method breakdown
    const paymentBreakdown = {
      CASH: 0,
      CARD: 0, 
      QR: 0,
      OTHER: 0
    };

    // Top selling items
    const itemStats = {};

    for (const receipt of receipts) {
      const dateKey = receipt.createdAtUTC.toISOString().split('T')[0];
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          revenue: 0,
          receipts: 0,
          items: 0
        };
      }

      // Add to daily totals
      dailyStats[dateKey].revenue += receipt.total;
      dailyStats[dateKey].receipts += 1;
      dailyStats[dateKey].items += receipt.items.length;
      
      totalRevenue += receipt.total;

      // Process payments
      for (const payment of receipt.payments) {
        const method = payment.method || 'OTHER';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + payment.amount;
      }

      // Process items
      for (const item of receipt.items) {
        const itemName = item.name || 'Unknown';
        if (!itemStats[itemName]) {
          itemStats[itemName] = { qty: 0, revenue: 0 };
        }
        itemStats[itemName].qty += item.qty;
        itemStats[itemName].revenue += item.total;
      }
    }

    // Calculate top 5 items by quantity and revenue
    const topItemsByQty = Object.entries(itemStats)
      .sort(([,a], [,b]) => b.qty - a.qty)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }));

    const topItemsByRevenue = Object.entries(itemStats)
      .sort(([,a], [,b]) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, qty: stats.qty, revenue: stats.revenue }));

    // Create comprehensive analytics summary
    const analytics = {
      period: {
        start: since.toISOString(),
        end: new Date().toISOString()
      },
      totals: {
        revenue: totalRevenue,
        receipts: totalReceipts,
        averageTicket: totalReceipts > 0 ? Math.round(totalRevenue / totalReceipts) : 0
      },
      paymentBreakdown,
      topItemsByQty,
      topItemsByRevenue,
      dailyBreakdown: Object.values(dailyStats)
    };

    // Print summary
    console.log('\\n📈 ANALYTICS SUMMARY');
    console.log('===================');
    console.log(`Total Revenue: ฿${(analytics.totals.revenue / 100).toFixed(2)}`);
    console.log(`Total Receipts: ${analytics.totals.receipts}`);
    console.log(`Average Ticket: ฿${(analytics.totals.averageTicket / 100).toFixed(2)}`);
    
    console.log('\\n💳 Payment Methods:');
    Object.entries(paymentBreakdown).forEach(([method, amount]) => {
      if (amount > 0) {
        console.log(`  ${method}: ฿${(amount / 100).toFixed(2)}`);
      }
    });

    console.log('\\n🏆 Top 5 Items by Quantity:');
    topItemsByQty.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.name} - ${item.qty} sold (฿${(item.revenue / 100).toFixed(2)})`);
    });

    console.log('\\n💰 Top 5 Items by Revenue:');
    topItemsByRevenue.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.name} - ฿${(item.revenue / 100).toFixed(2)} (${item.qty} sold)`);
    });

    console.log('\\n📅 Daily Breakdown:');
    analytics.dailyBreakdown.forEach(day => {
      console.log(`  ${day.date}: ฿${(day.revenue / 100).toFixed(2)} (${day.receipts} receipts, ${day.items} items)`);
    });

    return analytics;

  } catch (error) {
    console.error('❌ Analytics processing failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processReceiptAnalytics()
    .then(() => {
      console.log('\\n✅ Analytics processing completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to process analytics:', error);
      process.exit(1);
    });
}

export { processReceiptAnalytics };