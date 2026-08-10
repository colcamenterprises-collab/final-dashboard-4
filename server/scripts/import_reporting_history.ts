import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loyverseAdapter } from "../reporting/importers/loyverse";
import { validateLoyverseControlReports } from "../reporting/importers/loyverseControls";
import { persistHistoricalImport } from "../reporting/importers/persistImport";
import type { SourceFileDescriptor } from "../reporting/importers/types";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function required(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`Missing required --${name} argument`);
  return value;
}

function sourceFile(filename: string): SourceFileDescriptor {
  const resolved = path.resolve(filename);
  if (!fs.existsSync(resolved)) throw new Error(`Source file not found: ${resolved}`);
  const contents = fs.readFileSync(resolved);
  const sha256 = crypto.createHash("sha256").update(contents).digest("hex");
  return {
    filename: path.basename(resolved),
    sha256,
    mimeType: "text/csv",
    contents,
  };
}

async function main() {
  const source = arg("source") || "loyverse";
  if (source !== "loyverse") throw new Error(`Unsupported source adapter: ${source}`);

  const receipts = sourceFile(required("receipts"));
  const items = sourceFile(required("items"));
  const supporting = (arg("supporting") || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .map(sourceFile);
  const files = [receipts, items, ...supporting];
  const context = {
    venueKey: arg("venue") || "sbb-rawai",
    timezone: arg("timezone") || "Asia/Bangkok",
    cutoverAt: arg("cutover") || "2026-08-09T03:00:00+07:00",
    currency: arg("currency") || "THB",
  };

  console.log("Reporting historical import");
  console.log(`Source: ${loyverseAdapter.displayName}`);
  console.log(`Venue: ${context.venueKey}`);
  console.log(`Timezone: ${context.timezone}`);
  console.log(`Cutover: ${context.cutoverAt}`);
  console.log("Files:");
  for (const file of files) console.log(`- ${file.filename}  sha256=${file.sha256}`);

  const validation = await loyverseAdapter.validate(files, context);
  console.log("Canonical validation:", JSON.stringify(validation, null, 2));
  if (!validation.ok) throw new Error(`Validation failed: ${validation.errors.join(" | ")}`);

  if (supporting.length) {
    const controls = validateLoyverseControlReports(files);
    console.log("Control reconciliation:", JSON.stringify(controls, null, 2));
    if (!controls.ok) throw new Error(`Control reconciliation failed: ${controls.errors.join(" | ")}`);
  } else {
    console.warn("No supporting control reports supplied; canonical receipt/item reconciliation only");
  }

  if (has("dry-run")) {
    let transactions = 0;
    let itemsCount = 0;
    let modifiers = 0;
    let payments = 0;
    for await (const transaction of loyverseAdapter.parse(files, context)) {
      transactions += 1;
      itemsCount += transaction.items.length;
      modifiers += transaction.items.reduce((sum, item) => sum + (item.modifiers?.length || 0), 0);
      payments += transaction.payments.length;
    }
    console.log(JSON.stringify({ dryRun: true, transactions, items: itemsCount, modifiers, payments }, null, 2));
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for a real import; use --dry-run for parser validation only");
  }

  const result = await persistHistoricalImport({
    adapter: loyverseAdapter,
    files,
    context,
    importType: "historical_pos_migration",
    notes: arg("notes") || "Validated Loyverse historical reporting migration",
  });
  console.log("IMPORT COMPLETE");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error("IMPORT FAILED");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
