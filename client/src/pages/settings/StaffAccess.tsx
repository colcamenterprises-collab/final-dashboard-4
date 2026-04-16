import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePinAuth } from "@/components/PinLoginGate";
import { ALL_PERMISSIONS, OWNER_PERMISSIONS, MANAGER_PERMISSIONS, STAFF_PERMISSIONS, type StaffPermissions } from "../../../../shared/schema";

type StaffUser = {
  id: number;
  name: string;
  role: string;
  active: boolean;
  permissions: StaffPermissions;
  createdAt: string;
};

type Mode = "list" | "create" | "edit" | "pin";

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
  "staff_access.manage": "Staff Access (Manage)",
  "website_admin.view": "Website Admin",
  "online_ordering_admin.view": "Online Ordering Admin",
};

const ROLE_DEFAULTS: Record<string, StaffPermissions> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function StaffAccessPage() {
  const { currentUser, hasPermission } = usePinAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("list");
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [pinUserId, setPinUserId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canManage = hasPermission("staff_access.manage") || currentUser?.role === "owner";

  const { data, isLoading } = useQuery<{ users: StaffUser[] }>({
    queryKey: ["/api/pin-auth/staff"],
    queryFn: () => apiFetch("/api/pin-auth/staff"),
    enabled: canManage,
  });

  const users = data?.users ?? [];

  function openEdit(u: StaffUser) { setEditUser(u); setMode("edit"); setFormError(""); setSuccessMsg(""); }
  function openCreate() { setEditUser(null); setMode("create"); setFormError(""); setSuccessMsg(""); }
  function goList() { setMode("list"); setEditUser(null); setFormError(""); setSuccessMsg(""); }

  if (!canManage) {
    return (
      <div className="p-6 text-xs text-slate-500">
        You do not have permission to manage staff access.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Access</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage staff accounts, PINs, and page permissions</p>
        </div>
        {mode === "list" && (
          <button
            onClick={openCreate}
            className="rounded px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            Add Staff
          </button>
        )}
        {mode !== "list" && (
          <button
            onClick={goList}
            className="rounded px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Back to list
          </button>
        )}
      </div>

      {successMsg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
          {successMsg}
        </div>
      )}

      {mode === "list" && (
        <StaffList
          users={users}
          isLoading={isLoading}
          onEdit={openEdit}
          onResetPin={(id) => { setPinUserId(id); setMode("pin"); setFormError(""); setSuccessMsg(""); }}
          qc={qc}
          setSuccess={setSuccessMsg}
        />
      )}
      {(mode === "create" || mode === "edit") && (
        <UserForm
          user={editUser}
          onSuccess={(msg) => { setSuccessMsg(msg); goList(); qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] }); }}
          onError={setFormError}
          formError={formError}
        />
      )}
      {mode === "pin" && pinUserId !== null && (
        <ResetPinForm
          userId={pinUserId}
          onSuccess={(msg) => { setSuccessMsg(msg); goList(); }}
          onError={setFormError}
          formError={formError}
        />
      )}
    </div>
  );
}

// ─── Staff list ────────────────────────────────────────────────────────────────

function StaffList({ users, isLoading, onEdit, onResetPin, qc, setSuccess }: {
  users: StaffUser[];
  isLoading: boolean;
  onEdit: (u: StaffUser) => void;
  onResetPin: (id: number) => void;
  qc: ReturnType<typeof useQueryClient>;
  setSuccess: (msg: string) => void;
}) {
  const toggleActive = useMutation({
    mutationFn: (u: StaffUser) =>
      apiFetch(`/api/pin-auth/staff/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] }); setSuccess("User updated."); },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded border border-slate-200 h-16 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs text-slate-500">No staff accounts yet.</p>
        <p className="text-xs text-slate-400 mt-1">Click Add Staff to create the first account.</p>
      </div>
    );
  }

  const roleOrder = { owner: 0, manager: 1, staff: 2 };
  const sorted = [...users].sort((a, b) => (roleOrder[a.role as keyof typeof roleOrder] ?? 3) - (roleOrder[b.role as keyof typeof roleOrder] ?? 3));

  return (
    <div className="space-y-2">
      {sorted.map((u) => (
        <div
          key={u.id}
          className={`rounded border bg-white p-3 flex items-center gap-3 ${u.active ? "border-slate-200" : "border-slate-200 opacity-60"}`}
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 shrink-0">
            {u.name.slice(0, 1).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900 truncate">{u.name}</span>
              <RoleBadge role={u.role} />
              {!u.active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100/60 text-red-600 font-medium">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {Object.entries(u.permissions).filter(([, v]) => v).length} permissions
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onResetPin(u.id)}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
            >
              PIN
            </button>
            <button
              onClick={() => onEdit(u)}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => toggleActive.mutate(u)}
              disabled={toggleActive.isPending}
              className={`text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40 ${
                u.active
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              {u.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── User form (create / edit) ─────────────────────────────────────────────────

function UserForm({ user, onSuccess, onError, formError }: {
  user: StaffUser | null;
  onSuccess: (msg: string) => void;
  onError: (e: string) => void;
  formError: string;
}) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "staff");
  const [pin, setPin] = useState("");
  const [permissions, setPermissions] = useState<StaffPermissions>(user?.permissions ?? STAFF_PERMISSIONS);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return apiFetch(`/api/pin-auth/staff/${user!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, role, permissions }),
        });
      }
      return apiFetch("/api/pin-auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, pin, permissions }),
      });
    },
    onSuccess: () => onSuccess(isEdit ? "User updated." : "User created."),
    onError: (e: Error) => onError(e.message),
  });

  function applyRoleDefaults(r: string) { setRole(r); setPermissions(ROLE_DEFAULTS[r] ?? STAFF_PERMISSIONS); }
  function togglePerm(key: keyof StaffPermissions) { setPermissions((prev) => ({ ...prev, [key]: !prev[key] })); }

  return (
    <div className="rounded border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-900">{isEdit ? `Edit — ${user!.name}` : "New Staff Account"}</h2>

      {formError && (
        <div className="rounded border border-red-200 bg-red-100/40 px-4 py-2.5 text-xs text-red-700">
          {formError}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label>
        <input
          className="w-full h-9 rounded border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staff member name"
          maxLength={40}
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
        <select
          className="w-full h-9 rounded border border-slate-200 px-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          value={role}
          onChange={(e) => applyRoleDefaults(e.target.value)}
        >
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">Changing role applies default permissions. Adjust below as needed.</p>
      </div>

      {/* PIN (create only) */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">PIN</label>
          <input
            className="w-full h-9 rounded border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-widest transition-colors"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="4-8 digits"
          />
        </div>
      )}

      {/* Permissions */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Page Access</label>
        <div className="rounded border border-slate-200 bg-slate-50 divide-y divide-slate-100">
          {ALL_PERMISSIONS.map((key) => (
            <label key={key} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white transition-colors">
              <div
                className="w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors"
                style={{
                  background: permissions[key] ? "#059669" : "#fff",
                  borderColor: permissions[key] ? "#059669" : "#cbd5e1",
                }}
                onClick={() => togglePerm(key)}
              >
                {permissions[key] && (
                  <svg width="9" height="7" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4L4.5 7.5L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input type="checkbox" className="sr-only" checked={!!permissions[key]} onChange={() => togglePerm(key)} />
              <span className="text-xs text-slate-700">{PERMISSION_LABELS[key] ?? key}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !name.trim() || (!isEdit && pin.length < 4)}
        className="w-full rounded py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40"
      >
        {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Account"}
      </button>
    </div>
  );
}

// ─── Reset PIN form ────────────────────────────────────────────────────────────

function ResetPinForm({ userId, onSuccess, onError, formError }: {
  userId: number;
  onSuccess: (msg: string) => void;
  onError: (e: string) => void;
  formError: string;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/pin-auth/staff/${userId}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      }),
    onSuccess: () => onSuccess("PIN updated successfully."),
    onError: (e: Error) => onError(e.message),
  });

  function submit() {
    if (pin !== confirm) { onError("PINs do not match."); return; }
    if (pin.length < 4) { onError("PIN must be at least 4 digits."); return; }
    mutation.mutate();
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-900">Set New PIN</h2>

      {formError && (
        <div className="rounded border border-red-200 bg-red-100/40 px-4 py-2.5 text-xs text-red-700">
          {formError}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">New PIN (4–8 digits)</label>
        <input
          className="w-full h-9 rounded border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-widest transition-colors"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Enter new PIN"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm PIN</label>
        <input
          className="w-full h-9 rounded border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-widest transition-colors"
          type="password"
          inputMode="numeric"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Re-enter new PIN"
        />
      </div>

      <button
        onClick={submit}
        disabled={mutation.isPending || pin.length < 4 || confirm.length < 4}
        className="w-full rounded py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40"
      >
        {mutation.isPending ? "Saving..." : "Update PIN"}
      </button>
    </div>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-amber-100/60 text-amber-700",
    manager: "bg-blue-100/60 text-blue-700",
    staff: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[role] ?? styles.staff}`}>
      {role}
    </span>
  );
}
