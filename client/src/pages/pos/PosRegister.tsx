import { useEffect, useMemo, useState } from "react";

type Item = { id:string; name_en:string; name_th?:string; category_name:string; active_price:number; set_upgrade_eligible:boolean };
type Modifier = { id:string; name_en:string; name_th?:string; price_delta:number; modifier_group_name_en:string };
type Line = Item & { quantity:number; set_upgrade?:boolean; set_drink_menu_item_id?:string; modifiers?:Modifier[]; notes?:string };
type Pending = { item:Item; modifiers:Modifier[] };

const thb = (n:number) => `฿${Number(n || 0).toLocaleString()}`;
const burgerImage = "/burger-placeholder.png";
const isBurger = (item:Item) => /burger|smash/i.test(item.category_name + item.name_en);

export default function PosRegister() {
  const [mode,setMode] = useState<"direct"|"grab">("direct");
  const [items,setItems] = useState<Item[]>([]);
  const [cart,setCart] = useState<Line[]>([]);
  const [cash,setCash] = useState("");
  const [payment,setPayment] = useState("cash");
  const [language,setLanguage] = useState<"en"|"th">("en");
  const [notice,setNotice] = useState("");
  const [pending,setPending] = useState<Pending | null>(null);
  const [modifierOptions,setModifierOptions] = useState<Modifier[]>([]);
  const [flow,setFlow] = useState<"modifiers"|"upgrade">("modifiers");
  const [selectedDrink,setSelectedDrink] = useState("");
  const [setUpgrade,setSetUpgrade] = useState(false);

  useEffect(() => {
    fetch(`/api/pos/menu?price_mode=${mode}`,{credentials:"include"})
      .then(r => r.json()).then(x => { setItems(x.data || []); setCart([]); })
      .catch(() => setNotice("Could not load POS menu"));
  },[mode]);

  const categories = useMemo(() => [...new Set(items.map(x => x.category_name))],[items]);
  const drinks = useMemo(() => items.filter(x => x.category_name === "Drinks"),[items]);
  const label = (x:{name_en:string;name_th?:string}) => language === "th" && x.name_th ? x.name_th : x.name_en;
  const lineTotal = (line:Line) => (line.active_price + (line.set_upgrade ? 80 : 0) + (line.modifiers || []).reduce((sum,m) => sum + Number(m.price_delta || 0),0)) * line.quantity;
  const total = cart.reduce((sum,line) => sum + lineTotal(line),0);
  const change = Math.max(0,Number(cash || 0) - total);

  const commitLine = (line:Line) => {
    if (isBurger(line)) return setCart(current => [...current,line]);
    setCart(current => {
      const index = current.findIndex(x => x.id === line.id && !x.set_upgrade && !(x.modifiers || []).length);
      return index < 0 ? [...current,line] : current.map((x,i) => i === index ? {...x,quantity:x.quantity + 1} : x);
    });
  };

  const startItem = async (item:Item) => {
    if (mode === "grab" || !isBurger(item)) return commitLine({...item,quantity:1});
    try {
      const response = await fetch(`/api/pos/menu/${item.id}/modifiers`,{credentials:"include"});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load modifiers");
      setPending({item,modifiers:[]});
      setModifierOptions(body.data || []);
      setFlow("modifiers");
      setSetUpgrade(false);
      setSelectedDrink("");
    } catch (error:any) { setNotice(error.message); }
  };

  const toggleModifier = (modifier:Modifier) => {
    setPending(current => current && ({...current,modifiers:current.modifiers.some(m => m.id === modifier.id) ? current.modifiers.filter(m => m.id !== modifier.id) : [...current.modifiers,modifier]}));
  };

  const finishBurger = () => {
    if (!pending) return;
    if (pending.item.set_upgrade_eligible && setUpgrade && !selectedDrink) return setNotice("Select the set drink before continuing");
    commitLine({...pending.item,quantity:1,modifiers:pending.modifiers,set_upgrade:pending.item.set_upgrade_eligible ? setUpgrade : false,set_drink_menu_item_id:selectedDrink || undefined});
    setPending(null);
  };

  const charge = async () => {
    try {
      const response = await fetch("/api/pos/orders",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        order_mode:mode,payment_method:mode === "grab" ? "grab" : payment,
        items:cart.map(x => ({menu_item_id:x.id,quantity:x.quantity,notes:x.notes || undefined,set_upgrade:mode === "direct" && !!x.set_upgrade,set_drink_menu_item_id:x.set_drink_menu_item_id,modifier_ids:(x.modifiers || []).map(m => m.id)}))
      })});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create order");
      setNotice(`${body.data.ticket_number} sent to kitchen`); setCart([]); setCash("");
    } catch (error:any) { setNotice(error.message); }
  };

  return <main className="h-dvh overflow-hidden bg-[#f5f4ed] text-zinc-950">
    <header className="flex h-16 items-center justify-between bg-[#101010] px-5 text-white"><div><b className="tracking-wide text-yellow-400">SMASH BROTHERS</b><span className="ml-3 text-sm text-zinc-400">Register 1</span></div><div className="flex items-center gap-2"><button className="rounded bg-zinc-800 px-3 py-2 text-sm" onClick={()=>setLanguage(language === "en" ? "th" : "en")}>{language === "en" ? "ไทย" : "EN"}</button><button className={`rounded px-4 py-2 font-bold ${mode === "direct" ? "bg-white text-black" : "bg-zinc-800"}`} onClick={()=>setMode("direct")}>Counter</button><button className={`rounded px-4 py-2 font-bold ${mode === "grab" ? "bg-green-600" : "bg-zinc-800"}`} onClick={()=>setMode("grab")}>Grab</button></div></header>
    {notice && <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded bg-black px-4 py-3 text-white">{notice}</div>}
    <div className="grid h-[calc(100dvh-64px)] grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-y-auto p-4"><div className="sticky top-0 z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b bg-[#f5f4ed]/95 px-4 py-3 backdrop-blur">{categories.map(category => <button type="button" onClick={()=>document.getElementById(category.replaceAll(" ","-"))?.scrollIntoView({behavior:"smooth",block:"start"})} key={category} className="shrink-0 rounded-xl bg-white px-4 py-3 text-sm font-bold shadow-sm hover:bg-yellow-300">{category}</button>)}</div><div className="mb-4"><p className="text-xs font-bold text-green-700">{mode === "grab" ? "GRAB PRICING · NO UPSELL" : "DIRECT PRICING · REQUIRED BURGER FLOW"}</p><h1 className="text-3xl font-black">New order</h1></div>{categories.map(category => <section id={category.replaceAll(" ","-")} key={category} className="mb-6 scroll-mt-20"><h2 className="mb-3 text-lg font-black">{category}</h2><div className="grid grid-cols-3 gap-2 xl:grid-cols-4">{items.filter(x => x.category_name === category).map(item => <button key={item.id} onClick={()=>startItem(item)} className="min-h-32 rounded-xl bg-white p-2 text-left shadow-sm hover:ring-2 hover:ring-yellow-400">{isBurger(item) && <img src={burgerImage} alt="" className="mx-auto h-14 w-full object-contain"/>}<p className="mt-1 line-clamp-2 text-sm font-bold">{label(item)}</p><p className="mt-1 text-lg font-black">{thb(item.active_price)}</p></button>)}</div></section>)}</section>
      <aside className="flex min-w-0 flex-col border-l bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Current order</h2><button onClick={()=>setCart([])} className="text-sm text-red-700">Clear</button></div><div className="min-h-0 flex-1 overflow-y-auto">{cart.map((line,index) => <div key={`${line.id}-${index}`} className="border-b py-3"><div className="flex justify-between gap-2 text-sm font-bold"><span>{line.quantity} × {label(line)}</span><span>{thb(lineTotal(line))}</span></div>{(line.modifiers || []).map(modifier => <p key={modifier.id} className="mt-1 text-xs text-zinc-600">+ {label(modifier)} {thb(modifier.price_delta)}</p>)}{line.set_upgrade && <p className="mt-1 text-xs text-zinc-600">+ Set upgrade · {drinks.find(drink => drink.id === line.set_drink_menu_item_id)?.name_en}</p>}{isBurger(line) && <input list="burger-request-suggestions" value={line.notes || ""} onChange={event=>setCart(current=>current.map((item,i)=>i === index ? {...item,notes:event.target.value} : item))} className="mt-2 w-full rounded border border-zinc-200 p-2 text-xs" placeholder="Item request (optional)" />}</div>)}</div><datalist id="burger-request-suggestions"><option value="No cheese"/><option value="No tomato"/><option value="No salad"/><option value="No onions"/><option value="No pickles"/><option value="No jalapenos"/><option value="No burger sauce"/><option value="No meat"/><option value="No bun"/></datalist><div className="border-t pt-3"><div className="flex justify-between text-2xl font-black"><span>Total</span><span>{thb(total)}</span></div>{mode === "direct" && payment === "cash" && <><input inputMode="decimal" value={cash} onChange={event=>setCash(event.target.value)} placeholder="Cash received" className="mt-3 w-full rounded border p-3"/><div className="mt-2 flex justify-between font-bold"><span>Change</span><span>{thb(change)}</span></div></>}<div className="mt-3 grid grid-cols-3 gap-1">{["cash","manual_qr_transfer","grab"].map(method => <button key={method} disabled={mode === "grab" && method !== "grab"} onClick={()=>setPayment(method)} className={`rounded p-2 text-xs font-bold ${payment === method ? "bg-black text-white" : "bg-zinc-100"}`}>{method === "manual_qr_transfer" ? "QR" : method}</button>)}</div><button disabled={!cart.length} onClick={charge} className="mt-3 w-full rounded-xl bg-yellow-400 p-4 text-lg font-black disabled:opacity-40">Charge {thb(total)}</button></div></aside>
    </div>
    {pending && <div className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold text-green-700">{flow === "modifiers" ? "STEP 1 OF 2" : "STEP 2 OF 2"}</p><h2 className="text-2xl font-black">{flow === "modifiers" ? "Make it Better" : "Make it a set?"}</h2><p className="text-sm text-zinc-600">{label(pending.item)}</p></div><button onClick={()=>setPending(null)} className="text-zinc-500">Close</button></div>{flow === "modifiers" ? <><p className="mt-4 text-sm">Select any additions requested by the customer.</p><div className="mt-3 grid grid-cols-2 gap-2">{modifierOptions.map(modifier => <button key={modifier.id} onClick={()=>toggleModifier(modifier)} className={`rounded-xl border p-3 text-left font-bold ${(pending.modifiers.some(m => m.id === modifier.id)) ? "border-yellow-400 bg-yellow-50" : "border-zinc-200"}`}><span className="block">{label(modifier)}</span><span className="text-sm">+{thb(modifier.price_delta)}</span></button>)}</div><button onClick={()=>pending.item.set_upgrade_eligible ? setFlow("upgrade") : finishBurger()} className="mt-5 w-full rounded-xl bg-yellow-400 p-4 font-black">Continue</button></> : <><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>setSetUpgrade(false)} className={`rounded-xl border p-4 font-bold ${!setUpgrade ? "border-yellow-400 bg-yellow-50" : "border-zinc-200"}`}>Burger only</button><button onClick={()=>setSetUpgrade(true)} className={`rounded-xl border p-4 font-bold ${setUpgrade ? "border-yellow-400 bg-yellow-50" : "border-zinc-200"}`}>Set +฿80</button></div>{setUpgrade && <select value={selectedDrink} onChange={event=>setSelectedDrink(event.target.value)} className="mt-3 w-full rounded border p-3"><option value="">Select included drink</option>{drinks.map(drink => <option key={drink.id} value={drink.id}>{label(drink)}</option>)}</select>}<button onClick={finishBurger} className="mt-5 w-full rounded-xl bg-yellow-400 p-4 font-black">Add to order</button></>}</div></div>}
  </main>;
}
