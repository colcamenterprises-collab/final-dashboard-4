import { useState } from "react";
import { CheckCircle2, Printer, TriangleAlert } from "lucide-react";
import {
  readPosPrinterSettings,
  savePosPrinterSettings,
  type PosPrinterSettings,
} from "@/lib/posPrinterSettings";

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
  const [settings, setSettings] = useState<PosPrinterSettings>(
    readPosPrinterSettings,
  );
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState("");

  const update = <K extends keyof PosPrinterSettings>(
    key: K,
    value: PosPrinterSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    savePosPrinterSettings(settings);
    setSaved(true);
  };

  const directTest = () => {
    savePosPrinterSettings(settings);
    const payload = utf8Base64(buildEscPosTest(settings.printerName));
    setTestStatus("Sending direct ESC/POS test to RawBT…");
    window.location.href = `rawbt:base64,${payload}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Printer className="h-6 w-6" />
          Printer Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          58mm Bluetooth ESC/POS test configuration for this POS tablet.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Printer name
          </span>
          <input
            value={settings.printerName}
            onChange={(event) => update("printerName", event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
            placeholder="58mm Bluetooth Receipt Printer"
          />
        </label>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Paper width
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[58, 80].map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => update("paperWidth", width as 58 | 80)}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  settings.paperWidth === width
                    ? "border-[#d7ae00] bg-[#fff6bf]"
                    : "border-slate-200 bg-white"
                }`}
              >
                {width} mm
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
          <span>
            <span className="block text-sm font-bold text-slate-900">
              Print automatically after payment
            </span>
            <span className="block text-xs text-slate-500">
              Saved now; native automatic printing will use this setting when the Android bridge is installed.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.autoPrint}
            onChange={(event) => update("autoPrint", event.target.checked)}
            className="h-5 w-5"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-[#ffd400] px-4 py-3 text-sm font-black text-black"
          >
            Save printer settings
          </button>
          <button
            type="button"
            onClick={directTest}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white"
          >
            Direct 58mm Test Print
          </button>
        </div>

        {saved && (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Printer settings saved on this tablet.
          </p>
        )}
        {testStatus && <p className="text-sm font-semibold text-slate-700">{testStatus}</p>}
      </section>

      <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-xs leading-5 text-amber-900">
          <p className="font-bold">Immediate shop test</p>
          <p>
            Pair the printer once in Android Bluetooth settings and install/open RawBT. The test button sends raw ESC/POS data directly through RawBT and does not use Android Print Service or a print dialog. This is a temporary hardware-validation bridge; the final SBB APK will replace RawBT with the native in-app Bluetooth plugin.
          </p>
        </div>
      </section>
    </div>
  );
}
