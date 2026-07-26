import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (file) => path.join(root, file);
const read = (file) => fs.readFileSync(p(file), "utf8");
const write = (file, content) => { fs.mkdirSync(path.dirname(p(file)), { recursive: true }); fs.writeFileSync(p(file), content); };

function patchSchema(source) {
  const keys = ["forms.daily_sales", "forms.daily_cleaning", "forms.daily_stock"];
  if (!source.includes('"forms.daily_cleaning"?: boolean;')) {
    source = source.replace('  "forms.daily_sales"?: boolean;\n  "forms.daily_stock"?: boolean;', '  "forms.daily_sales"?: boolean;\n  "forms.daily_cleaning"?: boolean;\n  "forms.daily_stock"?: boolean;');
  }
  if (!source.includes('  "forms.daily_cleaning",')) {
    source = source.replace('  "forms.daily_sales",\n  "forms.daily_stock",', '  "forms.daily_sales",\n  "forms.daily_cleaning",\n  "forms.daily_stock",');
  }
  for (const marker of ["MANAGER_PERMISSIONS", "STAFF_PERMISSIONS", "CASHIER_PERMISSIONS"]) {
    const start = source.indexOf(`export const ${marker}`);
    if (start < 0) continue;
    const end = source.indexOf("};", start);
    if (end < 0) continue;
    let block = source.slice(start, end);
    for (const key of keys) {
      const re = new RegExp(`  "${key.replaceAll('.', '\\.')}": (true|false),?`);
      if (re.test(block)) block = block.replace(re, `  "${key}": true,`);
      else block += `\n  "${key}": true,`;
    }
    source = source.slice(0, start) + block + source.slice(end);
  }
  return source;
}

function patchPinAuth(source) {
  if (source.includes('async function resolvePermissions(role: string): Promise<StaffPermissions>')) {
    source = source.replace('async function resolvePermissions(role: string): Promise<StaffPermissions> {', 'async function resolvePermissions(role: string, userPermissions?: StaffPermissions | null): Promise<StaffPermissions> {');
  }
  source = source.replace('      return row.permissions;\n', '      return { ...row.permissions, ...(userPermissions ?? {}) };\n');
  source = source.replace('  return ROLE_DEFAULTS[role] ?? STAFF_PERMISSIONS;\n}', '  return { ...(ROLE_DEFAULTS[role] ?? STAFF_PERMISSIONS), ...(userPermissions ?? {}) };\n}');
  source = source.replace('const permissions = await resolvePermissions(userRow.role);', 'const permissions = await resolvePermissions(userRow.role, userRow.permissions);');
  source = source.replace('const permissions = await resolvePermissions(role);', 'const permissions = requestedPermissions ?? await resolvePermissions(role);');
  if (!source.includes('permissions: requestedPermissions')) {
    source = source.replace('username: requestedUsername } = req.body as {', 'username: requestedUsername, permissions: requestedPermissions } = req.body as {');
  }
  if (!source.includes('if (permissions !== undefined) updates.permissions = permissions;')) {
    source = source.replace('    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;\n', '    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;\n    if (permissions !== undefined) updates.permissions = permissions;\n');
  }
  return source;
}

function patchApp(source) {
  if (!source.includes('import StaffAccess from "./pages/staff/Access";')) {
    source = source.replace('import StaffSettings from "./pages/staff/Settings";', 'import StaffSettings from "./pages/staff/Settings";\nimport StaffAccess from "./pages/staff/Access";');
  }
  if (!source.includes('path="/settings/staff-access"')) {
    source = source.replace(/(<Route path="\/staff\/settings"[^\n]+\n?)/, '$1                    <Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />\n');
  }
  // Daily workflow must be permission-controlled, not owner-only.
  source = source.replace(/<OwnerRoute>\s*(<(?:DailySalesV2|DailyCleaning|DailyStockV2)[\s\S]*?<\/[^>]+>)\s*<\/OwnerRoute>/g, '$1');
  source = source.replace(/<OwnerRoute>\s*(<(?:DailySalesV2|CleaningForm|DailyStock)[^>]*\/>)[\s\S]*?<\/OwnerRoute>/g, '$1');
  return source;
}

function patchSidebar(source) {
  if (!source.includes('to: "/settings/staff-access"')) {
    const anchor = '{ to: "/staff/settings"';
    const idx = source.indexOf(anchor);
    if (idx >= 0) {
      const lineEnd = source.indexOf('\n', idx);
      source = source.slice(0, lineEnd + 1) + '      { to: "/settings/staff-access", label: "Staff Access & Permissions", icon: UserCheck, testId: "nav-staff-access", ownerOnly: true },\n' + source.slice(lineEnd + 1);
    }
  }
  return source;
}

const accessPage = `import { useEffect, useMemo, useState } from "react";
import type { StaffPermissions } from "../../../shared/schema";

type PermissionKey = keyof StaffPermissions;
const PERMISSIONS: Array<{ key: PermissionKey; label: string; group: string }> = [
  { key: "dashboard.view", label: "Dashboard", group: "General" },
  { key: "operations.view", label: "Operations", group: "General" },
  { key: "forms.daily_sales", label: "Daily Sales — Form 1", group: "End of Shift Workflow" },
  { key: "forms.daily_cleaning", label: "Daily Cleaning — Form 2", group: "End of Shift Workflow" },
  { key: "forms.daily_stock", label: "Daily Stock — Form 3", group: "End of Shift Workflow" },
  { key: "purchasing.view", label: "Purchasing", group: "Operations" },
  { key: "analysis.view", label: "Reporting & Analysis", group: "Reporting" },
  { key: "finance.view", label: "Finance", group: "Finance" },
  { key: "expenses.view", label: "Expenses", group: "Finance" },
  { key: "menu.view", label: "Menu, Products, Recipes & Modifiers", group: "Menu" },
  { key: "pos.view", label: "POS, Kitchen & Customer Display", group: "POS & Orders" },
  { key: "online_ordering_admin.view", label: "Orders & Ordering Channels", group: "POS & Orders" },
  { key: "membership.view", label: "Membership & Customers", group: "Customers" },
  { key: "website_admin.view", label: "Website Administration", group: "Administration" },
  { key: "settings.view", label: "Settings", group: "Administration" },
  { key: "staff_access.manage", label: "Manage Staff Access", group: "Administration" },
];

type Staff = { id: number; name: string; role: string; username?: string | null; active: boolean; permissions?: StaffPermissions };

export default function StaffAccess() {
  const [users, setUsers] = useState<Staff[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<StaffPermissions>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await fetch("/api/pin-auth/staff", { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Failed to load staff");
    const next = data.users ?? [];
    setUsers(next);
    setSelectedId((current) => current ?? next[0]?.id ?? null);
  };
  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);
  const selected = useMemo(() => users.find((user) => user.id === selectedId) ?? null, [users, selectedId]);
  useEffect(() => { setDraft(selected?.permissions ?? {}); setMessage(""); }, [selected]);
  const groups = [...new Set(PERMISSIONS.map((permission) => permission.group))];

  const save = async () => {
    if (!selected) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(\`/api/pin-auth/staff/\${selected.id}\`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: draft }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to save permissions");
      setMessage("Permissions saved. This staff member must sign out and back in.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to save permissions"); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-6xl space-y-5 p-4">
    <div><h1 className="text-2xl font-bold">Staff Access & Permissions</h1><p className="text-sm text-slate-500">Select exactly which dashboard sections and end-of-shift forms each person can use.</p></div>
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="overflow-hidden rounded-xl border bg-white">{users.map((user) => <button key={user.id} type="button" onClick={() => setSelectedId(user.id)} className={\`w-full border-b px-4 py-3 text-left last:border-b-0 \${selectedId === user.id ? "bg-yellow-100" : "hover:bg-slate-50"}\`}><div className="font-semibold">{user.name}</div><div className="text-xs text-slate-500">{user.role}{user.active ? "" : " · Inactive"}</div></button>)}</div>
      <div className="space-y-5 rounded-xl border bg-white p-4">{!selected ? <p>Select a staff member.</p> : <>
        <div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-xs text-slate-500">Role: {selected.role}</p></div>
        {groups.map((group) => <section key={group}><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</h3><div className="grid gap-2 sm:grid-cols-2">{PERMISSIONS.filter((permission) => permission.group === group).map((permission) => <label key={permission.key} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 hover:bg-slate-50"><input type="checkbox" className="h-4 w-4" checked={draft[permission.key] === true} onChange={(event) => setDraft((current) => ({ ...current, [permission.key]: event.target.checked }))} /><span className="text-sm">{permission.label}</span></label>)}</div></section>)}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4"><button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Permissions"}</button>{message && <span className="text-sm text-slate-600">{message}</span>}</div>
      </>}</div>
    </div>
  </div>;
}
`;

write("shared/schema.ts", patchSchema(read("shared/schema.ts")));
write("server/routes/pinAuth.ts", patchPinAuth(read("server/routes/pinAuth.ts")));
write("client/src/App.tsx", patchApp(read("client/src/App.tsx")));
write("client/src/components/navigation/ModernSidebar.tsx", patchSidebar(read("client/src/components/navigation/ModernSidebar.tsx")));
write("client/src/pages/staff/Access.tsx", accessPage);
console.log("Urgent staff access workflow restored.");
