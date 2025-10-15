import fs from "fs";
const file = "client/src/pages/analysis/StockReview.tsx";
let src = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

if (src && !src.includes("/* [MEAT-AUTO-BTN] */")) {
  // Insert the Auto button in the Meat card's header
  src = src.replace(
    /(<div className="flex items-center justify-between mb-2">\s*<h2 className="text-base font-medium">Meat \(grams\)<\/h2>\s*<span[^>]*>[^<]*<\/span>\s*<\/div>)/m,
`$1
{/* [MEAT-AUTO-BTN] */}
<div className="flex items-center gap-2 mb-2">
  <button
    onClick={async ()=>{
      try{
        const res = await fetch(\`/api/stock-review/manual-ledger/refresh-meat?date=\${day}\`, { method:"POST" });
        const j = await res.json();
        if(!j.ok){ alert(j.error || "Auto-fill failed"); return; }
        // Pull fresh state
        const r = await fetch(\`/api/stock-review/manual-ledger?date=\${day}\`);
        const d = await r.json();
        if(d?.ok){
          setMeat(d.meat);
        }
      }catch(e){ alert("Auto-fill failed"); }
    }}
    className="h-9 rounded-xl border px-3 text-sm"
    title="Auto-fill Prev/Purchased/Actual from Expenses & Form 2"
  >Auto</button>
</div>`
  );
  fs.writeFileSync(file, src, "utf8");
  console.log("Patched StockReview.tsx with meat Auto button ✅");
} else {
  console.log("StockReview.tsx not found or already patched; skipping.");
}
