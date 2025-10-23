import { ingestPosForBusinessDate } from '../services/loyverseIngest';

async function ingestSingleDate() {
  const storeId = process.env.LOYVERSE_STORE_ID || 'bcacbb19-db02-4fe8-91fc-e5a9d8116f14';
  const date = process.argv[2] || '2025-10-22';

  console.log(`📥 Ingesting ${date} from Loyverse...`);
  
  try {
    const result = await ingestPosForBusinessDate(storeId, date);
    console.log(`✅ Success: ฿${result.sales.grand} sales, ฿${result.expenses.shopping + result.expenses.wages + result.expenses.other} expenses`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

ingestSingleDate()
  .catch((e) => {
    console.error('❌ Fatal:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
