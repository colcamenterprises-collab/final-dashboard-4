import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
const ensureDir = (p) => fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch anchor not found: ${label}`);
  return source.replace(search, replacement);
}

function addPermissionKey(schema) {
  if (!schema.includes('"forms.daily_cleaning"?: boolean;')) {
    schema = replaceOnce(
      schema,
      '  "forms.daily_sales"?: boolean;\n  "forms.daily_stock"?: boolean;',
      '  "forms.daily_sales"?: boolean;\n  "forms.daily_cleaning"?: boolean;\n  "forms.daily_stock"?: boolean;',
      "StaffPermissions daily form keys"
    );
  }
  if (!schema.includes('  "forms.daily_cleaning",')) {
    schema = replaceOnce(
      schema,
      '  "forms.daily_sales",\n  "forms.daily_stock",',
      '  "forms.daily_sales",\n  "forms.daily_cleaning",\n  "forms.daily_stock",',
      "ALL_PERMISSIONS daily form keys"
    );
  }
  for (const marker of ["MANAGER_PERMISSIONS", "STAFF_PERMISSIONS"]) {
    const start = schema.indexOf(`export const ${marker}`);
    if (start >= 0) {
      const end = schema.indexOf("};", start);
      const block = schema.slice(start, end);
      if (!block.includes('"forms.daily_cleaning"')) {
        const patched = block.replace(
          '  "forms.daily_sales": true,\n  "forms.daily_stock": true,',
          '  "forms.daily_sales": true,\n  "forms.daily_cleaning": true,\n  "forms.daily_stock": true,'
        );
        schema = schema.slice(0, start) + patched + schema.slice(end);
      }
    }
  }
  for (const marker of ["CASHIER_PERMISSIONS", "KITCHEN_STAFF_PERMISSIONS"]) {
    const start = schema.indexOf(`export const ${marker}`);
    if (start >= 0) {
      const end = schema.indexOf("};", start);
      const block = schema.slice(start, end);
      if (!block.includes('"forms.daily_cleaning"')) {
        const patched = block.replace(
          /  "forms\.daily_sales": (true|false),\n/,
          '  "forms.daily_sales": $1,\n  "forms.daily_cleaning": false,\n'
        );
        schema = schema.slice(0, start) + patched + schema.slice(end);
      }
    }
  }
  return schema;
}

function patchPinAuth(source) {
  source = source.replace(
    'async function resolvePermissions(role: string): Promise<StaffPermissions> {',
    'async function resolvePermissions(role: string, userPermissions?: StaffPermissions | null): Promise<StaffPermissions> {'
  );
  source = source.replace(
    '      return row.permissions;\n',
    '      return { ...row.permissions, ...(userPermissions ?? {}) };\n'
  );
  source = source.replace(
    '  return ROLE_DEFAULTS[role] ?? STAFF_PERMISSIONS;\n}',
    '  return { ...(ROLE_DEFAULTS[role] ?? STAFF_PERMISSIONS), ...(userPermissions ?? {}) };\n}'
  );
  source = source.replace(
    'const permissions = await resolvePermissions(userRow.role);',
    'const permissions = await resolvePermissions(userRow.role, userRow.permissions);'
  );

  source = source.replace(
    'const { name, role, email, contactNumber, pin, avatarUrl, username: requestedUsername } = req.body as {',
    'const { name, role, email, contactNumber, pin, avatarUrl, username: requestedUsername, permissions: requestedPermissions } = req.body as {'
  );
  source = source.replace(
    'pin?: string; avatarUrl?: string; username?: string;\n  };',
    'pin?: string; avatarUrl?: string; username?: string; permissions?: StaffPermissions;\n  };'
  );
  source = source.replace(
    'const permissions = await resolvePermissions(role);',
    'const permissions = requestedPermissions ?? await resolvePermissions(role);'
  );

  source = source.replace(
    'const { name, role, email, contactNumber, active, avatarUrl, username: requestedUsername } = req.body as {',
    'const { name, role, email, contactNumber, active, avatarUrl, username: requestedUsername, permissions } = req.body as {'
  );
  source = source.replace(
    'active?: boolean; avatarUrl?: string | null; username?: string;\n  };',
    'active?: boolean; avatarUrl?: string | null; username?: string; permissions?: StaffPermissions;\n  };'
  );
  if (!source.includes('if (permissions !== undefined) updates.permissions = permissions;')) {
    source = source.replace(
      '    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;\n',
      '    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;\n    if (permissions !== undefined) updates.permissions = permissions;\n'
    );
  }
  return source;
}

function patchApp(source) {
  if (!source.includes('import StaffAccess from "./pages/staff/Access";')) {
    source = replaceOnce(
      source,
      'import StaffSettings from "./pages/staff/Settings";',
      'import StaffSettings from "./pages/staff/Settings";\nimport StaffAccess from "./pages/staff/Access";',
      "Staff Access import"
    );
  }
  if (!source.includes('path="/settings/staff-access"')) {
    source = replaceOnce(
      source,
      '<Route path="/staff/settings" element={<ProtectedRoute><StaffSettings /></ProtectedRoute>} />',
      '<Route path="/staff/settings" element={<ProtectedRoute><StaffSettings /></ProtectedRoute>} />\n                    <Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><StaffAccess /></OwnerRoute></ProtectedRoute>} />',
      "Staff Access route"
    );
  }
  return source;
}

const accessPage = `import { useEffect, useMemo, useState } from "react";
import type { StaffPermissions } from "../../../shared/schema";

const PERMISSIONS: Array<{ key: keyof StaffPermissions; label: string; group: string }> = [
  { key: "dashboard.view", label: "Dashboard", group: "General" },
  { key: "operations.view", label: "Operations", group: "General" },
  { key: "forms.daily_sales", label: "Daily Sales Form", group: "Daily Workflow" },
  { key: "forms.daily_cleaning", label: "Daily Cleaning Form", group: "Daily Workflow" },
  { key: "forms.daily_stock", label: "Daily Stock Form", group: "Daily Workflow" },
  { key: "purchasing.view", label: "Purchasing", group: "Operations" },
  { key: "analysis.view", label: "Analysis & Reports", group: "Operations" },
  { key: "finance.view", label: "Finance", group: "Business" },
  { key: "expenses.view", label: "Expenses", group: "Business" },
  { key: "menu.view", label: "Menu", group: "Business" },
  { key: "pos.view", label: "POS", group: "Business" },
  { key: "membership.view", label: "Membership", group: "Business" },
  { key: "online_ordering_admin.view", label: "Online Ordering Admin", group: "Administration" },
  { key: "website_admin.view", label: "Website Admin", group: "Administration" },
  { key: "settings.view", label: "Settings", group: "Administration" },
  { key: "staff_access.manage", label: "Manage Staff Access", group: "Administration" },
];

type Staff = { id: number; name: string; role: string; username?: string | null; active: boolean; permissions: StaffPermissions };

export default function StaffAccess() {
  const [users, setUsers] = useState<Staff[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<StaffPermissions>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/pin-auth/staff", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load staff access");
    const data = await res.json();
    setUsers(data.users ?? []);
    if (!selectedId && data.users?.length) setSelectedId(data.users[0].id);
  }

  useEffect(() => { load().catch((e) => setMessage(e.message)); }, []);
  const selected = useMemo(() => users.find((u) => u.id === selectedId) ?? null, [users, selectedId]);
  useEffect(() => { setDraft(selected?.permissions ?? {}); setMessage(""); }, [selectedId, selected]);

  async function save() {
    if (!selected) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(\`/api/pin-auth/staff/\${selected.id}\`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save permissions");
      setMessage("Permissions saved. Staff must sign out and sign in again.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Failed to save permissions"); }
    finally { setSaving(false); }
  }

  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];
  return <div className="p-4 max-w-5xl mx-auto space-y-5">
    <div><h1 className="text-xl font-bold">Staff Access & Permissions</h1><p className="text-sm text-slate-500">Select exactly what each staff member can access.</p></div>
    <div className="grid md:grid-cols-[240px_1fr] gap-4">
      <div className="border rounded-xl bg-white overflow-hidden">
        {users.map((u) => <button key={u.id} onClick={() => setSelectedId(u.id)} className={\`w-full text-left px-4 py-3 border-b last:border-b-0 \${selectedId === u.id ? "bg-yellow-100" : "hover:bg-slate-50"}\`}>
          <div className="font-semibold text-sm">{u.name}</div><div className="text-xs text-slate-500">{u.role}{u.active ? "" : " · Inactive"}</div>
        </button>)}
      </div>
      <div className="border rounded-xl bg-white p-4 space-y-5">
        {!selected ? <p className="text-sm text-slate-500">Select a staff member.</p> : <>
          <div><h2 className="font-bold">{selected.name}</h2><p className="text-xs text-slate-500">Role: {selected.role}</p></div>
          {groups.map((group) => <section key={group}><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{group}</h3><div className="grid sm:grid-cols-2 gap-2">
            {PERMISSIONS.filter((p) => p.group === group).map((p) => <label key={p.key} className="flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={draft[p.key] === true} onChange={(e) => setDraft({ ...draft, [p.key]: e.target.checked })} className="h-4 w-4" />
              <span className="text-sm">{p.label}</span>
            </label>)}
          </div></section>)}
          <div className="flex items-center gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-black text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{saving ? "Saving..." : "Save Permissions"}</button>{message && <span className="text-sm text-slate-600">{message}</span>}</div>
        </>}
      </div>
    </div>
  </div>;
}
`;

let schema = addPermissionKey(read("shared/schema.ts"));
write("shared/schema.ts", schema);
write("server/routes/pinAuth.ts", patchPinAuth(read("server/routes/pinAuth.ts")));
write("client/src/App.tsx", patchApp(read("client/src/App.tsx")));
ensureDir("client/src/pages/staff/Access.tsx");
write("client/src/pages/staff/Access.tsx", accessPage);

console.log("Staff permissions hotfix applied successfully.");
