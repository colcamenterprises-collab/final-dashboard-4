import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const before = await client.query(`
      SELECT
        (SELECT count(*)::int FROM bank_txn) AS bank_txn_count,
        (SELECT count(*)::int FROM bank_import_batch) AS batch_count,
        (SELECT count(*)::int FROM expenses WHERE source = 'BANK_UPLOAD') AS approved_business_expense_count,
        (SELECT count(*)::int FROM expenses WHERE source <> 'BANK_UPLOAD' OR source IS NULL) AS non_bank_expense_count
    `);

    const approvedBusinessExpenses = before.rows[0]?.approved_business_expense_count ?? 0;
    const nonBankExpenses = before.rows[0]?.non_bank_expense_count ?? 0;

    // Review rows are disposable workflow state. Approved expenses are already copied into
    // the canonical expenses table and are intentionally preserved.
    const deletedTxns = await client.query('DELETE FROM bank_txn RETURNING id');
    const deletedBatches = await client.query('DELETE FROM bank_import_batch RETURNING id');

    await client.query('COMMIT');

    const after = await client.query(`
      SELECT
        (SELECT count(*)::int FROM bank_txn) AS bank_txn_count,
        (SELECT count(*)::int FROM bank_import_batch) AS batch_count,
        (SELECT count(*)::int FROM expenses WHERE source = 'BANK_UPLOAD') AS approved_business_expense_count,
        (SELECT count(*)::int FROM expenses WHERE source <> 'BANK_UPLOAD' OR source IS NULL) AS non_bank_expense_count
    `);

    const afterRow = after.rows[0] || {};

    if (Number(afterRow.bank_txn_count) !== 0 || Number(afterRow.batch_count) !== 0) {
      throw new Error('Repair verification failed: review queue tables are not empty');
    }

    if (Number(afterRow.approved_business_expense_count) !== Number(approvedBusinessExpenses)) {
      throw new Error('Repair verification failed: approved business expense count changed');
    }

    if (Number(afterRow.non_bank_expense_count) !== Number(nonBankExpenses)) {
      throw new Error('Repair verification failed: non-bank/shift expense count changed');
    }

    console.log(JSON.stringify({
      ok: true,
      deletedBankReviewTransactions: deletedTxns.rowCount,
      deletedBankImportBatches: deletedBatches.rowCount,
      preservedApprovedBusinessExpenses: Number(afterRow.approved_business_expense_count),
      preservedOtherExpenses: Number(afterRow.non_bank_expense_count),
      message: 'Bank import review state reset. Existing approved Business Expenses and Shift Expenses were preserved.',
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[FINAL_BANK_IMPORT_REPAIR_FAILED]', error);
  process.exit(1);
});
