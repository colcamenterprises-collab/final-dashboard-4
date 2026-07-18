import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  name_en: string;
  name_th?: string;
  category_name: string;
  active_price: number;
  image_url?: string;
  set_upgrade_eligible: boolean;
};

type Modifier = {
  id: string;
  name_en: string;
  name_th?: string;
  price_delta: number;
  modifier_group_name_en: string;
};

type Line = Item & {
  quantity: number;
  set_upgrade?: boolean;
  set_drink_menu_item_id?: string;
  modifiers?: Modifier[];
  notes?: string;
};

type Pending = { item: Item; modifiers: Modifier[] };
type Receipt = {
  orderId: string;
  receiptNumber: string;
  createdAt: string;
  orderMode: "direct" | "grab";
  paymentMethod: string;
  total: number;
  lines: Line[];
  reprint?: boolean;
};

const thb = (n: number) => `฿${Number(n || 0).toLocaleString()}`;
const burgerImage = "/burger-placeholder.png";
const isBurger = (item: Item) =>
  /burger|smash/i.test(`${item.category_name} ${item.name_en}`);
const categoryId = (category: string) =>
  `pos-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const speakTicket = (ticket: string, language: "en" | "th") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(
    language === "th"
      ? `ออเดอร์ ${ticket} ส่งเข้าครัวแล้ว`
      : `Order ${ticket} sent to kitchen`,
  );
  utterance.lang = language === "th" ? "th-TH" : "en-US";
  window.speechSynthesis.speak(utterance);
};

export default function PosRegister() {
  const [mode, setMode] = useState<"direct" | "grab">("direct");
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<Line[]>([]);
  const [cash, setCash] = useState("");
  const [payment, setPayment] = useState("cash");
  const [language, setLanguage] = useState<"en" | "th">("en");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [modifierOptions, setModifierOptions] = useState<Modifier[]>([]);
  const [flow, setFlow] = useState<"modifiers" | "upgrade">("modifiers");
  const [selectedDrink, setSelectedDrink] = useState("");
  const [setUpgrade, setSetUpgrade] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [orderNumber, setOrderNumber] = useState("Loading…");
  const [printReceipt, setPrintReceipt] = useState<Receipt | null>(null);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    fetch(`/api/pos/menu?price_mode=${mode}`, { credentials: "include" })
      .then((response) => response.json())
      .then((body) => {
        setItems(
          (body.data || []).map((item: Item) => ({
            ...item,
            active_price: Number(item.active_price || 0),
          })),
        );
        setCart([]);
      })
      .catch(() => setNotice("Could not load POS menu"));
  }, [mode]);

  const refreshOrderNumber = () =>
    fetch("/api/pos/orders/next-ticket", { credentials: "include" })
      .then((response) => {
        if (response.status === 401) {
          window.location.assign("/pos?lock=1");
          return null;
        }
        return response.json();
      })
      .then(
        (body) =>
          body?.data?.ticket_number && setOrderNumber(body.data.ticket_number),
      )
      .catch(() => setOrderNumber("Pending"));

  useEffect(() => {
    refreshOrderNumber();
  }, []);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category_name))],
    [items],
  );
  const drinks = useMemo(
    () => items.filter((item) => item.category_name === "Drinks"),
    [items],
  );
  const label = (item: { name_en: string; name_th?: string }) =>
    language === "th" && item.name_th ? item.name_th : item.name_en;
  const lineTotal = (line: Line) =>
    (Number(line.active_price || 0) +
      (line.set_upgrade ? 80 : 0) +
      (line.modifiers || []).reduce(
        (sum, modifier) => sum + Number(modifier.price_delta || 0),
        0,
      )) *
    line.quantity;
  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const change = Math.max(0, Number(cash || 0) - total);

  useEffect(() => {
    setActiveCategory((current) => current || categories[0] || "");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible)
          setActiveCategory(
            (visible.target as HTMLElement).dataset.category || "",
          );
      },
      { root: null, rootMargin: "-135px 0px -65% 0px", threshold: 0 },
    );
    categories.forEach((category) => {
      const element = document.getElementById(categoryId(category));
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [categories]);

  const commitLine = (line: Line) => {
    if (isBurger(line)) return setCart((current) => [...current, line]);
    setCart((current) => {
      const index = current.findIndex(
        (item) =>
          item.id === line.id &&
          !item.set_upgrade &&
          !(item.modifiers || []).length,
      );
      return index < 0
        ? [...current, line]
        : current.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
    });
  };

  const startItem = async (item: Item) => {
    if (mode === "grab" || !isBurger(item))
      return commitLine({ ...item, quantity: 1 });
    try {
      const response = await fetch(`/api/pos/menu/${item.id}/modifiers`, {
        credentials: "include",
      });
      if (response.status === 401) {
        window.location.assign("/pos?lock=1");
        return;
      }
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Could not load additions");
      setPending({ item, modifiers: [] });
      setModifierOptions(body.data || []);
      setFlow("modifiers");
      setSetUpgrade(false);
      setSelectedDrink("");
    } catch (error: any) {
      setNotice(error.message);
    }
  };

  const toggleModifier = (modifier: Modifier) =>
    setPending(
      (current) =>
        current && {
          ...current,
          modifiers: current.modifiers.some((item) => item.id === modifier.id)
            ? current.modifiers.filter((item) => item.id !== modifier.id)
            : [...current.modifiers, modifier],
        },
    );

  const finishBurger = () => {
    if (!pending) return;
    if (pending.item.set_upgrade_eligible && setUpgrade && !selectedDrink)
      return setNotice("Select the set drink before continuing");
    commitLine({
      ...pending.item,
      quantity: 1,
      modifiers: pending.modifiers,
      set_upgrade: pending.item.set_upgrade_eligible ? setUpgrade : false,
      set_drink_menu_item_id: selectedDrink || undefined,
    });
    setPending(null);
  };

  const recordPrintEvent = (
    receipt: Receipt,
    eventType: "print_requested" | "reprint_requested" | "print_failed",
    error?: string,
  ) =>
    fetch(`/api/pos/orders/${receipt.orderId}/print-event`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        print_kind: "customer_and_kitchen",
        error,
      }),
    }).catch(() => undefined);

  const print58mm = (receipt: Receipt, reprint = false) => {
    const printable = { ...receipt, reprint };
    setPrintReceipt(printable);
    setLastReceipt(printable);
    recordPrintEvent(
      printable,
      reprint ? "reprint_requested" : "print_requested",
    );
    window.setTimeout(() => {
      try {
        window.print();
      } catch (error: any) {
        recordPrintEvent(printable, "print_failed", error?.message || "Print failed");
        setNotice("Receipt saved, but the print dialog could not open");
      }
    }, 250);
  };

  const charge = async () => {
    const lines = cart.map((line) => ({
      ...line,
      modifiers: [...(line.modifiers || [])],
    }));
    try {
      const response = await fetch("/api/pos/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_mode: mode,
          payment_method: mode === "grab" ? "grab" : payment,
          items: lines.map((line) => ({
            menu_item_id: line.id,
            quantity: line.quantity,
            notes: line.notes || undefined,
            set_upgrade: mode === "direct" && !!line.set_upgrade,
            set_drink_menu_item_id: line.set_drink_menu_item_id,
            modifier_ids: (line.modifiers || []).map((modifier) => modifier.id),
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Could not create order");

      const receipt: Receipt = {
        orderId: body.data.id,
        receiptNumber: body.data.receipt_number || body.data.ticket_number,
        createdAt: body.data.created_at || new Date().toISOString(),
        orderMode: mode,
        paymentMethod: mode === "grab" ? "grab" : payment,
        total: Number(body.data.total || total),
        lines,
      };
      setNotice(`${receipt.receiptNumber} sent to kitchen`);
      speakTicket(receipt.receiptNumber, language);
      setCart([]);
      setCash("");
      refreshOrderNumber();
      print58mm(receipt);
      window.setTimeout(() => setNotice(""), 4000);
    } catch (error: any) {
      setNotice(error.message);
    }
  };

  return (
    <main className="h-dvh overflow-hidden bg-[#fffdf4] text-[#171717]">
      <style>{`
        .sbb-print-receipt { display: none; }
        @media print {
          @page { size: 58mm auto; margin: 0; }
          html, body { width: 58mm; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          .sbb-print-receipt, .sbb-print-receipt * { visibility: visible !important; }
          .sbb-print-receipt {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm;
            padding: 2.5mm;
            box-sizing: border-box;
            color: #000;
            background: #fff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            line-height: 1.3;
          }
          .sbb-print-receipt .ticket-number { font-size: 19px; font-weight: 900; letter-spacing: .5px; text-align: center; }
          .sbb-print-receipt .section-title { font-size: 14px; font-weight: 900; text-align: center; }
          .sbb-print-receipt .rule { border-top: 1px dashed #000; margin: 7px 0; }
          .sbb-print-receipt .print-row { display: flex; justify-content: space-between; gap: 6px; }
          .sbb-print-receipt .modifier { padding-left: 9px; font-size: 9px; }
          .sbb-print-receipt .kitchen-item { font-size: 14px; font-weight: 900; margin-top: 5px; }
          .sbb-print-receipt .cut-line { border-top: 2px dashed #000; margin: 14px 0 10px; text-align: center; }
        }
      `}</style>

      <header className="flex h-[70px] items-center justify-between bg-[#111111] px-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <img
            src="/smash-brothers-logo.png"
            alt="Smash Brothers Burgers"
            className="h-12 w-12 rounded-xl object-contain"
          />
          <nav className="hidden gap-1 lg:flex">
            <span className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">
              POS
            </span>
            <a
              href="/pos/kitchen"
              className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Kitchen
            </a>
            <a
              href="/pos/display"
              className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Ticket display
            </a>
            <a
              href="/pos/shifts"
              className="rounded-xl px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              Shift
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {lastReceipt && (
            <button
              type="button"
              onClick={() => print58mm(lastReceipt, true)}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold"
            >
              Reprint
            </button>
          )}
          <button
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold"
            onClick={() => setLanguage(language === "en" ? "th" : "en")}
          >
            {language === "en" ? "ไทย" : "EN"}
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              mode === "direct" ? "bg-white text-black" : "bg-white/10"
            }`}
            onClick={() => setMode("direct")}
          >
            Counter
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              mode === "grab"
                ? "bg-[#ffd400] text-black"
                : "bg-white/10"
            }`}
            onClick={() => setMode("grab")}
          >
            Grab
          </button>
        </div>
      </header>

      {notice && (
        <button
          type="button"
          onClick={() => setNotice("")}
          className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-2xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white shadow-2xl"
        >
          {notice} · Close
        </button>
      )}

      <div className="grid h-[calc(100dvh-70px)] grid-cols-[minmax(0,1fr)_348px] overflow-hidden">
        <section className="min-w-0 overflow-y-auto px-4 pb-10 pt-3">
          <div className="sticky top-0 z-10 -mx-4 mb-5 border-b border-[#d7ae00] bg-[#ffd400] px-4 py-3 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(category);
                    document
                      .getElementById(categoryId(category))
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  key={category}
                  className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                    activeCategory === category
                      ? "border-black bg-black text-white"
                      : "border-[#e8c72a] bg-white text-black hover:border-black"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {categories.map((category) => (
            <section
              id={categoryId(category)}
              data-category={category}
              key={category}
              className="mb-7 scroll-mt-24"
            >
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-black">{category}</h2>
                <span className="h-px flex-1 bg-[#ded8c7]" />
              </div>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {items
                  .filter((item) => item.category_name === category)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => startItem(item)}
                      className="group relative min-h-[142px] overflow-hidden rounded-[18px] border border-[#eee9d9] bg-white p-2 text-left shadow-[0_5px_16px_rgba(38,31,7,0.05)] transition hover:-translate-y-0.5 hover:border-[#ffd400]"
                    >
                      <div className="flex h-[68px] items-center justify-center bg-transparent">
                        <img
                          src={item.image_url || burgerImage}
                          alt=""
                          className="h-[66px] w-full object-contain"
                        />
                      </div>
                      <p className="mt-1 line-clamp-2 min-h-8 text-[12px] font-extrabold leading-4">
                        {label(item)}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-sm font-black">{thb(item.active_price)}</p>
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ffd400] text-base font-black text-black transition group-hover:bg-black group-hover:text-white">
                          +
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </section>

        <aside className="m-3 ml-0 flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-[#eee9d9] bg-white shadow-[0_10px_30px_rgba(38,31,7,0.08)]">
          <div className="flex items-center justify-between border-b border-[#eee9d9] px-5 py-4">
            <div>
              <h2 className="text-xl font-black">
                {language === "th" ? "ออเดอร์ปัจจุบัน" : "Current order"}
              </h2>
              <p className="mt-1 text-xs font-bold text-zinc-400">
                {language === "th" ? "ออเดอร์" : "Order"} · {orderNumber}
              </p>
            </div>
            <button
              onClick={() => setCart([])}
              className="rounded-xl px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              {language === "th" ? "ล้าง" : "Clear"}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {cart.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fff6c9] text-xl">
                    +
                  </div>
                  <p className="mt-3 text-sm font-bold text-zinc-500">
                    {language === "th"
                      ? "เพิ่มสินค้าเพื่อเริ่มออเดอร์"
                      : "Add items to start an order"}
                  </p>
                </div>
              </div>
            ) : (
              cart.map((line, index) => (
                <div
                  key={`${line.id}-${index}`}
                  className="border-b border-[#f1eee4] py-3"
                >
                  <div className="flex justify-between gap-2 text-sm font-bold">
                    <span className="leading-5">
                      {line.quantity} × {label(line)}
                    </span>
                    <span>{thb(lineTotal(line))}</span>
                  </div>
                  {(line.modifiers || []).map((modifier) => (
                    <p
                      key={modifier.id}
                      className="mt-1 text-xs font-medium text-[#15945c]"
                    >
                      + {label(modifier)} · {thb(modifier.price_delta)}
                    </p>
                  ))}
                  {line.set_upgrade && (
                    <div className="mt-1 text-xs font-bold text-[#856a00]">
                      <p>SET UPGRADE +฿80</p>
                      <p>1 × French Fries</p>
                      <p>
                        1 ×{" "}
                        {
                          drinks.find(
                            (drink) => drink.id === line.set_drink_menu_item_id,
                          )?.name_en
                        }
                      </p>
                    </div>
                  )}
                  {isBurger(line) && (
                    <input
                      list="burger-request-suggestions"
                      value={line.notes || ""}
                      onChange={(event) =>
                        setCart((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, notes: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-[#e9e4d5] bg-[#fffdf8] px-3 py-2 text-xs outline-none focus:border-[#ffd400]"
                      placeholder={
                        language === "th"
                          ? "คำขอ เช่น ไม่ใส่ชีส"
                          : "Item request, e.g. No cheese"
                      }
                    />
                  )}
                </div>
              ))
            )}
          </div>
          <datalist id="burger-request-suggestions">
            <option value="No cheese" />
            <option value="No tomato" />
            <option value="No salad" />
            <option value="No onions" />
            <option value="No pickles" />
            <option value="No jalapenos" />
            <option value="No burger sauce" />
            <option value="No meat" />
            <option value="No bun" />
          </datalist>
          <div className="border-t border-[#eee9d9] bg-[#fffefa] p-5">
            <div className="flex items-end justify-between">
              <span className="text-lg font-black">
                {language === "th" ? "ยอดรวม" : "Total"}
              </span>
              <span className="text-3xl font-black">{thb(total)}</span>
            </div>
            {mode === "direct" && payment === "cash" && (
              <>
                <input
                  inputMode="decimal"
                  value={cash}
                  onChange={(event) => setCash(event.target.value)}
                  placeholder={language === "th" ? "รับเงินสด" : "Cash received"}
                  className="mt-3 w-full rounded-xl border border-[#e9e4d5] bg-white px-3 py-3 text-sm outline-none focus:border-[#ffd400]"
                />
                <div className="mt-2 flex justify-between text-sm font-bold">
                  <span>{language === "th" ? "เงินทอน" : "Change"}</span>
                  <span>{thb(change)}</span>
                </div>
              </>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["cash", "manual_qr_transfer", "grab"].map((method) => (
                <button
                  key={method}
                  disabled={mode === "grab" && method !== "grab"}
                  onClick={() => setPayment(method)}
                  className={`rounded-xl py-3 text-xs font-black transition ${
                    payment === method
                      ? "bg-[#171717] text-white"
                      : "bg-[#f4f2eb] text-zinc-600 hover:bg-[#ebe7d8]"
                  }`}
                >
                  {method === "manual_qr_transfer" ? "QR" : method}
                </button>
              ))}
            </div>
            <button
              disabled={!cart.length}
              onClick={charge}
              className="mt-3 w-full rounded-xl bg-[#ffd400] py-4 text-base font-black text-black shadow-[0_7px_0_#d7ae00] transition hover:bg-[#ffe042] active:translate-y-0.5 active:shadow-[0_4px_0_#d7ae00] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {language === "th" ? "ชำระ" : "Charge"} {thb(total)}
            </button>
          </div>
        </aside>
      </div>

      {pending && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black tracking-[0.1em] text-[#15945c]">
                  {flow === "modifiers" ? "STEP 1 OF 2" : "STEP 2 OF 2"}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {flow === "modifiers" ? "Make it Better" : "Make it a set?"}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {label(pending.item)}
                </p>
              </div>
              <button
                onClick={() => setPending(null)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
            {flow === "modifiers" ? (
              <>
                <p className="mt-5 text-sm text-zinc-600">
                  Offer these additions before continuing.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {modifierOptions.map((modifier) => (
                    <button
                      key={modifier.id}
                      onClick={() => toggleModifier(modifier)}
                      className={`rounded-2xl border p-4 text-left font-bold ${
                        pending.modifiers.some(
                          (item) => item.id === modifier.id,
                        )
                          ? "border-[#ffd400] bg-[#fff9d9]"
                          : "border-zinc-200 hover:border-[#ffd400]"
                      }`}
                    >
                      <span className="block">{label(modifier)}</span>
                      <span className="mt-1 block text-sm text-[#15945c]">
                        +{thb(modifier.price_delta)}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() =>
                    pending.item.set_upgrade_eligible
                      ? setFlow("upgrade")
                      : finishBurger()
                  }
                  className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSetUpgrade(false)}
                    className={`rounded-2xl border p-4 font-bold ${
                      !setUpgrade
                        ? "border-[#ffd400] bg-[#fff9d9]"
                        : "border-zinc-200"
                    }`}
                  >
                    Burger only
                  </button>
                  <button
                    onClick={() => setSetUpgrade(true)}
                    className={`rounded-2xl border p-4 font-bold ${
                      setUpgrade
                        ? "border-[#ffd400] bg-[#fff9d9]"
                        : "border-zinc-200"
                    }`}
                  >
                    Set +฿80
                  </button>
                </div>
                {setUpgrade && (
                  <select
                    value={selectedDrink}
                    onChange={(event) => setSelectedDrink(event.target.value)}
                    className="mt-3 w-full rounded-xl border p-3"
                  >
                    <option value="">Select included drink</option>
                    {drinks.map((drink) => (
                      <option key={drink.id} value={drink.id}>
                        {label(drink)}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={finishBurger}
                  className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black"
                >
                  Add to order
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {printReceipt && (
        <div className="sbb-print-receipt" aria-hidden="true">
          <div className="section-title">SMASH BROTHERS BURGERS</div>
          {printReceipt.reprint && (
            <div className="section-title">*** REPRINT ***</div>
          )}
          <div className="ticket-number">{printReceipt.receiptNumber}</div>
          <div className="print-row">
            <span>{new Date(printReceipt.createdAt).toLocaleString()}</span>
            <span>{printReceipt.orderMode.toUpperCase()}</span>
          </div>
          <div className="print-row">
            <span>Payment</span>
            <span>{printReceipt.paymentMethod.toUpperCase()}</span>
          </div>
          <div className="rule" />
          {printReceipt.lines.map((line, index) => (
            <div key={`${line.id}-${index}`}>
              <div className="print-row">
                <span>
                  {line.quantity} x {line.name_en}
                </span>
                <span>{thb(lineTotal(line))}</span>
              </div>
              {(line.modifiers || []).map((modifier) => (
                <div className="modifier" key={modifier.id}>
                  + {modifier.name_en} {thb(modifier.price_delta)}
                </div>
              ))}
              {line.set_upgrade && (
                <>
                  <div className="modifier">+ SET UPGRADE</div>
                  <div className="modifier">1 x French Fries</div>
                  <div className="modifier">
                    1 x{" "}
                    {
                      drinks.find(
                        (drink) => drink.id === line.set_drink_menu_item_id,
                      )?.name_en
                    }
                  </div>
                </>
              )}
              {line.notes && <div className="modifier">NOTE: {line.notes}</div>}
            </div>
          ))}
          <div className="rule" />
          <div className="print-row section-title">
            <span>TOTAL</span>
            <span>{thb(printReceipt.total)}</span>
          </div>
          <div className="rule" />
          <div style={{ textAlign: "center" }}>Thank you</div>

          <div className="cut-line">CUT / KITCHEN COPY</div>
          <div className="section-title">KITCHEN TICKET</div>
          <div className="ticket-number">{printReceipt.receiptNumber}</div>
          <div className="section-title">
            {printReceipt.orderMode === "grab" ? "GRAB" : "COUNTER"}
          </div>
          <div className="rule" />
          {printReceipt.lines.map((line, index) => (
            <div key={`kitchen-${line.id}-${index}`}>
              <div className="kitchen-item">
                {line.quantity} x {line.name_en}
              </div>
              {(line.modifiers || []).map((modifier) => (
                <div className="modifier" key={`k-${modifier.id}`}>
                  + {modifier.name_en}
                </div>
              ))}
              {line.set_upgrade && (
                <>
                  <div className="modifier">+ SET UPGRADE</div>
                  <div className="kitchen-item">
                    {line.quantity} x French Fries
                  </div>
                  <div className="kitchen-item">
                    {line.quantity} x{" "}
                    {
                      drinks.find(
                        (drink) => drink.id === line.set_drink_menu_item_id,
                      )?.name_en
                    }
                  </div>
                </>
              )}
              {line.notes && (
                <div className="modifier">REQUEST: {line.notes}</div>
              )}
            </div>
          ))}
          <div className="rule" />
          <div style={{ textAlign: "center", fontWeight: 900 }}>
            END OF TICKET
          </div>
        </div>
      )}
    </main>
  );
}
