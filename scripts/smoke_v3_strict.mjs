const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const pp = (o)=>JSON.stringify(o,null,2);
const j = async (u,opts={})=>{
  const r = await fetch(u,{...opts, headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const ct=r.headers.get('content-type')||''; const b = ct.includes('json')? await r.json(): await r.text();
  return {status:r.status, ok:r.ok, body:b};
};
const ex = (c,m)=>{ if(!c) throw new Error(m); };

(async()=>{
  // 410 no-skip
  let r = await j(`${BASE_URL}/api/manager-check/skip`);
  ex(r.status===410, `Skip endpoint expected 410, got ${r.status}`);

  // Form1 create (with decimals)
  const salesPayload = {
    shiftDate: new Date().toISOString().slice(0,10),
    completedBy: "Smoke Tester",
    sales: { cash: 10500, qr: 6500, grab: 3200, aroi: 800 },
    banking: { startingCash: 3000, endingCash: 2500, cashBanked: 8000, qrTransfer: 6500 },
    expenses: {
      shopping: [{ item:"Buns", cost: 540.25, shop:"Makro" }],
      wages: [{ staff:"Somchai", amount:1200.75, type:"Part-time" }],
      others: [{ label:"Ice", amount: 120.10 }]
    }
  };
  r = await j(`${BASE_URL}/api/forms/daily-sales-v2`, {method:'POST', body: JSON.stringify(salesPayload)});
  ex(r.ok, `Form1 failed: ${pp(r.body)}`);
  const salesId = r.body?.id || r.body?.salesId || r.body?.data?.id; ex(!!salesId, "Form1 response missing id");

  // Form2 with tricky drinks
  const stockPayload = {
    salesId,
    rollsEnd: 45,
    meatEnd: 9000,
    drinkStock: { "น้ำเปล่า": 12, "Coke Zero (330ml)": 2, "RedBull™": 1, "Sprite": 0 },
    requisition: [{ name:"Buns", qty:120, category:"Bread", unit:"pcs" }, { name:"Drinks", qty:60, category:"Beverages", unit:"btls" }]
  };
  r = await j(`${BASE_URL}/api/forms/daily-stock`, {method:'POST', body: JSON.stringify(stockPayload)});
  ex(r.ok, `Form2 failed: ${pp(r.body)}`);

  // Questions 4 EN/TH
  let q = await j(`${BASE_URL}/api/manager-check/questions?lang=en`); ex(q.ok && q.body?.questions?.length===4, "EN questions must be 4");
  let qt = await j(`${BASE_URL}/api/manager-check/questions?lang=th`); ex(qt.ok && qt.body?.questions?.length===4, "TH questions must be 4");

  // Submit manager check
  const answers = q.body.questions.map((qq,i)=>({questionId: qq.id, response: i===0?"FAIL":"PASS", note: i===0?"Test fail note":""}));
  r = await j(`${BASE_URL}/api/manager-check/submit`, {method:'POST', body: JSON.stringify({ dailyCheckId:salesId, answeredBy:"Test Manager ✓", answers, questions:q.body.questions })});
  ex(r.ok, `Manager submit failed: ${pp(r.body)}`);

  // Library read
  let lib = await j(`${BASE_URL}/api/forms/library`);
  let item = (lib.ok && Array.isArray(lib.body)) ? (lib.body.find(x=>x.id===salesId) || lib.body[0]) : null;
  if (!item){ const one = await j(`${BASE_URL}/api/forms/${salesId}`); item = one.ok? one.body : null; }
  ex(!!item, "No library/form item found");

  const buns = item.buns ?? item.rollsEnd ?? item?.payload?.rollsEnd; ex(Number(buns)===45, `buns 45 expected, got ${buns}`);
  const meat = item.meat ?? item.meatEnd ?? item?.payload?.meatEnd; ex(Number(meat)===9000, `meat 9000 expected, got ${meat}`);
  const drinks = item.drinkStock ?? item?.payload?.drinkStock; ex(drinks && typeof drinks==='object', "drinks object missing");
  ex(Object.prototype.hasOwnProperty.call(drinks,"Sprite"), "Sprite key missing"); ex(drinks["Sprite"]===0, "Sprite must be 0");

  // Debug email-data to confirm email block stock
  const dbg = await j(`${BASE_URL}/api/_debug/email-data/${salesId}`);
  ex(dbg.ok, "debug email-data endpoint failed (set ENABLE_DEBUG_ROUTES=1)");
  ex(dbg.body?.stock?.drinks && Object.prototype.hasOwnProperty.call(dbg.body.stock.drinks,"น้ำเปล่า"), "Thai key missing in debug email-data");

  console.log(JSON.stringify({ ok:true, salesId, checks:["410 skip","form1","form2","qs en+th=4","mgr submit","library stock ok","debug email-data ok"] }, null, 2));
  process.exit(0);
})().catch(e=>{ console.error("SMOKE FAIL:", e?.message||e); process.exit(1); });
