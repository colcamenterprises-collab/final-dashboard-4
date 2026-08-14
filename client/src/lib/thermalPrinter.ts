export type NativePrinterDevice = {
  name: string;
  address: string;
  bonded?: boolean;
};

type NativeThermalPrinter = {
  listPrinters: () => Promise<{ printers: NativePrinterDevice[] }>;
  connect: (options: { address: string }) => Promise<{ connected: boolean; name?: string; address?: string; connectionMethod?: string }>;
  disconnect: () => Promise<{ connected: boolean }>;
  getStatus: () => Promise<{ connected: boolean; name?: string; address?: string; connectionMethod?: string }>;
  printRaw: (options: { base64: string }) => Promise<{ ok: boolean; connectionMethod?: string }>;
  printTest: () => Promise<{ ok: boolean; connectionMethod?: string }>;
  openCashDrawer: () => Promise<{ ok: boolean }>;
  speak: (options: { text: string; language?: string }) => Promise<{ ok: boolean }>;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: Record<string, unknown>;
  };
};

const STORAGE_KEY = "sbb.nativePrinter.address";

export function nativePrinterAvailable() {
  const cap = (window as CapacitorWindow).Capacitor;
  return Boolean(cap?.isNativePlatform?.() && cap?.Plugins?.ThermalPrinter);
}

function plugin(): NativeThermalPrinter {
  const cap = (window as CapacitorWindow).Capacitor;
  const value = cap?.Plugins?.ThermalPrinter as NativeThermalPrinter | undefined;
  if (!value) throw new Error("Native thermal printer is not available in this browser");
  return value;
}

export function readSavedPrinterAddress() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function savePrinterAddress(address: string) {
  if (address) localStorage.setItem(STORAGE_KEY, address);
  else localStorage.removeItem(STORAGE_KEY);
}

export async function listNativePrinters() {
  return (await plugin().listPrinters()).printers || [];
}

export async function connectNativePrinter(address: string) {
  const result = await plugin().connect({ address });
  if (result.connected) savePrinterAddress(address);
  return result;
}

export async function reconnectSavedPrinter() {
  if (!nativePrinterAvailable()) return { connected: false };
  const address = readSavedPrinterAddress();
  if (!address) return { connected: false };
  try {
    return await connectNativePrinter(address);
  } catch {
    return { connected: false };
  }
}

export async function getNativePrinterStatus() {
  return plugin().getStatus();
}

export async function disconnectNativePrinter() {
  savePrinterAddress("");
  return plugin().disconnect();
}

export async function nativeTestPrint() {
  return plugin().printTest();
}

export async function nativeOpenCashDrawer() {
  return plugin().openCashDrawer();
}

export async function nativeSpeak(text: string, language = "en-US") {
  if (!nativePrinterAvailable()) throw new Error("Native device bridge unavailable");
  return plugin().speak({ text, language });
}

export async function printEscPosBytes(bytes: Uint8Array) {
  if (!nativePrinterAvailable()) throw new Error("Native printer unavailable");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return plugin().printRaw({ base64: btoa(binary) });
}

const enc = new TextEncoder();
const concat = (...chunks: Uint8Array[]) => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const text = (value: string) => enc.encode(value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?"));

export type ReceiptPayload = {
  ticketNumber: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  cashReceived?: number;
  change?: number;
  lines: {
    quantity: number;
    name: string;
    unitPrice: number;
    modifiers?: { name: string; price: number }[];
    notes?: string;
    setUpgrade?: boolean;
    drinkName?: string;
  }[];
};

const money = (value: number) => `THB ${Number(value || 0).toFixed(2)}`;
const WIDTH = 32;
const pair = (left: string, right: string) => {
  const r = right.slice(0, WIDTH);
  return `${left.slice(0, Math.max(1, WIDTH - r.length - 1)).padEnd(Math.max(1, WIDTH - r.length - 1))} ${r}`;
};

export function buildReceiptEscPos(payload: ReceiptPayload) {
  const lines: string[] = [
    "SMASH BROTHERS BURGERS",
    "Rawai, Phuket",
    "--------------------------------",
    pair("ORDER", payload.ticketNumber),
    pair("PAYMENT", payload.paymentMethod.toUpperCase()),
    pair("DATE", new Date().toLocaleString("en-GB", { hour12: false })),
    "--------------------------------",
  ];

  for (const line of payload.lines) {
    lines.push(pair(`${line.quantity} x ${line.name}`, money(line.quantity * line.unitPrice)));
    for (const modifier of line.modifiers || []) lines.push(`  + ${modifier.name} ${money(modifier.price)}`.slice(0, WIDTH));
    if (line.setUpgrade) lines.push("  + SET UPGRADE");
    if (line.drinkName) lines.push(`  + ${line.drinkName}`.slice(0, WIDTH));
    if (line.notes) lines.push(`  NOTE: ${line.notes}`.slice(0, WIDTH));
  }

  lines.push("--------------------------------", pair("SUBTOTAL", money(payload.subtotal)));
  if (payload.discount > 0) lines.push(pair("DISCOUNT", `-${money(payload.discount)}`));
  lines.push(pair("TOTAL", money(payload.total)));
  if (payload.cashReceived !== undefined) lines.push(pair("CASH", money(payload.cashReceived)));
  if (payload.change !== undefined) lines.push(pair("CHANGE", money(payload.change)));
  lines.push("--------------------------------", "THANK YOU", "", "", "");

  return concat(
    new Uint8Array([0x1b, 0x40]),
    new Uint8Array([0x1b, 0x61, 0x01]),
    text(lines[0] + "\n" + lines[1] + "\n"),
    new Uint8Array([0x1b, 0x61, 0x00]),
    text(lines.slice(2).join("\n") + "\n"),
    new Uint8Array([0x1d, 0x56, 0x00]),
  );
}

export async function printReceiptNative(payload: ReceiptPayload, openDrawer = false) {
  if (!nativePrinterAvailable()) return { attempted: false, ok: false, message: "Native printer unavailable" };
  let status = await getNativePrinterStatus().catch(() => ({ connected: false }));
  if (!status.connected) status = await reconnectSavedPrinter();
  if (!status.connected) return { attempted: true, ok: false, message: "Printer is not connected" };

  const bytes = buildReceiptEscPos(payload);
  try {
    await printEscPosBytes(bytes);
  } catch (firstError) {
    const reconnected = await reconnectSavedPrinter();
    if (!reconnected.connected) {
      return {
        attempted: true,
        ok: false,
        message: firstError instanceof Error ? firstError.message : "Printing failed and printer could not reconnect",
      };
    }
    try {
      await printEscPosBytes(bytes);
    } catch (retryError) {
      return {
        attempted: true,
        ok: false,
        message: retryError instanceof Error ? retryError.message : "Printing failed after reconnect",
      };
    }
  }

  if (openDrawer) {
    try {
      await nativeOpenCashDrawer();
    } catch (drawerError) {
      return {
        attempted: true,
        ok: false,
        message: drawerError instanceof Error
          ? `Receipt printed, but cash drawer failed: ${drawerError.message}`
          : "Receipt printed, but cash drawer failed",
      };
    }
  }
  return { attempted: true, ok: true, message: openDrawer ? "Printed and cash drawer opened" : "Printed" };
}
