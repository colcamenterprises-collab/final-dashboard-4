import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { ShoppingCart, Plus, Minus, Search } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { Badge } from "@/components/ui/badge";
import { asArray, logInvalidMenuShape, normalizeMenuItems } from "@/lib/menuData";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  basePrice?: number;
  category?: string | { id?: string; name?: string };
  description?: string;
  isActive?: boolean;
  categoryName?: string;
  onlineEnabled?: boolean;
  posEnabled?: boolean;
}

const CATEGORY_ORDER = ["Burgers", "Side Orders", "Beverages", "Extras", "Sauce", "Other"];

function getCatName(item: MenuItem): string {
  if (item.categoryName) return item.categoryName;
  if (typeof item.category === "string") return item.category || "Other";
  if (item.category && typeof item.category === "object") return item.category.name || "Other";
  return "Other";
}

function getPrice(item: MenuItem): number {
  return Number(item.basePrice ?? item.price) || 0;
}

function sortCategories(cats: string[]) {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.findIndex((c) => a.toLowerCase().includes(c.toLowerCase()));
    const ib = CATEGORY_ORDER.findIndex((c) => b.toLowerCase().includes(c.toLowerCase()));
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function fmt(p: number) {
  return `฿${p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function OnlineOrdering() {
  const [, navigate] = useLocation();
  const { items: cartItems, addItem, removeItem, updateQty, total, itemCount } = useCart();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");

  const { data: rawData, isLoading, isError } = useQuery<unknown>({
    queryKey: ["/api/menu-v3/items"],
  });

  const itemResult = normalizeMenuItems<MenuItem>(rawData);
  const hasInvalidMenuShape = !isLoading && !itemResult.isValidShape;

  if (hasInvalidMenuShape) {
    logInvalidMenuShape("/order", rawData);
  }

  const allItems = asArray<MenuItem>(itemResult.items).filter((i) => i.isActive !== false);
  const categories = ["All", ...sortCategories(Array.from(new Set(allItems.map(getCatName))))];

  const visible = asArray(allItems).filter((item) => {
    const matchesCat = filterCat === "All" || getCatName(item) === filterCat;
    const matchesSearch = !search || (item.name || "").toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const byCategory = visible.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = getCatName(item);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const getQty = (id: string) => cartItems.find((i) => i.id === id)?.qty ?? 0;

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Order Online</h1>
          <p className="text-xs text-slate-500">Smash Brothers Burgers — Pickup & Delivery</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          className="w-full pl-8 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
          placeholder="Search menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`text-[10px] px-3 py-1 rounded-full border whitespace-nowrap flex-shrink-0 transition-colors ${
              filterCat === c
                ? "bg-black text-white border-black"
                : "border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400 text-xs">Loading menu...</div>}
      {isError && <div className="text-center py-16 text-red-500 text-xs">Failed to load menu.</div>}
      {hasInvalidMenuShape && <div className="text-center py-16 text-red-500 text-xs">Menu data could not be loaded. Check API response shape.</div>}

      <div className="space-y-4">
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{cat}</p>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const qty = getQty(item.id);
                const price = getPrice(item);
                const catName = getCatName(item);
                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 flex flex-col gap-2"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">{item.name || "—"}</p>
                      {item.description && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">{fmt(price)}</span>
                      {qty === 0 ? (
                        <button
                          onClick={() => addItem({ id: item.id, name: item.name || "—", price, categoryName: catName })}
                          className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQty(item.id, qty - 1)}
                            className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Minus className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 dark:text-white w-4 text-center">{qty}</span>
                          <button
                            onClick={() => addItem({ id: item.id, name: item.name || "—", price, categoryName: catName })}
                            className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {itemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl">
          <button
            onClick={() => navigate("/online-ordering/checkout")}
            className="w-full bg-black text-white rounded-2xl py-3.5 flex items-center justify-between px-4 shadow-2xl hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs font-semibold">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            </div>
            <span className="text-xs font-semibold">View Order · {fmt(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
