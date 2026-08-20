import assert from "node:assert/strict";
import test from "node:test";
import { computeBankingAuto } from "../services/bankingAuto";
import {
  normalizePaymentCategory,
  parseLoyverseMoney,
} from "../services/loyverseMirrorCommon";
import { loyverseAdapter } from "./importers/loyverse";
import type { CanonicalTransaction, SourceFileDescriptor } from "./importers/types";
import {
  SBB_REPORTING_CUTOVER_ISO,
  sourceOwnsTimestamp,
} from "./reportingCutover";
import { resolveExactReportingRange } from "./unifiedLedger";

const context = {
  venueKey: "sbb-rawai",
  timezone: "Asia/Bangkok",
  cutoverAt: SBB_REPORTING_CUTOVER_ISO,
  currency: "THB",
};

const receiptsHeader = [
  "Date",
  "Receipt number",
  "Receipt type",
  "Gross sales",
  "Discounts",
  "Net sales",
  "Total collected",
  "Payment type",
  "Dining option",
  "Status",
].join(",");

function receiptsFile(...rows: string[]): SourceFileDescriptor {
  return {
    filename: "receipts.csv",
    sha256: "f".repeat(64),
    mimeType: "text/csv",
    contents: `${receiptsHeader}\n${rows.join("\n")}\n`,
  };
}

async function parseTransactions(...rows: string[]): Promise<CanonicalTransaction[]> {
  const transactions: CanonicalTransaction[] = [];
  for await (const transaction of loyverseAdapter.parse([receiptsFile(...rows)], context)) {
    transactions.push(transaction);
  }
  return transactions;
}

function totals(transactions: CanonicalTransaction[]) {
  return transactions.reduce(
    (sum, transaction) => ({
      gross: sum.gross + transaction.subtotal,
      discount: sum.discount + transaction.discountTotal,
      refund: sum.refund + transaction.refundTotal,
      net: sum.net + transaction.netSales,
    }),
    { gross: 0, discount: 0, refund: 0, net: 0 },
  );
}

test("normal completed sale preserves gross minus discount as net sales", async () => {
  const [sale] = await parseTransactions(
    "08/08/2026 18:00,S-1,Sale,500,50,450,450,Cash,Direct,Closed",
  );

  assert.deepEqual(totals([sale]), { gross: 500, discount: 50, refund: 0, net: 450 });
  assert.equal(sale.netSales, sale.subtotal - sale.discountTotal - sale.refundTotal);
});

test("full refund preserves original gross history and produces zero combined net sales", async () => {
  const transactions = await parseTransactions(
    "08/08/2026 18:00,S-2,Sale,500,0,500,500,Cash,Direct,Closed",
    "08/08/2026 19:00,R-2,Refund,-500,0,-500,-500,Cash,Direct,Closed",
  );

  assert.deepEqual(totals(transactions), { gross: 500, discount: 0, refund: 500, net: 0 });
  assert.equal(transactions[1].subtotal, 0);
  assert.equal(transactions[1].paymentStatus, "refunded");
});

test("discounted full refund refunds the paid amount without counting refund gross twice", async () => {
  const transactions = await parseTransactions(
    "08/08/2026 18:00,S-3,Sale,500,50,450,450,QR,Direct,Closed",
    "08/08/2026 19:00,R-3,Refund,-450,0,-450,-450,QR,Direct,Closed",
  );

  assert.deepEqual(totals(transactions), { gross: 500, discount: 50, refund: 450, net: 0 });
});

test("single canonical payment allocation equals the completed receipt total", async () => {
  const [sale] = await parseTransactions(
    "08/08/2026 18:00,S-4,Sale,500,50,450,450,Cash,Direct,Closed",
  );

  assert.equal(sale.payments.length, 1);
  assert.equal(sale.payments.reduce((sum, payment) => sum + payment.amount, 0), sale.total);
  assert.equal(sale.payments[0].paymentMethod, "Cash");
});

test("refunded payment remains explicit and offsets reporting net sales", async () => {
  const [refund] = await parseTransactions(
    "08/08/2026 19:00,R-4,Refund,-450,0,-450,-450,Cash,Direct,Closed",
  );

  assert.equal(refund.payments[0].amount, -450);
  assert.equal(refund.refundTotal, 450);
  assert.equal(refund.netSales, -450);
});

test("Loyverse CSV reporting values are already THB major units", async () => {
  const [sale] = await parseTransactions(
    "08/08/2026 18:00,S-5,Sale,500,0,500,500,Cash,Direct,Closed",
  );

  assert.equal(sale.subtotal, 500);
  assert.equal(sale.total, 500);
  assert.equal(sale.currency, "THB");
});

test("Loyverse API money objects convert minor units once while scalar values remain major units", () => {
  assert.equal(parseLoyverseMoney({ amount: 50_000 }), 500);
  assert.equal(parseLoyverseMoney({ value: 50_000 }), 500);
  assert.equal(parseLoyverseMoney(500), 500);
  assert.equal(parseLoyverseMoney("500.00"), 500);
});

test("cutover ownership is exclusive before, exactly at, and after the boundary", () => {
  const cases = [
    { at: "2026-08-09T02:59:59.999+07:00", historical: true, live: false },
    { at: SBB_REPORTING_CUTOVER_ISO, historical: false, live: true },
    { at: "2026-08-09T03:00:00.001+07:00", historical: false, live: true },
  ];

  for (const fixture of cases) {
    const at = new Date(fixture.at);
    assert.equal(sourceOwnsTimestamp("loyverse", at), fixture.historical);
    assert.equal(sourceOwnsTimestamp("sbb_pos", at), fixture.live);
  }
});

test("duplicate logical transactions across source fixtures have exactly one cutover owner", () => {
  for (const at of [
    new Date("2026-08-09T02:59:59.999+07:00"),
    new Date(SBB_REPORTING_CUTOVER_ISO),
  ]) {
    const owningCopies = (["loyverse", "sbb_pos"] as const)
      .filter(source => sourceOwnsTimestamp(source, at));
    assert.equal(owningCopies.length, 1);
  }
});

test("reporting windows use a configurable half-open range", () => {
  const range = resolveExactReportingRange({
    fromDate: "2026-08-07",
    fromTime: "17:00",
    toDate: "2026-08-08",
    toTime: "03:00",
    timezone: "Asia/Bangkok",
  });
  const contains = (instant: string) => instant >= range.fromInstant && instant < range.toInstant;

  assert.equal(contains("2026-08-07T09:59:59.999Z"), false);
  assert.equal(contains(range.fromInstant), true);
  assert.equal(contains("2026-08-07T19:59:59.999Z"), true);
  assert.equal(contains(range.toInstant), false);
});

test("payment classification preserves Cash, QR, Grab, and Other buckets", () => {
  assert.deepEqual(normalizePaymentCategory("Cash"), { category: "Cash", mapped: true });
  assert.deepEqual(normalizePaymentCategory("PromptPay QR"), { category: "QR", mapped: true });
  assert.deepEqual(normalizePaymentCategory("GrabFood"), { category: "Grab", mapped: true });
  assert.deepEqual(normalizePaymentCategory("Other"), { category: "Other", mapped: true });
  assert.deepEqual(normalizePaymentCategory("Unconfigured tender"), { category: "Other", mapped: false });
});

test("sales channel remains distinct from payment method and order mode", async () => {
  const [sale] = await parseTransactions(
    "08/08/2026 18:00,S-6,Sale,450,0,450,450,Cash,Grab,Closed",
  );

  assert.equal(sale.channel, "Grab");
  assert.equal(sale.orderMode, "Grab");
  assert.equal(sale.payments[0].paymentMethod, "Cash");
});

test("normal cash shift protects the canonical expected banking arithmetic", () => {
  assert.deepEqual(computeBankingAuto({
    startingCash: 2_000,
    closingCash: 2_000,
    cashSales: 5_000,
    qrSales: 1_500,
  }), {
    startingCash: 2_000,
    closingCash: 2_000,
    cashSales: 5_000,
    qrSales: 1_500,
    cashExpenses: 0,
    expectedCashBank: 5_000,
    expectedQRBank: 1_500,
    expectedTotalBank: 6_500,
  });
});

test("zero cash sales produce no expected cash banking when float is retained", () => {
  const result = computeBankingAuto({ startingCash: 2_000, closingCash: 2_000, cashSales: 0 });
  assert.equal(result.expectedCashBank, 0);
});

test("cash expenses reduce the canonical expected cash banking amount", () => {
  const result = computeBankingAuto({
    startingCash: 2_000,
    closingCash: 2_000,
    cashSales: 5_000,
    shoppingTotal: 300,
    wagesTotal: 200,
    othersTotal: 100,
  });
  assert.equal(result.cashExpenses, 600);
  assert.equal(result.expectedCashBank, 4_400);
});

test("cash overage is represented by a lower expected bank amount and never a negative deposit", () => {
  assert.equal(computeBankingAuto({
    startingCash: 2_000,
    closingCash: 2_100,
    cashSales: 5_000,
  }).expectedCashBank, 4_900);
  assert.equal(computeBankingAuto({
    startingCash: 0,
    closingCash: 500,
    cashSales: 100,
  }).expectedCashBank, 0);
});
