import { DateTime } from 'luxon';
import { storeShiftSnapshot } from '../services/loyverseService';

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const fromValue = arg('from');
  const toValue = arg('to', fromValue);
  if (!fromValue || !toValue) throw new Error('Use --from YYYY-MM-DD --to YYYY-MM-DD');

  let cursor = DateTime.fromISO(fromValue, { zone: 'Asia/Bangkok' }).startOf('day');
  const end = DateTime.fromISO(toValue, { zone: 'Asia/Bangkok' }).startOf('day');
  if (!cursor.isValid || !end.isValid || end < cursor) throw new Error('Invalid rebuild date range');

  let rebuilt = 0;
  while (cursor <= end) {
    const date = cursor.toISODate()!;
    process.stdout.write(`${date} ... `);
    await storeShiftSnapshot(date);
    console.log('OK');
    rebuilt += 1;
    cursor = cursor.plus({ days: 1 });
  }

  console.log(`REBUILD COMPLETE: ${rebuilt} shift(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
