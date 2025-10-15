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

  async function save(){
    const body = { day, rolls, meat, drinks };
    const res = await fetch(`/api/stock-review/manual-ledger`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    const j = await res.json();
    if (!j.ok) alert(j.error || "Save failed");
  }

  function exportCSV(){
    window.open(`/api/stock-review/manual-ledger/export.csv?date=${day}`, "_blank");
  }

  const pill = (n:number)=> `text-xs px-2 py-1 rounded-full ${n===0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`;

  return (
    <div className="mx-auto max-w-5xl p-3 md:p-6">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur pb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold flex-1">Stock Review</h1>
          <input type="date" className="h-10 rounded-xl border px-3 text-sm"
            value={day} onChange={e=>setDay(e.target.value)} />
          <button onClick={save} className="h-10 rounded-xl bg-slate-900 text-white px-4 text-sm">Save</button>
          <button onClick={exportCSV} className="h-10 rounded-xl border px-4 text-sm">CSV (Day)</button>
        </div>
      </div>

      {/* Rolls */}
      <section className="mt-3 rounded-2xl border p-3 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Rolls (Buns)</h2>
          <span className={pill(rollsVar)}>Variance: {rollsVar}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {[
            ["Prev End", "prev_end"],
            ["Purchased", "purchased"],
            ["Burgers Sold", "sold"],
            ["Expected", "expected", true],
            ["Actual", "actual"],
            ["Paid", "paid"]
          ].map(([label, key, ro]:any)=>(
            <label key={String(key)} className="text-[12px] text-slate-600">
              <div className="mb-1">{label}</div>
              {key==="paid" ? (
                <select value={rolls.paid} onChange={e=>setRolls({...rolls, paid: yn(e.target.value)})}
                        className="h-10 w-full rounded-xl border px-2 text-base">
                  <option value="N">N</option><option value="Y">Y</option>
                </select>
              ) : (
                <input inputMode="numeric" pattern="[0-9]*"
                       value={String((rolls as any)[key])}
                       onChange={e=> setRolls({...rolls, [key]: nz(e.target.value)})}
                       readOnly={!!ro}
                       className="h-10 w-full rounded-xl border px-3 text-base"/>
              )}
            </label>
          ))}
        </div>
      </section>

      {/* Meat */}
      <section className="mt-3 rounded-2xl border p-3 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Meat (grams)</h2>
          <span className={pill(meatVar)}>Variance: {meatVar} g</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {[
            ["Prev End (g)", "prev_end"],
            ["Purchased (g)", "purchased"],
            ["Sold (g)", "sold"],
            ["Expected (g)", "expected", true],
            ["Actual (g)", "actual"],
            ["Paid", "paid"]
          ].map(([label, key, ro]:any)=>(
            <label key={String(key)} className="text-[12px] text-slate-600">
              <div className="mb-1">{label}</div>
              {key==="paid" ? (
                <select value={meat.paid} onChange={e=>setMeat({...meat, paid: yn(e.target.value)})}
                        className="h-10 w-full rounded-xl border px-2 text-base">
                  <option value="N">N</option><option value="Y">Y</option>
                </select>
              ) : (
                <input inputMode="numeric" pattern="[0-9]*"
                       value={String((meat as any)[key])}
                       onChange={e=> setMeat({...meat, [key]: nz(e.target.value)})}
                       readOnly={!!ro}
                       className="h-10 w-full rounded-xl border px-3 text-base"/>
              )}
            </label>
          ))}
        </div>
      </section>

      {/* Drinks */}
      <section className="mt-3 rounded-2xl border p-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 md:p-4">
          <h2 className="text-base font-medium">Drinks (Cans)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                {["Brand","Prev","Purch","Sold","Exp","Act","Var","Paid"].map(h=>(
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drinks.map((d, idx)=>(
                <tr key={d.brand} className="border-t">
                  <td className="px-3 py-2">{d.brand}</td>
                  {(["prev_end","purchased","sold"] as const).map(k=>(
                    <td key={k} className="px-3 py-2">
                      <input inputMode="numeric" pattern="[0-9]*"
                        value={String((d as any)[k])}
                        onChange={e=>{
                          const v = nz(e.target.value);
                          setDrinks(s => s.map((r,i)=> i===idx ? {...r, [k]: v} : r));
                        }}
                        className="h-10 w-24 rounded-xl border px-2 text-base"/>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-slate-500">{d.expected}</td>
                  <td className="px-3 py-2">
                    <input inputMode="numeric" pattern="[0-9]*"
                      value={String(d.actual)}
                      onChange={e=>{
                        const v = nz(e.target.value);
                        setDrinks(s => s.map((r,i)=> i===idx ? {...r, actual: v, variance: v - (r.expected ?? 0)} : r));
                      }}
                      className="h-10 w-24 rounded-xl border px-2 text-base"/>
                  </td>
                  <td className={`px-3 py-2 ${d.variance===0?"text-green-600":"text-red-600"}`}>{d.variance}</td>
                  <td className="px-3 py-2">
                    <select value={d.paid}
                      onChange={e=> setDrinks(s => s.map((r,i)=> i===idx ? {...r, paid: (e.target.value as YN)} : r))}
                      className="h-10 w-16 rounded-xl border px-2 text-base">
                      <option value="N">N</option><option value="Y">Y</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {loading && <div className="mt-3 text-sm text-slate-500">Loading…</div>}
    </div>
  );
}
