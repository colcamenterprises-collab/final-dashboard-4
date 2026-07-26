import fs from "node:fs";

const appPath = "client/src/App.tsx";
const sidebarPath = "client/src/components/navigation/ModernSidebar.tsx";
const printerPagePath = "client/src/pages/settings/PrinterSettings.tsx";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    if (source.includes(replacement)) return source;
    throw new Error(`Could not apply ${label}; expected source text was not found.`);
  }
  return source.replace(search, replacement);
}

fs.mkdirSync("client/src/pages/settings", { recursive: true });

if (!fs.existsSync(printerPagePath)) {
  fs.writeFileSync(printerPagePath, `import { useEffect, useState } from "react";

const STORAGE_KEY = "sbb-printer-settings-v1";

type PrinterSettingsState = {
  deviceName: string;
  paperWidth: "58" | "80";
  autoPrint: boolean;
  openDrawer: boolean;
};

const defaults: PrinterSettingsState = {
  deviceName: "",
  paperWidth: "58",
  autoPrint: true,
  openDrawer: true,
};

export default function PrinterSettings() {
  const [settings, setSettings] = useState<PrinterSettingsState>(defaults);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings({ ...defaults, ...JSON.parse(saved) });
    } catch {}
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setMessage("Printer settings saved on this tablet.");
  };

  const testPrint = () => {
    window.print();
    setMessage("Android print dialog opened. Select the paired receipt printer.");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <div>
        <h1 className="text-2xl font-black">Printer Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Receipt printer settings for this tablet and register.</p>
      </div>

      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold">
          Printer name
          <input
            value={settings.deviceName}
            onChange={(event) => setSettings({ ...settings, deviceName: event.target.value })}
            placeholder="Example: MTP-II / 58 Printer"
            className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"
          />
        </label>

        <label className="block text-sm font-semibold">
          Paper width
          <select
            value={settings.paperWidth}
            onChange={(event) => setSettings({ ...settings, paperWidth: event.target.value as "58" | "80" })}
            className="mt-1 w-full rounded-xl border px-3 py-3 text-sm"
          >
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </select>
        </label>

        <label className="flex items-center justify-between rounded-xl border p-4 text-sm font-semibold">
          Auto print customer receipt after payment
          <input
            type="checkbox"
            checked={settings.autoPrint}
            onChange={(event) => setSettings({ ...settings, autoPrint: event.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border p-4 text-sm font-semibold">
          Open cash drawer after cash payment
          <input
            type="checkbox"
            checked={settings.openDrawer}
            onChange={(event) => setSettings({ ...settings, openDrawer: event.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={save} className="rounded-xl bg-black px-4 py-3 text-sm font-bold text-white">
            Save printer settings
          </button>
          <button type="button" onClick={testPrint} className="rounded-xl border border-black px-4 py-3 text-sm font-bold">
            Test print
          </button>
        </div>

        {message && <p className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm print:block">
        <div className="mx-auto max-w-[58mm] text-center text-black">
          <h2 className="text-lg font-black">SMASH BROTHERS BURGERS</h2>
          <p className="text-xs">Printer Test</p>
          <hr className="my-2 border-black" />
          <p className="text-xs">Paper width: {settings.paperWidth} mm</p>
        </div>
      </section>
    </div>
  );
}
`);
}

let app = read(appPath);

for (const importLine of [
  'import Orders from "./pages/ordering/Orders";\n',
  'import Catalog from "./pages/ordering/Catalog";\n',
  'import AdminMenu from "./pages/admin/ordering/AdminMenu";\n',
  'import AdminSettings from "./pages/admin/ordering/AdminSettings";\n',
  'import PosCatalog from "./pages/pos/PosCatalog";\n',
]) {
  app = app.replace(importLine, "");
}

if (!app.includes('import PrinterSettings from "./pages/settings/PrinterSettings";')) {
  app = replaceRequired(
    app,
    'import StaffAccess from "./pages/settings/StaffAccess";',
    'import StaffAccess from "./pages/settings/StaffAccess";\nimport PrinterSettings from "./pages/settings/PrinterSettings";',
    "Printer Settings import",
  );
}

app = replaceRequired(
  app,
  '<Route path="/pos/catalog" element={<ProtectedRoute><PosCatalog /></ProtectedRoute>} />',
  '<Route path="/pos/catalog" element={<Navigate to="/menu/items" replace />} />',
  "legacy POS catalogue redirect",
);
app = replaceRequired(
  app,
  '<Route path="/ordering/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />',
  '<Route path="/ordering/orders" element={<Navigate to="/admin/ordering/orders" replace />} />',
  "duplicate Orders redirect",
);
app = replaceRequired(
  app,
  '<Route path="/ordering/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />',
  '<Route path="/ordering/catalog" element={<Navigate to="/menu/items" replace />} />',
  "duplicate ordering catalogue redirect",
);
app = replaceRequired(
  app,
  '<Route path="/admin/ordering/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />',
  '<Route path="/admin/ordering/menu" element={<Navigate to="/menu/items" replace />} />',
  "duplicate admin menu redirect",
);
app = replaceRequired(
  app,
  '<Route path="/admin/ordering/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />',
  '<Route path="/admin/ordering/settings" element={<Navigate to="/admin/ordering/qr-codes" replace />} />',
  "ordering settings consolidation redirect",
);

if (!app.includes('path="/settings/printer"')) {
  app = replaceRequired(
    app,
    '<Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />',
    '<Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />\n                    <Route path="/settings/printer" element={<ProtectedRoute><OwnerRoute><PrinterSettings /></OwnerRoute></ProtectedRoute>} />',
    "Printer Settings route",
  );
}

fs.writeFileSync(appPath, app);

let sidebar = read(sidebarPath);

const oldMenu = `  {
    title: "Menu",
    defaultOpen: false,
    items: [
      { to: "/menu/items",       label: "Menu Items",          icon: UtensilsCrossed, testId: "nav-menu-items" },
      { to: "/menu/recipes",     label: "Recipes & Costing",   icon: BookOpen,        testId: "nav-recipes" },
      { to: "/menu/modifiers",   label: "Modifiers",           icon: List,            testId: "nav-modifiers" },
      { to: "/menu/categories",  label: "Categories",          icon: List,            testId: "nav-menu-categories" },
    ],
  },`;

const newMenu = `  {
    title: "Menu",
    defaultOpen: false,
    items: [
      { to: "/menu/items",       label: "Products",            icon: UtensilsCrossed, testId: "nav-menu-items" },
      { to: "/menu/categories",  label: "Categories",          icon: List,            testId: "nav-menu-categories" },
      { to: "/menu/modifiers",   label: "Modifier Groups",     icon: List,            testId: "nav-modifiers" },
      { to: "/menu/recipes",     label: "Recipes & Costing",   icon: BookOpen,        testId: "nav-recipes", ownerOnly: true },
    ],
  },`;
sidebar = replaceRequired(sidebar, oldMenu, newMenu, "Menu navigation consolidation");

const oldPos = `  {
    title: "POS",
    defaultOpen: true,
    items: [
      { to: "/pos/catalog", label: "POS Catalogue",         icon: UtensilsCrossed, testId: "nav-pos-catalog" },
      { to: "/pos",         label: "Register POS",          icon: ShoppingBag,    testId: "nav-pos-register" },
      { to: "/pos/kitchen", label: "Kitchen Tickets",       icon: CookingPot,     testId: "nav-pos-kitchen" },
      { to: "/pos/display", label: "Customer Ticket Display", icon: Monitor,      testId: "nav-pos-display" },
    ],
  },`;

const newPos = `  {
    title: "POS",
    defaultOpen: true,
    items: [
      { to: "/pos",              label: "Register POS",      icon: ShoppingBag, testId: "nav-pos-register" },
      { to: "/pos/kitchen",      label: "Kitchen Display",   icon: CookingPot,  testId: "nav-pos-kitchen" },
      { to: "/pos/display",      label: "Customer Display",  icon: Monitor,     testId: "nav-pos-display" },
      { to: "/settings/printer", label: "Printer Settings",  icon: Settings,    testId: "nav-printer-settings", ownerOnly: true },
    ],
  },`;
sidebar = replaceRequired(sidebar, oldPos, newPos, "POS navigation consolidation");

const oldOrdering = `  {
    title: "Sales & Ordering",
    defaultOpen: false,
    items: [
      { to: "/admin/ordering/orders",    label: "Orders",             icon: ShoppingBag,     testId: "nav-ordering-orders" },
      { to: "/admin/ordering/qr-codes",  label: "QR Codes & Settings", icon: QrCode,          testId: "nav-ordering-qr" },
    ],
  },`;

const newOrdering = `  {
    title: "Orders",
    defaultOpen: false,
    items: [
      { to: "/admin/ordering/orders",   label: "All Orders",        icon: ShoppingBag, testId: "nav-ordering-orders" },
      { to: "/admin/ordering/qr-codes", label: "Ordering Channels", icon: QrCode,      testId: "nav-ordering-qr" },
    ],
  },`;
sidebar = replaceRequired(sidebar, oldOrdering, newOrdering, "Orders navigation consolidation");

fs.writeFileSync(sidebarPath, sidebar);

console.log("Issue #2 navigation restructuring applied successfully.");
console.log("Legacy duplicate routes now redirect to the retained single source of truth.");
console.log("No database records or legacy components were deleted.");
