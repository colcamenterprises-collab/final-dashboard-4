import { useEffect, useState } from "react";
import { CheckCircle2, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import {
  readPosPrinterSettings,
  savePosPrinterSettings,
  type PosPrinterSettings,
} from "@/lib/posPrinterSettings";
import {
  connectNativePrinter,
  disconnectNativePrinter,
  getNativePrinterStatus,
  listNativePrinters,
  nativePrinterAvailable,
  nativeTestPrint,
  readSavedPrinterAddress,
  type NativePrinterDevice,
} from "@/lib/thermalPrinter";

function utf8Base64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function buildEscPosTest(printerName: string) {
  const ESC = "\u001b";
  const GS = "\u001d";
  return [
    `${ESC}@`,
    `${ESC}a\u0001`,
    "SMASH BROTHERS BURGERS",
    "58MM PRINTER TEST",
    `${ESC}a\u0000`,
    "--------------------------------",
    `Printer: ${printerName || "58mm Bluetooth"}`,
    `Time: ${new Date().toLocaleString("en-GB", { hour12: false })}`,
    "--------------------------------",
    "DIRECT ESC/POS TEST SUCCESSFUL",
    "",
    "",
    "",
    `${GS}V\u0000`,
  ].join("\n");
}

export default function PrinterSettings() {
  const [settings, setSettings] = useState<PosPrinterSettings>(readPosPrinterSettings);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [printers, setPrinters] = useState<NativePrinterDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState(readSavedPrinterAddress());
  const [connected, setConnected] = useState(false);
  const native = nativePrinterAvailable();

  useEffect(() => {
    if (!native) return;
    getNativePrinterStatus().then((status) => setConnected(status.connected)).catch(() => setConnected(false));
  }, [native]);

  const update = <K extends keyof PosPrinterSettings>(key: K, value: PosPrinterSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    savePosPrinterSettings(settings);
    setSaved(true);
  };

  const refreshPrinters = async () => {
    setTestStatus("Reading paired Bluetooth devices…");
    try {
      const devices = await listNativePrinters();
      setPrinters(devices);
      setTestStatus(devices.length ? "Select the 58mm printer, then Connect." : "No paired Bluetooth devices found. Pair the printer in Android settings first.");
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : "Could not read Bluetooth devices");
    }
  };

  const connect = async () => {
    if (!selectedAddress) return setTestStatus("Select a Bluetooth printer first.");
    setTestStatus("Connecting directly to printer…");
    try {
      const result = await connectNativePrinter(selectedAddress);
      setConnected(result.connected);
      const device = printers.find((item) => item.address === selectedAddress);
      if (device?.name) update("printerName", device.name);
      setTestStatus(result.connected ? `Connected directly to ${result.name || device?.name || "printer"}.` : "Printer did not connect.");
    } catch (error) {
      setConnected(false);
      setTestStatus(error instanceof Error ? error.message : "Printer connection failed");
    }
  };

  const disconnect = async () => {
    await disconnectNativePrinter().catch(() => undefined);
    setConnected(false);
    setSelectedAddress("");
    setTestStatus("Printer disconnected.");
  };

  const directTest = async () => {
    savePosPrinterSettings(settings);
    if (native) {
      setTestStatus("Sending native ESC/POS test…");
      try {
        await nativeTestPrint();
        setTestStatus("Native test sent successfully.");
      } catch (error) {
        setTestStatus(error instanceof Error ? error.message : "Native test failed");
      }
      return;
    }
    const payload = utf8Base64(buildEscPosTest(settings.printerName));
    setTestStatus("Native app not detected. Sending fallback ESC/POS test to RawBT…");
    window.location.href = `rawbt:base64,${payload}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Printer className="h-6 w-6" /> Printer Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          58mm Bluetooth ESC/POS configuration for this POS tablet.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className={`rounded-xl border p-4 ${native ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="text-sm font-black">{native ? "Native SBB printer bridge detected" : "Browser mode"}</p>
          <p className="mt-1 text-xs text-slate-600">
            {native ? "The POS can connect directly to Bluetooth without Android Print Service." : "Install the SBB Android app for direct in-app Bluetooth printing. RawBT remains available only as a test fallback."}
          </p>
        </div>

        {native && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Bluetooth printer</p>
                <p className={`text-sm font-bold ${connected ? "text-emerald-700" : "text-slate-500"}`}>{connected ? "Connected" : "Not connected"}</p>
              </div>
              <button type="button" onClick={refreshPrinters} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw className="h-4 w-4" /> Scan paired</button>
            </div>
            <select value={selectedAddress} onChange={(event) => setSelectedAddress(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm">
              <option value="">Select paired printer…</option>
              {printers.map((device) => <option key={device.address} value={device.address}>{device.name} — {device.address}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={connect} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">Connect</button>
              <button type="button" onClick={disconnect} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black">Disconnect</button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Printer name</span>
          <input value={settings.printerName} onChange={(event) => update("printerName", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" placeholder="58mm Bluetooth Receipt Printer" />
        </label>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wide text-slate-600">Paper width</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[58, 80].map((width) => (
              <button key={width} type="button" onClick={() => update("paperWidth", width as 58 | 80)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${settings.paperWidth === width ? "border-[#d7ae00] bg-[#fff6bf]" : "border-slate-200 bg-white"}`}>{width} mm</button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
          <span>
            <span className="block text-sm font-bold text-slate-900">Print automatically after payment</span>
            <span className="block text-xs text-slate-500">When enabled in the SBB Android app, receipts print directly after checkout.</span>
          </span>
          <input type="checkbox" checked={settings.autoPrint} onChange={(event) => update("autoPrint", event.target.checked)} className="h-5 w-5" />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={save} className="flex-1 rounded-xl bg-[#ffd400] px-4 py-3 text-sm font-black text-black">Save printer settings</button>
          <button type="button" onClick={directTest} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">{native ? "Native Test Print" : "RawBT Test Print"}</button>
        </div>

        {saved && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Printer settings saved on this tablet.</p>}
        {testStatus && <p className="text-sm font-semibold text-slate-700">{testStatus}</p>}
      </section>

      {!native && (
        <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-xs leading-5 text-amber-900">
            <p className="font-bold">Temporary browser fallback</p>
            <p>RawBT can still validate the printer from the browser. The SBB Android app replaces it with the native Bluetooth bridge above.</p>
          </div>
        </section>
      )}
    </div>
  );
}
