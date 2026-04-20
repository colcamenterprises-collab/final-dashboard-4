import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePinAuth } from "@/components/PinLoginGate";
import {
  ALL_PERMISSIONS,
  OWNER_PERMISSIONS,
  MANAGER_PERMISSIONS,
  CASHIER_PERMISSIONS,
  KITCHEN_STAFF_PERMISSIONS,
  STAFF_PERMISSIONS,
  type StaffPermissions,
} from "../../../../shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type StaffUser = {
  id: number;
  name: string;
  role: string;
  email: string | null;
  username: string | null;
  contactNumber: string | null;
  active: boolean;
  permissions: StaffPermissions;
  avatarUrl: string | null;
  createdAt: string;
};

type RolePermRow = {
  id: number | null;
  role: string;
  permissions: StaffPermissions;
  updatedAt: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "Dashboard",
  "operations.view": "Operations",
  "purchasing.view": "Purchasing",
  "analysis.view": "Analysis",
  "finance.view": "Finance",
  "menu.view": "Menu Management",
  "pos.view": "POS Terminal",
  "membership.view": "Membership",
  "forms.daily_sales": "Daily Sales Form",
  "forms.daily_stock": "Daily Stock Form",
  "expenses.view": "Expenses",
  "settings.view": "Settings",
  "staff_access.manage": "Staff Access",
  "website_admin.view": "Website Admin",
  "online_ordering_admin.view": "Online Ordering Admin",
};

const ROLES = ["owner", "manager", "cashier", "kitchen_staff"] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen_staff: "Kitchen Staff",
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: "bg-amber-100/60 text-amber-700",
  manager: "bg-blue-100/60 text-blue-700",
  cashier: "bg-emerald-100/60 text-emerald-700",
  kitchen_staff: "bg-purple-100/60 text-purple-700",
};

const ROLE_ORDER: Record<string, number> = { owner: 0, manager: 1, cashier: 2, kitchen_staff: 3 };

const DEFAULT_PERMS: Record<string, StaffPermissions> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  cashier: CASHIER_PERMISSIONS,
  kitchen_staff: KITCHEN_STAFF_PERMISSIONS,
};

// ─── API helper ──────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function StaffAccessPage() {
  const { currentUser } = usePinAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  const [staffModal, setStaffModal] = useState<"closed" | "create" | "edit" | "pin">("closed");
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [pinUserId, setPinUserId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const isOwner = currentUser?.role === "owner";

  if (!isOwner) {
    return (
      <div className="p-6 text-xs text-slate-500">
        Only owners can manage staff access.
      </div>
    );
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function closeModal() { setStaffModal("closed"); setEditUser(null); setPinUserId(null); }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Access</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage staff accounts and role permissions</p>
        </div>
        {tab === "staff" && (
          <button
            onClick={() => { setEditUser(null); setStaffModal("create"); }}
            className="rounded px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            + Add Staff
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit">
        {(["staff", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "staff" ? "Staff Directory" : "Role Permissions"}
          </button>
        ))}
      </div>

      {/* Staff Directory */}
      {tab === "staff" && (
        <StaffDirectory
          qc={qc}
          onEdit={(u) => { setEditUser(u); setStaffModal("edit"); }}
          onResetPin={(id) => { setPinUserId(id); setStaffModal("pin"); }}
          onToast={showToast}
        />
      )}

      {/* Role Permissions */}
      {tab === "roles" && (
        <RolePermissionsPanel qc={qc} onToast={showToast} />
      )}

      {/* Staff Modal */}
      {staffModal === "create" && (
        <StaffModal
          user={null}
          onClose={closeModal}
          onSuccess={(msg) => { showToast(msg); closeModal(); qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] }); }}
        />
      )}
      {staffModal === "edit" && editUser && (
        <StaffModal
          user={editUser}
          onClose={closeModal}
          onSuccess={(msg) => { showToast(msg); closeModal(); qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] }); }}
        />
      )}
      {staffModal === "pin" && pinUserId !== null && (
        <PinResetModal
          userId={pinUserId}
          onClose={closeModal}
          onSuccess={(msg) => { showToast(msg); closeModal(); }}
        />
      )}
    </div>
  );
}

// ─── Staff Directory ──────────────────────────────────────────────────────────

function StaffDirectory({ qc, onEdit, onResetPin, onToast }: {
  qc: ReturnType<typeof useQueryClient>;
  onEdit: (u: StaffUser) => void;
  onResetPin: (id: number) => void;
  onToast: (msg: string) => void;
}) {
  const { data, isLoading } = useQuery<{ users: StaffUser[] }>({
    queryKey: ["/api/pin-auth/staff"],
    queryFn: () => apiFetch("/api/pin-auth/staff"),
  });

  const toggleActive = useMutation({
    mutationFn: (u: StaffUser) =>
      apiFetch(`/api/pin-auth/staff/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      }),
    onSuccess: (_, u) => {
      qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] });
      onToast(u.active ? "Staff member deleted." : "Staff member activated.");
    },
  });

  const users = [...(data?.users ?? [])].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
  );

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded border border-slate-200 animate-pulse bg-slate-50" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">No staff accounts yet.</p>
        <p className="text-xs text-slate-400 mt-1">Click + Add Staff to create the first account.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-200 bg-white overflow-hidden">
      {/* Table header
           Mobile  (<md):  avatar | name | role | actions
           Tablet  (md+):  avatar | name | email | role | actions
           Desktop (lg+):  avatar | name | email | contact | role | actions  */}
      <div className="
        grid gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200
        text-xs font-semibold text-slate-500 uppercase tracking-wide
        grid-cols-[32px_1fr_72px_116px]
        md:grid-cols-[32px_minmax(0,1.6fr)_minmax(0,1.3fr)_76px_130px]
        lg:grid-cols-[32px_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_76px_140px]
      ">
        <div />
        <div>Name</div>
        <div className="hidden md:block">Email</div>
        <div className="hidden lg:block">Contact</div>
        <div>Role</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-slate-100">
        {users.map((u) => (
          <div
            key={u.id}
            className={`
              grid gap-2 items-center px-4 py-3 transition-colors
              grid-cols-[32px_1fr_72px_116px]
              md:grid-cols-[32px_minmax(0,1.6fr)_minmax(0,1.3fr)_76px_130px]
              lg:grid-cols-[32px_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_76px_140px]
              ${!u.active ? "opacity-50 bg-slate-50/50" : "hover:bg-slate-50/50"}
            `}
          >
            {/* Avatar */}
            <div className="shrink-0">
              {u.avatarUrl ? (
                <img
                  src={u.avatarUrl}
                  alt={u.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  ROLE_BADGE_STYLES[u.role]?.replace("/60", "") ?? "bg-slate-100 text-slate-600"
                }`}>
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name */}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{u.name}</p>
              {u.username && <p className="text-xs text-slate-400 font-mono mt-0.5">@{u.username}</p>}
              {!u.active && <span className="text-xs text-red-500">Inactive</span>}
            </div>

            {/* Email — tablet+ only */}
            <div className="hidden md:block text-xs text-slate-500 truncate min-w-0">
              {u.email || <span className="text-slate-300">—</span>}
            </div>

            {/* Contact — desktop only */}
            <div className="hidden lg:block text-xs text-slate-500 truncate min-w-0">
              {u.contactNumber || <span className="text-slate-300">—</span>}
            </div>

            {/* Role badge */}
            <div>
              <RoleBadge role={u.role} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => onResetPin(u.id)}
                className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
              >
                PIN
              </button>
              <button
                onClick={() => onEdit(u)}
                className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive.mutate(u)}
                disabled={toggleActive.isPending}
                className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                  u.active
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {u.active ? "Delete" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Role Permissions Panel ───────────────────────────────────────────────────

function RolePermissionsPanel({ qc, onToast }: {
  qc: ReturnType<typeof useQueryClient>;
  onToast: (msg: string) => void;
}) {
  const { data, isLoading } = useQuery<{ rolePermissions: RolePermRow[] }>({
    queryKey: ["/api/pin-auth/role-permissions"],
    queryFn: () => apiFetch("/api/pin-auth/role-permissions"),
  });

  // localPerms mirrors what the user is editing right now
  const [localPerms, setLocalPerms] = useState<Record<string, StaffPermissions>>({});
  // savedPerms tracks what was last persisted so we can detect dirty state
  const [savedPerms, setSavedPerms] = useState<Record<string, StaffPermissions>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Initialise local state once data arrives
  const initialised = Object.keys(localPerms).length > 0;
  if (!isLoading && data && !initialised) {
    const initial: Record<string, StaffPermissions> = {};
    data.rolePermissions.forEach((r) => { initial[r.role] = { ...(r.permissions ?? DEFAULT_PERMS[r.role] ?? {}) }; });
    setLocalPerms(initial);
    setSavedPerms(initial);
  }

  function togglePerm(role: string, key: keyof StaffPermissions) {
    setLocalPerms((p) => ({ ...p, [role]: { ...p[role], [key]: !p[role]?.[key] } }));
  }

  function isDirty(role: string): boolean {
    const a = localPerms[role] ?? {};
    const b = savedPerms[role] ?? {};
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  function discardRole(role: string) {
    setLocalPerms((p) => ({ ...p, [role]: { ...(savedPerms[role] ?? DEFAULT_PERMS[role] ?? {}) } }));
  }

  async function saveRole(role: string) {
    setSaving(role);
    try {
      await apiFetch(`/api/pin-auth/role-permissions/${role}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: localPerms[role] }),
      });
      setSavedPerms((p) => ({ ...p, [role]: { ...localPerms[role] } }));
      qc.invalidateQueries({ queryKey: ["/api/pin-auth/role-permissions"] });
      qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] });
      onToast(`${ROLE_LABELS[role]} permissions saved.`);
    } catch (e: unknown) {
      onToast(`Failed to save: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(null);
    }
  }

  if (isLoading) {
    return <div className="h-48 rounded border border-slate-200 animate-pulse bg-slate-50" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Click any checkbox to toggle access for that role. Save changes per column when done.
        The Owner role always has full access and cannot be restricted.
      </p>

      {/* Big permissions matrix table */}
      <div className="rounded border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-44">Permission</th>
              {ROLES.map((role) => {
                const isOwnerRole = role === "owner";
                const dirty = !isOwnerRole && isDirty(role);
                const isSaving = saving === role;
                return (
                  <th key={role} className="text-center px-3 py-3 font-semibold text-slate-700">
                    <div className="flex flex-col items-center gap-1.5">
                      <RoleBadge role={role} />
                      {!isOwnerRole && dirty && (
                        <div className="flex gap-1 items-center">
                          <button
                            onClick={() => saveRole(role)}
                            disabled={isSaving}
                            className="text-xs px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => discardRole(role)}
                            disabled={isSaving}
                            className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((key, idx) => (
              <tr key={key} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                <td className="px-4 py-2.5 text-slate-700 font-medium">{PERMISSION_LABELS[key] ?? key}</td>
                {ROLES.map((role) => {
                  const isOwnerRole = role === "owner";
                  const perms = localPerms[role] ?? DEFAULT_PERMS[role] ?? {};
                  const checked = isOwnerRole ? true : !!perms[key];

                  return (
                    <td key={role} className="px-3 py-2 text-center">
                      <button
                        disabled={isOwnerRole}
                        onClick={() => !isOwnerRole && togglePerm(role, key)}
                        title={isOwnerRole ? "Owner always has full access" : `Toggle ${PERMISSION_LABELS[key]} for ${ROLE_LABELS[role]}`}
                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto border transition-all ${
                          checked
                            ? "bg-emerald-500 border-emerald-500"
                            : "bg-white border-slate-300"
                        } ${isOwnerRole ? "cursor-default opacity-60" : "cursor-pointer hover:scale-110 hover:border-emerald-400"}`}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/50">
              <td className="px-4 py-2.5 text-xs text-slate-400 italic">Click checkboxes to edit</td>
              {ROLES.map((role) => (
                <td key={role} className="px-3 py-2.5 text-center text-xs text-slate-400">
                  {role === "owner" ? "Full access" : isDirty(role) ? (
                    <span className="text-amber-600 font-medium">● Unsaved</span>
                  ) : (
                    <span className="text-emerald-600">✓ Saved</span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Staff Create / Edit Modal ────────────────────────────────────────────────

function StaffModal({ user, onClose, onSuccess }: {
  user: StaffUser | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [usernameManual, setUsernameManual] = useState(!!user?.username);
  const [contactNumber, setContactNumber] = useState(user?.contactNumber ?? "");
  const validRoles = ["owner", "manager", "cashier", "kitchen_staff"];
  const [role, setRole] = useState(validRoles.includes(user?.role ?? "") ? user!.role : "cashier");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatarUrl ?? "");
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function deriveUsername(fullName: string): string {
    const parts = fullName.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return parts[0][0] + parts[parts.length - 1];
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!usernameManual) setUsername(deriveUsername(val));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFormError("Photo must be under 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!isEdit && pin !== confirmPin) throw new Error("PINs do not match");
      if (!isEdit && pin.length < 4) throw new Error("PIN must be at least 4 digits");
      const body: Record<string, unknown> = { name, role, email, username: username || undefined, contactNumber, avatarUrl: avatarPreview || null };
      if (!isEdit) body.pin = pin;
      return apiFetch(
        isEdit ? `/api/pin-auth/staff/${user!.id}` : "/api/pin-auth/staff",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
    },
    onSuccess: () => onSuccess(isEdit ? `${name} updated.` : `${name} added to the team.`),
    onError: (e: Error) => setFormError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">{isEdit ? `Edit — ${user!.name}` : "Add New Staff"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {formError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </div>
          )}

          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <button onClick={() => fileRef.current?.click()} className="relative group shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 group-hover:border-emerald-400 transition-colors" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-emerald-400 flex flex-col items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-white">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-700">Profile Photo</p>
              <p className="text-xs text-slate-400 mt-0.5">Click to upload · Max 2 MB</p>
              {avatarPreview && (
                <button onClick={() => setAvatarPreview("")} className="text-xs text-red-500 hover:text-red-700 mt-1 transition-colors">Remove</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
          </div>

          {/* Name */}
          <Field label="Full Name *">
            <input
              className="input"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Jane Smith"
              maxLength={60}
            />
          </Field>

          {/* Username */}
          <Field label="Username">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono select-none">@</span>
              <input
                className="input pl-7 font-mono"
                value={username}
                onChange={(e) => {
                  setUsernameManual(true);
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                }}
                placeholder="auto-generated from name"
                maxLength={30}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {usernameManual ? "Custom username · can log in with this" : "Auto-generated from name · edit to override"}
            </p>
          </Field>

          {/* Email */}
          <Field label="Email Address">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
            <p className="text-xs text-slate-400 mt-1">Optional · can also log in with username or name</p>
          </Field>

          {/* Contact */}
          <Field label="Contact Number">
            <input
              className="input"
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="+66 81 234 5678"
            />
          </Field>

          {/* Role */}
          <Field label="Role *">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
              <option value="kitchen_staff">Kitchen Staff</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Permissions are determined by the role. Set them in the Role Permissions tab.</p>
          </Field>

          {/* PIN — create only */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="PIN (4–8 digits) *">
                <input
                  className="input tracking-widest"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Enter PIN"
                />
              </Field>
              <Field label="Confirm PIN *">
                <input
                  className="input tracking-widest"
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Re-enter PIN"
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { setFormError(""); mutation.mutate(); }}
            disabled={mutation.isPending || !name.trim() || (!isEdit && pin.length < 4)}
            className="px-4 py-2 text-sm font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Staff"}
          </button>
        </div>
      </div>

      <style>{`.input { width: 100%; height: 36px; border-radius: 6px; border: 1px solid #e2e8f0; padding: 0 12px; font-size: 13px; color: #0f172a; background: white; outline: none; transition: border-color .15s; } .input:focus { border-color: #059669; box-shadow: 0 0 0 2px #d1fae5; }`}</style>
    </div>
  );
}

// ─── PIN Reset Modal ──────────────────────────────────────────────────────────

function PinResetModal({ userId, onClose, onSuccess }: {
  userId: number;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (pin !== confirm) throw new Error("PINs do not match");
      if (pin.length < 4) throw new Error("PIN must be at least 4 digits");
      return apiFetch(`/api/pin-auth/staff/${userId}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
    },
    onSuccess: () => onSuccess("PIN updated."),
    onError: (e: Error) => setFormError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Reset PIN</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {formError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN (4–8 digits)">
              <input
                className="input tracking-widest"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter new PIN"
              />
            </Field>
            <Field label="Confirm PIN">
              <input
                className="input tracking-widest"
                type="password"
                inputMode="numeric"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Re-enter PIN"
              />
            </Field>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { setFormError(""); mutation.mutate(); }}
            disabled={mutation.isPending || pin.length < 4 || confirm.length < 4}
            className="px-4 py-2 text-sm font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40"
          >
            {mutation.isPending ? "Saving…" : "Update PIN"}
          </button>
        </div>
      </div>
      <style>{`.input { width: 100%; height: 36px; border-radius: 6px; border: 1px solid #e2e8f0; padding: 0 12px; font-size: 13px; color: #0f172a; background: white; outline: none; transition: border-color .15s; } .input:focus { border-color: #059669; box-shadow: 0 0 0 2px #d1fae5; }`}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE_STYLES[role] ?? "bg-slate-100 text-slate-600"}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
