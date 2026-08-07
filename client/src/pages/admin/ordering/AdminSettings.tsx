import { useEffect, useMemo, useState } from "react";

const defaults = {
  restaurant_name: "Smash Brothers Burgers",
  restaurant_address: "Rawai, Phuket, Thailand",
  restaurant_latitude: "",
  restaurant_longitude: "",
  delivery_enabled: true,
  delivery_radius_km: 4,
  standard_delivery_fee: 50,
  delivery_fee_charged: 0,
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>(defaults);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const r = await fetch("/api/ordering/settings", { credentials: "include" });
    const d = await r.json();
    const values: Record<string, any> = { ...defaults };
    for (const row of d.data ?? []) values[row.key] = row.value;
    setSettings(values);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setMessage("");
    try {
      const payload = {
        restaurant_name: settings.restaurant_name,
        restaurant_address: settings.restaurant_address,
        restaurant_latitude: settings.restaurant_latitude === "" ? null : Number(settings.restaurant_latitude),
        restaurant_longitude: settings.restaurant_longitude === "" ? null : Number(settings.restaurant_longitude),
        delivery_enabled: Boolean(settings.delivery_enabled),
        delivery_radius_km: Number(settings.delivery_radius_km || 0),
        standard_delivery_fee: Number(settings.standard_delivery_fee || 0),
        delivery_fee_charged: Number(settings.delivery_fee_charged || 0),
      };
      const r = await fetch("/api/ordering/settings", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.blockers?.[0]?.message || "Unable to save settings");
      setMessage("Ordering settings saved.");
      await load();
    } catch (error: any) { setMessage(error?.message || "Unable to save settings."); }
    finally { setSaving(false); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setMessage("Location is not available on this device."); return; }
    setLocating(true); setMessage("");
    navigator.geolocation.getCurrentPosition((position) => {
      setSettings((current) => ({ ...current, restaurant_latitude: position.coords.latitude.toFixed(7), restaurant_longitude: position.coords.longitude.toFixed(7) }));
      setMessage("Restaurant location captured. Save Ordering Settings to apply it.");
      setLocating(false);
    }, () => { setMessage("Could not access this device location. Enter latitude and longitude manually."); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  const feeLabel = useMemo(() => Number(settings.delivery_fee_charged || 0) === 0 ? "FREE" : `฿${Number(settings.delivery_fee_charged).toFixed(0)}`, [settings.delivery_fee_charged]);

  const field = (label: string, key: string, type = "text", hint?: string) => <label className="block text-sm font-medium text-neutral-700">{label}<input type={type} value={settings[key] ?? ""} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-950" />{hint && <span className="mt-1 block text-xs font-normal text-neutral-500">{hint}</span>}</label>;

  return <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
    <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Online Ordering</p><h1 className="mt-1 text-3xl font-bold text-neutral-950">Restaurant & Delivery Settings</h1><p className="mt-2 text-sm text-neutral-600">Tenant-level controls. Nothing here is hard-coded to Smash Brothers, so the same ordering platform can be configured for another restaurant.</p></div>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-bold text-neutral-950">Restaurant</h2><p className="mt-1 text-sm text-neutral-500">The restaurant pin is the centre point used to validate direct-delivery orders.</p></div><button type="button" onClick={useCurrentLocation} disabled={locating} className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold text-neutral-800 disabled:opacity-50">{locating ? "Locating…" : "Use Current Location"}</button></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {field("Restaurant name", "restaurant_name")}
        {field("Restaurant address", "restaurant_address")}
        {field("Latitude", "restaurant_latitude", "number", "Used as the delivery-radius centre point.")}
        {field("Longitude", "restaurant_longitude", "number")}
      </div>
    </section>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-neutral-950">Delivery Area</h2><p className="mt-1 text-sm text-neutral-500">SBB starts at 4 km. Customers must choose a map pin inside this radius.</p></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(settings.delivery_enabled)} onChange={(e) => setSettings({ ...settings, delivery_enabled: e.target.checked })} className="h-5 w-5" /> Delivery enabled</label></div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {field("Delivery radius (km)", "delivery_radius_km", "number")}
        {field("Standard delivery value (THB)", "standard_delivery_fee", "number", "Allows receipts to show the normal value even when waived.")}
        {field("Customer delivery charge (THB)", "delivery_fee_charged", "number")}
      </div>
      <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">Customer display: <strong className="ml-1">Delivery {Number(settings.standard_delivery_fee || 0) > 0 && Number(settings.delivery_fee_charged || 0) === 0 ? <><span className="text-neutral-400 line-through">฿{Number(settings.standard_delivery_fee).toFixed(0)}</span> <span className="text-green-700">FREE</span></> : feeLabel}</strong></div>
    </section>

    {message && <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700">{message}</div>}
    <button disabled={saving} onClick={save} className="rounded-xl bg-[#FFD400] px-6 py-3 font-bold text-black disabled:opacity-60">{saving ? "Saving…" : "Save Ordering Settings"}</button>
  </main>;
}
