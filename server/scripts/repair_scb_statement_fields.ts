import 'dotenv/config';
import pg from 'pg';
import { planScbStatementFieldRepair } from '../services/scbStatementFieldRepair';

type RepairRow = {
  id: string;
  batch_id: string;
  source: string;
  posted_at: Date;
  amount_thb: string;
  description: string;
  supplier: string | null;
  notes: string | null;
  status: string;
  dedupe_key: string;
  raw: Record<string, unknown>;
};

async function main() {
  const apply = process.argv.includes('--apply');
  const batchId = process.argv.find((argument) => argument.startsWith('--batch-id='))?.slice('--batch-id='.length) || null;
  const expectedEligibleValue = process.argv.find((argument) => argument.startsWith('--expect-eligible='))?.slice('--expect-eligible='.length);
  const expectedScannedValue = process.argv.find((argument) => argument.startsWith('--expect-scanned='))?.slice('--expect-scanned='.length);
  const expectedEligible = expectedEligibleValue === undefined ? null : Number(expectedEligibleValue);
  const expectedScanned = expectedScannedValue === undefined ? null : Number(expectedScannedValue);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }
  if (expectedEligible !== null && (!Number.isInteger(expectedEligible) || expectedEligible < 0)) {
    throw new Error('--expect-eligible must be a non-negative integer.');
  }
  if (expectedScanned !== null && (!Number.isInteger(expectedScanned) || expectedScanned < 0)) {
    throw new Error('--expect-scanned must be a non-negative integer.');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  let scanned = 0;
  let eligible = 0;
  let repaired = 0;
  let alreadyCorrect = 0;
  let skippedEdited = 0;
  let skippedNonPending = 0;
  let skippedUnexpected = 0;

  try {
    await client.query('BEGIN');

  const result = await client.query<RepairRow>(`
    SELECT
      transaction.id,
      transaction.batch_id,
      batch.source,
      transaction.posted_at,
      transaction.amount_thb,
      transaction.description,
      transaction.supplier,
      transaction.notes,
      transaction.status,
      transaction.dedupe_key,
      transaction.raw
    FROM bank_txn transaction
    JOIN bank_import_batch batch ON batch.id = transaction.batch_id
    WHERE transaction.raw->>'layout' = 'scb_fixed_width'
      AND ($1::text IS NULL OR transaction.batch_id = $1)
    ORDER BY transaction.posted_at, transaction.id
    FOR UPDATE OF transaction
  `, [batchId]);

  scanned = result.rows.length;
  const repairs: Array<{
    row: RepairRow;
    next: {
      description: string;
      supplier: string | null;
      notes: string | null;
      dedupeKey: string;
      raw: Record<string, unknown>;
    };
  }> = [];

  for (const row of result.rows) {
    const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};
    const plan = planScbStatementFieldRepair({
      source: row.source,
      postedAt: new Date(row.posted_at),
      amountTHB: Number(row.amount_thb),
      description: row.description,
      supplier: row.supplier,
      notes: row.notes,
      status: row.status,
      dedupeKey: row.dedupe_key,
      raw,
    });

    if (plan.outcome === 'skip_non_pending') skippedNonPending += 1;
    if (plan.outcome === 'skip_edited') skippedEdited += 1;
    if (plan.outcome === 'skip_unexpected') skippedUnexpected += 1;
    if (plan.outcome === 'already_correct') alreadyCorrect += 1;
    if (plan.outcome !== 'repair') continue;

    eligible += 1;
    repairs.push({ row, next: plan.next });
  }

  if (expectedScanned !== null && scanned !== expectedScanned) {
    throw new Error(`Scanned row count mismatch: expected=${expectedScanned}, actual=${scanned}.`);
  }
  if (expectedEligible !== null && eligible !== expectedEligible) {
    throw new Error(`Eligible row count mismatch: expected=${expectedEligible}, actual=${eligible}.`);
  }

  if (apply) {
    for (const { row, next } of repairs) {

      const updated = await client.query(`
      UPDATE bank_txn
      SET
        description = $2,
        supplier = $3,
        notes = $4,
        dedupe_key = $5,
        raw = $6::jsonb
      WHERE id = $1
        AND status = 'pending'
        AND description = $7
    `, [
      row.id,
      next.description,
      next.supplier,
      next.notes,
      next.dedupeKey,
      JSON.stringify(next.raw),
      row.description,
    ]);

      if (updated.rowCount !== 1) {
        throw new Error(`Concurrent change prevented repair of bank_txn ${row.id}.`);
      }

      await client.query(`
      UPDATE bank_deposit
      SET description = $2, updated_at = now()
      WHERE bank_txn_id = $1
        AND description = $3
    `, [row.id, next.description, row.description]);

      repaired += 1;
    }
  }

  if (apply) await client.query('COMMIT');
  else await client.query('ROLLBACK');

  console.table([{
    mode: apply ? 'apply' : 'dry-run',
    batchId: batchId || 'all',
    scanned,
    eligible,
    repaired,
    alreadyCorrect,
    skippedEdited,
    skippedNonPending,
    skippedUnexpected,
  }]);

  if (apply && repaired !== eligible) {
    throw new Error(`Repair count mismatch: eligible=${eligible}, repaired=${repaired}.`);
  }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[SCB_STATEMENT_FIELD_REPAIR_FAILED]', error);
  process.exitCode = 1;
});
