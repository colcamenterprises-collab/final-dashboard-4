import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartItem, CartModifier, OnlineCategory, OnlineProduct, OrderPayload } from "./types";

type OnlineCatalogItem = OnlineProduct;
type OnlineCatalogResponse = { items: OnlineCatalogItem[] };

type OnlineOptionItem = {
  id: string;
  name: string;
  price_delta: number;
};

type OnlineOptionGroup = {
  id: string;
  name: string;
  min: number;
  max: number;
  required: boolean;
  type: "single" | "multi";
  options: OnlineOptionItem[];
};

const SBB_YELLOW = "#FFEB00";
const THB = (n: number) => `THB ${n.toFixed(2)}`;
const uid = () => Math.random().toString(36).slice(2, 10);

const loadLS = <T,>(k: string, f: T) => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : f;
  } catch {
    return f;
  }
};
const saveLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const lineUnitPrice = (item: CartItem) => item.product.price + item.modifiers.reduce((sum, mod) => sum + mod.priceDelta, 0);
const lineTotal = (item: CartItem) => lineUnitPrice(item) * item.quantity;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function App() {
  const [categories, setCategories] = useState<OnlineCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>(() => loadLS<CartItem[]>("sbb.cart", []));
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [cardQty, setCardQty] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<OnlineProduct | null>(null);
  const [optionGroups, setOptionGroups] = useState<OnlineOptionGroup[]>([]);
  const [draftSelections, setDraftSelections] = useState<Record<string, string[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const fontInjected = useRef(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);

  const productMap = useMemo(() => {
    const map = new Map<string, OnlineProduct>();
    for (const category of categories) {
      for (const product of category.items) {
        map.set(product.id, product);
      }
    }
    return map;
  }, [categories]);

  const unavailableCartItems = useMemo(() => {
    return cart.filter((item) => {
      const product = productMap.get(item.product.id);
      return !product || product.price !== item.product.price;
    });
  }, [cart, productMap]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + lineTotal(item), 0), [cart]);

  useEffect(() => saveLS("sbb.cart", cart), [cart]);

  useEffect(() => {
    if (fontInjected.current) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap";
    document.head.appendChild(link);
    fontInjected.current = true;
  }, []);

  const buildCategories = (items: OnlineCatalogItem[]): OnlineCategory[] => {
    const grouped = new Map<string, OnlineProduct[]>();
    for (const item of items) {
      const category = (item.category || "Unmapped").trim() || "Unmapped";
      const existing = grouped.get(category) || [];
      existing.push(item);
      grouped.set(category, existing);
    }
    return Array.from(grouped.entries()).map(([name, categoryItems]) => ({ name, items: categoryItems }));
  };

  const fetchProducts = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/online/catalog", { cache: "no-store" });
      const data: OnlineCatalogResponse = await response.json();
      if (!response.ok) {
        throw new Error("Online menu request failed.");
      }
      const normalizedItems = Array.isArray(data.items)
        ? data.items.map((item) => ({
            ...item,
            id: String(item.id),
            image_url: item.image_url ?? (item as any).image ?? null,
          }))
        : [];
      const nextCategories = buildCategories(normalizedItems);
      setCategories(nextCategories);
      if (nextCategories.length > 0) {
        setActiveCategory(nextCategories[0].name);
      }
    } catch (_error) {
      setErrorMessage("Unable to load online menu. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // IntersectionObserver — update active category as user scrolls
  useEffect(() => {
    if (categories.length === 0) return;

    const observers: IntersectionObserver[] = [];

    categories.forEach((cat) => {
      const el = sectionRefs.current[cat.name];
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !scrolling.current) {
              setActiveCategory(cat.name);
            }
          });
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [categories]);

  const scrollToCategory = useCallback((categoryName: string) => {
    const el = sectionRefs.current[categoryName];
    if (!el) return;
    setActiveCategory(categoryName);
    scrolling.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { scrolling.current = false; }, 800);

    // Scroll the category nav so the active tab is centered
    const navEl = categoryNavRef.current;
    if (navEl) {
      const btn = navEl.querySelector(`[data-cat="${slugify(categoryName)}"]`) as HTMLElement;
      if (btn) {
        const btnLeft = btn.offsetLeft;
        const btnWidth = btn.offsetWidth;
        const navWidth = navEl.offsetWidth;
        navEl.scrollTo({ left: btnLeft - navWidth / 2 + btnWidth / 2, behavior: "smooth" });
      }
    }
  }, []);

  const openProductOptions = async (product: OnlineProduct) => {
    setSelectedProduct(product);
    setLoadingOptions(true);
    setDraftSelections({});
    try {
      const response = await fetch(`/api/online/catalog/${product.id}/options`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load options");
      const groups = Array.isArray(data?.option_groups) ? data.option_groups : [];
      setOptionGroups(groups);
      const initial: Record<string, string[]> = {};
      for (const group of groups) {
        if (group.required && group.type === "single" && Array.isArray(group.options) && group.options[0]) {
          initial[group.id] = [group.options[0].id];
        }
      }
      setDraftSelections(initial);
    } catch {
      setOptionGroups([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const toggleOption = (group: OnlineOptionGroup, option: OnlineOptionItem) => {
    setDraftSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.type === "single") {
        return { ...prev, [group.id]: [option.id] };
      }
      const exists = current.includes(option.id);
      if (exists) {
        return { ...prev, [group.id]: current.filter((id) => id !== option.id) };
      }
      if (current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, option.id] };
    });
  };

  const addConfiguredItemToCart = (product: OnlineProduct) => {
    const qty = cardQty[product.id] ?? 1;
    const modifiers: CartModifier[] = [];
    for (const group of optionGroups) {
      const selectedIds = draftSelections[group.id] || [];
      if (group.required && selectedIds.length < Math.max(1, group.min || 0)) {
        setErrorMessage(`Please select required options for ${group.name}.`);
        return;
      }
      for (const selectedId of selectedIds) {
        const option = group.options.find((o) => o.id === selectedId);
        if (!option) continue;
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.price_delta,
        });
      }
    }
    setCart((prev) => [...prev, { lineId: uid(), product, quantity: qty, modifiers }]);
    setSelectedProduct(null);
    setOptionGroups([]);
    setDraftSelections({});
  };

  const updateCartQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => item.lineId === lineId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId));
  };

  const submitOrder = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (cart.length === 0) { setErrorMessage("Add items to your cart before checkout."); return; }
    if (!customerName.trim() || !customerPhone.trim()) { setErrorMessage("Customer name and phone are required."); return; }
    setSubmitting(true);
    try {
      const payload: OrderPayload = {
        channel: "ONLINE",
        timestamp: new Date().toISOString(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: customerNotes.trim() || undefined,
        items: cart.map((item) => ({
          itemId: item.product.id,
          quantity: item.quantity,
          modifiers: item.modifiers.map((mod) => ({ groupId: mod.groupId, optionId: mod.optionId })),
        })),
      };
      const response = await fetch("/api/online/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Order submission failed.");
      setCart([]);
      setCheckoutOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerNotes("");
      setSuccessMessage(`Order confirmed. Reference: ${data.orderNumber || data.orderId}`);
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-[Poppins]">
        <div className="mx-auto w-full max-w-[700px] px-4 pt-8 pb-4">
          <h1 className="text-2xl font-semibold">Loading online menu...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">

      {/* Header */}
      <div className="mx-auto w-full max-w-[700px] px-4 pt-8 pb-4">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
              <img src="/images/sbb-logo.png" alt="SBB" className="h-8 w-8 object-contain" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Smash Brothers Burgers (Rawai)</h1>
          </div>
          <p className="mt-2 text-sm text-white/70">Traditional American Smash Burgers — Opens at 6:00 pm</p>
        </div>
      </div>

      {/* Sticky category nav */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="mx-auto w-full max-w-[700px]">
          <div
            ref={categoryNavRef}
            className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {categories.map((category) => {
              const isActive = activeCategory === category.name;
              return (
                <button
                  key={category.name}
                  data-cat={slugify(category.name)}
                  onClick={() => scrollToCategory(category.name)}
                  className="relative flex-shrink-0 pb-3 pt-3 px-2 text-sm font-semibold transition-colors"
                  style={{ color: isActive ? SBB_YELLOW : "rgba(255,255,255,0.7)" }}
                >
                  {category.name.toUpperCase()}
                  {isActive && (
                    <span
                      className="absolute left-0 right-0 bottom-0 h-[3px] rounded"
                      style={{ background: SBB_YELLOW }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vertical content */}
      <div className="mx-auto w-full max-w-[700px] px-4 pb-4">
        {errorMessage && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">{errorMessage}</div>}
        {successMessage && <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">{successMessage}</div>}

        {categories.map((category) => (
          <section
            key={category.name}
            ref={(el) => { sectionRefs.current[category.name] = el; }}
            className="mt-8"
          >
            {/* Category header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-1.5 w-6 rounded-full flex-shrink-0" style={{ background: SBB_YELLOW }} />
              <h2 className="text-lg md:text-xl font-extrabold">{category.name.toUpperCase()}</h2>
            </div>

            {/* Items */}
            <div className="space-y-4">
              {category.items.map((product) => {
                const qty = cardQty[product.id] ?? 1;
                return (
                  <div key={product.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold leading-tight">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-white/70 line-clamp-2">{product.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold">{THB(product.price)}</div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="border border-white/20 rounded-lg px-3 py-1"
                            onClick={() => setCardQty((prev) => ({ ...prev, [product.id]: Math.max(1, (prev[product.id] ?? 1) - 1) }))}
                          >-</button>
                          <div className="min-w-[24px] text-center">{qty}</div>
                          <button
                            className="border border-white/20 rounded-lg px-3 py-1"
                            onClick={() => setCardQty((prev) => ({ ...prev, [product.id]: (prev[product.id] ?? 1) + 1 }))}
                          >+</button>
                        </div>
                        <button
                          onClick={() => openProductOptions(product)}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-black"
                          style={{ background: SBB_YELLOW }}
                        >
                          Select options
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="h-40" />
      </div>

      {/* Options modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-black p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
              <button className="text-sm underline text-white/70" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
            {loadingOptions ? (
              <div className="mt-3 text-sm text-white/70">Loading options...</div>
            ) : (
              <div className="mt-3 space-y-3">
                {optionGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-white/10 p-3">
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-xs text-white/60">min {group.min} · max {group.max} · {group.required ? "required" : "optional"}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const selected = (draftSelections[group.id] || []).includes(option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => toggleOption(group, option)}
                            className={`rounded-lg border px-3 py-2 text-sm ${selected ? "bg-white text-black" : "border-white/20"}`}
                          >
                            {option.name}{option.price_delta ? ` +${THB(option.price_delta)}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold text-black"
              style={{ background: SBB_YELLOW }}
              onClick={() => addConfiguredItemToCart(selectedProduct)}
            >
              Add to cart
            </button>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[75] bg-black/70 flex items-end md:items-center justify-center p-4"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-black p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Checkout</h3>
              <button className="text-sm underline text-white/70" onClick={() => setCheckoutOpen(false)}>Close</button>
            </div>
            <div className="mt-3 space-y-2">
              <input className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <input className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2" placeholder="Customer phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              <textarea className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2" placeholder="Order notes" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
            </div>
            <button
              className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-black"
              style={{ background: SBB_YELLOW, opacity: submitting ? 0.5 : 1 }}
              onClick={submitOrder}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Confirm order"}
            </button>
          </div>
        </div>
      )}

      {/* Cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-[900px] px-3 pb-4">
          <div className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur p-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
              <div className="px-3 py-2 rounded-xl bg-white/10">{cart.length} item{cart.length !== 1 ? "s" : ""}</div>
              <div className="px-3 py-2 rounded-xl bg-white/10">Subtotal: {THB(subtotal)}</div>
              {unavailableCartItems.length > 0 && (
                <div className="px-3 py-2 rounded-xl bg-red-500/20 text-red-200">Some items are no longer available</div>
              )}
            </div>
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.lineId} className="rounded-xl border border-white/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.product.name}</div>
                      {item.modifiers.length > 0 && <div className="text-xs text-white/70">{item.modifiers.map((m) => m.optionName).join(", ")}</div>}
                      <div className="text-xs text-white/70">{THB(lineUnitPrice(item))} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="border border-white/20 rounded-lg px-2" onClick={() => updateCartQty(item.lineId, -1)}>-</button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <button className="border border-white/20 rounded-lg px-2" onClick={() => updateCartQty(item.lineId, +1)}>+</button>
                      <button className="text-xs underline text-white/70" onClick={() => removeFromCart(item.lineId)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{THB(subtotal)}</span>
              </div>
              <button
                className="rounded-xl px-4 py-3 text-sm font-semibold text-black"
                style={{ background: SBB_YELLOW, opacity: cart.length === 0 || unavailableCartItems.length > 0 ? 0.5 : 1 }}
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.length === 0 || unavailableCartItems.length > 0}
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
