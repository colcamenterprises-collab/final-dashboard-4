import { readPosPrinterSettings } from "@/lib/posPrinterSettings";

export type NativePrinterDevice = {
  name: string;
  address: string;
  bonded?: boolean;
};

export type NativeAppVersion = {
  versionName: string;
  versionCode: number;
  packageName: string;
};

type NativeThermalPrinter = {
  listPrinters: () => Promise<{ printers: NativePrinterDevice[] }>;
  connect: (options: { address: string }) => Promise<{ connected: boolean; name?: string; address?: string; connectionMethod?: string }>;
  disconnect: () => Promise<{ connected: boolean }>;
  getStatus: () => Promise<{ connected: boolean; name?: string; address?: string; connectionMethod?: string }>;
  getAppVersion: () => Promise<NativeAppVersion>;
  openAppUpdate: (options: { url: string }) => Promise<{ ok: boolean }>;
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
const CORE_PRINTER_METHODS: (keyof NativeThermalPrinter)[] = [
  "listPrinters",
  "connect",
  "disconnect",
  "getStatus",
  "printRaw",
  "printTest",
  "openCashDrawer",
];

function rawPlugin(): Partial<NativeThermalPrinter> | undefined {
  const cap = (window as CapacitorWindow).Capacitor;
  return cap?.Plugins?.ThermalPrinter as Partial<NativeThermalPrinter> | undefined;
}

export function nativeBridgeMissingMethods(methods: (keyof NativeThermalPrinter)[] = CORE_PRINTER_METHODS) {
  const value = rawPlugin();
  if (!value) return methods.map(String);
  return methods.filter((method) => typeof value[method] !== "function").map(String);
}

export function nativePrinterAvailable() {
  const cap = (window as CapacitorWindow).Capacitor;
  return Boolean(cap?.isNativePlatform?.() && rawPlugin() && nativeBridgeMissingMethods().length === 0);
}

function pluginMethod<K extends keyof NativeThermalPrinter>(name: K): NativeThermalPrinter[K] {
  const value = rawPlugin();
  const method = value?.[name];
  if (typeof method !== "function") {
    throw new Error(`POS app update required: native ThermalPrinter bridge is missing ${String(name)}.`);
  }
  return method as NativeThermalPrinter[K];
}

function buildExternalAndroidIntent(url: string) {
  const target = new URL(url, window.location.href);
  const scheme = target.protocol.replace(":", "");
  const destination = `${target.host}${target.pathname}${target.search}${target.hash}`;
  return `intent://${destination}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}

export function readSavedPrinterAddress() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function savePrinterAddress(address: string) {
  if (address) localStorage.setItem(STORAGE_KEY, address);
  else localStorage.removeItem(STORAGE_KEY);
}

export async function listNativePrinters() {
  return (await pluginMethod("listPrinters")()).printers || [];
}

export async function connectNativePrinter(address: string) {
  const result = await pluginMethod("connect")({ address });
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
  return pluginMethod("getStatus")();
}

export async function getNativeAppVersion() {
  return pluginMethod("getAppVersion")();
}

export async function openNativeAppUpdate(url: string) {
  const value = rawPlugin();
  if (typeof value?.openAppUpdate === "function") return value.openAppUpdate({ url });

  const cap = (window as CapacitorWindow).Capacitor;
  if (cap?.isNativePlatform?.()) {
    window.location.href = buildExternalAndroidIntent(url);
    return { ok: true };
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) throw new Error("Could not open the POS app update. Allow pop-ups and try again.");
  return { ok: true };
}

export async function releaseNativePrinter() {
  if (!nativePrinterAvailable()) return { connected: false };
  try {
    return await pluginMethod("disconnect")();
  } catch {
    return { connected: false };
  }
}

export async function disconnectNativePrinter() {
  savePrinterAddress("");
  return pluginMethod("disconnect")();
}

export async function nativeTestPrint() {
  return pluginMethod("printTest")();
}

export async function nativeOpenCashDrawer() {
  return pluginMethod("openCashDrawer")();
}

export async function nativeSpeak(value: string, language = "en-US") {
  const plugin = rawPlugin();
  if (typeof plugin?.speak === "function") return plugin.speak({ text: value, language });

  if ("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = language;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return { ok: true };
  }

  throw new Error("POS app update required: native ThermalPrinter bridge is missing speak.");
}

export async function printEscPosBytes(bytes: Uint8Array) {
  if (!nativePrinterAvailable()) throw new Error("Native printer bridge is incomplete. Install the latest SBB POS app.");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return pluginMethod("printRaw")({ base64: btoa(binary) });
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

function pair(left: string, right: string, width: number) {
  const r = right.slice(0, width);
  const available = Math.max(1, width - r.length - 1);
  return `${left.slice(0, available).padEnd(available)} ${r}`;
}

async function rasterImage(dataUrl: string, maxDots: number) {
  if (!dataUrl) return new Uint8Array();
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Receipt image could not be loaded"));
  });

  const scale = Math.min(1, maxDots / Math.max(1, image.naturalWidth));
  const width = Math.max(1, Math.floor(image.naturalWidth * scale));
  const height = Math.max(1, Math.floor(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Receipt image renderer is unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const alpha = rgba[pixel + 3] / 255;
      const luminance = (rgba[pixel] * 0.299 + rgba[pixel + 1] * 0.587 + rgba[pixel + 2] * 0.114) * alpha + 255 * (1 - alpha);
      if (luminance < 170) bitmap[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
  }

  return concat(
    new Uint8Array([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]),
    bitmap,
    text("\n"),
  );
}

function qrEscPos(value: string) {
  const data = enc.encode(value.trim());
  if (!data.length) return new Uint8Array();
  const storeLength = data.length + 3;
  return concat(
    new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]),
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    new Uint8Array([0x1d, 0x28, 0x6b, storeLength & 0xff, (storeLength >> 8) & 0xff, 0x31, 0x50, 0x30]),
    data,
    new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
    text("\n"),
  );
}

export async function buildReceiptEscPos(payload: ReceiptPayload) {
  const settings = readPosPrinterSettings();
  const width = settings.paperWidth === 80 ? 48 : 32;
  const separator = "-".repeat(width);
  const maxDots = settings.paperWidth === 80 ? 576 : 384;
  const chunks: Uint8Array[] = [new Uint8Array([0x1b, 0x40])];

  chunks.push(new Uint8Array([0x1b, 0x61, 0x01]));
  if (settings.headerLogoDataUrl) {
    try { chunks.push(await rasterImage(settings.headerLogoDataUrl, maxDots)); } catch { /* receipt text must still print */ }
  }
  chunks.push(new Uint8Array([0x1b, 0x45, 0x01]));
  chunks.push(text("SMASH BROTHERS BURGERS\n"));
  chunks.push(new Uint8Array([0x1b, 0x45, 0x00]));
  chunks.push(text("Rawai, Phuket\n"));
  chunks.push(new Uint8Array([0x1b, 0x61, 0x00]));

  const lines: string[] = [
    separator,
    pair("ORDER", payload.ticketNumber, width),
    pair("PAYMENT", payload.paymentMethod.toUpperCase(), width),
    pair("DATE", new Date().toLocaleString("en-GB", { hour12: false }), width),
    separator,
  ];

  for (const line of payload.lines) {
    lines.push(pair(`${line.quantity} x ${line.name}`, money(line.quantity * line.unitPrice), width));
    for (const modifier of line.modifiers || []) lines.push(`  + ${modifier.name} ${money(modifier.price)}`.slice(0, width));
    if (line.setUpgrade) lines.push("  + SET UPGRADE");
    if (line.drinkName) lines.push(`  + ${line.drinkName}`.slice(0, width));
    if (line.notes) lines.push(`  NOTE: ${line.notes}`.slice(0, width));
  }

  lines.push(separator, pair("SUBTOTAL", money(payload.subtotal), width));
  if (payload.discount > 0) lines.push(pair("DISCOUNT", `-${money(payload.discount)}`, width));
  chunks.push(text(lines.join("\n") + "\n"));
  chunks.push(new Uint8Array([0x1b, 0x45, 0x01]));
  chunks.push(text(pair("TOTAL", money(payload.total), width) + "\n"));
  chunks.push(new Uint8Array([0x1b, 0x45, 0x00]));
  if (payload.cashReceived !== undefined) chunks.push(text(pair("CASH", money(payload.cashReceived), width) + "\n"));
  if (payload.change !== undefined) chunks.push(text(pair("CHANGE", money(payload.change), width) + "\n"));
  chunks.push(text(separator + "\n"));

  chunks.push(new Uint8Array([0x1b, 0x61, 0x01]));
  if (settings.footerImageDataUrl) {
    try { chunks.push(await rasterImage(settings.footerImageDataUrl, maxDots)); } catch { /* continue */ }
  }
  if (settings.footerText.trim()) chunks.push(text(settings.footerText.trim().slice(0, width) + "\n"));
  if (settings.qrText.trim()) {
    if (settings.qrLabel.trim()) chunks.push(text(settings.qrLabel.trim().slice(0, width) + "\n"));
    chunks.push(qrEscPos(settings.qrText));
  }
  chunks.push(text("\n\n\n"));
  chunks.push(new Uint8Array([0x1d, 0x56, 0x00]));
  return concat(...chunks);
}

export async function printReceiptNative(payload: ReceiptPayload, openDrawer = false) {
  if (!nativePrinterAvailable()) return { attempted: false, ok: false, message: "Native printer unavailable or POS app update required" };
  let status = await getNativePrinterStatus().catch(() => ({ connected: false }));
  if (!status.connected) status = await reconnectSavedPrinter();
  if (!status.connected) return { attempted: true, ok: false, message: "Printer is not connected" };

  const bytes = await buildReceiptEscPos(payload);
  try {
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
  } finally {
    // Do not monopolise the Bluetooth RFCOMM socket. Releasing the printer after
    // each POS job allows Grab Merchant or another Android app to use the same
    // paired ESC/POS printer between SBB transactions.
    await releaseNativePrinter();
  }
}
