import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root,p)), { recursive: true }); fs.writeFileSync(path.join(root,p), s); };

const page = `import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Staff = { id:number; name:string; username?:string|null; role:string; active:boolean; permissions?:Record<string,boolean> };
const GROUPS = [
  { title:"Daily Workflow", items:[
    ["forms.daily_sales","Daily Sales — Form 1"],
    ["forms.daily_cleaning","Daily Cleaning — Form 2"],
    ["forms.daily_stock","Daily Stock — Form 3"],
  ]},
  { title:"Operations", items:[
    ["operations.view","Operations"],["purchasing.view","Purchasing"],["inventory.view","Inventory"],["waste.view","Waste"],
  ]},
  { title:"Reporting", items:[
    ["analysis.view","Reports & Analysis"],["reports.sales.view","Sales Reports"],["reports.receipts.view","Receipt History"],["reports.items.view","Sales by Item"],
  ]},
  { title:"Finance", items:[
    ["finance.view","Finance"],["expenses.view","Expenses"],["banking.view","Banking & Reconciliation"],
  ]},
  { title:"Menu", items:[
    ["menu.view","Products"],["menu.recipes.view","Recipes & Costing"],["menu.modifiers.view","Modifier Library"],["menu.categories.view","Categories"],
  ]},
  { title:"POS", items:[
    ["pos.view","Register POS"],["pos.kitchen.view","Kitchen Display"],["pos.customer_display.view","Customer Display"],["pos.printers.view","Printer Settings"],
  ]},
  { title:"Orders", items:[
    ["online_ordering_admin.view","Orders"],["ordering.channels.view","Ordering Channels / QR"],
  ]},
  { title:"Human Resources & Administration", items:[
    ["staff.view","Staff"],["roster.view","Rosters"],["settings.view","Settings"],["staff_access.manage","Staff Access & Permissions"],["website_admin.view","Website Admin"],
  ]},
];

export default function RolesPermissions() {
  const [users,setUsers]=useState<Staff[]>([]); const [selectedId,setSelectedId]=useState<number|null>(null);
  const [draft,setDraft]=useState<Record<string,boolean>>({}); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
  async function load(){ const r=await fetch('/api/pin-auth/staff',{credentials:'include'}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not load staff'); setUsers(d.users||[]); if(!selectedId&&d.users?.length)setSelectedId(d.users[0].id); }
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  const selected=useMemo(()=>users.find(u=>u.id===selectedId)||null,[users,selectedId]);
  useEffect(()=>{setDraft(selected?.permissions||{});setMessage('');},[selectedId,selected]);
  async function save(){ if(!selected)return; setSaving(true);setMessage(''); try{ const r=await fetch('/api/pin-auth/staff/'+selected.id,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({permissions:draft})}); const d=await r.json().catch(()=>({})); if(!r.ok)throw new Error(d.error||'Could not save permissions'); setMessage('Permissions saved. Staff must sign out and sign in again.'); await load(); }catch(e){setMessage(e instanceof Error?e.message:'Could not save permissions');}finally{setSaving(false);} }
  return <div className="mx-auto max-w-6xl space-y-5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Staff Access & Permissions</h1><p className="text-sm text-slate-500">Control exactly what each staff member can see and use.</p></div><Link to="/settings/staff-logins" className="rounded-lg border px-4 py-2 text-sm font-semibold">Manage Logins</Link></div>
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="overflow-hidden rounded-xl border bg-white">{users.map(u=><button key={u.id} onClick={()=>setSelectedId(u.id)} className={'w-full border-b px-4 py-3 text-left last:border-0 '+(selectedId===u.id?'bg-yellow-100':'hover:bg-slate-50')}><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">{u.role}{u.active?'':' · Inactive'}</div></button>)}</div>
      <div className="space-y-5 rounded-xl border bg-white p-4">{!selected?<p>Select a staff member.</p>:<><div><h2 className="text-lg font-bold">{selected.name}</h2><p className="text-xs text-slate-500">Role: {selected.role}</p></div>{GROUPS.map(g=><section key={g.title}><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</h3><div className="grid gap-2 sm:grid-cols-2">{g.items.map(([key,label])=><label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 hover:bg-slate-50"><input type="checkbox" checked={draft[key]===true} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/><span className="text-sm">{label}</span></label>)}</div></section>)}<div className="flex flex-wrap items-center gap-3 pt-2"><button onClick={save} disabled={saving} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save Permissions'}</button>{message&&<span className="text-sm text-slate-600">{message}</span>}</div></>}</div>
    </div>
  </div>;
}
`;

write('client/src/pages/staff/RolesPermissions.tsx', page);

let app = read('client/src/App.tsx');
if (!app.includes('import RolesPermissions from "./pages/staff/RolesPermissions";')) {
  const importAnchor = app.match(/import .*Staff.* from .*staff.*;\n/i);
  if (!importAnchor) throw new Error('Could not find staff import anchor in App.tsx');
  app = app.replace(importAnchor[0], importAnchor[0] + 'import RolesPermissions from "./pages/staff/RolesPermissions";\n');
}

const routeRx = /<Route\s+path=["']\/settings\/staff-access["']\s+element=\{([\s\S]*?)\}\s*\/>/;
const match = app.match(routeRx);
if (!match) throw new Error('Could not find /settings/staff-access route');
const oldElement = match[1];
const replacement = `<Route path="/settings/staff-access" element={<ProtectedRoute><OwnerRoute><RolesPermissions /></OwnerRoute></ProtectedRoute>} />\n                    <Route path="/settings/staff-logins" element={${oldElement}} />`;
app = app.replace(routeRx, replacement);
write('client/src/App.tsx', app);

console.log('Staff permissions matrix route fixed. Old login management preserved at /settings/staff-logins');
