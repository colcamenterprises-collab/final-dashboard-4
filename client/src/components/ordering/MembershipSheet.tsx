import { useState } from "react";
import { createOrFindMembership, lookupMembership } from "./orderingApi";

type MemberIdentity = { id: string; member_number: string; name: string; phone_display: string; qr_code_id?: string; qr_token?: string; qr_data_url?: string; order_count?: number; lifetime_spend?: number };

export default function MembershipSheet({ member, onMember, onClose }: { member: MemberIdentity | null; onMember: (member: MemberIdentity) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"join" | "lookup">(member ? "lookup" : "join");
  const [name, setName] = useState(member?.name || "");
  const [phone, setPhone] = useState(member?.phone_display || "");
  const [current, setCurrent] = useState<MemberIdentity | null>(member);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError(""); setLoading(true);
    try {
      const payload = mode === "join" ? await createOrFindMembership(name.trim(), phone.trim()) : await lookupMembership(phone.trim());
      const identity = payload.data as MemberIdentity;
      setCurrent(identity); onMember(identity);
      try { localStorage.setItem("sbb_member_identity", JSON.stringify(identity)); } catch {}
    } catch (err: any) { setError(err?.message || "Unable to find membership."); }
    finally { setLoading(false); }
  }

  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
    <section className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Smash Club</p><h2 className="mt-1 text-2xl font-bold text-neutral-950">{current ? "Your Membership" : "Join in seconds"}</h2></div><button onClick={onClose} className="h-9 w-9 rounded-full bg-neutral-100 text-xl text-neutral-600">×</button></div>

      {current ? <div className="mt-5">
        <div className="rounded-3xl bg-neutral-950 p-5 text-white"><div className="text-xs uppercase tracking-[0.18em] text-neutral-400">Smash Brothers Member</div><div className="mt-4 text-2xl font-bold">{current.name}</div><div className="mt-1 font-mono text-[#FFD400]">{current.member_number}</div>{current.qr_data_url && <img src={current.qr_data_url} alt="Membership QR" className="mx-auto mt-5 h-52 w-52 rounded-2xl bg-white p-2" />}</div>
        <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-neutral-50 p-3"><div className="text-xs text-neutral-500">Orders</div><div className="mt-1 text-xl font-bold">{Number(current.order_count || 0)}</div></div><div className="rounded-xl bg-neutral-50 p-3"><div className="text-xs text-neutral-500">Lifetime spend</div><div className="mt-1 text-xl font-bold">฿{Number(current.lifetime_spend || 0).toLocaleString()}</div></div></div>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-[#FFD400] px-4 py-3 font-bold text-black">Continue Ordering</button>
      </div> : <>
        <div className="mt-5 grid grid-cols-2 rounded-xl bg-neutral-100 p-1"><button onClick={() => setMode("join")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "join" ? "bg-white shadow-sm" : "text-neutral-500"}`}>Join</button><button onClick={() => setMode("lookup")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "lookup" ? "bg-white shadow-sm" : "text-neutral-500"}`}>Already a member</button></div>
        <div className="mt-4 space-y-3">{mode === "join" && <label className="block text-sm font-medium text-neutral-700">Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 outline-none focus:border-neutral-950" /></label>}<label className="block text-sm font-medium text-neutral-700">Mobile number<input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-3 outline-none focus:border-neutral-950" /></label></div>
        <p className="mt-3 text-xs leading-5 text-neutral-500">That’s it. No birthday, email or long form required.</p>
        {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
        <button disabled={loading || !phone.trim() || (mode === "join" && !name.trim())} onClick={submit} className="mt-4 w-full rounded-xl bg-[#FFD400] px-4 py-3 font-bold text-black disabled:opacity-50">{loading ? "Please wait…" : mode === "join" ? "Join Smash Club" : "Find My Membership"}</button>
      </>}
    </section>
  </div>;
}
