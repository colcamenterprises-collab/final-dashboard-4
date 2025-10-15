import fs from "fs";

const file = "server/routes/stockReviewManual.ts";
let src = fs.readFileSync(file, "utf8");

// Health endpoint
if (!src.includes("/* [SRV-HEALTH] */")) {
  src = src.replace(
    /router\.get\([^]*?\);\s*\/\/ end base get/m,
    `$&

/* [SRV-HEALTH] */
router.get("/manual-ledger/health", (req,res)=>{
  try { return res.json({ ok:true, scope:"stock-review", routes:["refresh-meat","refresh-rolls","save","get"] }); }
  catch(e){ return res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});
`
  );
}

// Make refresh endpoints accept date in body as fallback
const ensureDateFlex = (name) => {
  const rx = new RegExp(String.raw`router\.post\("/manual-ledger/${name}".+?{[\s\S]*?}\);`, "m");
  if (!src.match(rx)) return;
  src = src.replace(rx, (block) => {
    if (block.includes("const bodyDay")) return block; // already patched
    return block.replace(
      /const day = dayStr\(.+?\);/,
      `const bodyDay = String(req.body?.day||"").slice(0,10);
  const queryDay = String(req.query.date||"").slice(0,10);
  const day = dayStr(queryDay || bodyDay);`
    );
  });
};

if (src.includes('/manual-ledger/refresh-meat')) ensureDateFlex('refresh-meat');
if (src.includes('/manual-ledger/refresh-rolls')) ensureDateFlex('refresh-rolls');

fs.writeFileSync(file, src, "utf8");
console.log("Backend hardened: health + flexible date ✅")
