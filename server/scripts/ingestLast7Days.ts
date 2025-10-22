import { ingestPosForBusinessDate } from '../services/loyverseIngest';

async function ingestLast7Days() {
  const storeId = process.env.LOYVERSE_STORE_ID;
  if (!storeId) {
    console.error('❌ LOYVERSE_STORE_ID environment variable not set');
    process.exit(1);
  }

  console.log('🔄 Starting real POS data ingestion for last 7 days...\n');
  console.log(`   Store ID: ${storeId}\n`);

  const today = new Date();
  const results = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const businessDate = date.toISOString().split('T')[0];

    try {
      const totals = await ingestPosForBusinessDate(storeId, businessDate);
      results.push({ date: businessDate, success: true, totals });
    } catch (error) {
      console.error(`   ❌ Error for ${businessDate}:`, error);
      results.push({ date: businessDate, success: false, error });
    }

    console.log('');
  }

  console.log('📊 Summary:\n');
  for (const result of results) {
    if (result.success && result.totals) {
      console.log(`   ✅ ${result.date}: ${result.totals.grand} THB (${result.totals.cash} cash, ${result.totals.qr} QR)`);
    } else {
      console.log(`   ❌ ${result.date}: Failed`);
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎉 Completed: ${successCount}/${results.length} days ingested successfully`);
}

ingestLast7Days()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
