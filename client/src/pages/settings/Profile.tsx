import { useEffect, useState } from "react";
import { KeyRound, Save, UserRound } from "lucide-react";
import StaffAvatarUpload from "@/components/staff/StaffAvatarUpload";

type ProfileData = {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  contactNumber: string | null;
  role: string;
  avatarUrl: string | null;
  createdAt?: string | null;
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", contactNumber: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/pin-auth/me/profile");
      setProfile(data.user);
      setForm({
        name: data.user.name || "",
        username: data.user.username || "",
        email: data.user.email || "",
        contactNumber: data.user.contactNumber || "",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveProfile = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const data = await api("/api/pin-auth/me/profile", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setProfile((prev) => prev ? { ...prev, ...data.user } : data.user);
      setMessage("Profile updated. Name changes appear everywhere after your next sign in.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update profile");
    } finally { setSaving(false); }
  };

  const saveAvatar = async (avatarUrl: string | null) => {
    const data = await api("/api/pin-auth/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ avatarUrl }),
    });
    setProfile((prev) => prev ? { ...prev, avatarUrl: data.user.avatarUrl ?? null } : prev);
    setMessage(avatarUrl ? "Profile photo updated" : "Profile photo removed");
  };

  const changePin = async () => {
    setMessage(""); setError("");
    try {
      await api("/api/pin-auth/me/pin", {
        method: "PATCH",
        body: JSON.stringify({ currentPin, newPin }),
      });
      setCurrentPin(""); setNewPin("");
      setMessage("Password / PIN updated");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update password / PIN");
    }
  };

  if (loading) return <div className="mx-auto max-w-4xl p-6 text-sm text-slate-500">Loading profile…</div>;
  if (!profile) return <div className="mx-auto max-w-4xl p-6 text-red-600">{error || "Profile unavailable"}</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-2 md:p-6">
      <div>
        <div className="flex items-center gap-3"><UserRound className="h-7 w-7" /><h1 className="text-3xl font-black">My Profile</h1></div>
        <p className="mt-1 text-sm text-slate-500">Manage your own dashboard account details, profile photo and password / PIN.</p>
      </div>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || message}</div>}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <StaffAvatarUpload name={profile.name} avatarUrl={profile.avatarUrl} onChange={saveAvatar} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Name</span><input className="w-full rounded-xl border p-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</span><input className="w-full rounded-xl border p-3" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span><input type="email" className="w-full rounded-xl border p-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact number</span><input className="w-full rounded-xl border p-3" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{profile.role.replaceAll("_", " ")}</span><button disabled={saving || !form.name.trim()} onClick={() => void saveProfile()} className="flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save profile"}</button></div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><KeyRound className="h-5 w-5" /><h2 className="text-lg font-black">Change password / PIN</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="password" autoComplete="current-password" className="rounded-xl border p-3" placeholder="Current password / PIN" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
          <input type="password" autoComplete="new-password" className="rounded-xl border p-3" placeholder="New password / PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end"><button disabled={currentPin.length < 4 || newPin.length < 4} onClick={() => void changePin()} className="rounded-xl border border-black px-4 py-3 text-sm font-bold disabled:opacity-40">Update password / PIN</button></div>
      </section>
    </div>
  );
}
