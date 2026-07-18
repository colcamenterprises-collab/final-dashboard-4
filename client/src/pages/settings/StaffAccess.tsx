import { useEffect, useState, type FormEvent, type HTMLAttributes } from "react";
import { Navigate } from "react-router-dom";
import { usePinAuth } from "@/components/PinLoginGate";

type StaffUser = {
  id: number; name: string; username: string | null; role: string; active: boolean;
  email: string | null; contactNumber: string | null;
};

const ROLES = [
  ["owner", "Owner"],
  ["manager", "Manager"],
  ["staff", "Staff"],
  ["cashier", "Cashier"],
  ["kitchen_staff", "Kitchen"],
] as const;

const emptyForm = { name: "", username: "", role: "staff", pin: "", email: "", contactNumber: "" };

export default function StaffAccess() {
  const { currentUser } = usePinAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pin-auth/staff", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load staff access");
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff access");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (currentUser?.role === "owner") void load(); }, [currentUser?.role]);

  if (currentUser?.role !== "owner") return <Navigate to="/dashboard" replace />;

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setMessage(""); setError("");
    if (!/^\d{4}$/.test(form.pin)) { setError("PIN must be exactly four digits."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/pin-auth/staff", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create staff member");
      setForm(emptyForm); setMessage(`Created ${data.user.name}.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create staff member"); }
    finally { setSaving(false); }
  }

  async function saveUser(user: StaffUser, changes: Partial<StaffUser>) {
    setMessage(""); setError("");
    try {
      const response = await fetch(`/api/pin-auth/staff/${user.id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update staff member");
      setMessage(`Updated ${data.user.name}.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update staff member"); }
  }

  async function resetPin(user: StaffUser) {
    const pin = window.prompt(`Enter a new four-digit PIN for ${user.name}.`);
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly four digits."); return; }
    setMessage(""); setError("");
    try {
      const response = await fetch(`/api/pin-auth/staff/${user.id}/pin`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset PIN");
      setMessage(`PIN reset for ${user.name}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not reset PIN"); }
  }

  return <section className="mx-auto max-w-6xl space-y-6">
    <div>
      <p className="text-sm font-semibold text-emerald-700">Owner controls</p>
      <h1 className="text-2xl font-bold text-slate-900">Staff & Access</h1>
      <p className="mt-1 text-sm text-slate-600">Create staff sign-ins, set roles, reset PINs, or disable access. PINs are never displayed or stored in the browser.</p>
    </div>

    {(message || error) && <div className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}

    <form onSubmit={createUser} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Add staff member</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" value={form.name} onChange={(v) => updateForm("name", v)} required />
        <Field label="Username" value={form.username} onChange={(v) => updateForm("username", v)} hint="Optional; one is generated if blank" />
        <label className="text-sm font-medium text-slate-700">Role<select value={form.role} onChange={(e) => updateForm("role", e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3">{ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <Field label="Four-digit PIN" value={form.pin} onChange={(v) => updateForm("pin", v.replace(/\D/g, "").slice(0, 4))} type="password" inputMode="numeric" required />
        <Field label="Email" value={form.email} onChange={(v) => updateForm("email", v)} type="email" />
        <Field label="Contact number" value={form.contactNumber} onChange={(v) => updateForm("contactNumber", v)} />
      </div>
      <button disabled={saving} className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Creating…" : "Create staff sign-in"}</button>
    </form>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Current accounts</h2></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Loading staff accounts…</p> : <div className="divide-y divide-slate-100">
        {users.map((user) => <div key={user.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="font-medium text-slate-900">{user.name} {!user.active && <span className="ml-2 text-xs font-semibold text-red-600">Disabled</span>}</p><p className="text-sm text-slate-500">{user.username || "No username"}{user.email ? ` · ${user.email}` : ""}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={user.role} onChange={(e) => void saveUser(user, { role: e.target.value })} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">{ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <button onClick={() => void resetPin(user)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">Reset PIN</button>
            <button onClick={() => void saveUser(user, { active: !user.active })} className={`rounded-md px-3 py-2 text-sm font-medium ${user.active ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{user.active ? "Disable" : "Enable"}</button>
          </div>
        </div>)}
      </div>}
    </div>
  </section>;
}

function Field({ label, value, onChange, required, hint, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; hint?: string; type?: string; inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return <label className="text-sm font-medium text-slate-700">{label}<input value={value} onChange={(e) => onChange(e.target.value)} required={required} type={type} inputMode={inputMode} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 font-normal" />{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>;
}
