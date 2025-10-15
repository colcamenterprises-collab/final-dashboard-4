import { useEffect, useMemo, useState } from "react";

type YN = "Y"|"N";

const BRANDS = [
  "Coke","Coke Zero","Sprite","Schweppes Manow",
  "Red Fanta","Orange Fanta","Red Singha","Yellow Singha","Pink Singha"
];

type RollsMeat = { prev_end:number; purchased:number; sold:number; expected:number; actual:number; paid:YN };
type Drink = { brand:string; prev_end:number; purchased:number; sold:number; expected:number; actual:number; variance:number; paid:YN };

const nz = (v:any)=> Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0;
const yn = (v:any):YN => v==="Y" ? "Y" : "N";

export default function StockReview(){
  const today = new Date().toISOString().slice(0,10);
  const [day, setDay] = useState<string>(today);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rolls, setRolls] = useState<RollsMeat>({prev_end:0,purchased:0,sold:0,expected:0,actual:0,paid:"N"});
  const [meat, setMeat] = useState<RollsMeat>({prev_end:0,purchased:0,sold:0,expected:0,actual:0,paid:"N"});
  const [drinks, setDrinks] = useState<Drink[]>(BRANDS.map(b => ({brand:b, prev_end:0,purchased:0,sold:0,expected:0,actual:0,variance:0,paid:"N"})));

  const rollsVar = useMemo(()=> nz(rolls.actual) - nz(rolls.expected), [rolls]);
  const meatVar = useMemo(()=> nz(meat.actual) - nz(meat.expected), [meat]);

  // recompute exp/variance on edit
  useEffect(()=>{
    setRolls(r => ({...r, expected: nz(r.prev_end) + nz(r.purchased) - nz(r.sold)}));
  }, [rolls.prev_end, rolls.purchased, rolls.sold]);
  useEffect(()=>{
    setMeat(m => ({...m, expected: nz(m.prev_end) + nz(m.purchased) - nz(m.sold)}));
  }, [meat.prev_end, meat.purchased, meat.sold]);
  useEffect(()=>{
    setDrinks(ds => ds.map(d => {
      const expected = nz(d.prev_end) + nz(d.purchased) - nz(d.sold);
      return {...d, expected, variance: nz(d.actual) - expected};
    }));
  }, [JSON.stringify(drinks.map(d=>[d.prev_end,d.purchased,d.sold,d.actual]))]);

  async function load(){
    setLoading(true);
    const res = await fetch(`/api/stock-review/manual-ledger?date=${day}`);
    const data = await res.json();
    if (data?.ok){
      setRolls(data.rolls);
      setMeat(data.meat);
      const map = new Map(data.drinks.map((r:Drink)=>[r.brand,r]));
      setDrinks(BRANDS.map(b => map.get(b) || {brand:b, prev_end:0,purchased:0,sold:0,expected:0,actual:0,variance:0,paid:"N"}));
    }
    setLoading(false);
  }

  useEffect(()=>{ load(); }, [day]);

  async function saveData(status:'draft'|'submit'){
    if(status==='submit'){
      const rOk = Number(rolls?.actual ?? 0) >= 0;
      const mOk = Number(meat?.actual ?? 0) >= 0;
      if(!rOk || !mOk){ alert("Please fill actual counts for Rolls and Meat before submit."); return; }
    }
    setSaving(true);
    try{
      const body:any = { day, status };
      if(rolls) body.rolls = {
        prev_end: Number(rolls.prev_end||0),
        purchased: Number(rolls.purchased||0),
        sold: Number(rolls.sold||0),
        expected: Number(rolls.expected||0),
        actual: Number(rolls.actual||0),
        paid: String(rolls.paid||'N')
      };
      if(meat) body.meat = {
        prev_end: Number(meat.prev_end||0),
        purchased: Number(meat.purchased||0),
        sold: Number(meat.sold||0),
        expected: Number(meat.expected||0),
        actual: Number(meat.actual||0),
        paid: String(meat.paid||'N')
      };
      const res = await fetch('/api/stock-review/manual-ledger/save', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if(!j.ok) throw new Error(j.error||'Save failed');
      alert(status==='submit' ? 'Submitted successfully!' : 'Draft saved!');
    }catch(e:any){ 
      alert(e.message||'Save failed'); 
    } finally{ 
      setSaving(false); 
    }
  }

  function exportCSV(){
    window.open(`/api/stock-review/manual-ledger/export.csv?date=${day}`, "_blank");
  }

  const pill = (n:number)=> `text-xs px-2 py-1 rounded-full ${n===0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`;

  return (
    <div className="mx-auto max-w-5xl p-3 md:p-6 bg-white min-h-screen">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white pb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold flex-1">Stock Review</h1>
          <input type="date" className="h-10 rounded border px-3 text-sm"
            value={day} onChange={e=>setDay(e.target.value)} />
          <button onClick={exportCSV} className="h-10 rounded border px-4 text-sm">CSV (Day)</button>
        </div>
      </div>

      {/* Rolls */}
      <section className="mt-3 rounded border p-3 md:p-4 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Rolls (Buns)</h2>
          <span className={pill(rollsVar)}>Variance: {rollsVar}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={async ()=>{
              try{
                const res = await fetch(`/api/stock-review/manual-ledger/refresh-rolls?date=${day}`, { method:"POST" });
                const j = await res.json();
                if(!j.ok){ alert(j.error || "Auto-fill failed"); return; }
                const r = await fetch(`/api/stock-review/manual-ledger?date=${day}`);
                const d = await r.json();
                if(d?.ok){ setRolls(d.rolls); }
              }catch(e){ alert("Auto-fill failed"); }
            }}
            className="h-9 rounded border px-3 text-sm bg-emerald-50 hover:bg-emerald-100"
            title="Auto-fill Prev/Purchased/Actual from Expenses & Form 2"
          >Auto</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            ["Prev End", "prev_end"],
            ["Purchased", "purchased"],
            ["Burgers Sold", "sold"],
            ["Expected", "expected", true],
            ["Actual", "actual"]
          ].map(([label, key, ro]:any)=>(
            <label key={String(key)} className="text-[12px] text-slate-600">
              <div className="mb-1">{label}</div>
              <input inputMode="numeric" pattern="[0-9]*"
                     value={String((rolls as any)[key])}
                     onChange={e=> setRolls({...rolls, [key]: nz(e.target.value)})}
                     readOnly={!!ro}
                     className="h-10 w-full rounded border px-3 text-sm"/>
            </label>
          ))}
        </div>
      </section>

      {/* Meat */}
      <section className="mt-3 rounded border p-3 md:p-4 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Meat (grams)</h2>
          <span className={pill(meatVar)}>Variance: {meatVar} g</span>
        </div>
{/* [MEAT-AUTO-BTN] */}
<div className="flex items-center gap-2 mb-2">
  <button
    onClick={async ()=>{
      try{
        const res = await fetch(`/api/stock-review/manual-ledger/refresh-meat?date=${day}`, { method:"POST" });
        const j = await res.json();
        if(!j.ok){ alert(j.error || "Auto-fill failed"); return; }
        // Pull fresh state
        const r = await fetch(`/api/stock-review/manual-ledger?date=${day}`);
        const d = await r.json();
        if(d?.ok){
          setMeat(d.meat);
        }
      }catch(e){ alert("Auto-fill failed"); }
    }}
    className="h-9 rounded border px-3 text-sm bg-emerald-50 hover:bg-emerald-100"
    title="Auto-fill Prev/Purchased/Actual from Expenses & Form 2"
  >Auto</button>
</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            ["Prev End (g)", "prev_end"],
            ["Purchased (g)", "purchased"],
            ["Sold (g)", "sold"],
            ["Expected (g)", "expected", true],
            ["Actual (g)", "actual"]
          ].map(([label, key, ro]:any)=>(
            <label key={String(key)} className="text-[12px] text-slate-600">
              <div className="mb-1">{label}</div>
              <input inputMode="numeric" pattern="[0-9]*"
                     value={String((meat as any)[key])}
                     onChange={e=> setMeat({...meat, [key]: nz(e.target.value)})}
                     readOnly={!!ro}
                     className="h-10 w-full rounded border px-3 text-sm"/>
            </label>
          ))}
        </div>
      </section>

      {/* Drinks */}
      <section className="mt-3 rounded border p-0 overflow-hidden shadow-md">
        <div className="flex items-center justify-between p-3 md:p-4">
          <h2 className="text-base font-medium">Drinks (Cans)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left">
                {["Brand","Prev","Purch","Sold","Exp","Act","Var"].map(h=>(
                  <th key={h} className="px-3 py-2 font-medium text-[12px] text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drinks.map((d, idx)=>(
                <tr key={d.brand} className="border-t">
                  <td className="px-3 py-2 text-sm">{d.brand}</td>
                  {(["prev_end","purchased","sold"] as const).map(k=>(
                    <td key={k} className="px-3 py-2">
                      <input inputMode="numeric" pattern="[0-9]*"
                        value={String((d as any)[k])}
                        onChange={e=>{
                          const v = nz(e.target.value);
                          setDrinks(s => s.map((r,i)=> i===idx ? {...r, [k]: v} : r));
                        }}
                        className="h-10 w-24 rounded border px-2 text-sm"/>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-sm text-slate-500">{d.expected}</td>
                  <td className="px-3 py-2">
                    <input inputMode="numeric" pattern="[0-9]*"
                      value={String(d.actual)}
                      onChange={e=>{
                        const v = nz(e.target.value);
                        setDrinks(s => s.map((r,i)=> i===idx ? {...r, actual: v, variance: v - (r.expected ?? 0)} : r));
                      }}
                      className="h-10 w-24 rounded border px-2 text-sm"/>
                  </td>
                  <td className={`px-3 py-2 text-sm ${d.variance===0?"text-green-600":"text-red-600"}`}>{d.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {loading && <div className="mt-3 text-sm text-slate-500">Loading…</div>}

      {/* Sticky footer with Save Draft and Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="mx-auto max-w-5xl px-3 md:px-6 py-3">
          <div className="flex gap-3 justify-end">
            <button 
              disabled={saving} 
              onClick={()=>saveData('draft')} 
              className="h-10 px-6 rounded border text-sm bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button 
              disabled={saving} 
              onClick={()=>saveData('submit')} 
              className="h-10 px-6 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom padding to prevent content from being hidden behind sticky footer */}
      <div className="h-20"></div>
    </div>
  );
}
