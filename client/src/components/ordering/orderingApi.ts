import { apiRequest } from "@/lib/queryClient";

export type OrderingLanguage = "en" | "th";
export type CartModifier = { item_modifier_id: string; name_en: string; name_th?: string | null; price_delta: string; quantity: number };
export type CartItem = { menu_item_id: string; name_en: string; name_th?: string | null; price: string; quantity: number; notes: string; modifiers: CartModifier[] };

export async function fetchOrderingMenu(admin = false) {
  const res = await fetch(admin ? "/api/ordering/admin/menu" : "/api/ordering/menu", { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitOrderingOrder(input: any) {
  return apiRequest("/api/ordering/orders", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchOrderingOrder(orderId: string) {
  const res = await fetch(`/api/ordering/orders/${orderId}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchOrderingStatus(orderId: string, status: string, actor = "staff") {
  return apiRequest(`/api/ordering/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status, actor }) });
}

export function money(value: string | number) {
  return `฿${Number(value || 0).toFixed(2)}`;
}

export function itemLabel(item: any, language: OrderingLanguage) {
  return language === "th" && item.name_th ? item.name_th : item.name_en;
}
