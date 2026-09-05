import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

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

type DeviceRole = "register" | "kitchen" | "display";
type Device = {
  id: string;
  device_name: string;
  role: DeviceRole;
  location_name?: string | null;
  platform: string;
  status: "pending" | "active" | "revoked";
  paired_at?: string | null;
  last_seen_at?: string | null;
  app_version?: string | null;
  os_version?: string | null;
};

type Pairing = {
  id: string;
  device_name: string;
  role: DeviceRole;
  pairing_code: string;
  pairing_uri: string;
  pairing_expires_at: string;
};

const roleLabel: Record<DeviceRole, string> = {
  register: "POS Register",
  kitchen: "Kitchen Display",
  display: "Customer Display",
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>(defaults);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [deviceRole, setDeviceRole] = useState<DeviceRole>("register");
  const [deviceLocation, setDeviceLocation] = useState("Rawai");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState("");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairingQr, setPairingQr] = useState("");

  async function load() {
    const r = await fetch("/api/ordering/settings", { credentials: "include" });
    const d = await r.json();
    const values: Record<string, any> = { ...defaults };
    for (const row of d.data ?? []) values[row.key] = row.value;
    setSettings(values);
  }

  async function loadDevices() {
    try {
      const r = await fetch("/api/pos/devices", { credentials: "include" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || "Unable to load devices");
      setDevices(d.data || []);
      setDeviceMessage("");
    } catch (error: any) {
      setDeviceMessage(error?.message || "Device management requires owner access.");
    }
  }

  useEffect(() => { void load(); void loadDevices(); }, []);

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

  async function createDevice() {
    if (!deviceName.trim()) return setDeviceMessage("Enter a device name.");
    setDeviceBusy(true); setDeviceMessage("");
    try {
      const r = await fetch("/api/pos/devices", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: deviceName.trim(), role: deviceRole, location_name: deviceLocation.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || "Unable to create device");
      setDeviceName("");
      await loadDevices();
      await startPairing(d.data.id);
    } catch (error: any) {
      setDeviceMessage(error?.message || "Unable to create device.");
    } finally { setDeviceBusy(false); }
  }

  async function startPairing(id: string) {
    setDeviceBusy(true); setDeviceMessage("");
    try {
      const r = await fetch(`/api/pos/devices/${id}/pairing`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || "Unable to create pairing code");
      setPairing(d.data);
      setPairingQr(await QRCode.toDataURL(d.data.pairing_uri, { width: 280, margin: 2 }));
      await loadDevices();
    } catch (error: any) {
      setDeviceMessage(error?.message || "Unable to create pairing code.");
    } finally { setDeviceBusy(false); }
  }

  async function revokeDevice(id: string) {
    if (!window.confirm("Revoke this device? It will immediately lose access and must be paired again as a new/renewed device.")) return;
    setDeviceBusy(true);
    try {
      const r = await fetch(`/api/pos/devices/${id}/revoke`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || "Unable to revoke device");
      if (pairing?.id === id) { setPairing(null); setPairingQr(""); }
      await loadDevices();
    } catch (error: any) {
      setDeviceMessage(error?.message || "Unable to revoke device.");
    } finally { setDeviceBusy(false); }
  }

  const feeLabel = useMemo(() => Number(settings.delivery_fee_charged || 0) === 0 ? "FREE" : `฿${Number(settings.delivery_fee_charged).toFixed(0)}`, [settings.delivery_fee_charged]);
  const field = (label: string, key: string, type = "text", hint?: string) => <label className="block text-sm font-medium text-neutral-700">{label}<input type={type} value={settings[key] ?? ""} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-950" />{hint && <span className="mt-1 block text-xs font-normal text-neutral-500">{hint}</span>}</label>;

  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Back Office</p><h1 className="mt-1 text-3xl font-bold text-neutral-950">Business, Delivery & Devices</h1><p className="mt-2 text-sm text-neutral-600">Control restaurant settings and register POS, Kitchen Display and Customer Display devices without server or terminal access.</p></div>

    <section className="rounded-2xl border-2 border-neutral-950 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">Customli Device Control</p><h2 className="mt-1 text-2xl font-black text-neutral-950">Devices</h2><p className="mt-1 max-w-3xl text-sm text-neutral-600">Back Office owns the device identity and role. Staff never need a backend token, SSH session or terminal command.</p></div><button type="button" onClick={() => void loadDevices()} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold">Refresh</button></div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label className="text-sm font-bold">Device name<input value={deviceName} onChange={(e)=>setDeviceName(e.target.value)} placeholder="Main Counter POS" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5" /></label>
        <label className="text-sm font-bold">Role<select value={deviceRole} onChange={(e)=>setDeviceRole(e.target.value as DeviceRole)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"><option value="register">POS Register</option><option value="kitchen">Kitchen Display</option><option value="display">Customer Display</option></select></label>
        <label className="text-sm font-bold">Location<input value={deviceLocation} onChange={(e)=>setDeviceLocation(e.target.value)} placeholder="Rawai" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5" /></label>
        <button disabled={deviceBusy} onClick={() => void createDevice()} className="self-end rounded-xl bg-[#FFD400] px-5 py-3 font-black text-black disabled:opacity-50">+ Add Device</button>
      </div>

      {deviceMessage && <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{deviceMessage}</div>}

      <div className="mt-5 overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-left text-sm"><thead className="bg-neutral-950 text-white"><tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last seen</th><th className="px-4 py-3">Version</th><th className="px-4 py-3 text-right">Controls</th></tr></thead><tbody>
          {devices.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No registered devices yet.</td></tr>}
          {devices.map((device) => <tr key={device.id} className="border-t"><td className="px-4 py-3 font-bold">{device.device_name}<div className="text-xs font-normal text-neutral-500">{device.platform || "android"}</div></td><td className="px-4 py-3">{roleLabel[device.role]}</td><td className="px-4 py-3">{device.location_name || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${device.status === "active" ? "bg-green-100 text-green-800" : device.status === "revoked" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{device.status}</span></td><td className="px-4 py-3 text-xs">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}</td><td className="px-4 py-3 text-xs">{device.app_version || "—"}</td><td className="px-4 py-3"><div className="flex justify-end gap-2">{device.status !== "revoked" && <button disabled={deviceBusy} onClick={() => void startPairing(device.id)} className="rounded-lg border px-3 py-2 text-xs font-bold">{device.status === "active" ? "Re-pair" : "Pair"}</button>} {device.status !== "revoked" && <button disabled={deviceBusy} onClick={() => void revokeDevice(device.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Revoke</button>}</div></td></tr>)}
        </tbody></table>
      </div>

      {pairing && <div className="mt-5 grid gap-5 rounded-2xl border-2 border-[#FFD400] bg-[#fffdf0] p-5 md:grid-cols-[300px_1fr] md:items-center">
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">{pairingQr ? <img src={pairingQr} alt="Device pairing QR code" className="mx-auto h-[280px] w-[280px]" /> : <div className="grid h-[280px] place-items-center text-neutral-500">Creating QR…</div>}</div>
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Pair device</p><h3 className="mt-1 text-2xl font-black">{pairing.device_name}</h3><p className="mt-1 text-sm text-neutral-600">Assigned role: <strong>{roleLabel[pairing.role]}</strong>. Open the Customli app and scan this QR code, or enter the six-digit code.</p><div className="mt-5 inline-flex rounded-2xl bg-black px-6 py-4 font-mono text-4xl font-black tracking-[0.28em] text-white">{pairing.pairing_code.slice(0,3)} {pairing.pairing_code.slice(3)}</div><p className="mt-3 text-xs font-semibold text-neutral-500">Single use. Expires {new Date(pairing.pairing_expires_at).toLocaleTimeString()}.</p><button onClick={() => { setPairing(null); setPairingQr(""); }} className="mt-4 rounded-xl border bg-white px-4 py-2 text-sm font-bold">Close pairing</button></div>
      </div>}
    </section>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-bold text-neutral-950">Restaurant</h2><p className="mt-1 text-sm text-neutral-500">The restaurant pin is the centre point used to validate direct-delivery orders.</p></div><button type="button" onClick={useCurrentLocation} disabled={locating} className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold text-neutral-800 disabled:opacity-50">{locating ? "Locating…" : "Use Current Location"}</button></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{field("Restaurant name", "restaurant_name")}{field("Restaurant address", "restaurant_address")}{field("Latitude", "restaurant_latitude", "number", "Used as the delivery-radius centre point.")}{field("Longitude", "restaurant_longitude", "number")}</div>
    </section>

    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-neutral-950">Delivery Area</h2><p className="mt-1 text-sm text-neutral-500">Configure the direct-delivery service radius and customer fee.</p></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(settings.delivery_enabled)} onChange={(e) => setSettings({ ...settings, delivery_enabled: e.target.checked })} className="h-5 w-5" /> Delivery enabled</label></div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{field("Delivery radius (km)", "delivery_radius_km", "number")}{field("Standard delivery value (THB)", "standard_delivery_fee", "number", "Allows receipts to show the normal value even when waived.")}{field("Customer delivery charge (THB)", "delivery_fee_charged", "number")}</div>
      <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">Customer display: <strong className="ml-1">Delivery {Number(settings.standard_delivery_fee || 0) > 0 && Number(settings.delivery_fee_charged || 0) === 0 ? <><span className="text-neutral-400 line-through">฿{Number(settings.standard_delivery_fee).toFixed(0)}</span> <span className="text-green-700">FREE</span></> : feeLabel}</strong></div>
    </section>

    {message && <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700">{message}</div>}
    <button disabled={saving} onClick={save} className="rounded-xl bg-[#FFD400] px-6 py-3 font-bold text-black disabled:opacity-60">{saving ? "Saving…" : "Save Business Settings"}</button>
  </main>;
}
