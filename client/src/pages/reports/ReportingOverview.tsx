import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, Banknote, Clock3, CreditCard, PackageSearch, Receipt, ShoppingBag, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { DateTime } from "luxon";
import { ExactDateTimeRange, reportingRangeParams, type ExactDateTimeRangeValue } from "@/components/reports/ExactDateTimeRange";

const money = (value: number) => `฿${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const compactMoney = (value: number) => value >= 1000 ? `฿${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `฿${value}`;
function localDate(offset = 0) { const date = new Date(); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }

type HourRow={bucketStart:string;orders:number;netSales:number};
type HourlyItemRow={bucketStart:string;quantity:number};
type CategoryRow={category:string;quantity:number;netSales:number};
type ProductRow={itemName:string;quantity:number;netSales:number};
type ProfitabilityCategory={category:string;quantity:number;grossSales:number;discounts:number;netSales:number;costOfGoods:number;costedNetSales:number;uncostedNetSales:number;fullyCosted:boolean;grossProfit:number|null;foodCostPct:number|null;grossMarginPct:number|null;costingCoveragePct:number|null};
type IngredientRow={key:string;name:string;unit:string;expectedQuantity:number;sourceLineCount:number;watched:boolean};
type ReportException={code:string;severity:string;label:string;amount:number|null;count:number;message:string};
type LabourEfficiency={itemCount:number;staffCount:number;shiftCount:number;shiftMinutes:number;grossLabourMinutes:number;breakAllowanceMinutes:number;prepMinutes:number;cleaningMinutes:number;prepAndCleaningMinutes:number;totalAllowanceMinutes:number;availableProductionMinutes:number;availableProductionHours:number;itemsPerLabourHour:number|null;labourMinutesPerItem:number;estimatedWorkloadMinutes:number;utilisationPct:number|null;unoccupiedCapacityMinutes:number;warnings:string[]};
type OverviewResponse = {
  ok:boolean; source:string; filters:ExactDateTimeRangeValue & {fromInstant:string;toInstant:string}; sourcesIncluded:string[];
  overview:{receiptCount:number;grossSales:number;discounts:number;refunds:number;netSales:number;averageOrder:number;historicalReceipts:number;liveReceipts:number;paymentSales:Record<string,number>;costing:{costOfGoods:number;grossProfit:number|null;knownGrossProfit:number;costedNetSales:number;uncostedNetSales:number;uncostedItemCount:number;itemNetSales:number;coveragePct:number|null;fullyCosted:boolean;foodCostPct:number|null;knownFoodCostPct:number|null;grossMarginPct:number|null;knownGrossMarginPct:number|null}};
  labor:{laborCost:number;paidStaffCount:number;staffShiftCount:number;recordedShiftCount:number;laborCostPct:number|null;source:string;demandSource:string;efficiency:LabourEfficiency};
  breakdowns:{daily:Array<{day:string;orders:number;netSales:number}>;hourly:HourRow[];hourlyItems:HourlyItemRow[];categories:CategoryRow[];topProducts:ProductRow[];profitabilityByCategory:ProfitabilityCategory[]};
  ingredientUsage:{ingredients:IngredientRow[];watched:IngredientRow[];coverage:{soldItemQuantity:number;mappedItemQuantity:number;unmappedItemQuantity:number;coveragePct:number|null;snapshotItemQuantity:number;fallbackItemQuantity:number};provenance:{primary:string;fallback:string;scope:string}};
  exceptions:ReportException[]; error?:string;
};

const cardTones = {
  blue: "from-blue-500 to-indigo-600 text-white",
  amber: "from-amber-300 to-orange-400 text-slate-950",
  mint: "from-emerald-300 to-teal-400 text-slate-950",
  violet: "from-violet-400 to-fuchsia-500 text-white",
  light: "from-white to-slate-100 text-slate-950",
  dark: "from-slate-800 to-slate-950 text-white",
};

function MetricCard({label,value,sub,tone="light",icon:Icon}:{label:string;value:string;sub:string;tone?:keyof typeof cardTones;icon:any}) {
  return <article className={`relative min-h-36 overflow-hidden rounded-[28px] bg-gradient-to-br p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)] ${cardTones[tone]}`}>
    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
    <div className="relative flex items-start justify-between"><p className="text-xs font-black uppercase tracking-[.18em] opacity-70">{label}</p><span className="rounded-full bg-black/10 p-2.5"><Icon className="h-4 w-4" /></span></div>
    <p className="relative mt-6 text-3xl font-black tracking-tight">{value}</p><p className="relative mt-2 text-xs font-semibold opacity-65">{sub}</p>
  </article>;
}

function paymentGroup(name:string){const key=name.toLowerCase();if(key.includes("grab"))return"Grab";if(key.includes("scan")||key.includes("prompt")||key.includes("qr"))return"QR";if(key.includes("cash"))return"Cash";if(key.includes("card"))return"Card";if(key.includes("online"))return"Online";return"Other";}
const paymentStyle:Record<string,{icon:any;color:string}>={Cash:{icon:Banknote,color:"bg-emerald-400"},QR:{icon:WalletCards,color:"bg-blue-400"},Grab:{icon:ShoppingBag,color:"bg-lime-300"},Card:{icon:CreditCard,color:"bg-violet-400"},Online:{icon:Sparkles,color:"bg-cyan-300"},Other:{icon:Sparkles,color:"bg-orange-300"}};

function Panel({title,subtitle,children,className=""}:{title:string;subtitle?:string;children:React.ReactNode;className?:string}) { return <section className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)] ${className}`}><div><h2 className="text-base font-black text-slate-950">{title}</h2>{subtitle?<p className="mt-1 text-xs text-slate-500">{subtitle}</p>:null}</div><div className="mt-5">{children}</div></section>; }
function HorizontalBar({label,value,max,meta,color}:{label:string;value:number;max:number;meta:string;color:string}) { const width=max>0?Math.max(3,Math.min(100,value/max*100)):0; return <div className="space-y-2"><div className="flex justify-between gap-3 text-xs"><span className="truncate font-bold text-slate-700">{label}</span><span className="shrink-0 text-slate-500">{meta}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{width:`${width}%`}} /></div></div>; }

function buildHourlySeries(rows:HourRow[], range:OverviewResponse["filters"]) {
  const totals = new Map(rows.map(row => [DateTime.fromISO(row.bucketStart).toUTC().startOf("hour").toISO(), row]));
  const start = DateTime.fromISO(range.fromInstant).toUTC().startOf("hour");
  const end = DateTime.fromISO(range.toInstant).toUTC().startOf("hour");
  const result=[]; let cursor=start;
  while(cursor<=end){const key=cursor.toISO();const row=totals.get(key);result.push({bucketStart:key,label:cursor.setZone(range.timezone).toFormat("ha").toLowerCase(),sales:row?.netSales||0,orders:row?.orders||0});cursor=cursor.plus({hours:1});}
  return result;
}

function buildLabourBuckets(rows:HourlyItemRow[], range:OverviewResponse["filters"], efficiency:LabourEfficiency) {
  const itemTotals=new Map(rows.map(row=>[DateTime.fromISO(row.bucketStart).toUTC().startOf("hour").toISO(),Number(row.quantity||0)]));
  const rangeStart=DateTime.fromISO(range.fromInstant).toUTC();
  const rangeEnd=DateTime.fromISO(range.toInstant).toUTC();
  const grossMinutes=Math.max(0,efficiency.grossLabourMinutes);
  const capacityRatio=grossMinutes>0?Math.max(0,Math.min(1,efficiency.availableProductionMinutes/grossMinutes)):0;
  const result=[]; let cursor=rangeStart.startOf("hour");
  while(cursor<rangeEnd){
    const bucketEnd=cursor.plus({hours:1});
    const overlapStart=cursor<rangeStart?rangeStart:cursor;
    const overlapEnd=bucketEnd>rangeEnd?rangeEnd:bucketEnd;
    const minutes=Math.max(0,overlapEnd.diff(overlapStart,"minutes").minutes);
    if(minutes>0){
      const items=itemTotals.get(cursor.toISO())||0;
      const capacityMinutes=efficiency.staffCount*minutes*capacityRatio;
      const workloadMinutes=items*efficiency.labourMinutesPerItem;
      result.push({label:overlapStart.setZone(range.timezone).toFormat("ha").toLowerCase(),items,utilisationPct:capacityMinutes>0?workloadMinutes/capacityMinutes*100:0});
    }
    cursor=bucketEnd;
  }
  return result;
}

function formatIngredient(row:IngredientRow) {
  const decimals = row.expectedQuantity >= 100 ? 0 : row.expectedQuantity >= 10 ? 1 : 2;
  return `${row.expectedQuantity.toFixed(decimals)} ${row.unit}`;
}

export default function ReportingOverview(){
 const [range,setRange]=useState<ExactDateTimeRangeValue>({fromDate:localDate(-1),fromTime:"17:55",toDate:localDate(),toTime:"02:15",timezone:"Asia/Bangkok"});
 const params=useMemo(()=>reportingRangeParams(range),[range]);
 const query=useQuery<OverviewResponse>({queryKey:["unified-reporting-overview",params],queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/unified/overview?${params}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}});
 const paymentGroups=useMemo(()=>{const grouped:Record<string,number>={Cash:0,QR:0,Grab:0,Online:0,Card:0,Other:0};for(const[name,amount]of Object.entries(query.data?.overview.paymentSales||{}))grouped[paymentGroup(name)]+=Number(amount||0);return grouped;},[query.data]);
 const hourly=useMemo(()=>query.data?buildHourlySeries(query.data.breakdowns.hourly,query.data.filters):[],[query.data]);
 const data=query.data?.overview; const costing=data?.costing; const breakdowns=query.data?.breakdowns; const labor=query.data?.labor; const efficiency=labor?.efficiency;
 const labourHourly=useMemo(()=>query.data&&efficiency?buildLabourBuckets(query.data.breakdowns.hourlyItems,query.data.filters,efficiency):[],[query.data,efficiency]);
 const categoryMax=Math.max(0,...(breakdowns?.profitabilityByCategory||[]).map(row=>row.netSales));
 const productMax=Math.max(0,...(breakdowns?.topProducts||[]).map(row=>row.netSales));
 const watched=(query.data?.ingredientUsage.watched||[]).slice(0,12);
 return <div className="min-h-screen rounded-[32px] bg-slate-50 p-4 text-slate-950 md:p-6">
  <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-black uppercase tracking-[.25em] text-blue-600">Restaurant intelligence</p><h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Reporting Overview</h1><p className="mt-2 text-sm text-slate-500">Sales, profitability and operational exceptions from one trusted ledger.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-sm"><ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok"/></div></header>
  {query.isLoading?<div className="rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-500">Loading reporting data…</div>:null}
  {query.isError?<div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{(query.error as Error).message}</div>:null}
  {data?<>
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
    <MetricCard label="Gross sales" value={money(data.grossSales)} sub="Menu value before adjustments" tone="blue" icon={ArrowUpRight}/>
    <MetricCard label="Discounts" value={money(data.discounts)} sub={`${data.grossSales>0?(data.discounts/data.grossSales*100).toFixed(1):"0.0"}% of gross sales`} tone="light" icon={Sparkles}/>
    <MetricCard label="Net sales" value={money(data.netSales)} sub={`${money(data.refunds)} refunds`} tone="mint" icon={Banknote}/>
    <MetricCard label="COGS" value={costing?.fullyCosted?money(costing.costOfGoods):"—"} sub={costing?.fullyCosted?`${costing.foodCostPct?.toFixed(1) ?? "—"}% food cost`:`${costing?.coveragePct?.toFixed(0) ?? 0}% costing coverage`} tone="amber" icon={PackageSearch}/>
    <MetricCard label="Gross profit" value={costing?.grossProfit==null?"—":money(costing.grossProfit)} sub={costing?.grossMarginPct==null?"Withheld until costing is complete":`${costing.grossMarginPct.toFixed(1)}% gross margin`} tone="dark" icon={ArrowUpRight}/>
    <MetricCard label="Labour" value={labor?.laborCostPct==null?"—":`${labor.laborCostPct.toFixed(1)}%`} sub={`${money(labor?.laborCost||0)} · ${labor?.paidStaffCount||0} paid staff`} tone="violet" icon={UsersRound}/>
  </div>

  <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Orders</p><p className="mt-1 text-xl font-black">{data.receiptCount.toLocaleString()}</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Average order</p><p className="mt-1 text-xl font-black">{money(data.averageOrder)}</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Recipe / cost coverage</p><p className="mt-1 text-xl font-black">{costing?.coveragePct==null?"—":`${costing.coveragePct.toFixed(1)}%`}</p></div>
  </div>

  {(query.data?.exceptions.length||0)>0?<Panel className="mt-5 border-amber-200" title="Operational Exceptions" subtitle="Items that need management attention; incomplete data is never silently treated as zero"><div className="grid gap-3 lg:grid-cols-2">{query.data?.exceptions.map(item=><div key={item.code} className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-amber-950">{item.label}</p>{item.amount!=null?<span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-amber-900">{money(item.amount)}</span>:null}</div><p className="mt-1 text-xs text-amber-900">{item.message}</p></div></div>)}</div></Panel>:null}

  <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
    <Panel title="Hourly Sales" subtitle={`Net sales through the selected shift · ${range.fromTime} to ${range.toTime}`}>
      {hourly.length?<ResponsiveContainer width="100%" height={290}><BarChart data={hourly} margin={{top:18,right:4,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:"#64748b",fontSize:11,fontWeight:700}}/><YAxis axisLine={false} tickLine={false} width={50} tick={{fill:"#64748b",fontSize:10}} tickFormatter={compactMoney}/><Tooltip cursor={{fill:"rgba(59,130,246,.06)"}} contentStyle={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:16,color:"#0f172a"}} formatter={(value:number,_name:string,entry:any)=>[`${money(value)} · ${entry.payload.orders} orders`,"Sales"]}/><Bar dataKey="sales" fill="#4f46e5" radius={[10,10,3,3]} maxBarSize={58}/></BarChart></ResponsiveContainer>:<p className="text-sm text-slate-500">No sales in this shift window.</p>}
    </Panel>
    <Panel title="Payment Mix" subtitle="Net sales by payment channel"><div className="space-y-3">{Object.entries(paymentGroups).filter(([,amount])=>amount>0).map(([label,amount])=>{const Style=paymentStyle[label];const Icon=Style.icon;const pct=data.netSales>0?amount/data.netSales*100:0;return <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span className={`rounded-xl p-2 text-slate-950 ${Style.color}`}><Icon className="h-4 w-4"/></span><div className="min-w-0 flex-1"><div className="flex justify-between text-xs"><span className="font-bold text-slate-700">{label}</span><span className="font-black text-slate-950">{money(amount)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${Style.color}`} style={{width:`${Math.max(pct?3:0,pct)}%`}}/></div></div><span className="w-10 text-right text-[10px] font-bold text-slate-500">{pct.toFixed(0)}%</span></div>})}</div></Panel>
  </div>

  <div className="mt-5 grid gap-5 xl:grid-cols-2">
    <Panel title="Category Mix" subtitle="Sales contribution with cost and margin where coverage is complete"><div className="space-y-4">{(breakdowns?.profitabilityByCategory||[]).slice(0,8).map((row,index)=><HorizontalBar key={row.category} label={row.category} value={row.netSales} max={categoryMax} meta={`${money(row.netSales)} · ${row.grossProfit==null?`${row.costingCoveragePct?.toFixed(0) ?? 0}% costed`:`${money(row.grossProfit)} GP · ${row.grossMarginPct?.toFixed(0)}% margin`}`} color={["bg-blue-400","bg-orange-300","bg-emerald-300","bg-violet-400"][index%4]}/>)}</div></Panel>
    <Panel title="Top Products" subtitle="Ranked by net sales"><div className="space-y-4">{(breakdowns?.topProducts||[]).slice(0,8).map((row,index)=><HorizontalBar key={row.itemName} label={`${index+1}. ${row.itemName}`} value={row.netSales} max={productMax} meta={`${money(row.netSales)} · ${row.quantity.toLocaleString()} sold`} color="bg-gradient-to-r from-blue-500 to-indigo-500"/>)}</div></Panel>
  </div>

  <Panel className="mt-5" title="Ingredient Control" subtitle="Theoretical consumption calculated from sold receipt lines and recipe ingredient mappings">
    <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-100 px-3 py-1.5">{query.data?.ingredientUsage.ingredients.length||0} ingredients tracked</span><span className="rounded-full bg-slate-100 px-3 py-1.5">{query.data?.ingredientUsage.coverage.coveragePct==null?"—":`${query.data.ingredientUsage.coverage.coveragePct.toFixed(1)}%`} sold-item recipe coverage</span>{(query.data?.ingredientUsage.coverage.fallbackItemQuantity||0)>0?<span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">{query.data?.ingredientUsage.coverage.fallbackItemQuantity} units using current-recipe fallback</span>:null}</div>
    {watched.length?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{watched.map(row=><div key={row.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="truncate text-xs font-black uppercase tracking-wide text-slate-500">{row.name}</p><p className="mt-2 text-2xl font-black">{formatIngredient(row)}</p><p className="mt-1 text-[10px] text-slate-500">Expected recipe consumption</p></div>)}</div>:<p className="text-sm text-slate-500">No watched ingredients have mapped recipe consumption in this period.</p>}
    <p className="mt-4 text-[11px] text-slate-500">Physical variance is only valid where the closing stock form records the same ingredient and unit. Rolls, meat and drink close counts can be reconciled after canonical mappings are aligned; fries and nuggets are currently theoretical-only because the close form does not record those quantities.</p>
  </Panel>

  {efficiency?<Panel className="mt-5" title="Labour Efficiency" subtitle="Compact hourly utilisation view; detailed calculations stay out of the Overview">
    <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Overall utilisation</p><p className="mt-1 text-xl font-black">{efficiency.utilisationPct==null?"—":`${efficiency.utilisationPct.toFixed(1)}%`}</p></div>
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Items / labour hr</p><p className="mt-1 text-xl font-black">{efficiency.itemsPerLabourHour==null?"—":efficiency.itemsPerLabourHour.toFixed(2)}</p></div>
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Production hours</p><p className="mt-1 text-xl font-black">{efficiency.availableProductionHours.toFixed(2)}</p></div>
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Items</p><p className="mt-1 text-xl font-black">{efficiency.itemCount.toLocaleString()}</p></div>
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Staff worked</p><p className="mt-1 text-xl font-black">{efficiency.staffCount}</p></div>
    </div>
    {labourHourly.length?<ResponsiveContainer width="100%" height={230}><BarChart data={labourHourly} margin={{top:10,right:4,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill:"#64748b",fontSize:11,fontWeight:700}}/><YAxis domain={[0,"auto"]} axisLine={false} tickLine={false} width={42} tick={{fill:"#64748b",fontSize:10}} tickFormatter={(value)=>`${value}%`}/><Tooltip contentStyle={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:16,color:"#0f172a"}} formatter={(value:number,_name:string,entry:any)=>[`${Number(value).toFixed(0)}% · ${entry.payload.items} items`,"Utilisation"]}/><Bar dataKey="utilisationPct" fill="#10b981" radius={[8,8,2,2]} maxBarSize={52}/></BarChart></ResponsiveContainer>:null}
    {efficiency.warnings.length?<div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{efficiency.warnings.join(" ")}</div>:null}
    <p className="mt-3 text-[11px] text-slate-500">The hourly chart uses paid POS item demand and the recorded shift labour allowances. It is a management indicator, not a replacement for the detailed labour calculation report.</p>
  </Panel>:null}

  <footer className="mt-5 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Sources: {(query.data?.sourcesIncluded||[]).join(" + ")||"No transactions"}</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3"/>{query.data?.filters.fromInstant} → {query.data?.filters.toInstant}</span></footer>
  </>:null}
 </div>;
}
