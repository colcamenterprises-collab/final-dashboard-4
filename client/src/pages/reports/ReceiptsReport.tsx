import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { ExactDateTimeRange, reportingRangeParams, type ExactDateTimeRangeValue } from "@/components/reports/ExactDateTimeRange";
import { PageTitle } from "@/components/ui/sbb-cards";
import GrabCampaignPanel, { useGrabCampaigns, type GrabCampaign } from "@/components/reports/GrabCampaignPanel";

type Receipt = { id:string; occurred_at:string; source_system:"loyverse"|"sbb_pos"|string; receipt_number:string; grab_order_number?:string|null; channel?:string; order_mode?:string; payment_status?:string; subtotal:number; discount_total:number; refund_total:number; net_sales:number; total:number; staff_name?:string };
type ReceiptModifier = { group?:string; name:string; quantity:number; priceDelta:number; revenue:number };
type ReceiptItem = { id:string; name:string; sku?:string; category?:string; quantity:number; unitPrice?:number; grossSales:number; discounts:number; refunds:number; netSales:number; costOfGoods?:number|null; grossProfit?:number|null; isSetComponent?:boolean; isSetProduct?:boolean; notes?:string; modifiers:ReceiptModifier[] };
type ReceiptPayment = { method:string; amount:number; paidAt?:string };
type ReceiptDetail = Receipt & { sourceSystem:string; items:ReceiptItem[]; payments:ReceiptPayment[]; tax_total?:number };
type Data = { ok:boolean; source:string; filters:ExactDateTimeRangeValue & {fromInstant:string;toInstant:string}; receipts:Receipt[]; error?:string };
type GrabReferenceData = { ok:boolean; references:{id:string;grab_order_number?:string|null}[]; error?:string };
type DetailResponse = { ok:boolean; receipt:ReceiptDetail; error?:string };

const money=(value:number|null|undefined)=>value==null?"—":`฿${Number(value||0).toLocaleString("en-US",{maximumFractionDigits:2})}`;
const stamp=(value:string)=>value?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(value)):"";
const csvDate=(value:string)=>value?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)):"";
const csvTime=(value:string)=>value?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(value)):"";
const csvCell=(value:unknown)=>`"${String(value??"").replace(/"/g,'""')}"`;
const csvNumber=(value:number|null|undefined)=>value==null?"":Number(value||0).toFixed(2);
const isGrabReceipt=(row:Receipt)=>String(row.order_mode||"").toLowerCase()==="grab"||String(row.channel||"").toLowerCase()==="grab";
const reconciliationStatus=(row:Receipt)=>isGrabReceipt(row)?(row.grab_order_number?"MATCHABLE":"MISSING GF REFERENCE"):"NOT GRAB";
function localDate(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}

async function fetchReceiptDetail(receipt:Receipt):Promise<ReceiptDetail>{
  const response=await fetch(`/api/reports/receipt-analytics/unified/receipts/${encodeURIComponent(receipt.source_system)}/${encodeURIComponent(receipt.id)}`,{credentials:"include",cache:"no-store"});
  const body:DetailResponse=await response.json();
  if(!response.ok||!body.ok||!body.receipt)throw new Error(body.error||`Unable to load receipt ${receipt.receipt_number} (HTTP ${response.status})`);
  return {...body.receipt,grab_order_number:receipt.grab_order_number||body.receipt.grab_order_number||null};
}

function downloadCsv(filename:string, headers:string[], body:(string|number|boolean)[][]){
  const csv="\uFEFF"+[headers,...body].map(line=>line.map(csvCell).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function campaignForItem(item:ReceiptItem, occurredAt:string, campaigns:GrabCampaign[]){
  const at=new Date(occurredAt).getTime();
  const name=String(item.name||"").toLowerCase();
  return campaigns.find(campaign=>campaign.active&&at>=new Date(campaign.startsAt).getTime()&&at<new Date(campaign.endsAt).getTime()&&name.includes(campaign.itemNameMatch.toLowerCase()));
}

function campaignAdjustment(receipt:ReceiptDetail,campaigns:GrabCampaign[]){
  if(!isGrabReceipt(receipt))return {discount:0,names:[] as string[],expected:Number(receipt.total||0)};
  let discount=0;
  const names=new Set<string>();
  for(const item of receipt.items||[]){
    if(item.isSetComponent)continue;
    const campaign=campaignForItem(item,receipt.occurred_at,campaigns);
    if(!campaign)continue;
    const gross=Number(item.grossSales||0);
    const quantity=Math.max(1,Number(item.quantity||1));
    const value=campaign.discountType==="percent"?gross*(Number(campaign.discountValue||0)/100):Math.min(gross,Number(campaign.discountValue||0)*quantity);
    discount+=value;
    names.add(campaign.name);
  }
  discount=Math.round(discount*100)/100;
  return {discount,names:[...names],expected:Math.max(0,Math.round((Number(receipt.total||0)-discount)*100)/100)};
}

function itemSummary(receipt:ReceiptDetail){
  return (receipt.items||[]).filter(item=>!item.isSetComponent).map(item=>{
    const mods=(item.modifiers||[]).filter(mod=>String(mod.group||"").toUpperCase()!=="SET UPGRADE").map(mod=>mod.name).join(" + ");
    return `${Number(item.quantity||0)}x ${item.name}${mods?` (${mods})`:""}${item.isSetProduct?" [SET]":""}`;
  }).join("; ");
}

function ReceiptDetails({receipt}:{receipt:Receipt}){
  const detail=useQuery<DetailResponse>({queryKey:["unified-receipt-detail",receipt.source_system,receipt.id],queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/unified/receipts/${encodeURIComponent(receipt.source_system)}/${encodeURIComponent(receipt.id)}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}});
  if(detail.isLoading)return <div className="p-4 text-xs text-slate-500">Loading receipt details…</div>;
  if(detail.isError)return <div className="p-4 text-xs font-semibold text-red-700">{(detail.error as Error).message}</div>;
  const row=detail.data?.receipt;if(!row)return null;
  return <div className="space-y-4 bg-slate-50 p-4">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs"><div><strong>Staff:</strong> {row.staff_name||"—"}</div><div><strong>Channel:</strong> {row.channel||row.order_mode||"—"}</div><div><strong>Grab order:</strong> {receipt.grab_order_number||"—"}</div><div><strong>Subtotal:</strong> {money(row.subtotal)}</div><div><strong>Total:</strong> {money(row.total)}</div></div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-100 text-slate-500"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Category / SKU</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Gross</th><th className="px-3 py-2 text-right">Discount</th><th className="px-3 py-2 text-right">Refund</th><th className="px-3 py-2 text-right">Net</th></tr></thead><tbody className="divide-y">{(row.items||[]).map(item=><tr key={item.id}><td className="px-3 py-3"><div className="font-bold">{item.name}{item.isSetProduct?" · Set product":""}{item.isSetComponent?" · Set component":""}</div>{item.notes?<div className="mt-1 text-amber-700">Note: {item.notes}</div>:null}{(item.modifiers||[]).map((modifier,index)=><div key={`${modifier.name}-${index}`} className="mt-1 text-emerald-700">+ {modifier.name}{modifier.group?` · ${modifier.group}`:""}{Number(modifier.priceDelta||0)!==0?` · ${money(modifier.priceDelta)}`:""}</div>)}</td><td className="px-3 py-3 text-slate-500">{item.category||"—"}{item.sku?` · ${item.sku}`:""}</td><td className="px-3 py-3 text-right">{Number(item.quantity||0).toLocaleString()}</td><td className="px-3 py-3 text-right">{money(item.grossSales)}</td><td className="px-3 py-3 text-right">{money(item.discounts)}</td><td className="px-3 py-3 text-right">{money(item.refunds)}</td><td className="px-3 py-3 text-right font-bold">{money(item.netSales)}</td></tr>)}</tbody></table></div>
    <div className="rounded-xl border bg-white p-3 text-xs"><strong>Payments:</strong> {(row.payments||[]).length?(row.payments||[]).map((payment,index)=><span key={`${payment.method}-${index}`} className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-1">{payment.method} · {money(payment.amount)}</span>):<span className="ml-2 text-slate-500">No payment allocation recorded</span>}</div>
  </div>;
}

export default function ReceiptsReport(){
  const[range,setRange]=useState<ExactDateTimeRangeValue>({fromDate:localDate(-1),fromTime:"17:00",toDate:localDate(),toTime:"03:00",timezone:"Asia/Bangkok"});
  const[search,setSearch]=useState("");
  const[expanded,setExpanded]=useState<string|null>(null);
  const[exporting,setExporting]=useState<"summary"|"items"|null>(null);
  const[exportError,setExportError]=useState<string|null>(null);
  const params=useMemo(()=>reportingRangeParams(range),[range]);
  const query=useQuery<Data>({queryKey:["unified-receipts",params],queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/unified/receipts?${params}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}});
  const grabReferences=useQuery<GrabReferenceData>({queryKey:["receipt-grab-references",params],queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/grab-references?${params}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}});
  const campaigns=useGrabCampaigns();
  const receipts=useMemo(()=>{const refs=new Map((grabReferences.data?.references||[]).map(row=>[String(row.id),row.grab_order_number||null]));return(query.data?.receipts||[]).map(row=>row.source_system==="sbb_pos"?{...row,grab_order_number:refs.get(String(row.id))||null}:row);},[query.data,grabReferences.data]);
  const rows=useMemo(()=>{const q=search.trim().toLowerCase();return receipts.filter(row=>!q||[row.receipt_number,row.grab_order_number,row.source_system,row.channel,row.order_mode,row.payment_status,row.staff_name,reconciliationStatus(row)].some(value=>String(value||"").toLowerCase().includes(q)));},[receipts,search]);
  const summary=useMemo(()=>({receipts:rows.length,total:rows.reduce((sum,row)=>sum+Number(row.total||0),0),net:rows.reduce((sum,row)=>sum+Number(row.net_sales||0),0),refunds:rows.reduce((sum,row)=>sum+Number(row.refund_total||0),0)}),[rows]);

  const exportSummary=async()=>{
    if(exporting||!rows.length)return;
    setExporting("summary");setExportError(null);
    try{
      const details=await Promise.all(rows.map(fetchReceiptDetail));
      const activeCampaigns=campaigns.data?.campaigns||[];
      const headers=["Date","Time","Receipt Number","Grab Order Number","Channel","Items Ordered","POS Gross THB","Marketing Discount THB","Expected Grab Gross THB","Campaign","Payment Method","Payment Status","Reconciliation Status"];
      const body=details.map(receipt=>{const adjustment=campaignAdjustment(receipt,activeCampaigns);return [csvDate(receipt.occurred_at),csvTime(receipt.occurred_at),receipt.receipt_number,receipt.grab_order_number||"",receipt.channel||receipt.order_mode||"",itemSummary(receipt),csvNumber(receipt.total),csvNumber(adjustment.discount),csvNumber(adjustment.expected),adjustment.names.join(" | "),(receipt.payments||[]).map(payment=>payment.method).join(" | "),receipt.payment_status||"",reconciliationStatus(receipt)];});
      downloadCsv(`sbb-receipts-summary-${range.fromDate}-${range.toDate}.csv`,headers,body);
    }catch(error){setExportError(error instanceof Error?error.message:"Receipt summary export failed");}finally{setExporting(null);}
  };

  const exportItems=async()=>{
    if(exporting||!rows.length)return;
    setExporting("items");setExportError(null);
    try{
      const details=await Promise.all(rows.map(fetchReceiptDetail));
      const headers=["Date","Time","Receipt Number","Grab Order Number","Source","Channel","Payment Status","Staff","Item Name","SKU","Category","Qty","Unit Price THB","Item Gross THB","Item Net THB","Set Product","Set Component","Notes","Modifiers","Modifier Prices THB","Payment Methods","Receipt Subtotal THB","Receipt Total THB","Record ID","Item Record ID"];
      const body:(string|number|boolean)[][]=[];
      for(const receipt of details){
        const base=[csvDate(receipt.occurred_at),csvTime(receipt.occurred_at),receipt.receipt_number,receipt.grab_order_number||"",receipt.source_system,receipt.channel||receipt.order_mode||"",receipt.payment_status||"",receipt.staff_name||""];
        const payments=(receipt.payments||[]).map(payment=>payment.method).join(" | ");
        const items=receipt.items||[];
        if(!items.length){body.push([...base,"","","","","","",false,false,"","","",payments,csvNumber(receipt.subtotal),csvNumber(receipt.total),receipt.id,""]);continue;}
        for(const item of items){body.push([...base,item.name||"",item.sku||"",item.category||"",Number(item.quantity||0),csvNumber(item.unitPrice),csvNumber(item.grossSales),csvNumber(item.netSales),Boolean(item.isSetProduct),Boolean(item.isSetComponent),item.notes||"",(item.modifiers||[]).map(mod=>mod.name).join(" | "),(item.modifiers||[]).map(mod=>csvNumber(mod.priceDelta)).join(" | "),payments,csvNumber(receipt.subtotal),csvNumber(receipt.total),receipt.id,item.id||""]);}
      }
      downloadCsv(`sbb-receipts-line-items-${range.fromDate}-${range.toDate}.csv`,headers,body);
    }catch(error){setExportError(error instanceof Error?error.message:"Receipt line-item export failed");}finally{setExporting(null);}
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <PageTitle title="Receipts" meta="Permanent transaction ledger · historical + live POS · Asia/Bangkok"/>
    <ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok"/>
    <GrabCampaignPanel/>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search receipt, GF order, source, channel or staff…" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"/></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={exportSummary} disabled={!rows.length||query.isLoading||Boolean(exporting)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40"><Download className="h-4 w-4"/>{exporting==="summary"?"Exporting…":"Receipt Summary CSV"}</button><button type="button" onClick={exportItems} disabled={!rows.length||query.isLoading||Boolean(exporting)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 disabled:opacity-40"><Download className="h-4 w-4"/>{exporting==="items"?"Exporting…":"Line Items CSV"}</button></div>
      </div>
      {grabReferences.isError?<p className="mt-3 text-xs font-semibold text-amber-700">Grab order references unavailable: {(grabReferences.error as Error).message}</p>:null}{campaigns.isError?<p className="mt-3 text-xs font-semibold text-amber-700">Campaign adjustments unavailable: {(campaigns.error as Error).message}</p>:null}{exportError?<p className="mt-3 text-xs font-semibold text-red-700">CSV export failed: {exportError}</p>:null}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Receipts</p><p className="mt-1 text-xl font-black">{summary.receipts}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Receipt total</p><p className="mt-1 text-xl font-black">{money(summary.total)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Net sales</p><p className="mt-1 text-xl font-black">{money(summary.net)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Refunds</p><p className="mt-1 text-xl font-black">{money(summary.refunds)}</p></div></div>
    {query.isLoading&&<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading receipts…</div>}{query.isError&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{(query.error as Error).message}</div>}{!query.isLoading&&!query.isError&&rows.length===0&&<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">No receipts found in this exact date/time range.</div>}
    {rows.length>0&&<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1160px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="w-10 px-2 py-3"/><th className="px-4 py-3 text-left">Receipt</th><th className="px-4 py-3 text-left">Grab order</th><th className="px-4 py-3 text-left">Reconciliation</th><th className="px-4 py-3 text-left">Date / time</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-left">Channel</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Net sales</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row=>{const key=`${row.source_system}-${row.id}`;const open=expanded===key;return <><tr key={key} className="hover:bg-slate-50"><td className="px-2 py-3"><button onClick={()=>setExpanded(open?null:key)} className="rounded-lg p-1 hover:bg-slate-100">{open?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}</button></td><td className="px-4 py-3 font-black">{row.receipt_number}</td><td className="px-4 py-3 font-bold">{row.grab_order_number||"—"}</td><td className="px-4 py-3 text-xs font-bold">{reconciliationStatus(row)}</td><td className="px-4 py-3">{stamp(row.occurred_at)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase">{row.source_system==="sbb_pos"?"SBB POS":row.source_system}</span></td><td className="px-4 py-3">{row.channel||row.order_mode||"—"}</td><td className="px-4 py-3 text-right font-black">{money(row.total)}</td><td className="px-4 py-3 text-right font-black">{money(row.net_sales)}</td></tr>{open?<tr key={`${key}-detail`}><td colSpan={9} className="p-0"><ReceiptDetails receipt={row}/></td></tr>:null}</>;})}</tbody></table></div></div>}
  </div>;
}
