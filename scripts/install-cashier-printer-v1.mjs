import fs from "node:fs";

function replaceRequired(path, find, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (source.includes(replacement)) return;
  if (!source.includes(find)) throw new Error(`Required patch marker not found: ${path}`);
  fs.writeFileSync(path, source.replace(find, replacement));
}

fs.mkdirSync("client/src/pages/settings", { recursive: true });

fs.writeFileSync("client/src/lib/receiptPrinter.ts", String.raw`export type PrinterSettings = {
  enabled: boolean;
  autoPrint: boolean;
  openDrawer: boolean;
  paperWidth: 58;
  bridge: "rawbt" | "browser";
  deviceName: string;
};

export type ReceiptPrintLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers?: { name: string; price: number }[];
  notes?: string;
  setUpgrade?: boolean;
  drinkName?: string;
};

export type ReceiptPrintPayload = {
  ticketNumber: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  cashReceived?: number;
  change?: number;
  lines: ReceiptPrintLine[];
  printedAt?: Date;
};

const STORAGE_KEY = "sbb.cashierPrinter.v1";

export const defaultPrinterSettings: PrinterSettings = {
  enabled: true,
  autoPrint: true,
  openDrawer: true,
  paperWidth: 58,
  bridge: "rawbt",
  deviceName: "58mm Bluetooth Receipt Printer",
};

export function loadPrinterSettings(): PrinterSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultPrinterSettings, ...JSON.parse(saved) } : defaultPrinterSettings;
  } catch {
    return defaultPrinterSettings;
  }
}

export function savePrinterSettings(settings: PrinterSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const money = (value: number) => `THB ${Number(value || 0).toFixed(2)}`;
const WIDTH = 32;
const rule = "-".repeat(WIDTH);
const center = (text: string) => {
  const clean = text.slice(0, WIDTH);
  return " ".repeat(Math.max(0, Math.floor((WIDTH - clean.length) / 2))) + clean;
};
const pair = (left: string, right: string) => {
  const safeRight = right.slice(0, WIDTH);
  const leftWidth = Math.max(1, WIDTH - safeRight.length - 1);
  return `${left.slice(0, leftWidth).padEnd(leftWidth, " ")} ${safeRight}`;
};

export function buildReceiptText(payload: ReceiptPrintPayload, settings = loadPrinterSettings()) {
  const date = payload.printedAt || new Date();
  const out: string[] = [
    center("SMASH BROTHERS BURGERS"),
    center("Rawai, Phuket"),
    rule,
    pair("ORDER", payload.ticketNumber),
    pair("DATE", date.toLocaleString("en-GB", { hour12: false })),
    pair("PAYMENT", payload.paymentMethod.toUpperCase()),
    rule,
  ];

  payload.lines.forEach((line) => {
    const lineTotal = line.quantity * line.unitPrice;
    out.push(pair(`${line.quantity} x ${line.name}`, money(lineTotal)));
    line.modifiers?.forEach((modifier) => out.push(`  + ${modifier.name} ${money(modifier.price)}`.slice(0, WIDTH)));
    if (line.setUpgrade) out.push("  + SET UPGRADE".slice(0, WIDTH));
    if (line.drinkName) out.push(`  + ${line.drinkName}`.slice(0, WIDTH));
    if (line.notes) out.push(`  NOTE: ${line.notes}`.slice(0, WIDTH));
  });

  out.push(rule, pair("SUBTOTAL", money(payload.subtotal)));
  if (payload.discount > 0) out.push(pair("DISCOUNT", `-${money(payload.discount)}`));
  out.push(pair("TOTAL", money(payload.total)));
  if (payload.cashReceived !== undefined) out.push(pair("CASH", money(payload.cashReceived)));
  if (payload.change !== undefined) out.push(pair("CHANGE", money(payload.change)));
  out.push(rule, center("THANK YOU"), "", "", "");

  if (settings.openDrawer) out.push("\u001bp\u0000\u0032\u00fa");
  return out.join("\n");
}

function utf8Base64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function sendReceiptToPrinter(text: string, settings = loadPrinterSettings()) {
  if (!settings.enabled) return { attempted: false, ok: true, message: "Printer disabled" };
  try {
    if (settings.bridge === "browser") {
      const popup = window.open("", "_blank", "width=420,height=720");
      if (!popup) throw new Error("Browser blocked the print window");
      popup.document.write(`<pre style="font:14px monospace;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`);
      popup.document.close();
      popup.focus();
      popup.print();
      return { attempted: true, ok: true, message: "Browser print opened" };
    }
    const encoded = utf8Base64(text);
    window.location.href = `rawbt:base64,${encoded}`;
    return { attempted: true, ok: true, message: "Sent to Android print bridge" };
  } catch (error) {
    return { attempted: true, ok: false, message: error instanceof Error ? error.message : "Printing failed" };
  }
}

export async function printReceiptIfEnabled(payload: ReceiptPrintPayload) {
  const settings = loadPrinterSettings();
  if (!settings.enabled || !settings.autoPrint) return { attempted: false, ok: true, message: "Auto print disabled" };
  return sendReceiptToPrinter(buildReceiptText(payload, settings), settings);
}

export async function printTestReceipt(settings = loadPrinterSettings()) {
  const text = [
    center("SMASH BROTHERS BURGERS"),
    center("CASHIER PRINTER TEST"),
    rule,
    pair("PAPER", "58mm"),
    pair("BRIDGE", settings.bridge.toUpperCase()),
    pair("DRAWER", settings.openDrawer ? "ENABLED" : "DISABLED"),
    pair("TIME", new Date().toLocaleString("en-GB", { hour12: false })),
    rule,
    center("TEST SUCCESSFUL"),
    "",
    "",
  ].join("\n") + (settings.openDrawer ? "\n\u001bp\u0000\u0032\u00fa" : "");
  return sendReceiptToPrinter(text, settings);
}
`);

fs.writeFileSync("client/src/pages/settings/HardwareSettings.tsx", String.raw`import { useState } from "react";
import { Printer, RefreshCw, TestTube2 } from "lucide-react";
import { defaultPrinterSettings, loadPrinterSettings, printTestReceipt, savePrinterSettings, type PrinterSettings } from "@/lib/receiptPrinter";

export default function HardwareSettings() {
  const [settings, setSettings] = useState<PrinterSettings>(() => loadPrinterSettings());
  const [status, setStatus] = useState("Ready to test");
  const [testing, setTesting] = useState(false);

  const update = <K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    savePrinterSettings(next);
    setStatus("Settings saved on this cashier tablet");
  };

  const test = async () => {
    setTesting(true);
    setStatus("Sending test receipt...");
    const result = await printTestReceipt(settings);
    setStatus(result.ok ? result.message : `Failed: ${result.message}`);
    window.setTimeout(() => setTesting(false), 1200);
  };

  const reset = () => {
    setSettings(defaultPrinterSettings);
    savePrinterSettings(defaultPrinterSettings);
    setStatus("Printer settings reset");
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Settings</p>
      <h1 className="mt-1 text-3xl font-black text-neutral-900">Cashier Hardware</h1>
      <p className="mt-2 text-sm text-neutral-600">Samsung Galaxy Tab A9+ · 58mm Bluetooth receipt printer</p>
    </div>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#ffd400]"><Printer className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-bold">Cashier receipt printer</h2><p className="text-sm text-neutral-500">ESC/POS compatible · paired in Android Bluetooth settings</p></div>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">CONFIGURED</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Printer name
          <input value={settings.deviceName} onChange={(event) => update("deviceName", event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold">Paper width
          <select value={settings.paperWidth} onChange={() => update("paperWidth", 58)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"><option value={58}>58 mm</option></select>
        </label>
        <label className="text-sm font-semibold">Android print bridge
          <select value={settings.bridge} onChange={(event) => update("bridge", event.target.value as PrinterSettings["bridge"])} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"><option value="rawbt">RawBT / ESC-POS bridge</option><option value="browser">Android browser print</option></select>
        </label>
        <div className="rounded-xl border bg-neutral-50 p-3 text-sm"><strong>Status</strong><p className="mt-1 text-neutral-600">{status}</p></div>
      </div>

      <div className="mt-5 space-y-3">
        {([
          ["enabled", "Receipt printer enabled"],
          ["autoPrint", "Automatically print after payment"],
          ["openDrawer", "Open cash drawer after receipt"],
        ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} className="h-5 w-5" /></label>)}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={test} disabled={testing} className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><TestTube2 className="h-4 w-4" />{testing ? "Sending..." : "Test print"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />Reset settings</button>
      </div>
    </section>

    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <strong>Shop setup:</strong> Keep the printer paired in the Samsung tablet Bluetooth settings. Test Print sends a 58mm ESC/POS receipt through the selected Android bridge.
    </section>
  </div>;
}
`);

replaceRequired(
  "client/src/App.tsx",
  'import StaffAccess from "./pages/settings/StaffAccess";',
  'import StaffAccess from "./pages/settings/StaffAccess";\nimport HardwareSettings from "./pages/settings/HardwareSettings";'
);
replaceRequired(
  "client/src/App.tsx",
  '                    <Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />',
  '                    <Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />\n                    <Route path="/settings/hardware" element={<ProtectedRoute><OwnerRoute><HardwareSettings /></OwnerRoute></ProtectedRoute>} />'
);

replaceRequired(
  "client/src/components/navigation/ModernSidebar.tsx",
  '      { to: "/settings/staff-access", label: "Staff Access",  icon: UserCheck,   testId: "nav-staff-access", ownerOnly: true },',
  '      { to: "/settings/staff-access", label: "Staff Access",  icon: UserCheck,   testId: "nav-staff-access", ownerOnly: true },\n      { to: "/settings/hardware",     label: "Cashier Hardware", icon: Settings, testId: "nav-hardware", ownerOnly: true },'
);

replaceRequired(
  "client/src/pages/pos/PosRegister.tsx",
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useState } from "react";\nimport { printReceiptIfEnabled } from "@/lib/receiptPrinter";'
);
replaceRequired(
  "client/src/pages/pos/PosRegister.tsx",
  '      setMarketingOpen(false);\n      setNotice(`${body.data.ticket_number} sent to kitchen`);\n      speakKitchenOrder(kitchenCalloutItems(),language);',
  '      setMarketingOpen(false);\n      const printResult = await printReceiptIfEnabled({\n        ticketNumber: body.data.ticket_number,\n        paymentMethod: mode === "grab" ? "grab" : payment,\n        subtotal,\n        discount: discountPreview,\n        total,\n        cashReceived: mode === "direct" && payment === "cash" ? Number(cash || 0) : undefined,\n        change: mode === "direct" && payment === "cash" ? change : undefined,\n        lines: cart.map(line => ({\n          name: line.name_en,\n          quantity: line.quantity,\n          unitPrice: Number(line.active_price || 0) + (line.set_upgrade ? 80 : 0) + (line.modifiers || []).reduce((sum, modifier) => sum + Number(modifier.price_delta || 0), 0),\n          modifiers: (line.modifiers || []).map(modifier => ({ name: modifier.name_en, price: Number(modifier.price_delta || 0) })),\n          notes: line.notes,\n          setUpgrade: Boolean(line.set_upgrade || line.meal_deal),\n          drinkName: drinks.find(drink => drink.id === line.set_drink_menu_item_id)?.name_en,\n        })),\n      });\n      setNotice(printResult.attempted && !printResult.ok ? `${body.data.ticket_number} sent to kitchen · Printer failed: ${printResult.message}` : `${body.data.ticket_number} sent to kitchen`);\n      speakKitchenOrder(kitchenCalloutItems(),language);'
);

console.log("Cashier printer v1 installed");
