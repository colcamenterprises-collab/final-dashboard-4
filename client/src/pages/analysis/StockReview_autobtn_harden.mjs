import fs from "fs";
const file = "client/src/pages/analysis/StockReview.tsx";
let src = fs.readFileSync(file, "utf8");

function injectHelpers() {
  if (src.includes("/* [SR-TOAST] */")) return;
  src = src.replace(
    /export default function StockReview\([^\)]*\)\s*{/,
    (m)=> m + `
  /* [SR-TOAST] */
  const [busyMeat,setBusyMeat] = React.useState(false);
  const [busyRolls,setBusyRolls] = React.useState(false);
  function toast(msg:string){ try{ alert(msg); }catch{} }
`
  );
}

function patchBtn(label, path, busyState) {
  const marker = label === "Rolls" ? "/* [ROLLS-AUTO-BTN] */" : "/* [MEAT-AUTO-BTN] */";
  if (!src.includes(marker)) return; // button not present
  src = src.replace(
    new RegExp(String.raw`${marker}[\s\S]*?onClick=\{async \(\)=>\{[\s\S]*?\}\}`, "m"),
    `${marker}
<div className="flex items-center gap-2 mb-2">
  <button
    onClick={async ()=>{
      try{
        ${busyState}(true);
        const q = encodeURIComponent(day);
        const res = await fetch(\`${path}?date=\${q}\`, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ day })
        });
        const j = await res.json().catch(()=>({ok:false,error:"Bad JSON"}));
        if(!j?.ok){ toast(j?.error ? \`${label} auto failed: \${j.error}\` : \`${label} auto failed\`); return; }
        const r = await fetch(\`/api/stock-review/manual-ledger?date=\${q}\`);
        const d = await r.json();
        if(d?.ok){
          ${label==="Rolls" ? "setRolls(d.rolls);" : "setMeat(d.meat);"}
          toast(\`${label} auto-filled for \${day}\`);
        } else {
          toast("Reload failed");
        }
      }catch(e:any){
        toast(\`${label} auto error: \${e?.message||e}\`);
      } finally { ${busyState}(false); }
    }}
    className="h-9 rounded-xl border px-3 text-sm disabled:opacity-60"
    disabled={${busyState.replace("set","")}}
    title="Auto-fill from Expenses & Form 2"
  >{${busyState.replace("set","")}} ? "..." : "Auto"}</button>
</div>`
  );
}

injectHelpers();
patchBtn("Rolls", "/api/stock-review/manual-ledger/refresh-rolls", "setBusyRolls");
patchBtn("Meat",  "/api/stock-review/manual-ledger/refresh-meat",  "setBusyMeat");

fs.writeFileSync(file, src, "utf8");
console.log("Frontend hardened: Auto buttons show progress + errors ✅");
