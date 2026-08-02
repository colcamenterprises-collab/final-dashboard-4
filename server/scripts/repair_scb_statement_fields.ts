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
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
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
    ORDER BY transaction.posted_at, transaction.id
    FOR UPDATE OF transaction
  `);

  scanned = result.rows.length;

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
    if (!apply) continue;

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
      plan.next.description,
      plan.next.supplier,
      plan.next.notes,
      plan.next.dedupeKey,
      JSON.stringify(plan.next.raw),
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
    `, [row.id, plan.next.description, row.description]);

    repaired += 1;
  }

  if (apply) await client.query('COMMIT');
  else await client.query('ROLLBACK');

  console.table([{
    mode: apply ? 'apply' : 'dry-run',
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
