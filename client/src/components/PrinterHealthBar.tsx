import { useEffect, useState } from "react";
import { readLastNativeCheckoutStatus } from "@/lib/posNativeCheckoutBridge";
import {
  getNativePrinterStatus,
  nativePrinterAvailable,
  readSavedPrinterAddress,
} from "@/lib/thermalPrinter";

type State = {
  healthy: boolean;
  label: string;
  detail: string;
};

function visiblePath() {
  const path = window.location.pathname;
  return path === "/dashboard" || path === "/pos" || path.startsWith("/pos?");
}

export default function PrinterHealthBar() {
  const [visible, setVisible] = useState(visiblePath);
  const [state, setState] = useState<State>({ healthy: false, label: "Printer", detail: "Checking" });

  useEffect(() => {
    let cancelled = false;
    let previousPath = window.location.pathname;

    const refresh = async () => {
      const currentPath = window.location.pathname;
      if (currentPath !== previousPath) {
        previousPath = currentPath;
        if (!cancelled) setVisible(visiblePath());
      }
      if (!visiblePath()) return;

      if (!nativePrinterAvailable()) {
        if (!cancelled) setState({ healthy: false, label: "Printer", detail: "POS app offline" });
        return;
      }

      const saved = readSavedPrinterAddress();
      if (!saved) {
        if (!cancelled) setState({ healthy: false, label: "Printer", detail: "Not configured" });
        return;
      }

      const last = readLastNativeCheckoutStatus();
      const lastFailedRecently = Boolean(
        last && !last.printed && Date.now() - new Date(last.at).getTime() < 6 * 60 * 60 * 1000,
      );
      const status = await getNativePrinterStatus().catch(() => ({ connected: false }));

      if (!cancelled) {
        setState(lastFailedRecently
          ? { healthy: false, label: "Printer", detail: "Last print failed" }
          : {
              healthy: true,
              label: "Printer",
              detail: status.connected ? "Connected" : "Ready",
            });
      }
    };

    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    const checkout = () => { void refresh(); };
    window.addEventListener("sbb:pos-native-checkout", checkout);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("sbb:pos-native-checkout", checkout);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      title={`${state.label}: ${state.detail}`}
      onClick={() => { window.location.assign("/pos/printer-settings"); }}
      className="fixed right-4 top-[76px] z-[80] flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      <span className="flex h-2.5 w-9 overflow-hidden rounded-full bg-slate-200">
        <span className={`h-full w-full ${state.healthy ? "bg-emerald-500" : "bg-red-500"}`} />
      </span>
      <span className="text-[11px] font-black text-slate-900">{state.label}</span>
      <span className={`text-[10px] font-bold ${state.healthy ? "text-emerald-700" : "text-red-700"}`}>
        {state.healthy ? "100%" : "0%"}
      </span>
    </button>
  );
}
