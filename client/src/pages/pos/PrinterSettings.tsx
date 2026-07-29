import { useState } from "react";
import { CheckCircle2, Printer, TriangleAlert } from "lucide-react";
import {
  readPosPrinterSettings,
  savePosPrinterSettings,
  type PosPrinterSettings,
} from "@/lib/posPrinterSettings";

export default function PrinterSettings() {
  const [settings, setSettings] = useState<PosPrinterSettings>(
    readPosPrinterSettings,
  );
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Printer className="h-6 w-6" />
          Printer Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Settings are saved on this POS tablet.
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
            placeholder="Receipt printer"
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
              Opens the tablet print service after a successful order.
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
            onClick={() => window.print()}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white"
          >
            Open test print
          </button>
        </div>

        {saved && (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Printer settings saved on this tablet.
          </p>
        )}
      </section>

      <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs leading-5 text-amber-900">
          Android controls the final printer connection. Pair the Bluetooth
          printer in tablet settings and select it when the print service opens.
          Browsers cannot silently pair or choose a system printer.
        </p>
      </section>

      <style>{`
        @media print {
          @page { size: ${settings.paperWidth}mm auto; margin: 3mm; }
          body * { visibility: hidden !important; }
          body::after {
            visibility: visible !important;
            content: "SMASH BROTHERS BURGERS\\A PRINTER TEST\\A ${settings.printerName}\\A ${settings.paperWidth}mm";
            white-space: pre;
            display: block;
            font: 700 14px monospace;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
