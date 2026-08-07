import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type Row={key:string;label:string;pos:number;dailySales:number|null;delta:number|null;status:"match"|"flag"|"missing"};
type Data={ok:boolean;message?:string;shift?:{id:string;staff_name:string;shift_date:string;opened_at:string;closed_at?:string|null;starting_float:number;receiptCount:number;totalSales:number};dailySales?:{id:string;completed_by:string;shift_date:string}|null;rows:Row[];allMatched?:boolean;filters?:{windowStart:string;windowEnd:string;timezone:string}};
const money=(v:number|null)=>v==null?"—":`฿${Number(v).toLocaleString("en-US",{maximumFractionDigits:2})}`;
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export default function ShiftReviewReport(){
  const [mode,setMode]=useState<"last_completed_shift"|"current_shift"|"shift_date">("last_completed_shift");
  const [date,setDate]=useState(today());
  const params=useMemo(()=>{const p=new URLSearchParams();if(mode==="shift_date"){p.set("mode","custom");p.set("shiftStartDate",date)}else p.set("mode",mode);return p.toString()},[mode,date]);
  const {data,isLoading,isError}=useQuery<Data>({queryKey:["shift-review-report",params],queryFn:async()=>{const r=await fetch(`/api/reports/receipt-analytics/shift-review?${params}`,{credentials:"include",cache:"no-store"});const b=await r.json();if(!r.ok)throw new Error(b.error||`HTTP ${r.status}`);return b}});
  return <div className="mx-auto max-w-6xl space-y-5">
    <PageTitle title="Shift Review" meta="SBB POS source of truth vs Daily Sales V2 staff form" />
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>setMode("last_completed_shift")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${mode==="last_completed_shift"?"bg-black text-white":"bg-white"}`}>Last Completed Shift</button>
        <button onClick={()=>setMode("current_shift")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${mode==="current_shift"?"bg-black text-white":"bg-white"}`}>Current Shift</button>
        <button onClick={()=>setMode("shift_date")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${mode==="shift_date"?"bg-black text-white":"bg-white"}`}>Shift Date</button>
        {mode==="shift_date"&&<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/>}
      </div>
    </div>
    {isLoading&&<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading shift comparison…</div>}
    {isError&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load shift comparison.</div>}
    {!isLoading&&!isError&&data&&!data.ok&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.message||"No shift found."}</div>}
    {data?.ok&&<>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Shift Date</p><p className="mt-1 text-xl font-black">{data.shift?.shift_date}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">POS Receipts</p><p className="mt-1 text-xl font-black">{data.shift?.receiptCount||0}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">POS Sales</p><p className="mt-1 text-xl font-black">{money(data.shift?.totalSales||0)}</p></div>
      </div>
      <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${data.allMatched?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-amber-200 bg-amber-50 text-amber-900"}`}>{data.allMatched?"POS and Daily Sales V2 match for all compared fields.":"One or more fields require review."}</div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Measure</th><th className="px-4 py-3 text-right">POS Shift</th><th className="px-4 py-3 text-right">Daily Sales V2</th><th className="px-4 py-3 text-right">Difference</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{data.rows.map(r=><tr key={r.key} className={r.status==="flag"?"bg-red-50":""}><td className="px-4 py-4 font-bold">{r.label}</td><td className="px-4 py-4 text-right font-semibold">{money(r.pos)}</td><td className="px-4 py-4 text-right">{money(r.dailySales)}</td><td className={`px-4 py-4 text-right font-bold ${r.status==="flag"?"text-red-700":""}`}>{money(r.delta)}</td><td className="px-4 py-4 text-center">{r.status==="match"?<CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600"/>:r.status==="flag"?<AlertTriangle className="mx-auto h-5 w-5 text-red-600"/>:<MinusCircle className="mx-auto h-5 w-5 text-amber-600"/>}</td></tr>)}</tbody></table>
        {!data.dailySales&&<div className="border-t border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">No Daily Sales V2 form exists for this shift date yet. POS values remain the reporting source of truth.</div>}
      </div>
    </>}
  </div>
}
