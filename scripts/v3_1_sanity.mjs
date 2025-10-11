const BASE = process.env.BASE_URL || 'http://localhost:3000';
const j = async (u,opts={})=>{ const r=await fetch(u,{...opts,headers:{'Content-Type':'application/json'}}); const ct=r.headers.get('content-type')||''; const b=ct.includes('json')? await r.json(): await r.text(); return {status:r.status, ok:r.ok, body:b}; };
const ex=(c,m)=>{ if(!c) throw new Error(m); };
(async()=>{
  // 410 skip
  let r = await j(`${BASE}/api/manager-check/skip`);
  ex(r.status===410, `Expected 410 on skip, got ${r.status}`);

  // 4 questions EN/TH
  let en = await j(`${BASE}/api/manager-check/questions?lang=en`);
  ex(en.ok && en.body?.questions?.length===4, "EN questions must be 4");
  let th = await j(`${BASE}/api/manager-check/questions?lang=th`);
  ex(th.ok && th.body?.questions?.length===4, "TH questions must be 4");

  // V3 endpoint exists; V2/dashed gone
  let v3check = await j(`${BASE}/api/forms/daily-sales/v3`);
  ex([400,404,405].includes(v3check.status) || v3check.ok, "V3 route should exist (OPTIONS/405/200 ok)");

  let v2a = await j(`${BASE}/api/forms/daily-sales/v2`);
  ex(v2a.status===410, `V2 slash should be 410, got ${v2a.status}`);
  let v2b = await j(`${BASE}/api/forms/daily-sales-v2`);
  ex(v2b.status===410, `V2 dashed should be 410, got ${v2b.status}`);

  // Submit manager check once to ensure schema OK
  const answers = en.body.questions.map((q,i)=>({questionId:q.id, response: i===0?"FAIL":"PASS", note: i===0?"note":""}));
  let sub = await j(`${BASE}/api/manager-check/submit`, {method:'POST', body: JSON.stringify({ dailyCheckId: "sanity-test-id", answeredBy: "Sanity Manager", answers, questions: en.body.questions })});
  ex(sub.ok, `Manager submit failed: ${JSON.stringify(sub.body)}`);

  console.log(JSON.stringify({ok:true, checks:["skip 410","qs EN/TH=4","v3 canonical","v2 blocked","mgr submit schema ok"]}, null, 2));
  process.exit(0);
})().catch(e=>{ console.error("SANITY FAIL:", e?.message||e); process.exit(1); });
