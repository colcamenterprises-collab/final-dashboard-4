import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DateTime } from 'luxon';
import { db } from '../lib/prisma';
import { parseExternalEvidenceCsv } from '../finance/externalEvidenceImport';

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function required(name: string) {
  const value = arg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function isoOrNull(value?: string) {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone: 'Asia/Bangkok' });
  if (!dt.isValid) throw new Error(`Invalid ISO date/time: ${value}`);
  return dt.toUTC().toISO();
}

async function main() {
  const file = path.resolve(required('file'));
  const businessId = arg('business', 'sbb-rawai')!;
  const providerKey = arg('provider-key', 'grabfood')!;
  const evidenceName = arg('evidence-name', providerKey === 'grabfood' ? 'GrabFood Transaction Report' : `${providerKey} Transaction Report`)!;
  const revenueSourceName = arg('revenue-source', providerKey === 'grabfood' ? 'Delivery Marketplace - GrabFood' : `External Revenue - ${providerKey}`)!;
  const timezone = arg('timezone', 'Asia/Bangkok')!;
  const importedBy = arg('imported-by', 'owner-terminal')!;
  const coverageStart = isoOrNull(arg('coverage-start'));
  const coverageEnd = isoOrNull(arg('coverage-end'));
  const dryRun = hasFlag('dry-run');

  const buffer = fs.readFileSync(file);
  const sourceSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const parsed = parseExternalEvidenceCsv(buffer, { timezone, providerKey });

  const totals = parsed.accepted.reduce(
    (acc, row) => {
      acc.gross += row.grossSales ?? 0;
      acc.net += row.netSales ?? 0;
      acc.deductions += row.otherDeduction ?? 0;
      return acc;
    },
    { gross: 0, net: 0, deductions: 0 },
  );

  const dates = parsed.accepted.map((row) => row.transactionAt.getTime());
  const periodStart = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
  const periodEnd = dates.length ? new Date(Math.max(...dates)).toISOString() : null;

  console.log('External financial evidence import');
  console.log(`File: ${file}`);
  console.log(`Provider: ${providerKey}`);
  console.log(`Business: ${businessId}`);
  console.log(`Rows: ${parsed.accepted.length} accepted, ${parsed.rejected.length} rejected, ${parsed.skippedSummaryRows} summary rows skipped`);
  console.log(`Period: ${periodStart ?? 'n/a'} -> ${periodEnd ?? 'n/a'}`);
  console.log(`Coverage: ${coverageStart ?? 'derived'} -> ${coverageEnd ?? 'derived'}`);
  console.log(`Totals: gross ${totals.gross.toFixed(2)}, net ${totals.net.toFixed(2)}, deductions ${totals.deductions.toFixed(2)}`);

  if (parsed.rejected.length) {
    console.log('Rejected examples:');
    console.log(JSON.stringify(parsed.rejected.slice(0, 10), null, 2));
  }

  if (!parsed.accepted.length) throw new Error('No valid financial transactions were found');
  if (parsed.rejected.length > Math.max(5, Math.floor(parsed.accepted.length * 0.02))) {
    throw new Error(`Import rejected ${parsed.rejected.length} rows; review mapping before commit`);
  }
  if (dryRun) {
    console.log('DRY RUN COMPLETE - database unchanged');
    return;
  }

  const prisma = db();
  const revenueRows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO financial_revenue_sources (business_id,name,channel_type,currency,active,settlement_method)
     VALUES ($1,$2,'delivery_marketplace','THB',true,'provider_settlement')
     ON CONFLICT (business_id,name) DO UPDATE SET active=true,updated_at=NOW()
     RETURNING id`,
    businessId,
    revenueSourceName,
  );
  const revenueSourceId = revenueRows[0].id;

  const evidenceRows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO financial_evidence_sources (business_id,name,evidence_type,provider_key,integration_type,active,configuration_json)
     VALUES ($1,$2,'delivery_marketplace_statement',$3,'manual_import',true,$4::jsonb)
     ON CONFLICT (business_id,name) DO UPDATE
       SET provider_key=EXCLUDED.provider_key,active=true,configuration_json=EXCLUDED.configuration_json,updated_at=NOW()
     RETURNING id`,
    businessId,
    evidenceName,
    providerKey,
    JSON.stringify({ timezone, authority: ['promotion', 'fees', 'settlement', 'external_gross'] }),
  );
  const evidenceSourceId = evidenceRows[0].id;

  await prisma.$executeRawUnsafe(
    `INSERT INTO financial_source_evidence_links
       (revenue_source_id,evidence_source_id,authority_role,priority,required_for_close,matching_rules_json)
     VALUES ($1::uuid,$2::uuid,'external',10,true,$3::jsonb)
     ON CONFLICT (revenue_source_id,evidence_source_id,authority_role)
     DO UPDATE SET priority=EXCLUDED.priority,required_for_close=EXCLUDED.required_for_close,matching_rules_json=EXCLUDED.matching_rules_json`,
    revenueSourceId,
    evidenceSourceId,
    JSON.stringify({ order_key: 'external_order_id', timezone }),
  );

  const batchRows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO financial_import_batches
       (business_id,evidence_source_id,original_filename,source_sha256,period_start,period_end,coverage_start,coverage_end,imported_by,row_count,accepted_count,rejected_count,status,validation_summary_json)
     VALUES ($1,$2::uuid,$3,$4,$5::timestamptz,$6::timestamptz,$7::timestamptz,$8::timestamptz,$9,$10,$11,$12,'validated',$13::jsonb)
     ON CONFLICT (evidence_source_id,source_sha256) DO NOTHING
     RETURNING id`,
    businessId,
    evidenceSourceId,
    path.basename(file),
    sourceSha256,
    periodStart,
    periodEnd,
    coverageStart ?? periodStart,
    coverageEnd ?? periodEnd,
    importedBy,
    parsed.accepted.length + parsed.rejected.length + parsed.skippedSummaryRows,
    parsed.accepted.length,
    parsed.rejected.length,
    JSON.stringify({
      providerKey,
      headers: parsed.headers,
      skippedSummaryRows: parsed.skippedSummaryRows,
      totals,
      rejected: parsed.rejected.slice(0, 50),
    }),
  );

  if (!batchRows.length) {
    throw new Error('This exact evidence file has already been imported; duplicate import blocked');
  }
  const batchId = batchRows[0].id;

  let inserted = 0;
  let duplicates = 0;
  for (const row of parsed.accepted) {
    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO financial_transactions (
        business_id,revenue_source_id,evidence_source_id,import_batch_id,
        external_transaction_id,external_order_id,transaction_type,transaction_at,currency,
        gross_sales,merchant_funded_discount,provider_funded_discount,refund_amount,net_sales,
        commission,platform_fee,payment_fee,tax,tips,other_deduction,expected_settlement,
        original_record_json,source_record_hash
      ) VALUES (
        $1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::timestamptz,'THB',
        $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22
      ) ON CONFLICT (evidence_source_id,source_record_hash) DO NOTHING`,
      businessId,
      revenueSourceId,
      evidenceSourceId,
      batchId,
      row.externalTransactionId,
      row.externalOrderId,
      row.transactionType,
      row.transactionAt.toISOString(),
      row.grossSales,
      row.merchantFundedDiscount,
      row.providerFundedDiscount,
      row.refundAmount,
      row.netSales,
      row.commission,
      row.platformFee,
      row.paymentFee,
      row.tax,
      row.tips,
      row.otherDeduction,
      row.expectedSettlement,
      JSON.stringify(row.originalRecord),
      row.sourceRecordHash,
    );
    if (Number(result) > 0) inserted += 1;
    else duplicates += 1;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE financial_import_batches SET duplicate_count=$2 WHERE id=$1::uuid`,
    batchId,
    duplicates,
  );

  console.log('IMPORT COMPLETE');
  console.log(JSON.stringify({ batchId, evidenceSourceId, revenueSourceId, inserted, duplicates, ...totals }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
