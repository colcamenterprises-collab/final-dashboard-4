import { useEffect, useMemo, useState } from "react";

const money = (value: unknown) => `฿${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function AdminMembers() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
