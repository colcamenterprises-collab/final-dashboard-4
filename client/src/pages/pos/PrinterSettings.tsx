import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Download, Printer, RefreshCw, TriangleAlert, Upload } from "lucide-react";
import {
  readPosPrinterSettings,
  savePosPrinterSettings,
  type PosPrinterSettings,
} from "@/lib/posPrinterSettings";
import { readLastNativeCheckoutStatus } from "@/lib/posNativeCheckoutBridge";
import {
  connectNativePrinter,
  disconnectNativePrinter,
  getNativeAppVersion,
  getNativePrinterStatus,
  listNativePrinters,
  nativeOpenCashDrawer,
  nativePrinterAvailable,
  nativeTestPrint,
  openNativeAppUpdate,
  readSavedPrinterAddress,
  reconnectSavedPrinter,
  releaseNativePrinter,
  savePrinterAddress,
  type NativeAppVersion,
  type NativePrinterDevice,
} from "@/lib/thermalPrinter";

type PrinterStatus = { connected: boolean; name?: string; address?: string; connectionMethod?: string };
type PosAppRelease = { channel: string; versionName: string; versionCode: number; apkUrl: string; releaseNotes?: string };

async function receiptImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  if (file.size > 6 * 1024 * 1024) throw new Error("Receipt image must be under 6 MB");
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = url;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load image"));
  });
  const maxWidth = 576;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image renderer unavailable");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export default function PrinterSettings() {
  const [settings, setSettings] = useState<PosPrinterSettings>(readPosPrinterSettings);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [printers, setPrinters] = useState<NativePrinterDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState(readSavedPrinterAddress());
  const [ready, setReady] = useState(false);
  const [lastCheckout, setLastCheckout] = useState(readLastNativeCheckoutStatus);
  const [installedApp, setInstalledApp] = useState<NativeAppVersion | null>(null);
  const [latestRelease, setLatestRelease] = useState<PosAppRelease | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [qrPreview, setQrPreview] = useState("");
  const native = nativePrinterAvailable();

  const updateAvailable = useMemo(() => {
    if (!native || !installedApp || !latestRelease) return false;
    return Number(latestRelease.versionCode || 0) > Number(installedApp.versionCode || 0);
  }, [installedApp, latestRelease, native]);

  useEffect(() => {
    let cancelled = false;
    if (!settings.qrText.trim()) { setQrPreview(""); return; }
    void QRCode.toDataURL(settings.qrText.trim(), { margin: 1, width: 180 }).then((url) => {
      if (!cancelled) setQrPreview(url);
    }).catch(() => { if (!cancelled) setQrPreview(""); });
    return () => { cancelled = true; };
  }, [settings.qrText]);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    const restore = async () => {
      try {
        const devices = await listNativePrinters();
        if (!cancelled) setPrinters(devices);
        const savedAddress = readSavedPrinterAddress();
        if (savedAddress && !cancelled) setSelectedAddress(savedAddress);
        if (savedAddress) {
          const status = await reconnectSavedPrinter();
          if (status.connected) {
            await releaseNativePrinter();
            if (!cancelled) {
              setReady(true);
              setTestStatus(`Printer ready${status.name ? `: ${status.name}` : ""}. Connection releases after each SBB print so Grab can share it.`);
            }
          } else if (!cancelled) setTestStatus("Saved printer could not be reached. Tap Connect & Save.");
        }
      } catch (error) {
        if (!cancelled) setTestStatus(error instanceof Error ? error.message : "Could not restore printer");
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [native]);

  useEffect(() => {
    const updateLastCheckout = () => setLastCheckout(readLastNativeCheckoutStatus());
    window.addEventListener("sbb:pos-native-checkout", updateLastCheckout);
    return () => window.removeEventListener("sbb:pos-native-checkout", updateLastCheckout);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/pos-app/latest.json?ts=${Date.now()}`, { cache: "no-store" });
        if (response.ok && !cancelled) setLatestRelease(await response.json());
      } catch {}
      if (native) {
        try { const installed = await getNativeAppVersion(); if (!cancelled) setInstalledApp(installed); }
        catch (error) { if (!cancelled) setUpdateStatus(error instanceof Error ? error.message : "Could not read app version"); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [native]);

  const update = <K extends keyof PosPrinterSettings>(key: K, value: PosPrinterSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    savePosPrinterSettings(settings);
    if (selectedAddress) savePrinterAddress(selectedAddress);
    setSaved(true);
  };

  const refreshPrinters = async () => {
    setTestStatus("Reading paired Bluetooth devices…");
    try {
      const devices = await listNativePrinters();
      setPrinters(devices);
      setTestStatus(devices.length ? "Paired devices refreshed." : "No paired devices found. Pair the printer in Android settings first.");
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : "Could not read Bluetooth devices");
    }
  };

  const connect = async () => {
    if (!selectedAddress) return setTestStatus("Select a Bluetooth printer first.");
    setTestStatus("Testing printer connection…");
    try {
      const result = await connectNativePrinter(selectedAddress);
      const device = printers.find((item) => item.address === selectedAddress);
      const next = { ...settings, printerName: result.name || device?.name || settings.printerName };
      setSettings(next);
      savePosPrinterSettings(next);
      savePrinterAddress(selectedAddress);
      setReady(Boolean(result.connected));
      await releaseNativePrinter();
      setSaved(true);
      setTestStatus(result.connected ? "Printer verified and saved. Bluetooth released for shared use with Grab Merchant." : "Printer did not connect.");
    } catch (error) {
      setReady(false);
      setTestStatus(error instanceof Error ? error.message : "Printer connection failed");
    }
  };

  const disconnect = async () => {
    await disconnectNativePrinter().catch(() => undefined);
    setReady(false);
    setSelectedAddress("");
    setTestStatus("Printer selection cleared.");
  };

  const ensureConnection = async () => {
    let status: PrinterStatus = await getNativePrinterStatus().catch(() => ({ connected: false }));
    if (!status.connected) status = await reconnectSavedPrinter();
    if (!status.connected) throw new Error("Saved printer could not reconnect. Tap Connect & Save and try again.");
    setReady(true);
    return status;
  };

  const directTest = async () => {
    if (!native) return setTestStatus("Native test printing requires the SBB POS app.");
    save();
    try {
      await ensureConnection();
      await nativeTestPrint();
      setTestStatus("Native test printed successfully. Bluetooth released for Grab after the test.");
    } catch (error) {
      setReady(false);
      setTestStatus(error instanceof Error ? error.message : "Native test failed");
    } finally {
      await releaseNativePrinter();
    }
  };

  const drawerTest = async () => {
    if (!native) return setTestStatus("Cash drawer testing requires the SBB POS app.");
    try {
      await ensureConnection();
      await nativeOpenCashDrawer();
      setTestStatus("Cash drawer pulse sent successfully. Bluetooth released for Grab.");
    } catch (error) {
      setReady(false);
      setTestStatus(error instanceof Error ? error.message : "Cash drawer test failed");
    } finally {
      await releaseNativePrinter();
    }
  };

  const installUpdate = async () => {
    if (!latestRelease?.apkUrl) return setUpdateStatus("No approved POS app download is available.");
    try {
      if (native) await openNativeAppUpdate(latestRelease.apkUrl);
      else window.location.assign(latestRelease.apkUrl);
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : "Could not open POS app update");
    }
  };

  const upload = async (key: "headerLogoDataUrl" | "footerImageDataUrl", file?: File) => {
    if (!file) return;
    try { update(key, await receiptImage(file)); }
    catch (error) { setTestStatus(error instanceof Error ? error.message : "Could not load image"); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900"><Printer className="h-6 w-6" /> Printer Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Bluetooth printer, receipt branding, QR and cash-drawer configuration.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className={`rounded-xl border p-4 ${native ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-black">{native ? "Native SBB printer bridge detected" : "Browser mode"}</p>
            <p className="mt-1 text-xs text-slate-600">{native ? "SBB connects only for each print job, then releases Bluetooth so Grab Merchant can use the same paired printer." : "Open this page inside the SBB Android POS app for direct Bluetooth printing."}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-600">POS app update</p><p className="text-sm font-black">{native && installedApp ? `Installed ${installedApp.versionName} (build ${installedApp.versionCode})` : native ? "Reading installed version…" : "Browser mode"}</p><p className="text-xs text-slate-600">{latestRelease ? `Latest approved ${latestRelease.versionName} (build ${latestRelease.versionCode})` : "Checking latest release…"}</p></div>
              {native && latestRelease && <span className={`rounded-full px-3 py-1 text-xs font-black ${updateAvailable ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{updateAvailable ? "UPDATE AVAILABLE" : "UP TO DATE"}</span>}
            </div>
            <button type="button" onClick={installUpdate} disabled={!latestRelease?.apkUrl} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffd400] px-4 py-3 text-sm font-black text-black disabled:opacity-40"><Download className="h-4 w-4" /> {updateAvailable ? "Download & Install Update" : "Download Latest POS App"}</button>
            {updateStatus && <p className="text-xs font-semibold text-slate-700">{updateStatus}</p>}
          </div>

          {native && <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Bluetooth printer</p><p className={`text-sm font-bold ${ready ? "text-emerald-700" : "text-red-700"}`}>{ready ? "Ready" : "Not ready"}</p></div><button type="button" onClick={refreshPrinters} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw className="h-4 w-4" /> Scan paired</button></div>
            <select value={selectedAddress} onChange={(e) => setSelectedAddress(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"><option value="">Select paired printer…</option>{printers.map((device) => <option key={device.address} value={device.address}>{device.name} — {device.address}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={connect} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">Connect & Save</button><button type="button" onClick={disconnect} className="rounded-xl border px-4 py-3 text-sm font-black">Clear printer</button></div>
          </div>}

          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Printer name</span><input value={settings.printerName} onChange={(e) => update("printerName", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" /></label>
          <fieldset><legend className="text-xs font-bold uppercase tracking-wide text-slate-600">Paper width</legend><div className="mt-2 grid grid-cols-2 gap-3">{[58,80].map((width) => <button key={width} type="button" onClick={() => update("paperWidth", width as 58|80)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${settings.paperWidth === width ? "border-[#d7ae00] bg-[#fff6bf]" : "border-slate-200"}`}>{width} mm</button>)}</div></fieldset>
          <label className="flex items-center justify-between rounded-xl border p-4"><span><span className="block text-sm font-bold">Print automatically after payment</span><span className="block text-xs text-slate-500">Reconnects, prints, then releases the printer for other apps.</span></span><input type="checkbox" checked={settings.autoPrint} onChange={(e) => update("autoPrint", e.target.checked)} className="h-5 w-5" /></label>

          <div className="space-y-4 rounded-2xl border-2 border-slate-200 p-4">
            <div><h2 className="text-base font-black">Receipt Branding & QR</h2><p className="text-xs text-slate-500">Like Loyverse: upload header/footer artwork and preview the customer receipt before saving.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-dashed p-4 text-sm font-bold"><span className="mb-2 flex items-center gap-2"><Upload className="h-4 w-4" /> Header logo</span><input type="file" accept="image/*" onChange={(e) => void upload("headerLogoDataUrl", e.target.files?.[0])} className="block w-full text-xs" />{settings.headerLogoDataUrl && <button type="button" onClick={() => update("headerLogoDataUrl", "")} className="mt-2 text-xs underline">Remove</button>}</label>
              <label className="rounded-xl border border-dashed p-4 text-sm font-bold"><span className="mb-2 flex items-center gap-2"><Upload className="h-4 w-4" /> Footer logo / image</span><input type="file" accept="image/*" onChange={(e) => void upload("footerImageDataUrl", e.target.files?.[0])} className="block w-full text-xs" />{settings.footerImageDataUrl && <button type="button" onClick={() => update("footerImageDataUrl", "")} className="mt-2 text-xs underline">Remove</button>}</label>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">QR code URL / text<input value={settings.qrText} onChange={(e) => update("qrText", e.target.value)} placeholder="https://order.smashbrosburgers.com" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm normal-case tracking-normal" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wide text-slate-600">QR label<input value={settings.qrLabel} onChange={(e) => update("qrLabel", e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm normal-case" /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Footer text<input value={settings.footerText} onChange={(e) => update("footerText", e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm normal-case" /></label></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3"><button type="button" onClick={save} className="rounded-xl bg-[#ffd400] px-4 py-3 text-sm font-black">Save printer settings</button><button type="button" onClick={directTest} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">Native Test Print</button><button type="button" onClick={drawerTest} disabled={!native} className="rounded-xl border border-slate-900 px-4 py-3 text-sm font-black disabled:opacity-40">Test Cash Drawer</button></div>
          {saved && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Printer, branding and QR settings saved on this POS tablet.</p>}
          {testStatus && <p className="text-sm font-semibold text-slate-700">{testStatus}</p>}
          {lastCheckout && <div className="rounded-xl border bg-slate-50 p-4 text-xs leading-5"><p className="font-black">Last POS checkout hardware result · Ticket {lastCheckout.ticketNumber || "—"}</p><p>Automatic print: <strong>{lastCheckout.printed ? "SUCCESS" : "NOT PRINTED"}</strong> — {lastCheckout.printMessage}</p><p>Order callout: <strong>{lastCheckout.callout ? "SUCCESS" : "NOT PLAYED"}</strong> — {lastCheckout.calloutMessage}</p></div>}
        </section>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-2xl border bg-slate-100 p-4"><p className="mb-3 text-xs font-black uppercase tracking-[.16em] text-slate-500">Receipt preview</p><div className="mx-auto w-[280px] bg-white px-5 py-6 font-mono text-[11px] text-black shadow-xl">
            {settings.headerLogoDataUrl ? <img src={settings.headerLogoDataUrl} alt="Header logo" className="mx-auto mb-3 max-h-24 max-w-full object-contain grayscale" /> : null}
            <div className="text-center"><p className="text-sm font-black">SMASH BROTHERS BURGERS</p><p>Rawai, Phuket</p></div><p className="my-2">--------------------------------</p><div className="flex justify-between"><span>ORDER</span><span>483</span></div><div className="flex justify-between"><span>PAYMENT</span><span>CASH</span></div><p className="my-2">--------------------------------</p><div className="flex justify-between"><span>1 x Double Smash</span><span>THB 220.00</span></div><p>  + Cheese THB 30.00</p><div className="flex justify-between"><span>1 x Fries</span><span>THB 80.00</span></div><p className="my-2">--------------------------------</p><div className="flex justify-between"><span>SUBTOTAL</span><span>THB 330.00</span></div><div className="mt-1 flex justify-between text-sm font-black"><span>TOTAL</span><span>THB 330.00</span></div><p className="my-2">--------------------------------</p>
            {settings.footerImageDataUrl ? <img src={settings.footerImageDataUrl} alt="Footer" className="mx-auto my-3 max-h-24 max-w-full object-contain grayscale" /> : null}
            <div className="text-center">{settings.footerText && <p className="font-bold">{settings.footerText}</p>}{settings.qrText && <>{settings.qrLabel && <p className="mt-2">{settings.qrLabel}</p>}{qrPreview && <img src={qrPreview} alt="Receipt QR" className="mx-auto mt-1 h-28 w-28" />}</>}</div>
          </div></div>
        </aside>
      </div>

      {!native && <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="text-xs leading-5 text-amber-900"><p className="font-bold">Browser mode</p><p>Receipt design can be previewed here, but direct Bluetooth testing requires the SBB Android POS app.</p></div></section>}
    </div>
  );
}
