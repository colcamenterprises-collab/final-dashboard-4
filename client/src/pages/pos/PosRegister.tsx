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
  const [activeCategory,setActiveCategory] = useState("");
  const [orderNumber,setOrderNumber] = useState("Loading…");

  useEffect(() => {
    fetch(`/api/pos/menu?price_mode=${mode}`,{credentials:"include"})
      .then(r => r.json()).then(x => { setItems(x.data || []); setCart([]); })
      .catch(() => setNotice("Could not load POS menu"));
  },[mode]);

  const refreshOrderNumber = () => fetch("/api/pos/orders/next-ticket",{credentials:"include"})
    .then(r => { if (r.status === 401) { window.location.assign("/pos?lock=1"); return null; } return r.json(); })
    .then(x => x?.data?.ticket_number && setOrderNumber(x.data.ticket_number))
    .catch(() => setOrderNumber("Pending"));

  useEffect(() => { refreshOrderNumber(); },[]);

  const categories = useMemo(() => [...new Set(items.map(x => x.category_name))],[items]);
  const drinks = useMemo(() => items.filter(x => x.category_name === "Drinks"),[items]);
  const label = (x:{name_en:string;name_th?:string}) => language === "th" && x.name_th ? x.name_th : x.name_en;
  const lineTotal = (line:Line) => (line.active_price + (line.set_upgrade ? 80 : 0) + (line.modifiers || []).reduce((sum,m) => sum + Number(m.price_delta || 0),0)) * line.quantity;
  const total = cart.reduce((sum,line) => sum + lineTotal(line),0);
  const change = Math.max(0,Number(cash || 0) - total);

  useEffect(() => {
    setActiveCategory(current => current || categories[0] || "");
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveCategory((visible.target as HTMLElement).dataset.category || "");
    },{root:null,rootMargin:"-150px 0px -60% 0px",threshold:0});
    categories.forEach(category => { const element = document.getElementById(category.replaceAll(" ","-")); if (element) observer.observe(element); });
    return () => observer.disconnect();
  },[categories]);

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
      if (response.status === 401) { window.location.assign("/pos?lock=1"); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load additions");
      setPending({item,modifiers:[]}); setModifierOptions(body.data || []); setFlow("modifiers"); setSetUpgrade(false); setSelectedDrink("");
    } catch (error:any) { setNotice(error.message); }
  };

  const toggleModifier = (modifier:Modifier) => setPending(current => current && ({...current,modifiers:current.modifiers.some(m => m.id === modifier.id) ? current.modifiers.filter(m => m.id !== modifier.id) : [...current.modifiers,modifier]}));
  const finishBurger = () => {
    if (!pending) return;
    if (pending.item.set_upgrade_eligible && setUpgrade && !selectedDrink) return setNotice("Select the set drink before continuing");
    commitLine({...pending.item,quantity:1,modifiers:pending.modifiers,set_upgrade:pending.item.set_upgrade_eligible ? setUpgrade : false,set_drink_menu_item_id:selectedDrink || undefined});
    setPending(null);
  };
  const charge = async () => {
    try {
      const response = await fetch("/api/pos/orders",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_mode:mode,payment_method:mode === "grab" ? "grab" : payment,items:cart.map(x => ({menu_item_id:x.id,quantity:x.quantity,notes:x.notes || undefined,set_upgrade:mode === "direct" && !!x.set_upgrade,set_drink_menu_item_id:x.set_drink_menu_item_id,modifier_ids:(x.modifiers || []).map(m => m.id)}))})});
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not create order");
      setNotice(`${body.data.ticket_number} sent to kitchen`); setCart([]); setCash(""); refreshOrderNumber();
    } catch (error:any) { setNotice(error.message); }
  };

  return <main className="h-dvh overflow-hidden bg-[#fffdf4] text-[#171717]">
    <header className="flex h-[70px] items-center justify-between bg-[#111111] px-5 text-white shadow-lg">
      <div className="flex items-center gap-4"><img src="/smash-brothers-logo.png" alt="Smash Brothers Burgers" className="h-12 w-12 rounded-xl object-contain"/><nav className="hidden gap-1 lg:flex"><span className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">POS</span><a href="/pos/kitchen" className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">Kitchen</a><a href="/pos/display" className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">Ticket display</a><a href="/pos/shifts" className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">Shift</a></nav></div>
      <div className="flex items-center gap-2"><button className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold" onClick={()=>setLanguage(language === "en" ? "th" : "en")}>{language === "en" ? "ไทย" : "EN"}</button><button className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === "direct" ? "bg-white text-black" : "bg-white/10"}`} onClick={()=>setMode("direct")}>Counter</button><button className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === "grab" ? "bg-[#ffd400] text-black" : "bg-white/10"}`} onClick={()=>setMode("grab")}>Grab</button></div>
    </header>
    {notice && <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-2xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white shadow-2xl">{notice}</div>}
    <div className="grid h-[calc(100dvh-70px)] grid-cols-[minmax(0,1fr)_348px] overflow-hidden">
      <section className="min-w-0 overflow-y-auto px-5 pb-10 pt-4">
        <div className="sticky top-0 z-10 -mx-5 mb-7 border-b border-[#d7ae00] bg-[#ffd400] px-5 py-4 shadow-sm"><div className="flex gap-3 overflow-x-auto pb-1">{categories.map(category => <button type="button" onClick={()=>{setActiveCategory(category);document.getElementById(category.replaceAll(" ","-"))?.scrollIntoView({behavior:"smooth",block:"start"});}} key={category} className={`shrink-0 rounded-2xl border px-5 py-3 text-sm font-bold shadow-[0_4px_14px_rgba(30,26,13,0.06)] transition ${activeCategory === category ? "border-black bg-black text-white" : "border-[#e8c72a] bg-white text-black hover:border-black"}`}>{category}</button>)}</div></div>
        <div className="mb-7"><p className="text-[11px] font-black tracking-[0.1em] text-[#15945c]">{mode === "grab" ? "GRAB" : "DIRECT ORDER"}</p></div>
        {categories.map((category,categoryIndex) => <section id={category.replaceAll(" ","-")} data-category={category} key={category} className={`mb-12 scroll-mt-28 rounded-[28px] p-5 ${categoryIndex % 2 === 0 ? "bg-[#fff9e8]" : "bg-[#f7f5ee]"}`}><div className="mb-5 flex items-center gap-3"><h2 className="text-xl font-black">{category}</h2><span className="h-px flex-1 bg-[#ded8c7]"/></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{items.filter(x => x.category_name === category).map(item => <button key={item.id} onClick={()=>startItem(item)} className="group relative min-h-[190px] overflow-hidden rounded-[22px] border border-[#eee9d9] bg-white p-3 text-left shadow-[0_7px_22px_rgba(38,31,7,0.055)] transition hover:-translate-y-1 hover:border-[#ffd400] hover:shadow-[0_13px_28px_rgba(38,31,7,0.11)]"><div className="flex h-[84px] items-center justify-center">{isBurger(item) && <img src={burgerImage} alt="" className="h-[80px] w-[112px] object-contain drop-shadow-[0_9px_8px_rgba(39,27,8,0.2)]"/>}</div><p className="mt-1 line-clamp-2 min-h-10 text-[13px] font-extrabold leading-5">{label(item)}</p><p className="mt-2 text-base font-black">{thb(item.active_price)}</p><span className="mt-2 grid h-8 w-full place-items-center rounded-full bg-[#ffd400] text-lg font-black leading-none text-black transition group-hover:bg-black group-hover:text-white">+</span></button>)}</div></section>)}
      </section>
      <aside className="m-3 ml-0 flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-[#eee9d9] bg-white shadow-[0_10px_30px_rgba(38,31,7,0.08)]"><div className="flex items-center justify-between border-b border-[#eee9d9] px-5 py-4"><div><h2 className="text-xl font-black">Current order</h2><p className="mt-1 text-xs font-bold text-zinc-400">Order · {orderNumber}</p></div><button onClick={()=>setCart([])} className="rounded-xl px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50">Clear</button></div><div className="min-h-0 flex-1 overflow-y-auto px-5">{cart.length === 0 ? <div className="grid h-full place-items-center text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff6c9] text-xl">+</div><p className="mt-3 text-sm font-bold text-zinc-500">Add items to start an order</p></div></div> : cart.map((line,index) => <div key={`${line.id}-${index}`} className="border-b border-[#f1eee4] py-3"><div className="flex justify-between gap-2 text-sm font-bold"><span className="leading-5">{line.quantity} × {label(line)}</span><span>{thb(lineTotal(line))}</span></div>{(line.modifiers || []).map(modifier => <p key={modifier.id} className="mt-1 text-xs font-medium text-[#15945c]">+ {label(modifier)} · {thb(modifier.price_delta)}</p>)}{line.set_upgrade && <p className="mt-1 text-xs font-medium text-[#856a00]">Set upgrade · {drinks.find(drink => drink.id === line.set_drink_menu_item_id)?.name_en}</p>}{isBurger(line) && <input list="burger-request-suggestions" value={line.notes || ""} onChange={event=>setCart(current=>current.map((item,i)=>i === index ? {...item,notes:event.target.value} : item))} className="mt-2 w-full rounded-xl border border-[#e9e4d5] bg-[#fffdf8] px-3 py-2 text-xs outline-none focus:border-[#ffd400]" placeholder="Item request, e.g. No cheese"/>}</div>)}</div><datalist id="burger-request-suggestions"><option value="No cheese"/><option value="No tomato"/><option value="No salad"/><option value="No onions"/><option value="No pickles"/><option value="No jalapenos"/><option value="No burger sauce"/><option value="No meat"/><option value="No bun"/></datalist><div className="border-t border-[#eee9d9] bg-[#fffefa] p-5"><div className="flex items-end justify-between"><span className="text-lg font-black">Total</span><span className="text-3xl font-black">{thb(total)}</span></div>{mode === "direct" && payment === "cash" && <><input inputMode="decimal" value={cash} onChange={event=>setCash(event.target.value)} placeholder="Cash received" className="mt-3 w-full rounded-xl border border-[#e9e4d5] bg-white px-3 py-3 text-sm outline-none focus:border-[#ffd400]"/><div className="mt-2 flex justify-between text-sm font-bold"><span>Change</span><span>{thb(change)}</span></div></>}<div className="mt-4 grid grid-cols-3 gap-2">{["cash","manual_qr_transfer","grab"].map(method => <button key={method} disabled={mode === "grab" && method !== "grab"} onClick={()=>setPayment(method)} className={`rounded-xl py-3 text-xs font-black transition ${payment === method ? "bg-[#171717] text-white" : "bg-[#f4f2eb] text-zinc-600 hover:bg-[#ebe7d8]"}`}>{method === "manual_qr_transfer" ? "QR" : method}</button>)}</div><button disabled={!cart.length} onClick={charge} className="mt-3 w-full rounded-xl bg-[#ffd400] py-4 text-base font-black text-black shadow-[0_7px_0_#d7ae00] transition hover:bg-[#ffe042] active:translate-y-0.5 active:shadow-[0_4px_0_#d7ae00] disabled:cursor-not-allowed disabled:opacity-40">Charge {thb(total)}</button></div></aside>
    </div>
    {pending && <div className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black tracking-[0.1em] text-[#15945c]">{flow === "modifiers" ? "STEP 1 OF 2" : "STEP 2 OF 2"}</p><h2 className="mt-1 text-2xl font-black">{flow === "modifiers" ? "Make it Better" : "Make it a set?"}</h2><p className="mt-1 text-sm text-zinc-600">{label(pending.item)}</p></div><button onClick={()=>setPending(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100">Close</button></div>{flow === "modifiers" ? <><p className="mt-5 text-sm text-zinc-600">Offer these additions before continuing.</p><div className="mt-3 grid grid-cols-2 gap-2">{modifierOptions.map(modifier => <button key={modifier.id} onClick={()=>toggleModifier(modifier)} className={`rounded-2xl border p-4 text-left font-bold ${(pending.modifiers.some(m => m.id === modifier.id)) ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200 hover:border-[#ffd400]"}`}><span className="block">{label(modifier)}</span><span className="mt-1 block text-sm text-[#15945c]">+{thb(modifier.price_delta)}</span></button>)}</div><button onClick={()=>pending.item.set_upgrade_eligible ? setFlow("upgrade") : finishBurger()} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">Continue</button></> : <><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setSetUpgrade(false)} className={`rounded-2xl border p-4 font-bold ${!setUpgrade ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200"}`}>Burger only</button><button onClick={()=>setSetUpgrade(true)} className={`rounded-2xl border p-4 font-bold ${setUpgrade ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200"}`}>Set +฿80</button></div>{setUpgrade && <select value={selectedDrink} onChange={event=>setSelectedDrink(event.target.value)} className="mt-3 w-full rounded-xl border p-3"><option value="">Select included drink</option>{drinks.map(drink => <option key={drink.id} value={drink.id}>{label(drink)}</option>)}</select>}<button onClick={finishBurger} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">Add to order</button></>}</div></div>}
  </main>;
}
