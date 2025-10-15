import fs from "fs";
const file = "server/routes.ts";
const src = fs.readFileSync(file, "utf8");

// add import if missing
let out = src;
if (!out.includes("stockReviewManual")) {
  out = out.replace(
    /(\n\s*import .*?;\s*)+(?=[\s\S]*?\bconst app =)/m,
    (m) => m + '\nimport stockReviewManual from "./routes/stockReviewManual";\n'
  );
}

// ensure mount BEFORE dynamic analysis routes
if (!out.includes('app.use("/api/stock-review/manual-ledger"')) {
  // Insert mount right after any other early mounts but before /api/analysis
  out = out.replace(
    /(app\.use\([^\n]*\);[\s\S]*?)\n(?=app\.(get|use)\(["']\/api\/analysis)/m,
    (m) => m + '\napp.use("/api/stock-review/manual-ledger", stockReviewManual);\n'
  );
  // Fallback: if no /api/analysis marker, just add once near end before export
  if (!out.includes('app.use("/api/stock-review/manual-ledger"')) {
    out = out.replace(/(\nexport default app;)/, '\napp.use("/api/stock-review/manual-ledger", stockReviewManual);\n$1');
  }
}

fs.writeFileSync(file, out, "utf8");
console.log("Patched server/routes.ts ✅");
