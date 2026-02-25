import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CartItem, OnlineCategory, OnlineProduct, OrderPayload } from "./types";

type OnlineCatalogItem = OnlineProduct;
type OnlineCatalogResponse = { items: OnlineCatalogItem[] };

type OnlineOptionItem = {
  id: number;
  name: string;
  price_delta: number;
};

type OnlineOptionGroup = {
  id: number;
  name: string;
  min: number;
  max: number;
  required: boolean;
  options: OnlineOptionItem[];
};
const SBB_YELLOW = "#FFEB00";
const THB = (n: number) => `THB ${n.toFixed(2)}`;
const loadLS = <T,>(k: string, f: T) => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : f;
  } catch {
    return f;
  }
};
const saveLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export default function App() {
  const [categories, setCategories] = useState<OnlineCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>(() => loadLS<CartItem[]>("sbb.cart", []));
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [cardQty, setCardQty] = useState<Record<number, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<OnlineProduct | null>(null);
  const [optionGroups, setOptionGroups] = useState<OnlineOptionGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const fontInjected = useRef(false);

  const productMap = useMemo(() => {
    const map = new Map<number, OnlineProduct>();
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

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const total = subtotal;

  const activeProducts = useMemo(() => {
    return categories.find((c) => c.name === activeCategory)?.items ?? [];
  }, [categories, activeCategory]);

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
      const response = await fetch("/api/online/catalog");
      const data: OnlineCatalogResponse = await response.json();
      if (!response.ok) {
        throw new Error("Online menu request failed.");
      }
      const normalizedItems = Array.isArray(data.items)
        ? data.items.map((item) => ({
            ...item,
            image_url: item.image_url ?? (item as any).image ?? null,
          }))
        : [];
      const nextCategories = buildCategories(normalizedItems);
      setCategories(nextCategories);
      if ((!activeCategory || !nextCategories.some((c) => c.name === activeCategory)) && nextCategories.length > 0) {
        setActiveCategory(nextCategories[0].name);
      }
    } catch (error) {
      setErrorMessage("Unable to load online menu. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const setQuantityForProduct = (productId: number, value: number) => {
    setCardQty((prev) => ({
      ...prev,
      [productId]: Math.max(1, value),
    }));
  };


  const openProductOptions = async (product: OnlineProduct) => {
    setSelectedProduct(product);
    setLoadingOptions(true);
    try {
      const response = await fetch(`/api/online/catalog/${product.id}/options`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load options");
      setOptionGroups(Array.isArray(data?.option_groups) ? data.option_groups : []);
    } catch {
      setOptionGroups([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const addToCart = (product: OnlineProduct) => {
    const qty = cardQty[product.id] ?? 1;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const submitOrder = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (cart.length === 0) {
      setErrorMessage("Add items to your cart before checkout.");
      return;
    }

    setSubmitting(true);

    try {
      const refreshResponse = await fetch("/api/online/catalog");
      const refreshData: OnlineCatalogResponse = await refreshResponse.json();
      if (!refreshResponse.ok) {
        throw new Error("Unable to refresh product feed.");
      }

      const refreshedMap = new Map<number, OnlineProduct>();
      const refreshedCategories = buildCategories(Array.isArray(refreshData.items) ? refreshData.items : []);
      for (const category of refreshedCategories) {
        for (const product of category.items) {
          refreshedMap.set(product.id, product);
        }
      }

      const missingItems = cart.filter((item) => {
        const product = refreshedMap.get(item.product.id);
        return !product || product.price !== item.product.price;
      });

      if (missingItems.length > 0) {
        setErrorMessage("One or more items are no longer available. Please refresh your cart.");
        setSubmitting(false);
        return;
      }

      const payload: OrderPayload = {
        channel: "ONLINE",
        timestamp: new Date().toISOString(),
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          priceAtTimeOfSale: item.product.price,
        })),
      };

      const response = await fetch("/api/online/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Order submission failed.");
      }

      setCart([]);
      setSuccessMessage(`Order confirmed. Reference: ${data.orderId}`);
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

  if (errorMessage && categories.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white font-[Poppins]">
        <div className="mx-auto w-full max-w-[700px] px-4 pt-8 pb-4">
          <h1 className="text-2xl font-semibold">Online ordering unavailable</h1>
          <p className="mt-2 text-sm text-white/70">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (!errorMessage && categories.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white font-[Poppins]">
        <div className="mx-auto w-full max-w-[700px] px-4 pt-8 pb-4">
          <h1 className="text-2xl font-semibold">Online ordering unavailable</h1>
          <p className="mt-2 text-sm text-white/70">No products are available right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
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

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-4">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setActiveCategory(category.name)}
                className="relative pb-2 text-sm font-semibold"
              >
                <span className="opacity-90">{category.name.toUpperCase()}</span>
                {activeCategory === category.name && (
                  <span
                    className="absolute left-0 right-0 -bottom-[9px] h-[3px] rounded"
                    style={{ background: SBB_YELLOW }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 h-px w-full bg-white/10" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[700px] px-4">
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-6 rounded-full" style={{ background: SBB_YELLOW }} />
          <h2 className="text-lg md:text-xl font-extrabold">{activeCategory ? activeCategory.toUpperCase() : ""}</h2>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">
            {successMessage}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {activeProducts.map((product) => {
            const qty = cardQty[product.id] ?? 1;
            const isAvailable = product.price > 0;
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
                        onClick={() => setQuantityForProduct(product.id, qty - 1)}
                        disabled={!isAvailable}
                      >
                        -
                      </button>
                      <div className="min-w-[24px] text-center">{qty}</div>
                      <button
                        className="border border-white/20 rounded-lg px-3 py-1"
                        onClick={() => setQuantityForProduct(product.id, qty + 1)}
                        disabled={!isAvailable}
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => openProductOptions(product)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-black"
                      style={{ background: SBB_YELLOW, opacity: isAvailable ? 1 : 0.5 }}
                      disabled={!isAvailable}
                    >
                      Select options
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-28" />
      </div>


      {selectedProduct && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
          <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-black p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
              <button className="text-sm underline text-white/70" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
            {loadingOptions ? (
              <div className="mt-3 text-sm text-white/70">Loading options...</div>
            ) : optionGroups.length === 0 ? (
              <div className="mt-3 text-sm text-white/70">No option groups configured for this item.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {optionGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-white/10 p-3">
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-xs text-white/60">min {group.min} · max {group.max} · {group.required ? "required" : "optional"}</div>
                    <div className="mt-2 space-y-1">
                      {group.options.map((option) => (
                        <div key={option.id} className="text-sm text-white/80 flex items-center justify-between">
                          <span>{option.name}</span>
                          <span>{option.price_delta > 0 ? `+ ${THB(option.price_delta)}` : THB(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold text-black"
              style={{ background: SBB_YELLOW }}
              onClick={() => {
                addToCart(selectedProduct);
                setSelectedProduct(null);
              }}
            >
              Add to cart
            </button>
          </div>
        </div>
      )}


      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-[900px] px-3 pb-4">
          <div className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur p-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
              <div className="px-3 py-2 rounded-xl bg-white/10">{cart.length} item{cart.length !== 1 ? "s" : ""}</div>
              <div className="px-3 py-2 rounded-xl bg-white/10">Subtotal: {THB(subtotal)}</div>
              {unavailableCartItems.length > 0 && (
                <div className="px-3 py-2 rounded-xl bg-red-500/20 text-red-200">
                  Some items are no longer available
                </div>
              )}
            </div>

            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="rounded-xl border border-white/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.product.name}</div>
                      <div className="text-xs text-white/70">{THB(item.product.price)} each</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="border border-white/20 rounded-lg px-2"
                        onClick={() => updateCartQty(item.product.id, -1)}
                      >
                        -
                      </button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <button
                        className="border border-white/20 rounded-lg px-2"
                        onClick={() => updateCartQty(item.product.id, +1)}
                      >
                        +
                      </button>
                      <button
                        className="text-xs underline text-white/70"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{THB(total)}</span>
              </div>

              <button
                className="rounded-xl px-4 py-3 text-sm font-semibold text-black"
                style={{ background: SBB_YELLOW, opacity: cart.length === 0 || unavailableCartItems.length > 0 ? 0.5 : 1 }}
                onClick={submitOrder}
                disabled={cart.length === 0 || unavailableCartItems.length > 0 || submitting}
              >
                {submitting ? "Submitting..." : "Place order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
