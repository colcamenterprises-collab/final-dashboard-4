import { useEffect, useMemo, useState } from "react";

const card = "rounded-2xl shadow-sm border border-gray-200 p-3 mb-4";
const label = "text-xs text-gray-600";
const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm";
const badge = (v:number)=> v===0 ? "inline-block px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs"
                                : "inline-block px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-xs";

type Shift = any;
type DrinkRow = { name:string; prev_end:number; purchased:number; sold:number; expected:number; actual:number; variance:number; paid:boolean; };

async function api<T=any>(path:string, init?:RequestInit):Promise<T>{
  const r = await fetch(path, { headers: { "Content-Type":"application/json" }, ...init });
  return r.json();
}

export default function StockReview(){
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [shift, setShift] = useState<Shift|null>(null);
  const [drinks, setDrinks] = useState<DrinkRow[]>([]);
  const [saving, setSaving] = useState(false);

  const brands = useMemo(()=> drinks.map(d=>d.name), [drinks]);

  useEffect(() => {
    (async () => {
      const res = await api<{ok:boolean; item:Shift|null; drinks:DrinkRow[]}>(`/api/stock-review/manual-ledger?date=${date}`);
      if (res.ok){
        setShift(res.item || {
          shift_date: date, rolls_prev_end:0, rolls_purchased:0, burgers_sold:0, rolls_actual:0, rolls_paid:false,
          meat_prev_end_g:0, meat_purchased_g:0, meat_sold_g:0, meat_actual_g:0, meat_paid:false
        });
        setDrinks(res.drinks || []);
      }
    })();
  }, [date]);

  const rollsExpected = (Number(shift?.rolls_prev_end||0)+Number(shift?.rolls_purchased||0)-Number(shift?.burgers_sold||0))|0;
  const rollsVariance = (Number(shift?.rolls_actual||0)-rollsExpected)|0;

  const meatExpected  = (Number(shift?.meat_prev_end_g||0)+Number(shift?.meat_purchased_g||0)-Number(shift?.meat_sold_g||0))|0;
  const meatVariance  = (Number(shift?.meat_actual_g||0)-meatExpected)|0;

  async function saveBase(){
    setSaving(true);
    const body = JSON.stringify({ ...shift,
      roll_expected: rollsExpected, meat_expected_g: meatExpected
    });
    const method = shift?.id ? "PUT" : "POST";
    const url = shift?.id ? `/api/stock-review/manual-ledger/${shift.id}` : "/api/stock-review/manual-ledger";
    const res = await api<{ok:boolean; item:any}>(url,{ method, body});
    if (res.ok){
      setShift(res.item);
    }
    setSaving(false);
  }

  async function saveDrinks(){
    if (!shift?.id) { await saveBase(); }
    const id = shift?.id;
    if (!id) return;
    const body = JSON.stringify(drinks.map(d=>({ brand:d.name, prev_end:d.prev_end, purchased:d.purchased, sold:d.sold, actual:d.actual, paid:d.paid })));
    await api(`/api/stock-review/manual-ledger/${id}/drinks`, { method:"PUT", body });
  }

  async function saveAll(){
    await saveBase();
    await saveDrinks();
    alert("Saved!");
  }

  function updateShift(k:string, v:any){
    setShift((s:any)=> ({...s, [k]:v}));
  }

  function editDrink(idx:number, k:keyof DrinkRow, v:any){
    setDrinks(ds=>{
      const copy = [...ds];
      const d = {...copy[idx]};
      (d as any)[k] = k==="paid" ? !!v : Number(v||0);
      d.expected = (Number(d.prev_end||0)+Number(d.purchased||0)-Number(d.sold||0))|0;
      d.variance = (Number(d.actual||0)-d.expected)|0;
      copy[idx]=d;
      return copy;
    });
  }

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Stock Review</h1>
        <div className="flex gap-2">
          <input type="date" className={input} value={date} onChange={e=>setDate(e.target.value)} />
          <button onClick={saveAll} disabled={saving} className="px-3 py-2 rounded-xl bg-black text-white text-sm">{saving ? "Saving..." : "Save"}</button>
          <a className="px-3 py-2 rounded-xl border text-sm" href={`/api/stock-review/manual-ledger/export.csv?from=${date}&to=${date}`} target="_blank" rel="noreferrer">Export CSV (Day)</a>
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Rolls (Buns)</h2>
          <span className={badge(rollsVariance)}>Variance: {rollsVariance}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div><div className={label}>Prev End</div><input className={input} type="number" value={shift?.rolls_prev_end||0} onChange={e=>updateShift("rolls_prev_end", Number(e.target.value))}/></div>
          <div><div className={label}>Purchased</div><input className={input} type="number" value={shift?.rolls_purchased||0} onChange={e=>updateShift("rolls_purchased", Number(e.target.value))}/></div>
          <div><div className={label}>Burgers Sold</div><input className={input} type="number" value={shift?.burgers_sold||0} onChange={e=>updateShift("burgers_sold", Number(e.target.value))}/></div>
          <div><div className={label}>Expected</div><input className={input+" bg-gray-50"} readOnly value={rollsExpected}/></div>
          <div><div className={label}>Actual</div><input className={input} type="number" value={shift?.rolls_actual||0} onChange={e=>updateShift("rolls_actual", Number(e.target.value))}/></div>
          <div><div className={label}>Paid</div>
            <select className={input} value={shift?.rolls_paid ? "Y":"N"} onChange={e=>updateShift("rolls_paid", e.target.value==="Y")}><option>N</option><option>Y</option></select>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium">Meat (grams)</h2>
          <span className={badge(meatVariance)}>Variance: {meatVariance} g</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div><div className={label}>Prev End (g)</div><input className={input} type="number" value={shift?.meat_prev_end_g||0} onChange={e=>updateShift("meat_prev_end_g", Number(e.target.value))}/></div>
          <div><div className={label}>Purchased (g)</div><input className={input} type="number" value={shift?.meat_purchased_g||0} onChange={e=>updateShift("meat_purchased_g", Number(e.target.value))}/></div>
          <div><div className={label}>Sold (g)</div><input className={input} type="number" value={shift?.meat_sold_g||0} onChange={e=>updateShift("meat_sold_g", Number(e.target.value))}/></div>
          <div><div className={label}>Expected (g)</div><input className={input+" bg-gray-50"} readOnly value={meatExpected}/></div>
          <div><div className={label}>Actual (g)</div><input className={input} type="number" value={shift?.meat_actual_g||0} onChange={e=>updateShift("meat_actual_g", Number(e.target.value))}/></div>
          <div><div className={label}>Paid</div>
            <select className={input} value={shift?.meat_paid ? "Y":"N"} onChange={e=>updateShift("meat_paid", e.target.value==="Y")}><option>N</option><option>Y</option></select>
          </div>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-base font-medium mb-2">Drinks (Cans)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Brand</th>
                <th className="text-left py-2">Prev</th>
                <th className="text-left py-2">Purch</th>
                <th className="text-left py-2">Sold</th>
                <th className="text-left py-2 bg-gray-50">Exp</th>
                <th className="text-left py-2">Act</th>
                <th className="text-left py-2">Var</th>
                <th className="text-left py-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {drinks.map((d,i)=>(
                <tr key={d.name} className="border-b">
                  <td className="py-2 font-medium">{d.name}</td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.prev_end||0} onChange={e=>editDrink(i,'prev_end',e.target.value)}/></td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.purchased||0} onChange={e=>editDrink(i,'purchased',e.target.value)}/></td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.sold||0} onChange={e=>editDrink(i,'sold',e.target.value)}/></td>
                  <td className="bg-gray-50">{d.expected}</td>
                  <td><input type="number" className="w-16 border px-1 py-1 text-xs rounded" value={d.actual||0} onChange={e=>editDrink(i,'actual',e.target.value)}/></td>
                  <td><span className={badge(d.variance)}>{d.variance}</span></td>
                  <td>
                    <select className="border px-1 py-1 text-xs rounded" value={d.paid?"Y":"N"} onChange={e=>editDrink(i,'paid',e.target.value==="Y")}>
                      <option>N</option><option>Y</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
