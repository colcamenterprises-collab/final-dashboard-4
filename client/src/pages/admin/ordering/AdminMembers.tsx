import { useEffect, useMemo, useState } from "react";

const money = (value: unknown) => `฿${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

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
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ordering/commercial/admin/members", { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Unable to load members");
      setMembers(json.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => members.reduce((acc, m) => {
    acc.orders += Number(m.order_count || 0);
    acc.sales += Number(m.lifetime_spend || 0);
    return acc;
  }, { orders: 0, sales: 0 }), [members]);

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
        <h1 className="mt-1 text-3xl font-bold text-neutral-950">Memberships</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">Restaurant-owned membership records using only name and mobile number. Purchasing history is attached automatically as members order.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Members</div><div className="mt-2 text-3xl font-bold text-neutral-950">{members.length}</div></div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Member Orders</div><div className="mt-2 text-3xl font-bold text-neutral-950">{totals.orders}</div></div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Member Sales</div><div className="mt-2 text-3xl font-bold text-neutral-950">{money(totals.sales)}</div></div>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-neutral-950">Import Existing Members</h2><p className="mt-1 text-sm text-neutral-500">CSV needs only two columns: name and mobile. Duplicate mobile numbers are matched to the existing member.</p></div>
          <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#FFD400] px-4 py-3 text-sm font-bold text-black ${importing ? "pointer-events-none opacity-60" : ""}`}>{importing ? "Importing…" : "Import CSV"}<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importCsv(file); e.currentTarget.value = ""; }} /></label>
        </div>
        {importMessage && <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm font-medium text-neutral-700">{importMessage}</div>}
      </section>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-neutral-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-neutral-950">Member Database</h2><p className="mt-1 text-xs text-neutral-500">Designed for quick cashier signup and future incentives.</p></div>
          <div className="rounded-full bg-[#FFD400] px-3 py-1.5 text-xs font-bold text-black">Name + Mobile Only</div>
        </div>
        {loading ? <div className="p-8 text-sm text-neutral-500">Loading members…</div> : members.length === 0 ? <div className="p-8 text-sm text-neutral-500">No members yet. New signups from the ordering portal will appear here automatically.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-5 py-3">Member</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Lifetime Spend</th><th className="px-4 py-3">Last Order</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {members.map((member) => <tr key={member.id}>
                  <td className="px-5 py-4"><div className="font-semibold text-neutral-950">{member.name}</div><div className="mt-1 text-xs font-mono text-neutral-500">{member.member_number}</div></td>
                  <td className="px-4 py-4">{member.phone_display}</td>
                  <td className="px-4 py-4">{member.created_at ? new Date(member.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-4 font-semibold">{Number(member.order_count || 0)}</td>
                  <td className="px-4 py-4 font-semibold">{money(member.lifetime_spend)}</td>
                  <td className="px-4 py-4">{member.last_order_at ? new Date(member.last_order_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.status === "active" ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>{member.status}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
