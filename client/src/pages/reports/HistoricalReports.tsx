import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/ui/sbb-cards";

type Row={paymentMethod:string;orderMode:string;receiptCount:number;total:number};
type Data={ok:boolean;paymentMix:Row[];summary:{grossSales:number;receiptCount:number}};
const money=(v:number)=>`฿${Number(v||0).toLocaleString("en-US",{maximumFractionDigits:2})}`;
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)};
const label=(r:Row)=>r.orderMode==="grab"||r.paymentMethod==="grab"?"GrabFood":r.paymentMethod==="cash"?"Cash":r.paymentMethod==="manual_qr_transfer"?"QR / Scan":r.paymentMethod||"Other";

export default function PaymentTypesReport(){
 const [fromDate,setFromDate]=useState(yesterday()),[fromTime,setFromTime]=useState("17:00"),[toDate,setToDate]=useState(today()),[toTime,setToTime]=useState("03:00");
 const params=useMemo(()=>new URLSearchParams({fromDate,fromTime,toDate,toTime}).toString(),[fromDate,fromTime,toDate,toTime]);
 const {data,isLoading,isError}=useQuery<Data>({queryKey:["pos-payment-types",params],queryFn:async()=>{const r=await fetch(`/api/reports/receipt-analytics?${params}`,{credentials:"include",cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}});
 return <div className="mx-auto max-w-5xl space-y-5"><PageTitle title="Sales by Payment Type" meta="SBB POS payments · no Loyverse dependency" />
 <div className="rounded-2xl border bg-white p-4"><div className="grid gap-3 md:grid-cols-4"><label className="text-xs font-bold">From date<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="text-xs font-bold">From time<input type="time" value={fromTime} onChange={e=>setFromTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="text-xs font-bold">To date<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label><label className="text-xs font-bold">To time<input type="time" value={toTime} onChange={e=>setToTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label></div></div>
 {isLoading&&<div className="rounded-2xl border bg-white p-8 text-center text-sm">Loading payments…</div>}{isError&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">Could not load payment data.</div>}
 {data?.ok&&<><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Receipts</p><p className="text-xl font-black">{data.summary.receiptCount}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Sales</p><p className="text-xl font-black">{money(data.summary.grossSales)}</p></div></div><div className="overflow-hidden rounded-2xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Payment Type</th><th className="px-4 py-3 text-right">Receipts</th><th className="px-4 py-3 text-right">Sales</th></tr></thead><tbody className="divide-y">{data.paymentMix.map((r,i)=><tr key={i}><td className="px-4 py-3 font-bold">{label(r)}</td><td className="px-4 py-3 text-right">{r.receiptCount}</td><td className="px-4 py-3 text-right font-black">{money(r.total)}</td></tr>)}</tbody></table></div></>}
 </div>
}
