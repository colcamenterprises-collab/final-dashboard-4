import { useEffect, useMemo, useState } from "react";

const money = (value: unknown) => `฿${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString() : "—";
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString() : "—";
type ImportRow = { name: string; phone: string };

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const header = rows[0].map((cell) => cell.toLowerCase());
  const nameIndex = header.findIndex((cell) => ["name", "customer", "member", "full name", "fullname"].includes(cell));
  const phoneIndex = header.findIndex((cell) => ["phone", "mobile", "mobile number", "phone number", "telephone"].includes(cell));
  const hasHeader = nameIndex >= 0 || phoneIndex >= 0;
  const n = nameIndex >= 0 ? nameIndex : 0;
  const p = phoneIndex >= 0 ? phoneIndex : 1;
  return rows.slice(hasHeader ? 1 : 0).map((row) => ({ name: String(row[n] || "").trim(), phone: String(row[p] || "").trim() })).filter((row) => row.name && row.phone);
}

export default function AdminMembers() {
  const [members, setMembers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({});
  const [tab, setTab] = useState<"members" | "customers">("members");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [profile, setProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [membersRes, customersRes, overviewRes] = await Promise.all([
        fetch("/api/ordering/commercial/admin/members", { credentials: "include" }),
        fetch("/api/ordering/commercial/admin/customers", { credentials: "include" }),
        fetch("/api/ordering/commercial/admin/overview", { credentials: "include" }),
      ]);
      const [membersJson, customersJson, overviewJson] = await Promise.all([membersRes.json(), customersRes.json(), overviewRes.json()]);
      if (!membersRes.ok || !membersJson.ok) throw new Error(membersJson.error || "Unable to load members");
      if (!customersRes.ok || !customersJson.ok) throw new Error(customersJson.error || "Unable to load customers");
      setMembers(membersJson.data || []);
      setCustomers(customersJson.data || []);
      setOverview(overviewJson?.data || {});
    } catch (error: any) {
      window.alert(error?.message || "Unable to load customer data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const memberTotals = useMemo(() => members.reduce((acc, m) => {
    acc.orders += Number(m.order_count || 0);
    acc.sales += Number(m.lifetime_spend || 0);
    return acc;
  }, { orders: 0, sales: 0 }), [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? members.filter((m) => `${m.name} ${m.phone_display} ${m.member_number}`.toLowerCase().includes(q)) : members;
  }, [members, search]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? customers.filter((c) => `${c.name || ""} ${c.phone_display || ""} ${c.member_number || ""}`.toLowerCase().includes(q)) : customers;
  }, [customers, search]);

  async function showMember(memberId: string) {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/ordering/commercial/admin/members/${memberId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Unable to load member profile");
      setProfile(json.data);
    } catch (error: any) {
      window.alert(error?.message || "Unable to load member profile");
    } finally {
      setProfileLoading(false);
    }
  }

  async function importCsv(file: File) {
    setImporting(true); setImportMessage("");
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("No valid name + mobile rows found in the CSV.");
      let ok = 0; let failed = 0;
      for (const row of rows) {
        try {
          const res = await fetch("/api/ordering/commercial/members", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
          if (!res.ok) throw new Error("Import failed");
          ok += 1;
        } catch { failed += 1; }
      }
      setImportMessage(`Import complete: ${ok} member${ok === 1 ? "" : "s"} processed${failed ? `, ${failed} failed` : ""}. Existing mobile numbers were matched rather than duplicated.`);
      await load();
    } catch (error: any) { setImportMessage(error?.message || "Unable to import CSV."); }
    finally { setImporting(false); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Online Ordering</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-950">Members & Customers</h1>
        <p className="mt-2 max-w-4xl text-sm text-neutral-600">One customer intelligence view built from canonical SBB orders. Members retain their permanent identity while non-member online customers remain visible by mobile number instead of becoming lost order data.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Members", members.length],
          ["Known Customers", customers.length],
          ["Member Orders", memberTotals.orders],
          ["Member Sales", money(memberTotals.sales)],
          ["Partner Sales", money(overview.attributed_sales)],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div></div>)}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-bold text-neutral-950">Import Existing Members</h2><p className="mt-1 text-sm text-neutral-500">CSV needs only name and mobile. Existing mobile numbers are matched, never duplicated.</p></div>
          <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#FFD400] px-4 py-3 text-sm font-bold text-black ${importing ? "pointer-events-none opacity-60" : ""}`}>{importing ? "Importing…" : "Import CSV"}<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importCsv(file); e.currentTarget.value = ""; }} /></label>
        </div>
        {importMessage && <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm font-medium text-neutral-700">{importMessage}</div>}
      </section>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded-xl bg-neutral-100 p-1">
            <button onClick={() => setTab("members")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "members" ? "bg-white shadow-sm" : "text-neutral-500"}`}>Members</button>
            <button onClick={() => setTab("customers")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "customers" ? "bg-white shadow-sm" : "text-neutral-500"}`}>All Customers</button>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile or member number" className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-950 lg:max-w-sm" />
        </div>

        {loading ? <div className="p-8 text-sm text-neutral-500">Loading customer intelligence…</div> : tab === "members" ? (
          filteredMembers.length === 0 ? <div className="p-8 text-sm text-neutral-500">No members found.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-5 py-3">Member</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Lifetime Spend</th><th className="px-4 py-3">Last Order</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-neutral-100">{filteredMembers.map((member) => <tr key={member.id}><td className="px-5 py-4"><div className="font-semibold text-neutral-950">{member.name}</div><div className="mt-1 font-mono text-xs text-neutral-500">{member.member_number}</div></td><td className="px-4 py-4">{member.phone_display}</td><td className="px-4 py-4">{date(member.created_at)}</td><td className="px-4 py-4 font-semibold">{Number(member.order_count || 0)}</td><td className="px-4 py-4 font-semibold">{money(member.lifetime_spend)}</td><td className="px-4 py-4">{date(member.last_order_at)}</td><td className="px-4 py-4 text-right"><button disabled={profileLoading} onClick={() => showMember(member.id)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold hover:bg-neutral-50">View Profile</button></td></tr>)}</tbody></table></div>
        ) : (
          filteredCustomers.length === 0 ? <div className="p-8 text-sm text-neutral-500">No identifiable customer orders yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-5 py-3">Customer</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Lifetime Spend</th><th className="px-4 py-3">Avg Order</th><th className="px-4 py-3">First Order</th><th className="px-4 py-3">Last Order</th><th className="px-4 py-3">Online</th></tr></thead><tbody className="divide-y divide-neutral-100">{filteredCustomers.map((customer) => <tr key={customer.phone_normalized}><td className="px-5 py-4"><div className="font-semibold text-neutral-950">{customer.name || "Customer"}</div><div className="mt-1 text-xs text-neutral-500">{customer.phone_display}</div></td><td className="px-4 py-4">{customer.is_member ? <button onClick={() => customer.member_id && showMember(customer.member_id)} className="rounded-full bg-[#FFD400] px-2.5 py-1 text-xs font-bold text-black">{customer.member_number || "Member"}</button> : <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">Non-member</span>}</td><td className="px-4 py-4 font-semibold">{Number(customer.order_count || 0)}</td><td className="px-4 py-4 font-semibold">{money(customer.lifetime_spend)}</td><td className="px-4 py-4">{money(customer.average_order_value)}</td><td className="px-4 py-4">{date(customer.first_order_at)}</td><td className="px-4 py-4">{date(customer.last_order_at)}</td><td className="px-4 py-4">{Number(customer.online_orders || 0)}</td></tr>)}</tbody></table></div>
        )}
      </div>

      {profile && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onClick={() => setProfile(null)}><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Member profile</div><h3 className="mt-1 text-2xl font-bold text-neutral-950">{profile.name}</h3><div className="mt-1 text-sm text-neutral-500">{profile.member_number} · {profile.phone_display}</div></div><button onClick={() => setProfile(null)} className="h-9 w-9 rounded-full bg-neutral-100 text-xl">×</button></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">{[["Orders", profile.order_count], ["Lifetime Spend", money(profile.lifetime_spend)], ["Average Order", money(profile.average_order_value)], ["Online Orders", profile.online_orders], ["Partner Orders", profile.partner_orders]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-neutral-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-2 text-lg font-bold text-neutral-950">{value}</div></div>)}</div><div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200"><div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 font-bold">Order History</div>{!profile.orders?.length ? <div className="p-5 text-sm text-neutral-500">No orders attached to this member yet.</div> : <div className="divide-y divide-neutral-100">{profile.orders.map((order: any) => <div key={order.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold text-neutral-950">#{order.ticket_number || order.order_number} · {money(order.total)}</div><div className="mt-1 text-xs text-neutral-500">{dateTime(order.created_at)} · {String(order.origin_channel || "").toUpperCase()} · {order.dining_type || "order"}{order.partner_venue_name ? ` · ${order.partner_venue_name}` : ""}</div></div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold">{order.status}</span></div><div className="mt-2 text-sm text-neutral-700">{(order.items || []).map((item: any) => `${item.quantity}× ${item.name}`).join(" · ") || "No item detail"}</div></div>)}</div>}</div></div></div>}
    </div>
  );
}
