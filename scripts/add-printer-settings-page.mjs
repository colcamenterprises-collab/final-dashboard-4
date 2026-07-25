import fs from 'node:fs';

const appPath = 'client/src/App.tsx';
const sidebarPath = 'client/src/components/navigation/ModernSidebar.tsx';
const pagePath = 'client/src/pages/settings/PrinterSettings.tsx';

fs.mkdirSync('client/src/pages/settings', { recursive: true });

const page = `import { useEffect, useState } from "react";

const STORAGE_KEY = "sbb-printer-settings-v1";

type Settings = {
  deviceName: string;
  paperWidth: "58" | "80";
  autoPrint: boolean;
  openDrawer: boolean;
};

const defaults: Settings = {
  deviceName: "",
  paperWidth: "58",
  autoPrint: true,
  openDrawer: true,
};

export default function PrinterSettings() {
  const [settings, setSettings] = useState<Settings>(defaults);
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
    setMessage("Android print dialog opened. Select the paired 58 mm Bluetooth printer.");
  };

  return <div className="mx-auto max-w-4xl space-y-5 p-4">
    <div>
      <h1 className="text-2xl font-black">Receipt Printer</h1>
      <p className="mt-1 text-sm text-slate-500">Cashier printer settings for this tablet and register.</p>
    </div>

    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">Bluetooth receipt printer</h2>
          <p className="text-xs text-slate-500">Pair the printer first in Android Settings. The POS then uses Android's print service.</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Setup required</span>
      </div>

      <label className="block text-sm font-semibold">Printer name
        <input value={settings.deviceName} onChange={(e) => setSettings({ ...settings, deviceName: e.target.value })} placeholder="Example: MTP-II / 58 Printer" className="mt-1 w-full rounded-xl border px-3 py-3 text-sm" />
      </label>

      <label className="block text-sm font-semibold">Paper width
        <select value={settings.paperWidth} onChange={(e) => setSettings({ ...settings, paperWidth: e.target.value as "58" | "80" })} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm">
          <option value="58">58 mm</option>
          <option value="80">80 mm</option>
        </select>
      </label>

      <label className="flex items-center justify-between rounded-xl border p-4 text-sm font-semibold">
        Auto print customer receipt after payment
        <input type="checkbox" checked={settings.autoPrint} onChange={(e) => setSettings({ ...settings, autoPrint: e.target.checked })} className="h-5 w-5" />
      </label>

      <label className="flex items-center justify-between rounded-xl border p-4 text-sm font-semibold">
        Open cash drawer after cash payment
        <input type="checkbox" checked={settings.openDrawer} onChange={(e) => setSettings({ ...settings, openDrawer: e.target.checked })} className="h-5 w-5" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={save} className="rounded-xl bg-black px-4 py-3 text-sm font-bold text-white">Save printer settings</button>
        <button type="button" onClick={testPrint} className="rounded-xl border border-black px-4 py-3 text-sm font-bold">Test print</button>
      </div>

      {message && <p className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm print:block">
      <div className="mx-auto max-w-[58mm] text-center text-black">
        <h2 className="text-lg font-black">SMASH BROTHERS BURGERS</h2>
        <p className="text-xs">Printer Test</p>
        <hr className="my-2 border-black" />
        <p className="text-xs">Paper width: {settings.paperWidth} mm</p>
        <p className="text-xs">RestaurantOS cashier printer</p>
      </div>
    </section>
  </div>;
}
`;
fs.writeFileSync(pagePath, page);

let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes('import PrinterSettings from "./pages/settings/PrinterSettings";')) {
  app = app.replace(
    'import StaffAccess from "./pages/settings/StaffAccess";',
    'import StaffAccess from "./pages/settings/StaffAccess";\nimport PrinterSettings from "./pages/settings/PrinterSettings";'
  );
}
if (!app.includes('path="/settings/printer"')) {
  app = app.replace(
    '<Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />',
    '<Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />\n                    <Route path="/settings/printer" element={<ProtectedRoute><OwnerRoute><PrinterSettings /></OwnerRoute></ProtectedRoute>} />'
  );
}
fs.writeFileSync(appPath, app);

let sidebar = fs.readFileSync(sidebarPath, 'utf8');
if (!sidebar.includes('label: "Printer Settings"')) {
  sidebar = sidebar.replace(
    '{ to: "/pos/display", label: "Customer Ticket Display", icon: Monitor,      testId: "nav-pos-display" },',
    '{ to: "/pos/display", label: "Customer Ticket Display", icon: Monitor,      testId: "nav-pos-display" },\n      { to: "/settings/printer", label: "Printer Settings", icon: Settings, testId: "nav-printer-settings", ownerOnly: true },'
  );
}
fs.writeFileSync(sidebarPath, sidebar);

console.log('Printer Settings page, route and sidebar link installed.');
