import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),"utf8");
const write = (p,c) => { const f=path.join(root,p); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,c); console.log(`updated ${p}`); };

const page = `import { useEffect, useMemo, useState } from "react";

type Shift = { id:string; staff_name:string; opened_at:string; starting_float:number; status:string; closed_at?:string|null; closing_cash?:number|null; cash_banked?:number|null; variance?:number|null };
type Movement = { id:string; movement_type:"cash_in"|"cash_out"; amount:number; reason:string; created_at:string };
const thb=(n:number)=>\`฿\${Number(n||0).toLocaleString()}\`;

export default function PosShifts(){
  const [shift,setShift]=useState<Shift|null>(null);
  const [history,setHistory]=useState<Shift[]>([]);
  const [movements,setMovements]=useState<Movement[]>([]);
  const [staffName,setStaffName]=useState("");
  const [startingFloat,setStartingFloat]=useState("2500");
  const [movementType,setMovementType]=useState<"cash_in"|"cash_out">("cash_out");
  const [movementAmount,setMovementAmount]=useState("");
  const [movementReason,setMovementReason]=useState("");
  const [closingCash,setClosingCash]=useState("");
  const [cashBanked,setCashBanked]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    const response=await fetch('/api/pos/shifts/current',{credentials:'include'});
    const body=await response.json();
    if(!response.ok) throw new Error(body.error||'Could not load shift');
    setShift(body.data?.shift||null); setMovements(body.data?.movements||[]); setHistory(body.data?.history||[]);
  };
  useEffect(()=>{load().catch(e=>setNotice(e.message));},[]);
  const movementTotal=useMemo(()=>movements.reduce((sum,m)=>sum+(m.movement_type==='cash_in'?Number(m.amount):-Number(m.amount)),0),[movements]);

  const openShift=async()=>{ if(!staffName.trim()) return setNotice('Enter cashier name'); setBusy(true); try{
    const r=await fetch('/api/pos/shifts/open',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({staff_name:staffName.trim(),starting_float:Number(startingFloat)})});
    const b=await r.json(); if(!r.ok) throw new Error(b.error||'Could not open shift'); await load(); setNotice('Shift opened. POS is ready.');
  }catch(e:any){setNotice(e.message)}finally{setBusy(false)}};

  const addMovement=async()=>{ if(!shift) return; if(Number(movementAmount)<=0||!movementReason.trim()) return setNotice('Enter amount and reason'); setBusy(true); try{
    const r=await fetch(\`/api/pos/shifts/\${shift.id}/movements\`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({movement_type:movementType,amount:Number(movementAmount),reason:movementReason.trim()})});
    const b=await r.json(); if(!r.ok) throw new Error(b.error||'Could not save movement'); setMovementAmount('');setMovementReason('');await load();
  }catch(e:any){setNotice(e.message)}finally{setBusy(false)}};

  const closeShift=async()=>{ if(!shift) return; if(closingCash===''||cashBanked==='') return setNotice('Enter closing cash and cash banked'); setBusy(true); try{
    const r=await fetch(\`/api/pos/shifts/\${shift.id}/close\`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({closing_cash:Number(closingCash),cash_banked:Number(cashBanked)})});
    const b=await r.json(); if(!r.ok) throw new Error(b.error||'Could not close shift'); setClosingCash('');setCashBanked('');await load();setNotice('Shift closed and locked.');
  }catch(e:any){setNotice(e.message)}finally{setBusy(false)}};

  return <main className="min-h-dvh bg-[#fffdf4] text-[#171717]">
    <header className="flex h-[70px] items-center justify-between bg-black px-5 text-white"><div className="flex items-center gap-3"><img src="/smash-brothers-logo.png" className="h-11 w-11 object-contain"/><div><h1 className="text-xl font-black">POS Shift</h1><p className="text-xs text-zinc-400">Cash register control</p></div></div><a href="/pos" className="rounded-xl bg-[#ffd400] px-4 py-2 text-sm font-black text-black">Back to POS</a></header>
    {notice&&<button onClick={()=>setNotice('')} className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-xl">{notice} · Close</button>}
    <section className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[1.1fr_.9fr]">
      {!shift?<div className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-black tracking-widest text-emerald-600">REGISTER LOCKED</p><h2 className="mt-2 text-3xl font-black">Open shift</h2><p className="mt-2 text-sm text-zinc-500">The POS cannot process orders until the cashier opens a shift.</p><label className="mt-6 block text-sm font-bold">Cashier name<input value={staffName} onChange={e=>setStaffName(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3"/></label><label className="mt-4 block text-sm font-bold">Starting float<input type="number" min="0" value={startingFloat} onChange={e=>setStartingFloat(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3"/></label><button disabled={busy} onClick={openShift} className="mt-6 w-full rounded-xl bg-[#ffd400] px-5 py-4 text-lg font-black disabled:opacity-50">Open shift</button></div>:
      <div className="space-y-5"><div className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex justify-between"><div><p className="text-xs font-black tracking-widest text-emerald-600">SHIFT OPEN</p><h2 className="mt-1 text-2xl font-black">{shift.staff_name}</h2><p className="text-sm text-zinc-500">Opened {new Date(shift.opened_at).toLocaleString()}</p></div><div className="text-right"><p className="text-xs font-bold text-zinc-400">Starting float</p><p className="text-2xl font-black">{thb(shift.starting_float)}</p></div></div></div>
      <div className="rounded-3xl border bg-white p-6 shadow-sm"><h3 className="text-xl font-black">Money in / money out</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><select value={movementType} onChange={e=>setMovementType(e.target.value as any)} className="rounded-xl border px-3 py-3"><option value="cash_out">Money out</option><option value="cash_in">Money in</option></select><input type="number" min="0" placeholder="Amount" value={movementAmount} onChange={e=>setMovementAmount(e.target.value)} className="rounded-xl border px-3 py-3"/><input placeholder="Reason" value={movementReason} onChange={e=>setMovementReason(e.target.value)} className="rounded-xl border px-3 py-3"/></div><button disabled={busy} onClick={addMovement} className="mt-3 rounded-xl bg-black px-5 py-3 font-black text-white">Record movement</button><div className="mt-4 divide-y">{movements.map(m=><div key={m.id} className="flex justify-between py-3 text-sm"><span><b>{m.movement_type==='cash_in'?'Money in':'Money out'}</b> · {m.reason}</span><span className="font-black">{m.movement_type==='cash_in'?'+':'-'}{thb(m.amount)}</span></div>)}</div><p className="mt-3 text-right text-sm font-bold">Net movement: {thb(movementTotal)}</p></div>
      <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm"><h3 className="text-xl font-black">Close shift</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Cash physically in register<input type="number" min="0" value={closingCash} onChange={e=>setClosingCash(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/></label><label className="text-sm font-bold">Cash banked<input type="number" min="0" value={cashBanked} onChange={e=>setCashBanked(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3"/></label></div><button disabled={busy} onClick={closeShift} className="mt-5 w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-black text-white">Close and lock shift</button></div></div>}
      <div className="rounded-3xl border bg-white p-6 shadow-sm"><h3 className="text-xl font-black">Recent shifts</h3><div className="mt-3 divide-y">{history.map(s=><div key={s.id} className="py-3 text-sm"><div className="flex justify-between"><b>{s.staff_name}</b><span className={s.status==='open'?'font-black text-emerald-600':'font-bold text-zinc-500'}>{s.status.toUpperCase()}</span></div><div className="mt-1 flex justify-between text-zinc-500"><span>{new Date(s.opened_at).toLocaleString()}</span><span>{thb(s.starting_float)}</span></div>{s.status==='closed'&&<div className="mt-1 flex justify-between text-xs"><span>Closing {thb(Number(s.closing_cash||0))} · Banked {thb(Number(s.cash_banked||0))}</span><b>Variance {thb(Number(s.variance||0))}</b></div>}</div>)}</div></div>
    </section>
  </main>;
}
`;
write("client/src/pages/pos/PosShifts.tsx",page);

let app=read("client/src/App.tsx");
if(!app.includes('import PosShifts')) app=app.replace('import PosCatalog from "./pages/pos/PosCatalog";','import PosCatalog from "./pages/pos/PosCatalog";\nimport PosShifts from "./pages/pos/PosShifts";');
if(!app.includes('path="/pos/shifts"')) app=app.replace('<Route path="/pos/display" element={<PosDisplay />} />','<Route path="/pos/display" element={<PosDisplay />} />\n                  <Route path="/pos/shifts" element={<ProtectedRoute><PosShifts /></ProtectedRoute>} />');
write("client/src/App.tsx",app);

let pos=read("server/routes/pos.ts");
const marker='router.get("/orders/next-ticket", staffDevice, async (_req, res) => {';
if(!pos.includes('async function ensurePosShiftSchema')){
const backend=`async function ensurePosShiftSchema() {
  await db().query(\`CREATE TABLE IF NOT EXISTS pos_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_name text NOT NULL, opened_at timestamptz NOT NULL DEFAULT NOW(),
    closed_at timestamptz, starting_float numeric(12,2) NOT NULL DEFAULT 0, closing_cash numeric(12,2), cash_banked numeric(12,2),
    expected_cash numeric(12,2), variance numeric(12,2), status text NOT NULL DEFAULT 'open', opened_by text, closed_by text,
    created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
  )\`);
  await db().query(\`CREATE TABLE IF NOT EXISTS pos_shift_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shift_id uuid NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
    movement_type text NOT NULL CHECK (movement_type IN ('cash_in','cash_out')), amount numeric(12,2) NOT NULL CHECK (amount > 0),
    reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW(), created_by text
  )\`);
  await db().query(\`ALTER TABLE ordering_orders ADD COLUMN IF NOT EXISTS pos_shift_id uuid REFERENCES pos_shifts(id)\`);
  await db().query(\`CREATE UNIQUE INDEX IF NOT EXISTS pos_one_open_shift_idx ON pos_shifts ((status)) WHERE status='open'\`);
}

async function currentPosShift() {
  await ensurePosShiftSchema();
  const result=await db().query(\`SELECT * FROM pos_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1\`);
  return result.rows[0] || null;
}

router.get("/shifts/current", staffDevice, async (_req,res)=>{ try{
  await ensurePosShiftSchema(); const shift=await currentPosShift();
  const movements=shift?(await db().query(\`SELECT * FROM pos_shift_movements WHERE shift_id=$1 ORDER BY created_at DESC\`,[shift.id])).rows:[];
  const history=(await db().query(\`SELECT * FROM pos_shifts ORDER BY opened_at DESC LIMIT 20\`)).rows;
  res.json({ok:true,source:"sbb_pos_core",data:{shift,movements,history}});
}catch(e:any){fail(res,e.message,500)}});

router.post("/shifts/open", staffDevice, async (req,res)=>{ try{
  await ensurePosShiftSchema(); if(await currentPosShift()) return fail(res,"A shift is already open",409);
  const staffName=text(req.body?.staff_name,120); const startingFloat=value(req.body?.starting_float);
  if(!staffName||startingFloat<0) return fail(res,"Cashier name and valid starting float are required");
  const actor=(req as any).user?.username||(req as any).user?.id||staffName;
  const result=await db().query(\`INSERT INTO pos_shifts(staff_name,starting_float,opened_by) VALUES($1,$2,$3) RETURNING *\`,[staffName,startingFloat,actor]);
  res.status(201).json({ok:true,source:"sbb_pos_core",data:result.rows[0]});
}catch(e:any){ if(e.code==='23505') return fail(res,"A shift is already open",409); fail(res,e.message,500)}});

router.post("/shifts/:id/movements", staffDevice, async (req,res)=>{ try{
  await ensurePosShiftSchema(); const movementType=req.body?.movement_type; const amount=value(req.body?.amount); const reason=text(req.body?.reason,240);
  if(!['cash_in','cash_out'].includes(movementType)||amount<=0||!reason) return fail(res,"Movement type, amount and reason are required");
  const open=await db().query(\`SELECT id FROM pos_shifts WHERE id=$1 AND status='open'\`,[req.params.id]); if(!open.rowCount) return fail(res,"Shift is not open",409);
  const actor=(req as any).user?.username||(req as any).user?.id||null;
  const result=await db().query(\`INSERT INTO pos_shift_movements(shift_id,movement_type,amount,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *\`,[req.params.id,movementType,amount,reason,actor]);
  res.status(201).json({ok:true,source:"sbb_pos_core",data:result.rows[0]});
}catch(e:any){fail(res,e.message,500)}});

router.post("/shifts/:id/close", staffDevice, async (req,res)=>{ const client=await db().connect(); try{
  await ensurePosShiftSchema(); await client.query('BEGIN');
  const current=(await client.query(\`SELECT * FROM pos_shifts WHERE id=$1 AND status='open' FOR UPDATE\`,[req.params.id])).rows[0]; if(!current){await client.query('ROLLBACK');return fail(res,"Shift is not open",409)}
  const closingCash=value(req.body?.closing_cash); const cashBanked=value(req.body?.cash_banked); if(closingCash<0||cashBanked<0){await client.query('ROLLBACK');return fail(res,"Closing cash and cash banked must be valid")}
  const sales=(await client.query(\`SELECT COALESCE(SUM(total_amount),0) total FROM ordering_orders WHERE pos_shift_id=$1 AND payment_method='cash' AND payment_status='paid'\`,[req.params.id])).rows[0];
  const moves=(await client.query(\`SELECT COALESCE(SUM(CASE WHEN movement_type='cash_in' THEN amount ELSE -amount END),0) total FROM pos_shift_movements WHERE shift_id=$1\`,[req.params.id])).rows[0];
  const expected=value(current.starting_float)+value(sales.total)+value(moves.total)-cashBanked; const variance=closingCash-expected;
  const actor=(req as any).user?.username||(req as any).user?.id||null;
  const closed=(await client.query(\`UPDATE pos_shifts SET status='closed',closed_at=NOW(),closing_cash=$2,cash_banked=$3,expected_cash=$4,variance=$5,closed_by=$6,updated_at=NOW() WHERE id=$1 RETURNING *\`,[req.params.id,closingCash,cashBanked,expected,variance,actor])).rows[0];
  await client.query('COMMIT'); res.json({ok:true,source:"sbb_pos_core",data:closed});
}catch(e:any){await client.query('ROLLBACK');fail(res,e.message,500)}finally{client.release()}});

`;
pos=pos.replace(marker,backend+marker);
}

if(!pos.includes('POS_SHIFT_REQUIRED')){
pos=pos.replace('router.post("/orders", staffDevice, async (req, res) => {\n  const input = req.body;', 'router.post("/orders", staffDevice, async (req, res) => {\n  const activeShift = await currentPosShift();\n  if (!activeShift) return fail(res, "Open a POS shift before taking orders", 409); // POS_SHIFT_REQUIRED\n  const input = req.body;');
pos=pos.replace('RETURNING *\`,\n          [\n            mode === "grab"', 'RETURNING *\`,\n          [\n            mode === "grab"');
// Add shift assignment immediately after order insert, independent of existing INSERT column list.
pos=pos.replace('const order = (\n        await client.query(', 'const order = (\n        await client.query(');
pos=pos.replace('      ).rows[0];', '      ).rows[0];\n      await client.query(`UPDATE ordering_orders SET pos_shift_id=$2 WHERE id=$1`, [order.id, activeShift.id]);');
}
write("server/routes/pos.ts",pos);
console.log("POS shift workflow installed");
