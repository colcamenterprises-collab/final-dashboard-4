import { apiRequest } from "@/lib/queryClient";

export type OrderingLanguage = "en" | "th";
export type CartModifier = { item_modifier_id: string; name_en: string; name_th?: string | null; price_delta: string; quantity: number };
export type CartItem = { menu_item_id: string; name_en: string; name_th?: string | null; price: string; quantity: number; notes: string; modifiers: CartModifier[] };

async function readJsonResponse(res: Response, where: string) {
  const contentType = res.headers.get("content-type") || "";
  const bodyText = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(`${where} returned non-JSON response (${res.status}).`);
  }

  const data = bodyText ? JSON.parse(bodyText) : null;
  if (!res.ok) {
    throw new Error(data?.blockers?.[0]?.message || data?.error || `${where} failed (${res.status}).`);
  }
  return data;
}

export async function fetchOrderingMenu(admin = false) {
  const path = admin ? "/api/ordering/admin/menu" : "/api/ordering/menu";
  const res = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return readJsonResponse(res, path);
}

export async function submitOrderingOrder(input: any) {
  return apiRequest("/api/ordering/orders", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchOrderingOrder(orderId: string) {
  const path = `/api/ordering/orders/${orderId}`;
  const res = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return readJsonResponse(res, path);
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
