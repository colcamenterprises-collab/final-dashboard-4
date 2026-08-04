import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ChevronDown, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import StaffAvatarUpload from "@/components/staff/StaffAvatarUpload";

type PermissionMap = Record<string, boolean | undefined>;
type User = {
  id: number;
  name: string;
  username: string | null;
  role: string;
  email: string | null;
  contactNumber: string | null;
  active: boolean;
  permissions?: PermissionMap | null;
  avatarUrl?: string | null;
};
type Form = { name: string; username: string; role: string; password: string; email: string; contactNumber: string; permissions: PermissionMap };
type PermissionDefinition = { key: string; label: string; description: string; group: string };

const PERMISSIONS: PermissionDefinition[] = [
  { key: "dashboard.view", label: "Dashboard", description: "View the main business dashboard.", group: "General" },
  { key: "operations.view", label: "Operations", description: "Open operational tools and daily workflows.", group: "General" },
  { key: "forms.daily_sales", label: "Daily Sales", description: "Complete the end-of-shift sales form.", group: "End of Shift" },
  { key: "forms.daily_cleaning", label: "Daily Cleaning", description: "Complete the daily cleaning workflow.", group: "End of Shift" },
  { key: "forms.daily_stock", label: "Daily Stock", description: "Complete the end-of-shift stock form.", group: "End of Shift" },
  { key: "purchasing.view", label: "Purchasing", description: "View purchasing, requisitions and stock received.", group: "Operations" },
  { key: "analysis.view", label: "Reporting & Analysis", description: "View reports, analysis and performance data.", group: "Reporting" },
  { key: "finance.view", label: "Finance", description: "View financial reporting and reconciliation areas.", group: "Finance" },
  { key: "expenses.view", label: "Expenses", description: "View and manage expense records.", group: "Finance" },
  { key: "menu.view", label: "Menu & Recipes", description: "Access menu items, recipes, categories and modifiers.", group: "Menu" },
  { key: "pos.view", label: "POS & Displays", description: "Access POS, kitchen display and customer ticket display.", group: "POS & Orders" },
  { key: "online_ordering_admin.view", label: "Online Orders", description: "Manage direct ordering and order channels.", group: "POS & Orders" },
  { key: "membership.view", label: "Customers & Membership", description: "Access customer and membership areas.", group: "Customers" },
  { key: "website_admin.view", label: "Website Administration", description: "Manage website administration features.", group: "Administration" },
  { key: "settings.view", label: "Settings", description: "Access general application settings.", group: "Administration" },
  { key: "staff_access.manage", label: "Manage Staff Access", description: "Create users and change staff permissions. Recommended for owners only.", group: "Administration" },
];

const ALL_ACCESS = Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, true])) as PermissionMap;
const NO_ACCESS = Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, false])) as PermissionMap;
const PRESETS: Array<{ label: string; permissions: PermissionMap }> = [
  { label: "Full access", permissions: ALL_ACCESS },
  { label: "Manager", permissions: { ...ALL_ACCESS, "staff_access.manage": false, "website_admin.view": false } },
  { label: "Front of house", permissions: { ...NO_ACCESS, "dashboard.view": true, "operations.view": true, "forms.daily_sales": true, "forms.daily_cleaning": true, "forms.daily_stock": true, "pos.view": true, "online_ordering_admin.view": true } },
  { label: "Kitchen", permissions: { ...NO_ACCESS, "operations.view": true, "forms.daily_cleaning": true, "forms.daily_stock": true, "pos.view": true } },
  { label: "No access", permissions: NO_ACCESS },
];

const empty: Form = { name: "", username: "", role: "staff", password: "", email: "", contactNumber: "", permissions: {} };

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function PermissionEditor({ value, onChange, disabled = false }: { value: PermissionMap; onChange: (permissions: PermissionMap) => void; disabled?: boolean }) {
  const groups = [...new Set(PERMISSIONS.map((permission) => permission.group))];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" disabled={disabled} onClick={() => onChange({ ...preset.permissions })} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{preset.label}</button>
        ))}
      </div>
      {groups.map((group) => (
        <section key={group}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">{group}</h3>
            <button type="button" disabled={disabled} className="text-xs font-semibold text-slate-500 hover:text-black disabled:opacity-40" onClick={() => {
              const keys = PERMISSIONS.filter((permission) => permission.group === group).map((permission) => permission.key);
              const allEnabled = keys.every((key) => value[key] === true);
              const next = { ...value };
              keys.forEach((key) => { next[key] = !allEnabled; });
              onChange(next);
            }}>Toggle group</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {PERMISSIONS.filter((permission) => permission.group === group).map((permission) => {
              const checked = value[permission.key] === true;
              return (
                <label key={permission.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-black bg-slate-50" : "bg-white hover:bg-slate-50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
                  <input type="checkbox" disabled={disabled} className="mt-1 h-4 w-4" checked={checked} onChange={(event) => onChange({ ...value, [permission.key]: event.target.checked })} />
                  <span><span className="block text-sm font-bold text-slate-900">{permission.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{permission.description}</span></span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function StaffAccess() {
  const [form, setForm] = useState<Form>(empty);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("staff");
  const [editPermissions, setEditPermissions] = useState<PermissionMap>({});
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [deleteFor, setDeleteFor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showCreatePermissions, setShowCreatePermissions] = useState(false);

  const usersQuery = useQuery<{ users: User[] }>({ queryKey: ["pin-auth-staff"], queryFn: () => api("/api/pin-auth/staff") });
  const users = usersQuery.data?.users || [];
  const owners = useMemo(() => users.filter((user) => user.role === "owner" && user.active), [users]);

  const create = useMutation({
    mutationFn: () => api("/api/pin-auth/staff", { method: "POST", body: JSON.stringify({ ...form, pin: form.password, permissions: form.role === "owner" ? {} : form.permissions }) }),
    onSuccess: (data) => { setForm(empty); setShowCreate(false); setShowCreatePermissions(false); setMessage(`Access created for ${data.user.username}. Open Access to add their photo.`); queryClient.invalidateQueries({ queryKey: ["pin-auth-staff"] }); },
    onError: (error: Error) => setMessage(error.message),
  });

  const updateAccess = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No user selected");
      return api(`/api/pin-auth/staff/${editing.id}`, { method: "PUT", body: JSON.stringify({ role: editRole, permissions: editRole === "owner" ? {} : editPermissions }) });
    },
    onSuccess: () => { setMessage("Role and permissions updated. The user must sign out and back in for changes to take effect."); setEditing(null); queryClient.invalidateQueries({ queryKey: ["pin-auth-staff"] }); },
    onError: (error: Error) => setMessage(error.message),
  });

  const toggle = useMutation({
    mutationFn: (user: User) => api(`/api/pin-auth/staff/${user.id}`, { method: "PUT", body: JSON.stringify({ active: !user.active }) }),
    onSuccess: () => { setMessage("Access updated"); queryClient.invalidateQueries({ queryKey: ["pin-auth-staff"] }); },
    onError: (error: Error) => setMessage(error.message),
  });

  const reset = useMutation({
    mutationFn: () => api(`/api/pin-auth/staff/${resetFor!.id}/pin`, { method: "PATCH", body: JSON.stringify({ pin: newPassword }) }),
    onSuccess: () => { setMessage("Password / PIN reset"); setResetFor(null); setNewPassword(""); },
    onError: (error: Error) => setMessage(error.message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/pin-auth/staff/${deleteFor!.id}`, { method: "DELETE" }),
    onSuccess: () => { setMessage("Staff login permanently deleted"); setDeleteFor(null); queryClient.invalidateQueries({ queryKey: ["pin-auth-staff"] }); },
    onError: (error: Error) => setMessage(error.message),
  });

  const openEditor = (user: User) => { setEditing(user); setEditRole(user.role); setEditPermissions({ ...(user.permissions || {}) }); setMessage(""); };

  const saveAvatar = async (avatarUrl: string | null) => {
    if (!editing) return;
    await api(`/api/pin-auth/staff/${editing.id}`, { method: "PUT", body: JSON.stringify({ avatarUrl }) });
    setEditing({ ...editing, avatarUrl });
    await queryClient.invalidateQueries({ queryKey: ["pin-auth-staff"] });
    setMessage(avatarUrl ? "User photo updated" : "User photo removed");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-2 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7" /><h1 className="text-3xl font-black">Staff Access & Permissions</h1></div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Create owner and staff accounts, upload user photos, assign a role, and control exactly which sections of the restaurant system each person can access.</p>
        </div>
        <button onClick={() => setShowCreate((value) => !value)} className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add user</button>
      </div>

      {message && <div className="rounded-xl border bg-white px-4 py-3 text-sm">{message}<button className="float-right text-slate-400" onClick={() => setMessage("")}>×</button></div>}
      {owners.length === 0 && <div className="rounded-xl border border-red-300 bg-red-50 p-4 font-bold text-red-800">No active owner account is visible. Do not deactivate the final owner.</div>}

      {showCreate && (
        <div className="space-y-5 rounded-2xl border bg-white p-5">
          <div><h2 className="text-lg font-black">Create user access</h2><p className="text-sm text-slate-500">Owners receive full access automatically. Other roles can be customised below.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border p-3" placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="rounded-lg border p-3" placeholder="Username (optional; generated if blank)" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            <select className="rounded-lg border p-3" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="staff">Staff</option><option value="cashier">Cashier</option><option value="kitchen_staff">Kitchen staff</option><option value="manager">Manager</option><option value="owner">Owner</option>
            </select>
            <input type="password" autoComplete="new-password" className="rounded-lg border p-3" placeholder="Password / PIN (4–72 characters)" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <input type="email" className="rounded-lg border p-3" placeholder="Email (optional)" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <input className="rounded-lg border p-3" placeholder="Contact number (optional)" value={form.contactNumber} onChange={(event) => setForm({ ...form, contactNumber: event.target.value })} />
          </div>
          {form.role !== "owner" && (
            <div className="rounded-xl border">
              <button type="button" onClick={() => setShowCreatePermissions((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <span><span className="block font-black">Custom access permissions</span><span className="text-xs text-slate-500">Tick the exact areas this person can use.</span></span>
                <ChevronDown className={`h-5 w-5 transition ${showCreatePermissions ? "rotate-180" : ""}`} />
              </button>
              {showCreatePermissions && <div className="border-t p-4"><PermissionEditor value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} /></div>}
            </div>
          )}
          {form.role === "owner" && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Check className="mt-0.5 h-5 w-5" /><div><div className="font-black">Owner = full system access</div><div className="mt-1 text-xs">Owner accounts are not restricted by the individual permission matrix.</div></div></div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl border px-4 py-3 font-bold" onClick={() => { setShowCreate(false); setShowCreatePermissions(false); setForm(empty); }}>Cancel</button>
            <button disabled={!form.name || form.password.length < 4 || create.isPending} onClick={() => create.mutate()} className="rounded-xl bg-[#FFD400] px-5 py-3 font-black disabled:opacity-40">{create.isPending ? "Creating…" : "Create access"}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">User</th><th className="p-4">Username</th><th className="p-4">Role / title</th><th className="p-4">Access</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
          <tbody className="divide-y">
            {users.map((user) => {
              const grantedCount = user.role === "owner" ? PERMISSIONS.length : Object.values(user.permissions || {}).filter(Boolean).length;
              return (
                <tr key={user.id}>
                  <td className="p-4"><StaffAvatarUpload name={user.name} avatarUrl={user.avatarUrl} onChange={() => {}} compact /></td>
                  <td className="p-4 font-mono">{user.username || "Not assigned"}</td>
                  <td className="p-4">{roleLabel(user.role)}</td>
                  <td className="p-4">{user.role === "owner" ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Full access</span> : <span className="text-xs text-slate-600">{grantedCount} custom permissions</span>}</td>
                  <td className="p-4">{user.active ? <span className="text-emerald-700">Active</span> : <span className="text-red-600">Disabled</span>}</td>
                  <td className="p-4"><div className="flex justify-end gap-2">
                    <button onClick={() => openEditor(user)} className="flex items-center gap-1 rounded-lg border px-3 py-2" title="Edit photo, role and permissions"><UserCog className="h-4 w-4" /> Access</button>
                    <button onClick={() => { setResetFor(user); setNewPassword(""); }} className="flex items-center gap-1 rounded-lg border px-3 py-2" title="Reset password or PIN"><KeyRound className="h-4 w-4" /> Reset</button>
                    <button disabled={user.role === "owner" && user.active && owners.length === 1} onClick={() => toggle.mutate(user)} className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-30" title={user.active ? "Disable access" : "Enable access"}>{user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>
                    <button disabled={user.role === "owner" && user.active && owners.length === 1} onClick={() => setDeleteFor(user)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30" title="Delete user"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {usersQuery.isLoading && <div className="p-10 text-center text-slate-500">Loading access accounts…</div>}
        {usersQuery.isError && <div className="p-10 text-center text-red-600">{(usersQuery.error as Error).message}</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4"><div><h2 className="text-2xl font-black">Access for {editing.name}</h2><p className="mt-1 text-sm text-slate-500">Manage their photo, role/title and exact system permissions.</p></div><button className="text-2xl text-slate-400" onClick={() => setEditing(null)}>×</button></div>
            <div className="my-5"><StaffAvatarUpload name={editing.name} avatarUrl={editing.avatarUrl} onChange={saveAvatar} /></div>
            <div className="my-5 max-w-sm"><label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Role / title</label><select className="w-full rounded-lg border p-3" value={editRole} onChange={(event) => setEditRole(event.target.value)}><option value="staff">Staff</option><option value="cashier">Cashier</option><option value="kitchen_staff">Kitchen staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select></div>
            {editRole === "owner" ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Check className="mt-0.5 h-5 w-5" /><div><div className="font-black">Owner = full system access</div><div className="mt-1 text-xs">Saving this user as an owner grants unrestricted access to the system.</div></div></div> : <PermissionEditor value={editPermissions} onChange={setEditPermissions} />}
            <div className="mt-6 flex justify-end gap-2 border-t pt-4"><button className="rounded-lg border px-4 py-2 font-bold" onClick={() => setEditing(null)}>Cancel</button><button disabled={updateAccess.isPending} className="rounded-lg bg-black px-5 py-2 font-bold text-white disabled:opacity-40" onClick={() => updateAccess.mutate()}>{updateAccess.isPending ? "Saving…" : "Save access"}</button></div>
          </div>
        </div>
      )}

      {resetFor && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-black">Reset access for {resetFor.name}</h2><p className="mt-1 text-sm text-slate-500">Username: {resetFor.username}</p><input autoFocus type="password" autoComplete="new-password" className="mt-5 w-full rounded-lg border p-3" placeholder="New password / PIN" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border px-4 py-2" onClick={() => setResetFor(null)}>Cancel</button><button disabled={newPassword.length < 4 || reset.isPending} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 font-bold text-white disabled:opacity-40" onClick={() => reset.mutate()}><RefreshCw className="h-4 w-4" /> Reset</button></div></div></div>}

      {deleteFor && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><div className="flex items-center gap-3 text-red-700"><Trash2 className="h-6 w-6" /><h2 className="text-xl font-black">Permanently delete login?</h2></div><p className="mt-3 text-sm text-slate-600">This will permanently remove <strong>{deleteFor.name}</strong> ({deleteFor.username || "no username"}) from Staff Access. This cannot be undone.</p><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border px-4 py-2" onClick={() => setDeleteFor(null)}>Cancel</button><button disabled={remove.isPending} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-40" onClick={() => remove.mutate()}><Trash2 className="h-4 w-4" />{remove.isPending ? "Deleting…" : "Delete permanently"}</button></div></div></div>}
    </div>
  );
}
