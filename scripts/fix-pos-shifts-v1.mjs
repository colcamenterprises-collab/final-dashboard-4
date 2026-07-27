import fs from "node:fs";

const file = "server/routes/pos.ts";
let source = fs.readFileSync(file, "utf8");

if (!source.includes("UPDATE ordering_orders SET pos_shift_id=$2 WHERE id=$1")) {
  const marker = `    ).rows[0];\n\n    const ticket = receiptNumber(Number(order.order_number), order.created_at);`;
  const replacement = `    ).rows[0];\n\n    await client.query(\`UPDATE ordering_orders SET pos_shift_id=$2 WHERE id=$1\`, [order.id, activeShift.id]);\n    const ticket = receiptNumber(Number(order.order_number), order.created_at);`;
  if (!source.includes(marker)) throw new Error("Could not find POS order insert marker");
  source = source.replace(marker, replacement);
}

const required = [
  'router.get("/shifts/current"',
  'router.post("/shifts/open"',
  'router.post("/shifts/:id/movements"',
  'router.post("/shifts/:id/close"',
  "POS_SHIFT_REQUIRED",
  "pos_shift_id",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing installed POS shift marker: ${marker}`);
}

fs.writeFileSync(file, source);
console.log("POS shift order linkage verified");
