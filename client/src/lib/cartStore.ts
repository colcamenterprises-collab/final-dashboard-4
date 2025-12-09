// PATCH O2 — CART SYSTEM
import { create } from "zustand";

type CartItem = {
  itemId: string;
  itemName: string;
  basePrice: number;
  qty: number;
  total: number;
  modifiers: { name: string; price: number }[];
};

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  clearCart: () => void;
};

export const useCart = create<CartState>((set, get) => ({
  items: JSON.parse(localStorage.getItem("cart") || "[]"),

  addItem: (item) => {
    const items = [...get().items, item];
    localStorage.setItem("cart", JSON.stringify(items));
    set({ items });
  },

  removeItem: (index) => {
    const items = get().items.filter((_, i) => i !== index);
    localStorage.setItem("cart", JSON.stringify(items));
    set({ items });
  },

  clearCart: () => {
    localStorage.setItem("cart", "[]");
    set({ items: [] });
  },
}));
