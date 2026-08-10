import assert from "node:assert/strict";
import test from "node:test";
import { loyverseAdapter } from "./loyverse";
import type { SourceFileDescriptor } from "./types";

const context = {
  venueKey: "sbb-rawai",
  timezone: "Asia/Bangkok",
  cutoverAt: "2026-08-09T03:00:00+07:00",
  currency: "THB",
};

function file(filename: string, contents: string): SourceFileDescriptor {
  return { filename, sha256: "a".repeat(64), mimeType: "text/csv", contents };
}

const receiptsHeader = "Date,Receipt number,Receipt type,Gross sales,Discounts,Net sales,Total collected,Payment type,Status,Cashier name";
const itemsHeader = "Date,Receipt number,Receipt type,Item,SKU,Category,Quantity,Gross sales,Discounts,Net sales,Cost of goods,Gross profit,Modifiers applied,Status";

test("excludes cancelled receipts from canonical validation and parsing", async () => {
  const receipts = file("receipts.csv", `${receiptsHeader}\n08/08/2026 18:00,6-1,Sale,200,0,200,200,Cash,Closed,Ael\n08/08/2026 18:05,6-2,Sale,300,0,300,300,Cash,Cancelled,Ael\n`);
  const items = file("receipts-by-item.csv", `${itemsHeader}\n08/08/2026 18:00,6-1,Sale,Burger,B1,Burgers,1,200,0,200,80,120,,Closed\n08/08/2026 18:05,6-2,Sale,Burger,B1,Burgers,1,300,0,300,120,180,,Cancelled\n`);
  const validation = await loyverseAdapter.validate([receipts, items], context);
  assert.equal(validation.ok, true);
  assert.equal(validation.transactionCount, 1);
  assert.equal(validation.grossSales, 200);
  assert.match(validation.warnings.join(" "), /1 cancelled/);
  const parsed = [];
  for await (const transaction of loyverseAdapter.parse([receipts, items], context)) parsed.push(transaction);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].sourceTransactionId, "6-1");
});

test("maps refund receipts without adding refund gross to positive gross sales", async () => {
  const receipts = file("receipts.csv", `${receiptsHeader}\n08/08/2026 18:00,6-3,Refund,-250,0,-250,-250,Cash,Closed,Ael\n`);
  const items = file("receipts-by-item.csv", `${itemsHeader}\n08/08/2026 18:00,6-3,Refund,Burger,B1,Burgers,-1,-250,0,-250,-100,-150,,Closed\n`);
  const validation = await loyverseAdapter.validate([receipts, items], context);
  assert.equal(validation.ok, true);
  assert.equal(validation.grossSales, 0);
  assert.equal(validation.refunds, 250);
  assert.equal(validation.netSales, -250);
  const parsed = [];
  for await (const transaction of loyverseAdapter.parse([receipts, items], context)) parsed.push(transaction);
  assert.equal(parsed[0].paymentStatus, "refunded");
  assert.equal(parsed[0].refundTotal, 250);
  assert.equal(parsed[0].items[0].quantity, -1);
  assert.equal(parsed[0].items[0].refundTotal, 250);
  assert.equal(parsed[0].items[0].grossSales, 0);
});

test("splits comma-separated Loyverse modifiers into separate canonical selections", async () => {
  const receipts = file("receipts.csv", `${receiptsHeader}\n08/08/2026 18:00,6-4,Sale,300,0,300,300,Cash,Closed,Ael\n`);
  const items = file("receipts-by-item.csv", `${itemsHeader}\n08/08/2026 18:00,6-4,Sale,Burger,B1,Burgers,1,300,0,300,100,200,"Double Cheese, Crispy Bacon, Coke",Closed\n`);
  const parsed = [];
  for await (const transaction of loyverseAdapter.parse([receipts, items], context)) parsed.push(transaction);
  assert.deepEqual(parsed[0].items[0].modifiers?.map(modifier => modifier.name), ["Double Cheese", "Crispy Bacon", "Coke"]);
});

test("rejects Loyverse receipts at or after the configured cutover", async () => {
  const receipts = file("receipts.csv", `${receiptsHeader}\n09/08/2026 03:00,6-5,Sale,100,0,100,100,Cash,Closed,Ael\n`);
  const items = file("receipts-by-item.csv", `${itemsHeader}\n09/08/2026 03:00,6-5,Sale,Drink,D1,Drinks,1,100,0,100,40,60,,Closed\n`);
  const validation = await loyverseAdapter.validate([receipts, items], context);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(" "), /at\/after the configured cutover/);
});
