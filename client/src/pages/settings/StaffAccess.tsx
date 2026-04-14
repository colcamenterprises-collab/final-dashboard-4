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

  function openEdit(u: StaffUser) {
    setEditUser(u);
    setMode("edit");
    setFormError("");
    setSuccessMsg("");
  }

  function openCreate() {
    setEditUser(null);
    setMode("create");
    setFormError("");
    setSuccessMsg("");
  }

  function goList() {
    setMode("list");
    setEditUser(null);
    setFormError("");
    setSuccessMsg("");
  }

  if (!canManage) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        You do not have permission to manage staff access.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Staff Access</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage staff accounts, PINs, and page permissions
          </p>
        </div>
        {mode === "list" && (
          <button
            onClick={openCreate}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            style={{ background: "hsl(142,76%,45%)", color: "hsl(222,47%,6%)" }}
          >
            Add Staff
          </button>
        )}
        {mode !== "list" && (
          <button
            onClick={goList}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
          >
            Back to list
          </button>
        )}
      </div>

      {successMsg && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "hsl(142,76%,10%)", color: "hsl(142,76%,55%)", border: "1px solid hsl(142,76%,20%)" }}>
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

// ─── Staff list ───────────────────────────────────────────────────────────────

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pin-auth/staff"] });
      setSuccess("User updated.");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl h-20 animate-pulse bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No staff accounts yet.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click Add Staff to create the first account.</p>
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
          className="rounded-xl border p-4 flex items-center gap-4 transition-colors"
          style={{
            background: u.active ? "hsl(222,35%,8%)" : "hsl(222,30%,6%)",
            borderColor: u.active ? "hsl(222,30%,15%)" : "hsl(222,30%,11%)",
          }}
        >
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              background: u.active ? "hsl(222,35%,14%)" : "hsl(222,30%,10%)",
              color: u.active ? "hsl(142,76%,45%)" : "hsl(215,16%,40%)",
            }}
          >
            {u.name.slice(0, 1).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">{u.name}</span>
              <RoleBadge role={u.role} />
              {!u.active && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "hsl(0,30%,10%)", color: "hsl(0,50%,55%)" }}>
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "hsl(215,16%,50%)" }}>
              {Object.entries(u.permissions).filter(([, v]) => v).length} permissions
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onResetPin(u.id)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "hsl(222,35%,12%)", color: "hsl(215,16%,65%)", border: "1px solid hsl(222,30%,18%)" }}
            >
              PIN
            </button>
            <button
              onClick={() => onEdit(u)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "hsl(222,35%,12%)", color: "hsl(215,16%,65%)", border: "1px solid hsl(222,30%,18%)" }}
            >
              Edit
            </button>
            <button
              onClick={() => toggleActive.mutate(u)}
              disabled={toggleActive.isPending}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{
                background: u.active ? "hsl(0,30%,10%)" : "hsl(142,30%,10%)",
                color: u.active ? "hsl(0,70%,60%)" : "hsl(142,70%,50%)",
                border: `1px solid ${u.active ? "hsl(0,30%,15%)" : "hsl(142,30%,15%)"}`,
              }}
            >
              {u.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── User form (create / edit) ────────────────────────────────────────────────

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
  const [permissions, setPermissions] = useState<StaffPermissions>(
    user?.permissions ?? STAFF_PERMISSIONS
  );

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

  function applyRoleDefaults(r: string) {
    setRole(r);
    setPermissions(ROLE_DEFAULTS[r] ?? STAFF_PERMISSIONS);
  }

  function togglePerm(key: keyof StaffPermissions) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const labelStyle = "block text-xs font-semibold mb-1.5" as const;
  const inputStyle = "w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors" as const;

  return (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{ background: "hsl(222,35%,8%)", border: "1px solid hsl(222,30%,14%)" }}
    >
      <h2 className="text-base font-bold text-white">{isEdit ? `Edit — ${user!.name}` : "New Staff Account"}</h2>

      {formError && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: "hsl(0,30%,10%)", color: "hsl(0,70%,65%)", border: "1px solid hsl(0,30%,15%)" }}>
          {formError}
        </div>
      )}

      {/* Name */}
      <div>
        <label className={labelStyle} style={{ color: "hsl(215,16%,65%)" }}>Name</label>
        <input
          className={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staff member name"
          maxLength={40}
        />
      </div>

      {/* Role */}
      <div>
        <label className={labelStyle} style={{ color: "hsl(215,16%,65%)" }}>Role</label>
        <select
          className={inputStyle}
          value={role}
          onChange={(e) => applyRoleDefaults(e.target.value)}
        >
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
        <p className="text-xs mt-1" style={{ color: "hsl(215,16%,45%)" }}>
          Changing role applies default permissions. You can adjust below.
        </p>
      </div>

      {/* PIN (create only) */}
      {!isEdit && (
        <div>
          <label className={labelStyle} style={{ color: "hsl(215,16%,65%)" }}>PIN</label>
          <input
            className={inputStyle}
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
        <label className={labelStyle} style={{ color: "hsl(215,16%,65%)" }}>Page Access</label>
        <div
          className="rounded-lg p-4 space-y-2"
          style={{ background: "hsl(222,30%,6%)", border: "1px solid hsl(222,30%,11%)" }}
        >
          {ALL_PERMISSIONS.map((key) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!!permissions[key]}
                  onChange={() => togglePerm(key)}
                />
                <div
                  className="w-5 h-5 rounded flex items-center justify-center transition-all"
                  style={{
                    background: permissions[key] ? "hsl(142,76%,45%)" : "hsl(222,30%,14%)",
                    border: `1px solid ${permissions[key] ? "hsl(142,76%,45%)" : "hsl(222,30%,22%)"}`,
                  }}
                  onClick={() => togglePerm(key)}
                >
                  {permissions[key] && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4.5 7.5L10 1" stroke="hsl(222,47%,6%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span
                className="text-sm transition-colors"
                style={{ color: permissions[key] ? "hsl(213,31%,88%)" : "hsl(215,16%,50%)" }}
              >
                {PERMISSION_LABELS[key] ?? key}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !name.trim() || (!isEdit && pin.length < 4)}
        className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-40 active:scale-95"
        style={{ background: "hsl(142,76%,45%)", color: "hsl(222,47%,6%)" }}
      >
        {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Account"}
      </button>
    </div>
  );
}

// ─── Reset PIN form ───────────────────────────────────────────────────────────

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

  const inputStyle = "w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors tracking-widest" as const;
  const labelStyle = "block text-xs font-semibold mb-1.5 text-slate-400" as const;

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "hsl(222,35%,8%)", border: "1px solid hsl(222,30%,14%)" }}
    >
      <h2 className="text-base font-bold text-white">Set New PIN</h2>

      {formError && (
        <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: "hsl(0,30%,10%)", color: "hsl(0,70%,65%)", border: "1px solid hsl(0,30%,15%)" }}>
          {formError}
        </div>
      )}

      <div>
        <label className={labelStyle}>New PIN (4-8 digits)</label>
        <input
          className={inputStyle}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Enter new PIN"
        />
      </div>
      <div>
        <label className={labelStyle}>Confirm PIN</label>
        <input
          className={inputStyle}
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
        className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-40 active:scale-95"
        style={{ background: "hsl(142,76%,45%)", color: "hsl(222,47%,6%)" }}
      >
        {mutation.isPending ? "Saving..." : "Update PIN"}
      </button>
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, [string, string]> = {
    owner: ["hsl(45,90%,10%)", "hsl(45,90%,60%)"],
    manager: ["hsl(220,80%,10%)", "hsl(220,80%,65%)"],
    staff: ["hsl(222,30%,12%)", "hsl(215,16%,55%)"],
  };
  const [bg, text] = colors[role] ?? colors.staff;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ background: bg, color: text }}
    >
      {role}
    </span>
  );
}
