import { useState } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  categoryName?: string;
}

const STORAGE_KEY = "sbb_cart";

function load(): CartItem[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items: CartItem[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(load);

  const sync = (next: CartItem[]) => {
    save(next);
    setItems(next);
  };

  const addItem = (item: Omit<CartItem, "qty">) => {
    const existing = items.find((i) => i.id === item.id);
    if (existing) {
      sync(items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      sync([...items, { ...item, qty: 1 }]);
    }
  };

  const removeItem = (id: string) => sync(items.filter((i) => i.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeItem(id);
    sync(items.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const clearCart = () => sync([]);

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return { items, addItem, removeItem, updateQty, clearCart, total, itemCount };
}
