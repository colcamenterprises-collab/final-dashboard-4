import { useEffect, useMemo, useState } from "react";

const money = (value: unknown) => `฿${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
type VenueFormKey = "name" | "contact_name" | "phone" | "address" | "latitude" | "longitude";
const venueFields: Array<[string, VenueFormKey, boolean, string]> = [
  ["Venue name", "name", true, "Hotel, bar, hostel or partner name"],
  ["Contact name", "contact_name", false, "Optional"],
  ["Phone", "phone", false, "Optional"],
  ["Delivery address", "address", true, "Address used for locked QR delivery"],
  ["Latitude", "latitude", false, "Example: 7.7796"],
  ["Longitude", "longitude", false, "Example: 98.3254"],
];

const emptyForm = { name: "", contact_name: "", phone: "", address: "", latitude: "", longitude: "", notes: "" };

export default function AdminVenues() {
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ordering/commercial/admin/venues", { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Unable to load venues");
      setVenues(json.data || []);
    } catch (error: any) {
      window.alert(error?.message || "Unable to load venues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => venues.reduce((acc, venue) => {
    acc.scans += Number(venue.qr_scans || 0);
    acc.orders += Number(venue.orders || 0);
    acc.sales += Number(venue.sales || 0);
    return acc;
  }, { scans: 0, orders: 0, sales: 0 }), [venues]);

  const startCreate = () => { setEditing(null); setForm(emptyForm); };
  const startEdit = (venue: any) => {
    setEditing(venue);
    setForm({
      name: String(venue.name || ""), contact_name: String(venue.contact_name || ""), phone: String(venue.phone || ""),
      address: String(venue.address || ""), latitude: venue.latitude == null ? "" : String(venue.latitude),
      longitude: venue.longitude == null ? "" : String(venue.longitude), notes: String(venue.notes || ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        latitude: form.latitude.trim() ? Number(form.latitude) : null,
        longitude: form.longitude.trim() ? Number(form.longitude) : null,
      };
      const res = await fetch(editing ? `/api/ordering/commercial/admin/venues/${editing.id}` : "/api/ordering/commercial/admin/venues", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Unable to save venue");
      setEditing(null);
      setForm(emptyForm);
      await load();
      if (!editing && json.data?.id) await showQr(json.data);
    } catch (error: any) {
      window.alert(error?.message || "Unable to save venue");
    } finally {
      setSaving(false);
    }
  };

  const showQr = async (venue: any) => {
    const res = await fetch(`/api/ordering/commercial/admin/venues/${venue.id}/qr`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.ok) return window.alert(json.error || "Unable to load QR code");
    setQr(json.data);
  };

  const showReport = async (venue: any) => {
    const res = await fetch(`/api/ordering/commercial/admin/venues/${venue.id}/report`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.ok) return window.alert(json.error || "Unable to load venue report");
    setReport(json.data);
  };

  const toggleVenue = async (venue: any) => {
    const res = await fetch(`/api/ordering/commercial/admin/venues/${venue.id}`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !venue.is_active }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) return window.alert(json.error || "Unable to update venue");
    await load();
  };

  const downloadQr = () => {
    if (!qr?.qr_data_url) return;
    const a = document.createElement("a");
    a.href = qr.qr_data_url;
    a.download = `${String(qr.name || "partner-venue").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const printQr = () => {
    if (!qr?.qr_data_url) return;
    const win = window.open("", "_blank", "width=700,height=850");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${qr.name} QR</title><style>body{font-family:Arial;text-align:center;padding:40px}img{width:420px;height:420px}.url{font-size:12px;word-break:break-all;margin-top:16px}</style></head><body><h1>${qr.name}</h1><p>Scan to order from Smash Brothers Burgers</p><img src="${qr.qr_data_url}"/><div class="url">${qr.order_url}</div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Online Ordering</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-950">Partner Venues</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">Create permanent partner QR codes, lock delivery to the venue address and track scans, orders and attributed sales.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["QR scans", totals.scans], ["Attributed orders", totals.orders], ["Attributed sales", money(totals.sales)]].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-2 text-3xl font-bold text-neutral-950">{value}</div></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <form onSubmit={saveVenue} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-neutral-950">{editing ? "Edit Partner Venue" : "Add Partner Venue"}</h2><p className="mt-1 text-sm text-neutral-500">The saved address becomes the locked delivery destination when this QR is scanned.</p></div>{editing && <button type="button" onClick={startCreate} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold">Cancel</button>}</div>
          <div className="mt-5 space-y-3">
            {venueFields.map(([label, key, required, placeholder]) => <label key={key} className="block text-sm font-medium text-neutral-700">{label}<input required={required} inputMode={key === "latitude" || key === "longitude" ? "decimal" : undefined} placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-950" /></label>)}
            <div className="rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">Latitude/longitude are optional for now, but entering them makes the venue ready for the delivery-map phase without changing the QR later.</div>
            <label className="block text-sm font-medium text-neutral-700">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-950" /></label>
          </div>
          <button disabled={saving} className="mt-4 w-full rounded-xl bg-[#FFD400] px-4 py-3 font-bold text-black disabled:opacity-60">{saving ? "Saving…" : editing ? "Save Venue" : "Create Venue + QR"}</button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-5 py-4"><h2 className="font-bold text-neutral-950">Venue Performance</h2><p className="mt-1 text-xs text-neutral-500">Permanent QR attribution · 12-hour attribution window</p></div>
          {loading ? <div className="p-8 text-sm text-neutral-500">Loading venues…</div> : venues.length === 0 ? <div className="p-8 text-sm text-neutral-500">No partner venues yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-5 py-3">Venue</th><th className="px-4 py-3">Scans</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Sales</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-neutral-100">{venues.map((venue) => <tr key={venue.id}><td className="px-5 py-4"><div className="font-semibold text-neutral-950">{venue.name}</div><div className="mt-1 text-xs text-neutral-500">{venue.address}</div>{venue.latitude && venue.longitude && <div className="mt-1 text-[11px] text-neutral-400">{venue.latitude}, {venue.longitude}</div>}</td><td className="px-4 py-4 font-semibold">{Number(venue.qr_scans || 0)}</td><td className="px-4 py-4 font-semibold">{Number(venue.orders || 0)}</td><td className="px-4 py-4 font-semibold">{money(venue.sales)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${venue.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>{venue.is_active ? "Active" : "Inactive"}</span></td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => showQr(venue)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">QR</button><button onClick={() => showReport(venue)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">Report</button><button onClick={() => startEdit(venue)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">Edit</button><button onClick={() => toggleVenue(venue)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">{venue.is_active ? "Disable" : "Enable"}</button></div></td></tr>)}</tbody></table></div>}
        </div>
      </div>

      {qr && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setQr(null)}><div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Partner Venue QR</div><h3 className="mt-1 text-2xl font-bold text-neutral-950">{qr.name}</h3><img src={qr.qr_data_url} alt={`${qr.name} ordering QR`} className="mx-auto mt-5 h-72 w-72 rounded-2xl border border-neutral-200" /><div className="mt-4 break-all rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">{qr.order_url}</div><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => navigator.clipboard?.writeText(qr.order_url)} className="rounded-xl border border-neutral-300 px-4 py-3 font-semibold">Copy Link</button><button onClick={downloadQr} className="rounded-xl border border-neutral-300 px-4 py-3 font-semibold">Download PNG</button><button onClick={printQr} className="rounded-xl border border-neutral-300 px-4 py-3 font-semibold">Print QR</button><button onClick={() => setQr(null)} className="rounded-xl bg-neutral-950 px-4 py-3 font-semibold text-white">Done</button></div></div></div>}

      {report && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setReport(null)}><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Partner performance</div><h3 className="mt-1 text-2xl font-bold text-neutral-950">{report.name}</h3><p className="mt-1 text-sm text-neutral-500">{report.address}</p></div><button onClick={() => setReport(null)} className="h-9 w-9 rounded-full bg-neutral-100 text-xl">×</button></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["QR scans", report.qr_scans], ["Orders", report.orders], ["Sales", money(report.sales)], ["Average order", money(report.average_order_value)], ["Members", report.members], ["Last order", report.last_order_at ? new Date(report.last_order_at).toLocaleDateString() : "—"]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-neutral-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-2 text-lg font-bold text-neutral-950">{value}</div></div>)}</div></div></div>}
    </div>
  );
}
