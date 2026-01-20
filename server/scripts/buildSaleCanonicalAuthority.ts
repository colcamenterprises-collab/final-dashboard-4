import { DateTime } from "luxon";
import { buildSaleCanonicalAuthority } from "../services/rma/canonicalSalesBuilder";

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = DateTime.fromISO(value, { zone: "Asia/Bangkok" });
  return parsed.isValid ? parsed.toJSDate() : undefined;
};

async function run() {
  const receiptIds = process.env.RECEIPT_IDS?.split(",").map((value) => value.trim()).filter(Boolean);
  const from = parseDate(process.env.FROM_DATE);
  const to = parseDate(process.env.TO_DATE);

  const result = await buildSaleCanonicalAuthority({ receiptIds, from, to });
  console.log(`[RMA] Canonical sales rebuilt: ${result.inserted} rows across ${result.receiptsProcessed} receipts.`);
}

run().catch((error) => {
  console.error("[RMA] Failed to rebuild canonical sales", error);
  process.exit(1);
});
