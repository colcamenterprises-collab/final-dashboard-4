import { useEffect, useMemo, useState } from "react";

type Item = { id:string; name_en:string; name_th?:string; category_name:string; category_name_th?:string; active_price:number; set_upgrade_eligible:boolean };
type Modifier = { id:string; name_en:string; name_th?:string; price_delta:number; modifier_group_name_en:string };
type Line = Item & { quantity:number; set_upgrade?:boolean; meal_deal?:boolean; set_drink_menu_item_id?:string; modifiers?:Modifier[]; notes?:string };
type Pending = { item:Item; modifiers:Modifier[] };
type Discount = { id:string; code:string; name:string; discount_type:"percent"|"fixed"; value:number; active?:boolean };

const thb = (n:number) => `฿${Number(n || 0).toLocaleString()}`;
const burgerImage = "/burger-placeholder.png";
const isBurger = (item:Item) => /burger|smash/i.test(item.category_name + item.name_en);
const isMealDeal = (item:Item) => /meal deals?/i.test(item.category_name);
const thaiCategoryNames: Record<string, string> = {
  "Burgers":"เบอร์เกอร์", "Chicken Burgers":"เบอร์เกอร์ไก่", "Shaker Fries":"เชคเฟรนช์ฟรายส์",
  "Meal Deals":"ชุดสุดคุ้ม", "Sides":"ของทานเล่น", "Drinks":"เครื่องดื่ม",
};
const thaiMenuNames: Record<string, string> = {
  "Original Single Smash Burger":"สมาชเบอร์เกอร์ซิงเกิล", "Ultimate Double Smash Burger":"สมาชเบอร์เกอร์ดับเบิล", "Super Double Bacon and Cheese":"ซูเปอร์ดับเบิลเบคอนชีส", "Triple Smash Burger":"สมาชเบอร์เกอร์ทริปเปิล",
  "Crispy Chicken Fillet Burger":"คริสปี้ชิคเก้นฟิเลต์เบอร์เกอร์", "Karaage Chicken Burger":"คาราอาเกะชิคเก้นเบอร์เกอร์", "Chicken Fillet Sriracha Burger":"ชิคเก้นฟิเลต์ศรีราชาเบอร์เกอร์",
  "Cajun Shaker Fries":"เฟรนช์ฟรายส์เชคคาจัน", "Hot and Spicy Shaker Fries":"เฟรนช์ฟรายส์เชคฮอตแอนด์สไปซี่", "Wingzab Shaker Fries":"เฟรนช์ฟรายส์เชควิงแซ่บ",
  "Chicken Fillet Meal Deal":"ชุดชิคเก้นฟิเลต์", "Karaage Chicken Meal Deal":"ชุดคาราอาเกะชิคเก้น", "Single Smash Burger Set":"ชุดสมาชเบอร์เกอร์ซิงเกิล", "Ultimate Double Smash Burger Set":"ชุดสมาชเบอร์เกอร์ดับเบิล", "Super Double Bacon and Cheese Set":"ชุดซูเปอร์ดับเบิลเบคอนชีส", "Triple Smash Burger Set":"ชุดสมาชเบอร์เกอร์ทริปเปิล",
  "Dirty Fries":"เดอร์ตี้ฟรายส์", "Coleslaw with Bacon":"โคลสลอว์เบคอน", "French Fries":"เฟรนช์ฟรายส์", "Cheesy Bacon Fries":"ชีสซี่เบคอนฟรายส์", "Loaded Fries":"โหลดेडฟรายส์", "Sweet Potato Fries":"มันหวานทอด", "Chicken Nuggets (6)":"นักเก็ตไก่ (6 ชิ้น)",
  "Coke":"โค้ก", "Coke No Sugar":"โค้กไม่มีน้ำตาล", "Schweppes Manao":"ชเวปส์มะนาว", "Fanta Orange":"แฟนต้าน้ำส้ม", "Fanta Strawberry":"แฟนต้าสตอเบอร์รี่", "Soda Water":"โซดา", "Drinking Water":"น้ำดื่ม",
};
const speakTicket = (ticket:string, language:"en"|"th") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(language === "th" ? `ออเดอร์ ${ticket} ส่งเข้าครัวแล้ว` : `Order ${ticket} sent to kitchen`);
  utterance.lang = language === "th" ? "th-TH" : "en-US";
  window.speechSynthesis.speak(utterance);
};
const skipReasons = [
  { value:"customer_declined", label:"Customer declined" },
  { value:"customer_in_a_hurry", label:"Customer is in a hurry" },
  { value:"already_a_member", label:"Customer is already a member" },
];

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
  const [flow,setFlow] = useState<"modifiers"|"upgrade"|"meal-deal">("modifiers");
  const [selectedDrink,setSelectedDrink] = useState("");
  const [setUpgrade,setSetUpgrade] = useState(false);
  const [activeCategory,setActiveCategory] = useState("");
  const [orderNumber,setOrderNumber] = useState("Loading…");
  const [discounts,setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscount,setSelectedDiscount] = useState("");
  const [grabOrderNumber,setGrabOrderNumber] = useState("");
  const [grabCustomerName,setGrabCustomerName] = useState("");
  const [grabCustomerMobile,setGrabCustomerMobile] = useState("");
  const [marketingOpen,setMarketingOpen] = useState(false);
  const [marketingPrompt,setMarketingPrompt] = useState("Are you a member? If you join you get 10% off every meal, starting with your next order");
  const [marketingConsent,setMarketingConsent] = useState(false);
  const [marketingFirstName,setMarketingFirstName] = useState("");
  const [marketingMobile,setMarketingMobile] = useState("");
  const [marketingEmail,setMarketingEmail] = useState("");
  const [marketingSkipReason,setMarketingSkipReason] = useState("");
  const [discountManagerOpen,setDiscountManagerOpen] = useState(false);
  const [managedDiscounts,setManagedDiscounts] = useState<Discount[]>([]);
  const [newDiscount,setNewDiscount] = useState({ code:"", name:"", discount_type:"percent", value:"" });

  const loadDiscounts = () => fetch("/api/pos/discounts",{credentials:"include"})
    .then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load discount codes");
      setDiscounts((body.data || []).map((row:Discount) => ({ ...row, value:Number(row.value || 0) })));
    }).catch((error:any) => setNotice(error.message));

  useEffect(() => {
    fetch(`/api/pos/menu?price_mode=${mode}`,{credentials:"include"})
      .then(r => r.json()).then(x => {
        setItems((x.data || []).map((item:Item) => ({...item,active_price:Number(item.active_price || 0)})));
        setCart([]);
      })
      .catch(() => setNotice("Could not load POS menu"));
  },[mode]);
  useEffect(() => { loadDiscounts(); }, []);

  const refreshOrderNumber = () => fetch("/api/pos/orders/next-ticket",{credentials:"include"})
    .then(r => { if (r.status === 401) { window.location.assign("/pos?lock=1"); return null; } return r.json(); })
    .then(x => x?.data?.ticket_number && setOrderNumber(x.data.ticket_number))
    .catch(() => setOrderNumber("Pending"));
  useEffect(() => {
    refreshOrderNumber();
    fetch("/api/pos/marketing-prompt",{credentials:"include"}).then(r=>r.json()).then(x=>x?.data?.prompt && setMarketingPrompt(x.data.prompt)).catch(()=>undefined);
  },[]);

  const categories = useMemo(() => [...new Map(items.map(item => [item.category_name,{name_en:item.category_name,name_th:item.category_name_th || item.category_name}])).values()],[items]);
  const drinks = useMemo(() => items.filter(x => x.category_name === "Drinks"),[items]);
  const label = (x:{name_en:string;name_th?:string}) => language === "th" ? x.name_th || thaiMenuNames[x.name_en] || x.name_en : x.name_en;
  const categoryLabel = (category:{name_en:string;name_th?:string}) => language === "th" ? category.name_th || thaiCategoryNames[category.name_en] || category.name_en : category.name_en;
  const ui = language === "th" ? {
    pos:"ขายหน้าร้าน", kitchen:"ครัว", display:"หน้าจอคิว", shift:"กะงาน", discounts:"ส่วนลด", counter:"เคาน์เตอร์", direct:"ออเดอร์หน้าร้าน",
    clear:"ล้าง", total:"ยอดรวม", discount:"รหัสส่วนลด", noDiscount:"ไม่มีส่วนลด", grabDetails:"รายละเอียด Grab", grabOrder:"กรอกเลขออเดอร์ - GF ________",
    customerName:"ชื่อลูกค้า", mobile:"เบอร์มือถือ", cash:"เงินสด", change:"เงินทอน", continue:"ดำเนินการต่อ", addItems:"เพิ่มสินค้าเพื่อเริ่มออเดอร์",
    drink:"เลือกเครื่องดื่มที่รวมในชุด", add:"เพิ่มในออเดอร์", fries:"เฟรนช์ฟรายส์", mealIncludes:"ชุดนี้รวมเฟรนช์ฟรายส์และเครื่องดื่ม",
  } : {
    pos:"POS", kitchen:"Kitchen", display:"Ticket display", shift:"Shift", discounts:"Discounts", counter:"Counter", direct:"DIRECT ORDER",
    clear:"Clear", total:"Total", discount:"Discount code", noDiscount:"No discount", grabDetails:"GRAB ORDER DETAILS", grabOrder:"Enter the Order Number - GF ________",
    customerName:"Customer name", mobile:"Mobile number", cash:"Cash received", change:"Change", continue:"Continue", addItems:"Add items to start an order",
    drink:"Select included drink", add:"Add to order", fries:"French Fries", mealIncludes:"This meal deal includes French Fries and a drink",
  };
  const lineTotal = (line:Line) => (Number(line.active_price || 0) + (line.set_upgrade ? 80 : 0) + (line.modifiers || []).reduce((sum,m) => sum + Number(m.price_delta || 0),0)) * line.quantity;
  const subtotal = cart.reduce((sum,line) => sum + lineTotal(line),0);
  const selectedDiscountData = discounts.find(discount => discount.code === selectedDiscount);
  const discountPreview = selectedDiscountData ? Math.min(subtotal, selectedDiscountData.discount_type === "percent" ? subtotal * selectedDiscountData.value / 100 : selectedDiscountData.value) : 0;
  const total = Math.max(0,subtotal - discountPreview);
  const change = Math.max(0,Number(cash || 0) - total);

  useEffect(() => {
    setActiveCategory(current => current || categories[0]?.name_en || "");
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveCategory((visible.target as HTMLElement).dataset.category || "");
    },{root:null,rootMargin:"-150px 0px -60% 0px",threshold:0});
    categories.forEach(category => {
      const element = document.getElementById(category.name_en.replaceAll(" ","-"));
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  },[categories]);

  const commitLine = (line:Line) => {
    if (isBurger(line) || line.meal_deal) return setCart(current => [...current,line]);
    setCart(current => {
      const index = current.findIndex(x => x.id === line.id && !x.set_upgrade && !(x.modifiers || []).length);
      return index < 0 ? [...current,line] : current.map((x,i) => i === index ? {...x,quantity:x.quantity + 1} : x);
    });
  };
  const startItem = async (item:Item) => {
    if (isMealDeal(item)) {
      setPending({item,modifiers:[]}); setModifierOptions([]); setFlow("meal-deal"); setSelectedDrink(""); setSetUpgrade(false);
      return;
    }
    if (mode === "grab" || !isBurger(item)) return commitLine({...item,quantity:1});
    try {
      const response = await fetch(`/api/pos/menu/${item.id}/modifiers`,{credentials:"include"});
      if (response.status === 401) { window.location.assign("/pos?lock=1"); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load additions");
      setPending({item,modifiers:[]}); setModifierOptions(body.data || []); setFlow("modifiers"); setSetUpgrade(false); setSelectedDrink("");
    } catch (error:any) { setNotice(error.message); }
  };
  const toggleModifier = (modifier:Modifier) => setPending(current => current && ({
    ...current,
    modifiers:current.modifiers.some(m => m.id === modifier.id) ? current.modifiers.filter(m => m.id !== modifier.id) : [...current.modifiers,modifier],
  }));
  const finishBurger = () => {
    if (!pending) return;
    if ((isMealDeal(pending.item) || (pending.item.set_upgrade_eligible && setUpgrade)) && !selectedDrink) return setNotice("Select the included drink before continuing");
    commitLine({...pending.item,quantity:1,modifiers:pending.modifiers,meal_deal:isMealDeal(pending.item),set_upgrade:pending.item.set_upgrade_eligible ? setUpgrade : false,set_drink_menu_item_id:selectedDrink || undefined});
    setPending(null);
  };

  const startCheckout = () => {
    if (!cart.length) return;
    if (mode === "grab") {
      if (!/^GF-[A-Z0-9]{5,7}$/.test(grabOrderNumber.trim().toUpperCase())) return setNotice("Enter the Grab order number as GF- followed by 5–7 letters or numbers");
      if (!grabCustomerName.trim() || !grabCustomerMobile.trim()) return setNotice("Grab customer name and mobile number are required");
      if (!marketingFirstName) setMarketingFirstName(grabCustomerName.trim().split(/\s+/)[0] || "");
      if (!marketingMobile) setMarketingMobile(grabCustomerMobile.trim());
    }
    setMarketingOpen(true);
  };

  const charge = async () => {
    if (marketingConsent && (!marketingFirstName.trim() || (!marketingMobile.trim() && !marketingEmail.trim()))) {
      return setNotice("For membership, enter a first name and either a mobile number or email");
    }
    if (!marketingConsent && !marketingSkipReason) return setNotice("Select why the customer did not join");
    try {
      const response = await fetch("/api/pos/orders",{
        method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          order_mode:mode,
          payment_method:mode === "grab" ? "grab" : payment,
          grab_order_number:mode === "grab" ? grabOrderNumber.trim().toUpperCase() : undefined,
          customer_name:mode === "grab" ? grabCustomerName.trim() : undefined,
          customer_mobile:mode === "grab" ? grabCustomerMobile.trim() : undefined,
          discount_code:selectedDiscount || undefined,
          marketing:{
            consent:marketingConsent,
            first_name:marketingConsent ? marketingFirstName.trim() : undefined,
            mobile_number:marketingConsent ? marketingMobile.trim() : undefined,
            email:marketingConsent ? marketingEmail.trim() : undefined,
            skip_reason:marketingConsent ? undefined : marketingSkipReason,
          },
          items:cart.map(x => ({
            menu_item_id:x.id, quantity:x.quantity, notes:x.notes || undefined,
            set_upgrade:mode === "direct" && !!x.set_upgrade,
            meal_deal:!!x.meal_deal,
            set_drink_menu_item_id:x.set_drink_menu_item_id,
            modifier_ids:(x.modifiers || []).map(m => m.id),
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create order");
      setMarketingOpen(false);
      setNotice(`${body.data.ticket_number} sent to kitchen`);
      speakTicket(body.data.ticket_number,language);
      setCart([]); setCash(""); setSelectedDiscount(""); setGrabOrderNumber(""); setGrabCustomerName(""); setGrabCustomerMobile("");
      setMarketingConsent(false); setMarketingFirstName(""); setMarketingMobile(""); setMarketingEmail(""); setMarketingSkipReason("");
      refreshOrderNumber(); window.setTimeout(()=>setNotice(""),4000);
    } catch (error:any) { setNotice(error.message); }
  };

  const openDiscountManager = async () => {
    try {
      const response = await fetch("/api/pos/discounts/manage",{credentials:"include"});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not open discount management");
      setManagedDiscounts((body.data || []).map((row:Discount) => ({...row,value:Number(row.value || 0)})));
      setDiscountManagerOpen(true);
    } catch (error:any) { setNotice(error.message); }
  };
  const createDiscount = async () => {
    try {
      const response = await fetch("/api/pos/discounts/manage",{
        method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...newDiscount,value:Number(newDiscount.value)}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create discount");
      setNewDiscount({code:"",name:"",discount_type:"percent",value:""});
      setManagedDiscounts(current => [...current,{...body.data,value:Number(body.data.value)}]);
      loadDiscounts();
      setNotice(`${body.data.code} is ready to use`);
    } catch (error:any) { setNotice(error.message); }
  };
  const toggleDiscount = async (discount:Discount) => {
    try {
      const response = await fetch(`/api/pos/discounts/manage/${discount.id}`,{
        method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!discount.active}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update discount");
      setManagedDiscounts(current => current.map(item => item.id === discount.id ? {...item,...body.data,value:Number(body.data.value)} : item));
      loadDiscounts();
    } catch (error:any) { setNotice(error.message); }
  };

  return <main className="h-dvh overflow-hidden bg-[#fffdf4] text-[#171717]">
    <header className="flex h-[70px] items-center justify-between bg-[#111111] px-5 text-white shadow-lg">
      <div className="flex items-center gap-4">
        <img src="/smash-brothers-logo.png" alt="Smash Brothers Burgers" className="h-12 w-12 rounded-xl object-contain"/>
        <nav className="hidden gap-1 lg:flex"><span className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">{ui.pos}</span><a href="/pos/kitchen" className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">{ui.kitchen}</a><a href="/pos/display" className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">{ui.display}</a><a href="/pos/shifts" className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10">{ui.shift}</a></nav>
      </div>
      <div className="flex items-center gap-2">
        <button className="hidden rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold sm:block" onClick={openDiscountManager}>{ui.discounts}</button>
        <button className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold" onClick={()=>setLanguage(language === "en" ? "th" : "en")}>{language === "en" ? "ไทย" : "EN"}</button>
        <button className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === "direct" ? "bg-white text-black" : "bg-white/10"}`} onClick={()=>setMode("direct")}>{ui.counter}</button>
        <button className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === "grab" ? "bg-[#ffd400] text-black" : "bg-white/10"}`} onClick={()=>setMode("grab")}>Grab</button>
      </div>
    </header>
    {notice && <button type="button" onClick={()=>setNotice("")} className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-2xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white shadow-2xl">{notice} · Close</button>}
    <div className="grid h-[calc(100dvh-70px)] grid-cols-[minmax(0,1fr)_348px] overflow-hidden">
      <section className="min-w-0 overflow-y-auto px-5 pb-10 pt-4">
        <div className="sticky top-0 z-10 -mx-5 mb-7 border-b border-[#d7ae00] bg-[#ffd400] px-5 py-4 shadow-sm"><div className="flex gap-3 overflow-x-auto pb-1">{categories.map(category => <button type="button" onClick={()=>{setActiveCategory(category.name_en);document.getElementById(category.name_en.replaceAll(" ","-"))?.scrollIntoView({behavior:"smooth",block:"start"});}} key={category.name_en} className={`shrink-0 rounded-2xl border px-5 py-3 text-sm font-bold shadow-[0_4px_14px_rgba(30,26,13,0.06)] transition ${activeCategory === category.name_en ? "border-black bg-black text-white" : "border-[#e8c72a] bg-white text-black hover:border-black"}`}>{categoryLabel(category)}</button>)}</div></div>
        <div className="mb-7"><p className="text-[11px] font-black tracking-[0.1em] text-[#15945c]">{mode === "grab" ? "GRAB" : ui.direct}</p></div>
        {categories.map((category,categoryIndex) => <section id={category.name_en.replaceAll(" ","-")} data-category={category.name_en} key={category.name_en} className={`mb-12 scroll-mt-28 rounded-[28px] p-5 ${categoryIndex % 2 === 0 ? "bg-[#fff9e8]" : "bg-[#f7f5ee]"}`}><div className="mb-5 flex items-center gap-3"><h2 className="text-xl font-black">{categoryLabel(category)}</h2><span className="h-px flex-1 bg-[#ded8c7]"/></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{items.filter(x => x.category_name === category.name_en).map(item => <button key={item.id} onClick={()=>startItem(item)} className="group relative min-h-[190px] overflow-hidden rounded-[22px] border border-[#eee9d9] bg-white p-3 text-left shadow-[0_7px_22px_rgba(38,31,7,0.055)] transition hover:-translate-y-1 hover:border-[#ffd400] hover:shadow-[0_13px_28px_rgba(38,31,7,0.11)]"><div className="flex h-[84px] items-center justify-center">{isBurger(item) && <img src={burgerImage} alt="" className="h-[80px] w-[112px] object-contain drop-shadow-[0_9px_8px_rgba(39,27,8,0.2)]"/>}</div><p className="mt-1 line-clamp-2 min-h-10 text-[13px] font-extrabold leading-5">{label(item)}</p><p className="mt-2 text-base font-black">{thb(item.active_price)}</p><span className="mt-2 grid h-8 w-full place-items-center rounded-full bg-[#ffd400] text-lg font-black leading-none text-black transition group-hover:bg-black group-hover:text-white">+</span></button>)}</div></section>)}
      </section>
      <aside className="m-3 ml-0 min-h-0 min-w-0 overflow-y-auto rounded-[26px] border border-[#eee9d9] bg-white shadow-[0_10px_30px_rgba(38,31,7,0.08)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eee9d9] bg-white px-5 py-4"><div><h2 className="text-xl font-black">{language === "th" ? "ออเดอร์ปัจจุบัน" : "Current order"}</h2><p className="mt-1 text-xs font-bold text-zinc-400">{language === "th" ? "ออเดอร์" : "Order"} · {orderNumber}</p></div><button onClick={()=>setCart([])} className="rounded-xl px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50">{ui.clear}</button></div>
        <div className="min-h-[220px] px-5">{cart.length === 0 ? <div className="grid min-h-[220px] place-items-center text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff6c9] text-xl">+</div><p className="mt-3 text-sm font-bold text-zinc-500">{ui.addItems}</p></div></div> : <div className="py-2">{cart.map((line,index) => <div key={`${line.id}-${index}`} className="border-b border-dashed border-[#d9d2c0] py-3"><div className="flex justify-between gap-2 text-sm font-bold"><span className="leading-5">{line.quantity} × {label(line)}</span><span>{thb(lineTotal(line))}</span></div>{(line.modifiers || []).map(modifier => <p key={modifier.id} className="mt-1 text-xs font-medium text-[#15945c]">+ {label(modifier)} · {thb(modifier.price_delta)}</p>)}{(line.set_upgrade || line.meal_deal) && <div className="mt-1 text-xs font-bold text-[#856a00]">{line.set_upgrade && <p>SET UPGRADE +฿80</p>}<p>1 × {ui.fries}</p><p>1 × {label(drinks.find(drink => drink.id === line.set_drink_menu_item_id) || {name_en:"Selected drink"})}</p></div>}{isBurger(line) && <input list="burger-request-suggestions" value={line.notes || ""} onChange={event=>setCart(current=>current.map((item,i)=>i === index ? {...item,notes:event.target.value} : item))} className="mt-2 w-full rounded-xl border border-[#e9e4d5] bg-[#fffdf8] px-3 py-2 text-xs outline-none focus:border-[#ffd400]" placeholder={language === "th" ? "คำขอ เช่น ไม่ใส่ชีส" : "Item request, e.g. No cheese"}/>}</div>)}</div>}</div>
        <datalist id="burger-request-suggestions"><option value="No cheese"/><option value="No tomato"/><option value="No salad"/><option value="No onions"/><option value="No pickles"/><option value="No jalapenos"/><option value="No burger sauce"/><option value="No meat"/><option value="No bun"/></datalist>
        <div className="border-t border-[#eee9d9] bg-[#fffefa] p-5">
          <div className="flex items-end justify-between"><span className="text-lg font-black">{ui.total}</span><span className="text-3xl font-black">{thb(total)}</span></div>
          {selectedDiscountData && <div className="mt-1 flex justify-between text-xs font-bold text-[#15945c]"><span>{selectedDiscountData.code} — {selectedDiscountData.name}</span><span>-{thb(discountPreview)}</span></div>}
          <label className="mt-3 block text-xs font-black text-zinc-600">{ui.discount}<select value={selectedDiscount} onChange={event=>setSelectedDiscount(event.target.value)} className="mt-1 w-full rounded-xl border border-[#e9e4d5] bg-white px-3 py-3 text-sm outline-none focus:border-[#ffd400]"><option value="">{ui.noDiscount}</option>{discounts.filter(discount=>discount.code !== "OWNER100").map(discount => <option key={discount.id} value={discount.code}>{discount.name}</option>)}{discounts.some(discount=>discount.code === "OWNER100") && <option disabled>────────────────</option>}{discounts.filter(discount=>discount.code === "OWNER100").map(discount => <option key={discount.id} value={discount.code}>{discount.name}</option>)}</select></label>
          {mode === "grab" && <div className="mt-4 space-y-2 rounded-2xl border border-[#ffd400] bg-[#fff9d9] p-3"><p className="text-xs font-black text-[#856a00]">{ui.grabDetails}</p><label className="block text-xs font-bold">{ui.grabOrder}<input value={grabOrderNumber} onChange={event=>setGrabOrderNumber(event.target.value.toUpperCase())} placeholder="GF-ABCDE" className="mt-1 w-full rounded-xl border border-[#e9d678] bg-white px-3 py-2 text-sm outline-none focus:border-black"/></label><label className="block text-xs font-bold">{ui.customerName}<input value={grabCustomerName} onChange={event=>setGrabCustomerName(event.target.value)} className="mt-1 w-full rounded-xl border border-[#e9d678] bg-white px-3 py-2 text-sm outline-none focus:border-black"/></label><label className="block text-xs font-bold">{ui.mobile}<input inputMode="tel" value={grabCustomerMobile} onChange={event=>setGrabCustomerMobile(event.target.value)} className="mt-1 w-full rounded-xl border border-[#e9d678] bg-white px-3 py-2 text-sm outline-none focus:border-black"/></label></div>}
          {mode === "direct" && payment === "cash" && <><input inputMode="decimal" value={cash} onChange={event=>setCash(event.target.value)} placeholder={ui.cash} className="mt-3 w-full rounded-xl border border-[#e9e4d5] bg-white px-3 py-3 text-sm outline-none focus:border-[#ffd400]"/><div className="mt-2 flex justify-between text-sm font-bold"><span>{ui.change}</span><span>{thb(change)}</span></div></>}
          <div className="mt-4 grid grid-cols-3 gap-2">{["cash","manual_qr_transfer","grab"].map(method => <button key={method} disabled={mode === "grab" && method !== "grab"} onClick={()=>setPayment(method)} className={`rounded-xl py-3 text-xs font-black transition ${payment === method ? "bg-[#171717] text-white" : "bg-[#f4f2eb] text-zinc-600 hover:bg-[#ebe7d8]"}`}>{method === "manual_qr_transfer" ? "QR" : method}</button>)}</div>
          <button disabled={!cart.length} onClick={startCheckout} className="mt-3 w-full rounded-xl bg-[#ffd400] py-4 text-base font-black text-black shadow-[0_7px_0_#d7ae00] transition hover:bg-[#ffe042] active:translate-y-0.5 active:shadow-[0_4px_0_#d7ae00] disabled:cursor-not-allowed disabled:opacity-40">{ui.continue} {thb(total)}</button>
        </div>
      </aside>
    </div>

    {pending && <div className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black tracking-[0.1em] text-[#15945c]">{flow === "modifiers" ? "STEP 1 OF 2" : "STEP 2 OF 2"}</p><h2 className="mt-1 text-2xl font-black">{flow === "modifiers" ? "Make it Better" : flow === "meal-deal" ? "Choose the included drink" : "Make it a set?"}</h2><p className="mt-1 text-sm text-zinc-600">{label(pending.item)}</p></div><button onClick={()=>setPending(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100">Close</button></div>{flow === "modifiers" ? <><p className="mt-5 text-sm text-zinc-600">Offer these additions before continuing.</p><div className="mt-3 grid grid-cols-2 gap-2">{modifierOptions.map(modifier => <button key={modifier.id} onClick={()=>toggleModifier(modifier)} className={`rounded-2xl border p-4 text-left font-bold ${pending.modifiers.some(m => m.id === modifier.id) ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200 hover:border-[#ffd400]"}`}><span className="block">{label(modifier)}</span><span className="mt-1 block text-sm text-[#15945c]">+{thb(modifier.price_delta)}</span></button>)}</div><button onClick={()=>isMealDeal(pending.item) ? setFlow("meal-deal") : pending.item.set_upgrade_eligible ? setFlow("upgrade") : finishBurger()} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">{ui.continue}</button></> : flow === "meal-deal" ? <><p className="mt-5 rounded-2xl bg-[#fff9d9] p-4 text-sm font-bold text-[#856a00]">{ui.mealIncludes}</p><select value={selectedDrink} onChange={event=>setSelectedDrink(event.target.value)} className="mt-3 w-full rounded-xl border p-3"><option value="">{ui.drink}</option>{drinks.map(drink => <option key={drink.id} value={drink.id}>{label(drink)}</option>)}</select><button onClick={finishBurger} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">{ui.add}</button></> : <><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setSetUpgrade(false)} className={`rounded-2xl border p-4 font-bold ${!setUpgrade ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200"}`}>Burger only</button><button onClick={()=>setSetUpgrade(true)} className={`rounded-2xl border p-4 font-bold ${setUpgrade ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200"}`}>Set +฿80</button></div>{setUpgrade && <select value={selectedDrink} onChange={event=>setSelectedDrink(event.target.value)} className="mt-3 w-full rounded-xl border p-3"><option value="">{ui.drink}</option>{drinks.map(drink => <option key={drink.id} value={drink.id}>{label(drink)}</option>)}</select>}<button onClick={finishBurger} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">{ui.add}</button></>}</div></div>}

    {marketingOpen && <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4"><div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl"><p className="text-xs font-black tracking-[0.12em] text-[#15945c]">MEMBERSHIP & REVIEWS</p><h2 className="mt-1 text-2xl font-black">Before receipt completion</h2><p className="mt-3 rounded-2xl bg-[#fff9d9] p-4 text-base font-bold leading-6">{marketingPrompt}</p><div className="mt-5 flex items-center gap-3"><input id="marketing-consent" type="checkbox" checked={marketingConsent} onChange={event=>setMarketingConsent(event.target.checked)} className="h-5 w-5 accent-[#15945c]"/><label htmlFor="marketing-consent" className="text-sm font-bold">Customer agrees to receive promotions and a review invitation</label></div>{marketingConsent ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black">First name<input value={marketingFirstName} onChange={event=>setMarketingFirstName(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"/></label><label className="text-xs font-black">Mobile number<input inputMode="tel" value={marketingMobile} onChange={event=>setMarketingMobile(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"/></label><label className="text-xs font-black sm:col-span-2">Email (use email or mobile)<input inputMode="email" value={marketingEmail} onChange={event=>setMarketingEmail(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"/></label></div> : <div className="mt-4"><p className="text-sm font-bold">If they do not join, select one reason:</p><div className="mt-2 grid gap-2">{skipReasons.map(reason => <button key={reason.value} onClick={()=>setMarketingSkipReason(reason.value)} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${marketingSkipReason === reason.value ? "border-[#ffd400] bg-[#fff9d9]" : "border-zinc-200"}`}>{reason.label}</button>)}</div></div>}<div className="mt-6 flex gap-3"><button onClick={()=>setMarketingOpen(false)} className="rounded-xl border border-zinc-200 px-4 py-3 font-bold">Back</button><button onClick={charge} className="flex-1 rounded-xl bg-[#ffd400] px-4 py-3 font-black">Complete order {thb(total)}</button></div></div></div>}

    {discountManagerOpen && <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4"><div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-[0.12em] text-[#15945c]">STAFF DISCOUNT MANAGEMENT</p><h2 className="mt-1 text-2xl font-black">Discount codes</h2></div><button onClick={()=>setDiscountManagerOpen(false)} className="rounded-xl px-3 py-2 font-bold">Close</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={newDiscount.code} onChange={event=>setNewDiscount(current=>({...current,code:event.target.value.toUpperCase()}))} placeholder="Code e.g. STAFF10" className="rounded-xl border px-3 py-3 text-sm font-bold"/><input value={newDiscount.name} onChange={event=>setNewDiscount(current=>({...current,name:event.target.value}))} placeholder="Name e.g. Staff launch" className="rounded-xl border px-3 py-3 text-sm"/><select value={newDiscount.discount_type} onChange={event=>setNewDiscount(current=>({...current,discount_type:event.target.value}))} className="rounded-xl border px-3 py-3 text-sm"><option value="percent">Percentage</option><option value="fixed">Fixed amount (฿)</option></select><input inputMode="decimal" value={newDiscount.value} onChange={event=>setNewDiscount(current=>({...current,value:event.target.value}))} placeholder="Value" className="rounded-xl border px-3 py-3 text-sm"/></div><button onClick={createDiscount} className="mt-3 w-full rounded-xl bg-[#ffd400] px-4 py-3 font-black">Add discount code</button><div className="mt-6 max-h-64 space-y-2 overflow-y-auto">{managedDiscounts.map(discount => <div key={discount.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-black">{discount.code} <span className="text-sm font-medium text-zinc-500">— {discount.name}</span></p><p className="text-xs text-zinc-500">{discount.discount_type === "percent" ? `${discount.value}%` : thb(discount.value)}</p></div><button onClick={()=>toggleDiscount(discount)} className={`rounded-lg px-3 py-2 text-xs font-black ${discount.active ? "bg-[#e6f7ee] text-[#15804f]" : "bg-zinc-100 text-zinc-500"}`}>{discount.active ? "Active" : "Inactive"}</button></div>)}</div></div></div>}
  </main>;
}
