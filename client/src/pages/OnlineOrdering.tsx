import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// SBB — Online Ordering (VEV exact replica)
// Spec:
//  • Full-width yellow hero with centered logo + black title/subtitle + address pill
//  • Black category bar with UPPERCASE tabs; active tab text = yellow; NO underline/borders/pills
//  • Black page body; centered narrow container (~700px)
//  • Item rows: left image (square, rounded), center texts, right yellow price pill
//  • Sticky bottom bar with yellow CTA
//  • Simple front-end menu editor via ?admin=1

const SBB_YELLOW = "#FFEB00";

// ---------- Types ----------
type ModifierOption = { 
  id: string; 
  name: string; 
  priceDelta: number; 
  defaultSelected?: boolean 
};

type ModifierGroup = { 
  id: string; 
  name: string; 
  type: "single" | "multi"; 
  required?: boolean; 
  maxSelections?: number; 
  options: ModifierOption[] 
};

type MenuItem = { 
  id: string; 
  sku?: string; 
  name: string; 
  description?: string; 
  price: number; 
  category: string; 
  image?: string; 
  groups?: ModifierGroup[]; 
  available?: boolean 
};

type CartLine = { 
  id: string; 
  itemId: string; 
  sku?: string; 
  name: string; 
  basePrice: number; 
  qty: number; 
  modifiers: { 
    groupId: string; 
    groupName: string; 
    optionId: string; 
    optionName: string; 
    priceDelta: number 
  }[]; 
  note?: string 
};

type MenuData = { items: MenuItem[] };

// ---------- Defaults ----------
const DEFAULT_MENU: MenuData = { 
  items: [ 
    { 
      id: "set-single", 
      sku: "SKU_SET_SINGLE", 
      name: "Single Smash Burger Meal Set", 
      description: "The original single smash burger with French fries and your choice of soft drink.", 
      price: 209, 
      category: "sets", 
      image: "/images/items/single-set.jpg", 
      groups: [
        { 
          id: "drink", 
          name: "Choose Drink", 
          type: "single", 
          required: true, 
          options: [
            { id: "coke", name: "Coke", priceDelta: 0, defaultSelected: true }, 
            { id: "sprite", name: "Sprite", priceDelta: 0 }, 
            { id: "water", name: "Water", priceDelta: 0 }
          ] 
        }
      ] 
    }, 
    { 
      id: "set-double", 
      sku: "SKU_SET_DOUBLE", 
      name: "Ultimate Double Smash Burger Meal Set", 
      description: "Double-smash burger with 150g fries, coleslaw and a drink.", 
      price: 289, 
      category: "sets", 
      image: "/images/items/double-set.jpg" 
    }, 
    { 
      id: "single-burger", 
      sku: "SKU_SINGLE", 
      name: "Single Smash Burger", 
      description: "90g patty, cheese, pickles, onions, SBB sauce.", 
      price: 149, 
      category: "burgers", 
      image: "/images/items/single.jpg", 
      groups: [
        { 
          id: "patty", 
          name: "Patty", 
          type: "single", 
          required: true, 
          options: [
            { id: "single", name: "Single (90g)", priceDelta: 0, defaultSelected: true }, 
            { id: "double", name: "Double (2x90g)", priceDelta: 60 }
          ] 
        }, 
        { 
          id: "extras", 
          name: "Extras", 
          type: "multi", 
          maxSelections: 3, 
          options: [
            { id: "bacon", name: "Bacon", priceDelta: 35 }, 
            { id: "cheese", name: "Extra Cheese", priceDelta: 20 }
          ] 
        }
      ] 
    }, 
    { 
      id: "fries", 
      sku: "SKU_FRIES", 
      name: "Classic French Fries", 
      description: "Classic shoestring fries.", 
      price: 79, 
      category: "sides", 
      image: "/images/items/fries.jpg" 
    }, 
    { 
      id: "dirty-fries", 
      sku: "SKU_DIRTY", 
      name: "Cheesy Bacon Fries", 
      description: "American cheese, bacon bits, crispy onions.", 
      price: 119, 
      category: "sides", 
      image: "/images/items/dirty-fries.jpg" 
    }, 
    { 
      id: "coke", 
      sku: "SKU_COKE", 
      name: "Coke Can", 
      price: 35, 
      category: "drinks", 
      image: "/images/items/coke.jpg" 
    }, 
    { 
      id: "sprite", 
      sku: "SKU_SPRITE", 
      name: "Sprite Can", 
      price: 35, 
      category: "drinks", 
      image: "/images/items/sprite.jpg" 
    }
  ] 
};

const CATEGORIES = [ 
  { id: "sets", name: "BURGER MEAL SETS" }, 
  { id: "sides", name: "SIDE ORDERS" }, 
  { id: "burgers", name: "ORIGINAL SMASH BURGERS" }, 
  { id: "drinks", name: "DRINKS" }, 
] as const;

// ---------- Utils ----------
const THB = (n: number) => `฿${n.toFixed(2)}`;
const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const lineTotal = (l: CartLine) => (l.basePrice + l.modifiers.reduce((s, m) => s + m.priceDelta, 0)) * l.qty;
const getParam = (k: string) => new URLSearchParams(location.search).get(k);

// ---------- Storage Keys ----------
const LS_MENU = "sbb_menu_json_v1";
const LS_CART = "sbb_cart_v1";

export default function OnlineOrderingPage() {
  // PATCH O1 — Fetch menu from menu-ordering API
  const { data: menuData, isLoading: menuLoading } = useQuery<Array<any>>({
    queryKey: ["/api/menu-ordering/full"],
    enabled: !getParam("admin"), // Only fetch if NOT in admin mode
  });

  // PATCH O1 — Transform API menu to flat structure (from /api/menu-ordering/full)
  const apiMenu: MenuData = useMemo(() => {
    if (!menuData || !Array.isArray(menuData) || menuData.length === 0) return DEFAULT_MENU;
    const items: MenuItem[] = [];
    menuData.forEach((cat: any) => {
      (cat.items || []).forEach((item: any) => {
        items.push({
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          price: item.price,
          category: cat.slug,
          image: item.imageUrl,
          groups: item.groups?.map((g: any) => ({
            id: g.id || uid("grp"),
            name: g.name,
            type: g.type as "single" | "multi",
            required: g.required,
            maxSelections: g.maxSel,
            options: g.options?.map((o: any) => ({
              id: o.id || uid("opt"),
              name: o.name,
              priceDelta: o.priceDelta,
            })) || []
          })) || [],
          available: item.available !== false
        });
      });
    });
    return { items };
  }, [menuData]);

  // Menu (editable via admin mode, otherwise use API)
  const [menu, setMenu] = useState<MenuData>(() => { 
    if (getParam("admin")) {
      try { 
        const raw = localStorage.getItem(LS_MENU); 
        if (raw) return JSON.parse(raw); 
      } catch {} 
      return DEFAULT_MENU;
    }
    return DEFAULT_MENU;
  });

  // Update menu from API when data arrives (unless in admin mode)
  useEffect(() => {
    if (!getParam("admin") && apiMenu.items.length > 0) {
      setMenu(apiMenu);
    }
  }, [apiMenu]);

  const [activeCat, setActiveCat] = useState<(typeof CATEGORIES)[number]["id"]>("sets");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>(() => { 
    try { 
      const raw = localStorage.getItem(LS_CART); 
      return raw ? JSON.parse(raw) : []; 
    } catch { 
      return []; 
    } 
  });
  const [itemModal, setItemModal] = useState<{ open: boolean; item?: MenuItem; draft?: CartLine }>({ open: false });
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => { 
    localStorage.setItem(LS_CART, JSON.stringify(cart)); 
  }, [cart]);

  // Poppins font injection
  const fontInjected = useRef(false);
  useEffect(() => { 
    if (fontInjected.current) return; 
    const link = document.createElement("link"); 
    link.rel = "stylesheet"; 
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap"; 
    document.head.appendChild(link); 
    fontInjected.current = true; 
  }, []);

  const filteredMenu = useMemo(() => { 
    const q = search.trim().toLowerCase(); 
    return menu.items.filter((m) => m.category === activeCat && (!q || m.name.toLowerCase().includes(q))); 
  }, [menu, activeCat, search]);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);

  function openItem(item: MenuItem) { 
    const defaultMods: CartLine["modifiers"] = []; 
    item.groups?.forEach((g) => { 
      if (g.type === "single") { 
        const def = g.options.find((o) => o.defaultSelected) || g.options[0]; 
        if (def) defaultMods.push({ 
          groupId: g.id, 
          groupName: g.name, 
          optionId: def.id, 
          optionName: def.name, 
          priceDelta: def.priceDelta 
        }); 
      } 
    }); 
    setItemModal({ 
      open: true, 
      item, 
      draft: { 
        id: uid("line"), 
        itemId: item.id, 
        sku: item.sku, 
        name: item.name, 
        basePrice: item.price, 
        qty: 1, 
        modifiers: defaultMods 
      } 
    }); 
  }

  function toggleDraftModifier(group: ModifierGroup, opt: ModifierOption) { 
    if (!itemModal.draft) return; 
    const l = itemModal.draft; 
    if (group.type === "single") { 
      const newMods = l.modifiers.filter((m) => m.groupId !== group.id); 
      newMods.push({ 
        groupId: group.id, 
        groupName: group.name, 
        optionId: opt.id, 
        optionName: opt.name, 
        priceDelta: opt.priceDelta 
      }); 
      setItemModal({ ...itemModal, draft: { ...l, modifiers: newMods } }); 
    } else { 
      const exists = l.modifiers.find((m) => m.groupId === group.id && m.optionId === opt.id); 
      let newMods = l.modifiers.filter((m) => !(m.groupId === group.id && m.optionId === opt.id)); 
      if (!exists) { 
        const count = l.modifiers.filter((m) => m.groupId === group.id).length; 
        if (!group.maxSelections || count < group.maxSelections) { 
          newMods = [...l.modifiers, { 
            groupId: group.id, 
            groupName: group.name, 
            optionId: opt.id, 
            optionName: opt.name, 
            priceDelta: opt.priceDelta 
          }]; 
        } 
      } 
      setItemModal({ ...itemModal, draft: { ...l, modifiers: newMods } }); 
    } 
  }

  function commitDraft() { 
    if (!itemModal.draft) return; 
    setCart((p) => [...p, itemModal.draft!]); 
    setItemModal({ open: false }); 
  }
  
  function updateQty(id: string, d: number) { 
    setCart((p) => p.map((l) => (l.id === id ? { ...l, qty: Math.max(1, l.qty + d) } : l))); 
  }
  
  function removeLine(id: string) { 
    setCart((p) => p.filter((l) => l.id !== id)); 
  }

  // ---------- Admin Editor ----------
  const isAdmin = getParam("admin") === "1";
  const [showAdmin, setShowAdmin] = useState(isAdmin);
  const [draftJSON, setDraftJSON] = useState<string>(JSON.stringify(menu, null, 2));
  
  function saveMenuFromDraft() { 
    try { 
      const json = JSON.parse(draftJSON) as MenuData; 
      setMenu(json); 
      localStorage.setItem(LS_MENU, JSON.stringify(json)); 
      alert("Menu saved."); 
    } catch(e:unknown){ 
      const msg = e instanceof Error ? e.message : String(e);
      alert("Invalid JSON: " + msg); 
    } 
  }
  
  function resetMenu() { 
    setMenu(DEFAULT_MENU); 
    localStorage.removeItem(LS_MENU); 
  }

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
      {/* HERO: FULL YELLOW BANNER */}
      <section style={{ background: SBB_YELLOW }} className="text-black">
        <div className="mx-auto max-w-[720px] px-4 py-10 text-center">
          <div className="mx-auto h-28 w-28 flex items-center justify-center">
            <img 
              src="/attached_assets/1_1761464752373.png" 
              alt="Smash Brothers Burgers" 
              className="h-28 w-28 object-contain" 
            />
          </div>
          <h1 className="mt-4 text-[30px] md:text-[34px] font-extrabold tracking-tight">
            Smash Brothers Burgers (Rawai)
          </h1>
          <p className="mt-2 text-[15px] opacity-90">
            Traditional American Smash Burgers — Opens at 6:00 pm
          </p>
          <div className="mt-4 inline-flex items-center rounded-xl px-4 py-3" style={{ background: "#F7E54C" }}>
            <span className="text-[14px] font-semibold">
              69/9 Soi Saiyuan, Rawai, Phuket 83130, Thailand — Gilbis Plaza, Phuket
            </span>
          </div>
        </div>
      </section>

      {/* CATEGORY BAR: PURE BLACK, UPPERCASE, ACTIVE=YELLOW, NO UNDERLINES */}
      <div className="w-full bg-black">
        <div className="mx-auto max-w-[720px] px-4">
          <nav className="flex gap-6 py-4 justify-start md:justify-start">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`uppercase tracking-wide text-sm font-semibold transition-colors ${
                  activeCat === c.id ? "text-[--sbb-yellow]" : "text-white"
                }`}
                style={{ ['--sbb-yellow' as string]: SBB_YELLOW }}
                data-testid={`category-${c.id}`}
              >
                {c.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* MENU LIST: CENTERED NARROW CONTAINER */}
      <main className="mx-auto max-w-[720px] px-4">
        <div className="mt-4">
          <h2 className="text-[22px] font-extrabold">
            {CATEGORIES.find(c => c.id === activeCat)?.name.replace("_", " ")}
          </h2>
          <p className="mt-1 text-[14px] text-white/70">They are worth it!</p>
        </div>

        <div className="mt-6 space-y-6">
          {filteredMenu.map((m) => (
            <div 
              key={m.id} 
              className="rounded-2xl bg-[#121212] border border-white/10 p-4"
              data-testid={`menu-item-${m.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="h-[56px] w-[56px] rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {m.image ? <img src={m.image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight text-[16px]">{m.name}</div>
                  {m.description && <div className="text-[14px] text-white/70 mt-1">{m.description}</div>}
                </div>
                <button 
                  onClick={() => openItem(m)} 
                  className="rounded-xl px-4 py-2 text-[14px] font-semibold text-black" 
                  style={{ background: SBB_YELLOW }}
                  data-testid={`button-add-${m.id}`}
                >
                  {THB(m.price)} +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="h-28" />
      </main>

      {/* CART BAR */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-[900px] px-3 pb-4">
          <div className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur p-2 md:p-3 flex items-center gap-2 md:gap-4">
            <div className="text-xs md:text-sm px-3 py-2 rounded-xl bg-white/10">
              {cart.length} item{cart.length !== 1 ? "s" : ""}
            </div>
            <div className="text-xs md:text-sm px-3 py-2 rounded-xl bg-white/10">
              Subtotal: {THB(subtotal)}
            </div>
            <button 
              className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-black" 
              style={{ background: SBB_YELLOW }} 
              onClick={() => setShowCheckout(true)} 
              disabled={cart.length === 0}
              data-testid="button-checkout"
            >
              Review & Checkout
            </button>
          </div>
        </div>
      </div>

      {/* ITEM MODAL */}
      {itemModal.open && itemModal.item && itemModal.draft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
          <div className="w-full sm:max-w-[560px] bg-[#0B0B0B] text-white rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-semibold">{itemModal.item.name}</div>
              <button 
                className="text-sm underline" 
                onClick={() => setItemModal({ open: false })}
                data-testid="button-close-item-modal"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-4">
              {itemModal.item.groups?.map(g => (
                <div key={g.id}>
                  <div className="text-sm font-semibold">
                    {g.name} {g.required && <span className="text-white/50 text-xs">(required)</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {g.options.map(o => {
                      const selected = itemModal.draft!.modifiers.some(m => m.groupId === g.id && m.optionId === o.id);
                      return (
                        <button 
                          key={o.id} 
                          onClick={() => toggleDraftModifier(g, o)} 
                          className={`px-3 py-2 rounded-xl border text-sm ${
                            selected ? "bg-white text-black" : "bg-transparent"
                          }`} 
                          style={selected ? { borderColor: "transparent" } : { borderColor: "rgba(255,255,255,0.15)" }}
                          data-testid={`modifier-${o.id}`}
                        >
                          {o.name}{o.priceDelta ? ` +${THB(o.priceDelta)}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    className="border border-white/20 rounded-lg px-3 py-1" 
                    onClick={() => setItemModal({ 
                      ...itemModal, 
                      draft: { ...itemModal.draft!, qty: Math.max(1, itemModal.draft!.qty - 1) } 
                    })}
                    data-testid="button-decrease-qty"
                  >
                    -
                  </button>
                  <div data-testid="text-qty">{itemModal.draft.qty}</div>
                  <button 
                    className="border border-white/20 rounded-lg px-3 py-1" 
                    onClick={() => setItemModal({ 
                      ...itemModal, 
                      draft: { ...itemModal.draft!, qty: itemModal.draft!.qty + 1 } 
                    })}
                    data-testid="button-increase-qty"
                  >
                    +
                  </button>
                </div>
                <div className="font-semibold">{THB(lineTotal(itemModal.draft))}</div>
              </div>

              <button 
                onClick={commitDraft} 
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black" 
                style={{ background: SBB_YELLOW }}
                data-testid="button-add-to-order"
              >
                Add to order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (summary only; POS hook TBD) */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-[560px] bg-[#0B0B0B] text-white rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-semibold">Your Order</div>
              <button 
                className="text-sm underline" 
                onClick={() => setShowCheckout(false)}
                data-testid="button-close-checkout"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <div className="p-4 space-y-3">
                {cart.map(l => (
                  <div key={l.id} className="border border-white/10 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold leading-tight">{l.name}</div>
                        {l.modifiers.length > 0 && (
                          <ul className="text-xs text-white/70 list-disc ml-5 mt-1">
                            {l.modifiers.map(m => (
                              <li key={`${l.id}_${m.optionId}`}>
                                {m.groupName}: {m.optionName} {m.priceDelta ? `(+${THB(m.priceDelta)})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="text-right min-w-[120px]">
                        <div className="font-semibold">{THB(lineTotal(l))}</div>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <button 
                            className="border border-white/20 rounded-lg px-2" 
                            onClick={() => updateQty(l.id, -1)}
                            data-testid={`button-decrease-${l.id}`}
                          >
                            -
                          </button>
                          <span className="text-sm w-6 text-center">{l.qty}</span>
                          <button 
                            className="border border-white/20 rounded-lg px-2" 
                            onClick={() => updateQty(l.id, +1)}
                            data-testid={`button-increase-${l.id}`}
                          >
                            +
                          </button>
                        </div>
                        <div>
                          <button 
                            className="mt-2 text-xs underline text-white/70" 
                            onClick={() => removeLine(l.id)}
                            data-testid={`button-remove-${l.id}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Subtotal</div>
                <div className="text-xl font-bold">{THB(subtotal)}</div>
              </div>
              <button 
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black" 
                style={{ background: SBB_YELLOW }}
                data-testid="button-place-order"
              >
                Place Order
              </button>
              <p className="text-xs text-white/50 text-center mt-3">
                This is a preview. POS integration coming soon.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN EDITOR */}
      {showAdmin && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#0B0B0B] text-white rounded-2xl w-full max-w-[880px] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-semibold">Menu Editor</div>
              <div className="flex items-center gap-2">
                <button 
                  className="text-sm underline" 
                  onClick={resetMenu}
                  data-testid="button-reset-menu"
                >
                  Reset to default
                </button>
                <button 
                  className="text-sm underline" 
                  onClick={() => setShowAdmin(false)}
                  data-testid="button-close-admin"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-3">
              <p className="text-sm text-white/70">
                Paste or edit your JSON below. Use full image URLs or `/images/...` from your public folder. Save writes to localStorage.
              </p>
              <textarea 
                className="min-h-[360px] bg-black/50 border border-white/10 rounded-lg p-3 font-mono text-xs" 
                value={draftJSON} 
                onChange={(e) => setDraftJSON(e.target.value)}
                data-testid="textarea-menu-json"
              />
              <div className="flex items-center gap-2">
                <button 
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-black" 
                  style={{ background: SBB_YELLOW }} 
                  onClick={saveMenuFromDraft}
                  data-testid="button-save-menu"
                >
                  Save Menu
                </button>
                <button 
                  className="rounded-xl px-4 py-2 text-sm border border-white/15" 
                  onClick={() => setDraftJSON(JSON.stringify(menu, null, 2))}
                  data-testid="button-reload-current"
                >
                  Reload Current
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && !showAdmin && (
        <button 
          onClick={() => setShowAdmin(true)} 
          className="fixed bottom-20 right-4 z-[55] rounded-full px-4 py-2 text-sm font-semibold text-black shadow-lg" 
          style={{ background: SBB_YELLOW }}
          data-testid="button-show-admin"
        >
          Edit Menu
        </button>
      )}
    </div>
  );
}
