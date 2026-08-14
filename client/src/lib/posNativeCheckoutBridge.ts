import { readPosPrinterSettings } from "@/lib/posPrinterSettings";
import {
  nativePrinterAvailable,
  nativeSpeak,
  printReceiptNative,
  type ReceiptPayload,
} from "@/lib/thermalPrinter";

type PosOrderCreatedResponse = {
  ok?: boolean;
  data?: {
    id?: string;
    ticket_number?: string;
  };
};

type ReceiptItem = {
  id?: string;
  item_name_en?: string;
  unit_price?: number | string;
  quantity?: number | string;
  line_total?: number | string;
  notes?: string | null;
  is_set_component?: boolean;
  parent_order_item_id?: string | null;
  modifiers?: Array<{
    name_en?: string;
    price_delta?: number | string;
    quantity?: number | string;
  }>;
};

type ReceiptResponse = {
  ok?: boolean;
  data?: {
    id?: string;
    ticket_number?: string;
    payment_method?: string;
    subtotal?: number | string;
    discount_amount?: number | string;
    total?: number | string;
    items?: ReceiptItem[];
  };
};

type NativeCheckoutStatus = {
  orderId: string;
  ticketNumber: string;
  printed: boolean;
  printMessage: string;
  callout: boolean;
  calloutMessage: string;
  at: string;
};

const STATUS_KEY = "sbb.pos.lastNativeCheckoutStatus";
const BRIDGE_FLAG = "__sbbPosNativeCheckoutBridgeInstalled";
const processedOrderIds = new Set<string>();

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function storeStatus(status: NativeCheckoutStatus) {
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(status));
    window.dispatchEvent(new CustomEvent("sbb:pos-native-checkout", { detail: status }));
  } catch {
    // Diagnostics must never interrupt checkout.
  }
}

export function readLastNativeCheckoutStatus(): NativeCheckoutStatus | null {
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as NativeCheckoutStatus) : null;
  } catch {
    return null;
  }
}

function receiptPayload(receipt: NonNullable<ReceiptResponse["data"]>): ReceiptPayload {
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  return {
    ticketNumber: String(receipt.ticket_number || ""),
    paymentMethod: String(receipt.payment_method || "unknown"),
    subtotal: numeric(receipt.subtotal),
    discount: numeric(receipt.discount_amount),
    total: numeric(receipt.total),
    lines: items.map((item) => ({
      quantity: Math.max(1, Math.trunc(numeric(item.quantity) || 1)),
      name: String(item.item_name_en || "Item"),
      unitPrice: numeric(item.unit_price),
      modifiers: (item.modifiers || []).map((modifier) => ({
        name: String(modifier.name_en || "Option"),
        price: numeric(modifier.price_delta),
      })),
      notes: item.notes || undefined,
      setUpgrade: false,
    })),
  };
}

function kitchenCallout(receipt: NonNullable<ReceiptResponse["data"]>) {
  const parts: string[] = [];
  for (const item of receipt.items || []) {
    const quantity = Math.max(1, Math.trunc(numeric(item.quantity) || 1));
    parts.push(`${quantity} ${String(item.item_name_en || "item")}`);
    for (const modifier of item.modifiers || []) {
      if (modifier.name_en) parts.push(String(modifier.name_en));
    }
    if (item.notes?.trim()) parts.push(item.notes.trim());
  }
  return parts;
}

async function recordPrintEvent(
  originalFetch: typeof window.fetch,
  orderId: string,
  eventType: "print_requested" | "print_completed" | "print_failed",
  error?: string,
) {
  try {
    await originalFetch(`/api/pos/orders/${orderId}/print-event`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        print_kind: "customer_and_kitchen",
        error: error || undefined,
      }),
    });
  } catch {
    // Print audit telemetry must not interfere with sale completion.
  }
}

async function handleCreatedOrder(
  originalFetch: typeof window.fetch,
  orderId: string,
  fallbackTicket: string,
) {
  let ticketNumber = fallbackTicket;
  let printed = false;
  let printMessage = "Auto print disabled";
  let callout = false;
  let calloutMessage = "Callout unavailable";

  try {
    const receiptResponse = await originalFetch(`/api/pos/orders/${orderId}/receipt`, {
      credentials: "include",
      cache: "no-store",
    });
    const receiptBody = (await receiptResponse.json()) as ReceiptResponse;
    if (!receiptResponse.ok || !receiptBody.ok || !receiptBody.data) {
      throw new Error("Could not load completed order for printing");
    }

    const receipt = receiptBody.data;
    ticketNumber = String(receipt.ticket_number || fallbackTicket || "");

    const items = kitchenCallout(receipt);
    if (items.length) {
      const text = `New order: ${items.join(", ")}`;
      try {
        if (nativePrinterAvailable()) {
          await nativeSpeak(text, "en-US");
          callout = true;
          calloutMessage = "Native callout played";
        } else if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "en-US";
          window.speechSynthesis.speak(utterance);
          callout = true;
          calloutMessage = "Browser callout requested";
        }
      } catch (error) {
        calloutMessage = error instanceof Error ? error.message : "Callout failed";
      }
    }

    const settings = readPosPrinterSettings();
    if (settings.autoPrint) {
      await recordPrintEvent(originalFetch, orderId, "print_requested");
      const shouldOpenDrawer = String(receipt.payment_method || "").trim().toLowerCase() === "cash";
      const result = await printReceiptNative(receiptPayload(receipt), shouldOpenDrawer);
      printed = result.ok;
      printMessage = result.message;
      await recordPrintEvent(
        originalFetch,
        orderId,
        result.ok ? "print_completed" : "print_failed",
        result.ok ? undefined : result.message,
      );
    }
  } catch (error) {
    printMessage = error instanceof Error ? error.message : "Automatic checkout processing failed";
  }

  storeStatus({
    orderId,
    ticketNumber,
    printed,
    printMessage,
    callout,
    calloutMessage,
    at: new Date().toISOString(),
  });
}

export async function processCreatedPosOrder(orderId: string, fallbackTicket = "") {
  if (!orderId || processedOrderIds.has(orderId)) return;
  processedOrderIds.add(orderId);
  try {
    await handleCreatedOrder(window.fetch.bind(window), orderId, fallbackTicket);
  } catch {
    processedOrderIds.delete(orderId);
  }
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function isPosOrderCreate(input: RequestInfo | URL, init?: RequestInit) {
  if (requestMethod(input, init) !== "POST") return false;
  try {
    const url = new URL(requestUrl(input), window.location.origin);
    return url.origin === window.location.origin && url.pathname === "/api/pos/orders";
  } catch {
    return false;
  }
}

export function installPosNativeCheckoutBridge() {
  const globalWindow = window as Window & Record<string, unknown>;
  if (globalWindow[BRIDGE_FLAG]) return;
  globalWindow[BRIDGE_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    if (isPosOrderCreate(input, init) && response.ok) {
      try {
        const body = (await response.clone().json()) as PosOrderCreatedResponse;
        const orderId = String(body?.data?.id || "");
        const ticket = String(body?.data?.ticket_number || "");
        if (orderId) {
          window.setTimeout(() => {
            void processCreatedPosOrder(orderId, ticket);
          }, 0);
        }
      } catch {
        // Never change the sale response if post-sale hardware handling fails.
      }
    }
    return response;
  }) as typeof window.fetch;
}
