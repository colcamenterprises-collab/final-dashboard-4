import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KeyRound, Plus, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type User = { id:number; name:string; username:string|null; role:string; email:string|null; contactNumber:string|null; active:boolean };
type Form = { name:string; username:string; role:string; password:string; email:string; contactNumber:string };
const empty: Form = { name:"", username:"", role:"staff", password:"", email:"", contactNumber:"" };

async function api(path:string, options:RequestInit={}) {
  const response = await fetch(path, { credentials:"include", headers:{ "Content-Type":"application/json", ...(options.headers||{}) }, ...options });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function StaffAccess() {
  const [form,setForm]=useState<Form>(empty);
  const [showCreate,setShowCreate]=useState(false);
  const [resetFor,setResetFor]=useState<User|null>(null);
  const [newPassword,setNewPassword]=useState("");
  const [message,setMessage]=useState("");

  const usersQuery=useQuery<{users:User[]}>({queryKey:["pin-auth-staff"],queryFn:()=>api("/api/pin-auth/staff")});
  const users=usersQuery.data?.users||[];
  const owners=useMemo(()=>users.filter(u=>u.role==="owner"&&u.active),[users]);

  const create=useMutation({
    mutationFn:()=>api("/api/pin-auth/staff",{method:"POST",body:JSON.stringify({...form,pin:form.password})}),
    onSuccess:(data)=>{setForm(empty);setShowCreate(false);setMessage("Access created for "+data.user.username);queryClient.invalidateQueries({queryKey:["pin-auth-staff"]});},
    onError:(e:Error)=>setMessage(e.message)
  });
  const toggle=useMutation({
    mutationFn:(u:User)=>api("/api/pin-auth/staff/"+u.id,{method:"PUT",body:JSON.stringify({active:!u.active})}),
    onSuccess:()=>{setMessage("Access updated");queryClient.invalidateQueries({queryKey:["pin-auth-staff"]});},
    onError:(e:Error)=>setMessage(e.message)
  });
  const reset=useMutation({
    mutationFn:()=>api("/api/pin-auth/staff/"+resetFor!.id+"/pin",{method:"PATCH",body:JSON.stringify({pin:newPassword})}),
    onSuccess:()=>{setMessage("Password / PIN reset");setResetFor(null);setNewPassword("");},
    onError:(e:Error)=>setMessage(e.message)
  });

  return <div className="mx-auto max-w-5xl space-y-6 p-2 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7"/><h1 className="text-3xl font-black">Staff Access</h1></div><p className="mt-1 text-sm text-slate-500">Manage dashboard usernames, passwords/PINs, roles and active access.</p></div>
      <button onClick={()=>setShowCreate(v=>!v)} className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4"/>Add login</button>
    </div>

    {message&&<div className="rounded-xl border bg-white px-4 py-3 text-sm">{message}<button className="float-right text-slate-400" onClick={()=>setMessage("")}>×</button></div>}
    {owners.length===0&&<div className="rounded-xl border border-red-300 bg-red-50 p-4 font-bold text-red-800">No active owner account is visible. Do not deactivate the final owner.</div>}

    {showCreate&&<div className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <input className="rounded-lg border p-3" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="rounded-lg border p-3" placeholder="Username (optional; generated if blank)" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/>
      <select className="rounded-lg border p-3" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="staff">Staff</option><option value="cashier">Cashier</option><option value="kitchen_staff">Kitchen staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select>
      <input type="password" autoComplete="new-password" className="rounded-lg border p-3" placeholder="Password / PIN (4–72 characters)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
      <input type="email" className="rounded-lg border p-3" placeholder="Email (optional)" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
      <input className="rounded-lg border p-3" placeholder="Contact number (optional)" value={form.contactNumber} onChange={e=>setForm({...form,contactNumber:e.target.value})}/>
      <button disabled={!form.name||form.password.length<4||create.isPending} onClick={()=>create.mutate()} className="rounded-xl bg-[#FFD400] p-3 font-black disabled:opacity-40 md:col-span-2">{create.isPending?"Creating…":"Create access"}</button>
    </div>}

    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Staff member</th><th className="p-4">Username</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
      <tbody className="divide-y">{users.map(u=><tr key={u.id}><td className="p-4 font-bold">{u.name}</td><td className="p-4 font-mono">{u.username||"Not assigned"}</td><td className="p-4 capitalize">{u.role.replace("_"," ")}</td><td className="p-4">{u.active?<span className="text-emerald-700">Active</span>:<span className="text-red-600">Disabled</span>}</td><td className="p-4"><div className="flex justify-end gap-2"><button onClick={()=>{setResetFor(u);setNewPassword("")}} className="flex items-center gap-1 rounded-lg border px-3 py-2"><KeyRound className="h-4 w-4"/>Reset</button><button disabled={u.role==="owner"&&u.active&&owners.length===1} onClick={()=>toggle.mutate(u)} className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-30">{u.active?<UserX className="h-4 w-4"/>:<UserCheck className="h-4 w-4"/>}{u.active?"Disable":"Enable"}</button></div></td></tr>)}</tbody></table>
      {usersQuery.isLoading&&<div className="p-10 text-center text-slate-500">Loading access accounts…</div>}
      {usersQuery.isError&&<div className="p-10 text-center text-red-600">{(usersQuery.error as Error).message}</div>}
    </div>

    {resetFor&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-black">Reset access for {resetFor.name}</h2><p className="mt-1 text-sm text-slate-500">Username: {resetFor.username}</p><input autoFocus type="password" autoComplete="new-password" className="mt-5 w-full rounded-lg border p-3" placeholder="New password / PIN" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border px-4 py-2" onClick={()=>setResetFor(null)}>Cancel</button><button disabled={newPassword.length<4||reset.isPending} className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 font-bold text-white disabled:opacity-40" onClick={()=>reset.mutate()}><RefreshCw className="h-4 w-4"/>Reset</button></div></div></div>}
  </div>;
}
