import type { PoolClient } from "pg";
import { pool } from "../../db";
import type {
  CanonicalTransaction,
  ImportContext,
  ReportingSourceAdapter,
  SourceFileDescriptor,
} from "./types";

export type PersistImportResult = {
  batchId: string;
  sourceSystem: string;
  importedTransactions: number;
  importedItems: number;
  importedModifiers: number;
  importedPayments: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  validationStatus: "validated";
};

function finite(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a finite number`);
  return parsed;
}

function validDate(value: string, field: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${field} is not a valid timestamp: ${value}`);
  return date;
}

function assertCanonicalTransaction(transaction: CanonicalTransaction, context: ImportContext): void {
  if (!transaction.sourceTransactionId) throw new Error("Canonical transaction is missing sourceTransactionId");
  if (!transaction.occurredAt) throw new Error(`${transaction.sourceTransactionId}: occurredAt is required`);
  const occurredAt = validDate(transaction.occurredAt, `${transaction.sourceTransactionId}.occurredAt`);
  if (transaction.venueKey !== context.venueKey) throw new Error(`${transaction.sourceTransactionId}: venue mismatch`);
  if (context.cutoverAt && occurredAt.getTime() >= validDate(context.cutoverAt, "cutoverAt").getTime()) {
    throw new Error(`${transaction.sourceTransactionId}: historical transaction is at/after configured cutover`);
  }
  finite(transaction.subtotal, "subtotal");
  finite(transaction.discountTotal, "discountTotal");
  finite(transaction.refundTotal, "refundTotal");
  finite(transaction.taxTotal, "taxTotal");
  finite(transaction.netSales, "netSales");
  finite(transaction.total, "total");
}

async function insertTransaction(client: PoolClient, transaction: CanonicalTransaction, batchId: string) {
  const result = await client.query(
    `INSERT INTO reporting_historical_transactions (
      venue_key, source_system, source_transaction_id, source_receipt_number,
      occurred_at, business_timezone, channel, order_mode, payment_status,
      subtotal, discount_total, refund_total, tax_total, net_sales, total,
      currency, staff_name, source_import_batch_id, source_payload
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb
    ) RETURNING id`,
    [
      transaction.venueKey,
      transaction.sourceSystem,
      transaction.sourceTransactionId,
      transaction.sourceReceiptNumber || null,
      transaction.occurredAt,
      transaction.businessTimezone,
      transaction.channel || null,
      transaction.orderMode || null,
      transaction.paymentStatus || null,
      transaction.subtotal,
      transaction.discountTotal,
      transaction.refundTotal,
      transaction.taxTotal,
      transaction.netSales,
      transaction.total,
      transaction.currency,
      transaction.staffName || null,
      batchId,
      JSON.stringify(transaction.sourcePayload ?? null),
    ],
  );
  return String(result.rows[0].id);
}

async function insertItems(client: PoolClient, transactionId: string, transaction: CanonicalTransaction) {
  let itemCount = 0;
  let modifierCount = 0;
  for (const [index, item] of transaction.items.entries()) {
    const sourceLineId = item.sourceLineId || `${transaction.sourceTransactionId}:${index + 1}`;
    const result = await client.query(
      `INSERT INTO reporting_historical_transaction_items (
        transaction_id, source_line_id, source_item_id, item_name, sku, category,
        quantity, unit_price, gross_sales, discount_total, refund_total, net_sales,
        tax_total, cost_of_goods, gross_profit, is_set_component, source_payload
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb
      ) RETURNING id`,
      [
        transactionId,
        sourceLineId,
        item.sourceItemId || null,
        item.itemName,
        item.sku || null,
        item.category || null,
        item.quantity,
        item.unitPrice ?? null,
        item.grossSales,
        item.discountTotal,
        item.refundTotal,
        item.netSales,
        item.taxTotal,
        item.costOfGoods ?? null,
        item.grossProfit ?? null,
        item.isSetComponent === true,
        JSON.stringify(item.sourcePayload ?? null),
      ],
    );
    const itemId = String(result.rows[0].id);
    itemCount += 1;
    for (const [modifierIndex, modifier] of (item.modifiers || []).entries()) {
      const sourceModifierId = modifier.sourceModifierId || `${sourceLineId}:modifier:${modifierIndex + 1}`;
      await client.query(
        `INSERT INTO reporting_historical_transaction_modifiers (
          transaction_item_id, source_modifier_id, modifier_group, modifier_name,
          quantity, price_delta, revenue, source_payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [
          itemId,
          sourceModifierId,
          modifier.group || null,
          modifier.name,
          modifier.quantity,
          modifier.priceDelta,
          modifier.revenue,
          JSON.stringify(modifier.sourcePayload ?? null),
        ],
      );
      modifierCount += 1;
    }
  }
  return { itemCount, modifierCount };
}

async function insertPayments(client: PoolClient, transactionId: string, transaction: CanonicalTransaction) {
  let paymentCount = 0;
  for (const [index, payment] of transaction.payments.entries()) {
    const sourcePaymentId = payment.sourcePaymentId || `${transaction.sourceTransactionId}:payment:${index + 1}`;
    await client.query(
      `INSERT INTO reporting_historical_payments (
        transaction_id, source_payment_id, payment_method, amount, paid_at, source_payload
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        transactionId,
        sourcePaymentId,
        payment.paymentMethod,
        payment.amount,
        payment.paidAt || transaction.occurredAt,
        JSON.stringify(payment.sourcePayload ?? null),
      ],
    );
    paymentCount += 1;
  }
  return paymentCount;
}

export async function persistHistoricalImport(args: {
  adapter: ReportingSourceAdapter;
  files: SourceFileDescriptor[];
  context: ImportContext;
  importType?: string;
  notes?: string;
}): Promise<PersistImportResult> {
  if (!pool) throw new Error("Database unavailable: DATABASE_URL is required for historical import");
  if (!args.files.length) throw new Error("At least one source file is required");

  const validation = await args.adapter.validate(args.files, args.context);
  if (!validation.ok) {
    throw new Error(`Import validation failed: ${validation.errors.join(" | ")}`);
  }

  const primary = args.files[0];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const duplicate = await client.query(
      `SELECT id FROM reporting_import_batches WHERE source_file_sha256 = ANY($1::text[]) LIMIT 1`,
      [args.files.map(file => file.sha256)],
    );
    if (duplicate.rowCount) throw new Error("One or more source files have already been imported");

    const batch = await client.query(
      `INSERT INTO reporting_import_batches (
        source_system, source_file, source_file_sha256, import_type,
        source_row_count, source_gross_sales, source_discounts, source_refunds,
        source_net_sales, validation_status, validation_errors, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','[]'::jsonb,$10)
      RETURNING id`,
      [
        args.adapter.id,
        args.files.map(file => file.filename).join(" | "),
        primary.sha256,
        args.importType || "historical_transactions",
        validation.sourceRowCount ?? null,
        validation.grossSales ?? null,
        validation.discounts ?? null,
        validation.refunds ?? null,
        validation.netSales ?? null,
        args.notes || null,
      ],
    );
    const batchId = String(batch.rows[0].id);

    let importedTransactions = 0;
    let importedItems = 0;
    let importedModifiers = 0;
    let importedPayments = 0;
    let grossSales = 0;
    let discounts = 0;
    let refunds = 0;
    let netSales = 0;

    for await (const transaction of args.adapter.parse(args.files, args.context)) {
      assertCanonicalTransaction(transaction, args.context);
      const transactionId = await insertTransaction(client, transaction, batchId);
      const itemCounts = await insertItems(client, transactionId, transaction);
      importedItems += itemCounts.itemCount;
      importedModifiers += itemCounts.modifierCount;
      importedPayments += await insertPayments(client, transactionId, transaction);
      importedTransactions += 1;
      grossSales += transaction.subtotal;
      discounts += transaction.discountTotal;
      refunds += transaction.refundTotal;
      netSales += transaction.netSales;
    }

    if (!importedTransactions) throw new Error("Adapter produced zero canonical transactions");
    if (validation.transactionCount != null && importedTransactions !== validation.transactionCount) {
      throw new Error(`Transaction reconciliation failed: expected ${validation.transactionCount}; imported ${importedTransactions}`);
    }

    const tolerance = 0.01;
    const compare = (label: string, actual: number, expected?: number) => {
      if (expected == null) return;
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label} reconciliation failed: expected ${expected}; imported ${actual}`);
      }
    };
    compare("Gross sales", grossSales, validation.grossSales);
    compare("Discounts", discounts, validation.discounts);
    compare("Refunds", refunds, validation.refunds);
    compare("Net sales", netSales, validation.netSales);

    await client.query(
      `UPDATE reporting_import_batches SET
        imported_row_count=$2,
        imported_gross_sales=$3,
        imported_discounts=$4,
        imported_refunds=$5,
        imported_net_sales=$6,
        validation_status='validated',
        validation_errors='[]'::jsonb
       WHERE id=$1`,
      [batchId, importedTransactions, grossSales, discounts, refunds, netSales],
    );

    await client.query("COMMIT");
    return {
      batchId,
      sourceSystem: String(args.adapter.id),
      importedTransactions,
      importedItems,
      importedModifiers,
      importedPayments,
      grossSales,
      discounts,
      refunds,
      netSales,
      validationStatus: "validated",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
