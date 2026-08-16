import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { ExactDateTimeRange, reportingRangeParams, type ExactDateTimeRangeValue } from "@/components/reports/ExactDateTimeRange";
import { PageTitle } from "@/components/ui/sbb-cards";

type Item = { item_key:string; item_name:string; sku?:string; category?:string; quantity:number; gross_sales:number; discounts:number; refunds:number; net_sales:number; cost_of_goods:number|null; gross_profit:number|null; margin_pct:number|null; sources:string[] };
type Data = { ok:boolean; source:string; filters:ExactDateTimeRangeValue & {fromInstant:string;toInstant:string}; items:Item[]; error?:string };
type ComponentRow={group:string;name:string;type:"Modifier"|"Upsell";quantity:number;revenue:number;sources:string[]};
type SetComponent={key:string;name:string;category?:string;quantity:number;sources:string[]};
type ComponentData={ok:boolean;modifiers:ComponentRow[];upsells:ComponentRow[];setComponents:SetComponent[];limitations?:{historicalSetComponents?:string};error?:string};
type BurgerIngredient={key:string;name:string;unit:string;quantityPerItem:number;expectedQuantity:number};
type BurgerRow={menuItemId:string;itemName:string;sku?:string|null;category:string;soldQuantity:number;recipeId:number|null;recipeName:string|null;recipeStatus:"READY"|"NOT_LINKED"|"RECIPE_EMPTY";ingredients:BurgerIngredient[]};
type BurgerUsageData={ok:boolean;source:string;scope:string;burgers:BurgerRow[];coverage:{menuItems:number;readyMenuItems:number;soldQuantity:number;mappedSoldQuantity:number;coveragePct:number|null};error?:string};
type Tab="items"|"burgers"|"modifiers"|"upsells"|"set-components";

const money=(value:number|null|undefined)=>value==null?"—":`฿${Number(value||0).toLocaleString("en-US",{maximumFractionDigits:2})}`;
const percent=(value:number|null|undefined)=>value==null?"—":`${Number(value).toFixed(1)}%`;
const quantity=(value:number)=>Number(value||0).toLocaleString("en-US",{maximumFractionDigits:2});
function localDate(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
const csv=(value:unknown)=>`"${String(value??"").replace(/"/g,'""')}"`;
const sourceLabel=(sources:string[])=>(sources||[]).map(source=>source==="sbb_pos"?"SBB POS":source).join(" + ");

export default function SalesByItem(){
  const [range,setRange]=useState<ExactDateTimeRangeValue>({fromDate:localDate(-1),fromTime:"17:00",toDate:localDate(),toTime:"03:00",timezone:"Asia/Bangkok"});
  const [search,setSearch]=useState("");
  const [tab,setTab]=useState<Tab>("items");
  const params=useMemo(()=>reportingRangeParams(range),[range]);

  const query=useQuery<Data>({
    queryKey:["unified-sales-by-item",params],
    queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/unified/items?${params}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}
  });
  const components=useQuery<ComponentData>({
    queryKey:["unified-sales-components",params],
    queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/unified/components?${params}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}
  });
  const burgers=useQuery<BurgerUsageData>({
    queryKey:["burger-recipe-usage",params],
    queryFn:async()=>{const response=await fetch(`/api/reports/receipt-analytics/unified/burger-usage?${params}`,{credentials:"include",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||`HTTP ${response.status}`);return body;}
  });

  const q=search.trim().toLowerCase();
  const rows=useMemo(()=>(query.data?.items||[]).filter(row=>!q||[row.item_name,row.sku,row.category,...(row.sources||[])].some(value=>String(value||"").toLowerCase().includes(q))),[query.data,q]);
  const burgerRows=useMemo(()=>(burgers.data?.burgers||[]).filter(row=>!q||[row.itemName,row.sku,row.category,row.recipeName,row.recipeStatus].some(value=>String(value||"").toLowerCase().includes(q))),[burgers.data,q]);
  const ingredientColumns=useMemo(()=>{
    const columns=new Map<string,{key:string;name:string;unit:string}>();
    burgerRows.forEach(row=>row.ingredients.forEach(ingredient=>columns.set(ingredient.key,{key:ingredient.key,name:ingredient.name,unit:ingredient.unit})));
    return [...columns.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.unit.localeCompare(b.unit));
  },[burgerRows]);
  const modifierRows=(components.data?.modifiers||[]).filter(row=>!q||[row.group,row.name,...row.sources].some(value=>String(value||"").toLowerCase().includes(q)));
  const upsellRows=(components.data?.upsells||[]).filter(row=>!q||[row.group,row.name,...row.sources].some(value=>String(value||"").toLowerCase().includes(q)));
  const setRows=(components.data?.setComponents||[]).filter(row=>!q||[row.name,row.category,...row.sources].some(value=>String(value||"").toLowerCase().includes(q)));
  const totals=useMemo(()=>({quantity:rows.reduce((sum,row)=>sum+Number(row.quantity||0),0),net:rows.reduce((sum,row)=>sum+Number(row.net_sales||0),0),cogsAvailable:rows.length>0&&rows.every(row=>row.cost_of_goods!=null),cogs:rows.reduce((sum,row)=>sum+Number(row.cost_of_goods||0),0)}),[rows]);
  const profit=totals.cogsAvailable?totals.net-totals.cogs:null;
  const margin=profit!=null&&totals.net?profit/totals.net*100:null;
  const loading=query.isLoading||components.isLoading||burgers.isLoading;
  const error=query.isError?(query.error as Error):components.isError?(components.error as Error):burgers.isError?(burgers.error as Error):null;

  const exportItemCsv=()=>{
    const header=["Item","SKU","Category","Qty","Gross Sales","Discounts","Refunds","Net Sales","COGS","Gross Profit","Margin %","Sources"];
    const body=rows.map(row=>[row.item_name,row.sku,row.category,row.quantity,row.gross_sales,row.discounts,row.refunds,row.net_sales,row.cost_of_goods,row.gross_profit,row.margin_pct,sourceLabel(row.sources)].map(csv).join(","));
    const blob=new Blob([[header.map(csv).join(","),...body].join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`sales-by-item-${range.fromDate}-${range.toDate}.csv`;link.click();URL.revokeObjectURL(url);
  };
  const exportBurgerCsv=()=>{
    const header=["Burger","Category","Sold","Recipe","Recipe status",...ingredientColumns.map(column=>`${column.name} (${column.unit}) expected`)];
    const body=burgerRows.map(row=>{
      const values=new Map(row.ingredients.map(ingredient=>[ingredient.key,ingredient.expectedQuantity]));
      return [row.itemName,row.category,row.soldQuantity,row.recipeName,row.recipeStatus,...ingredientColumns.map(column=>values.get(column.key)??"")].map(csv).join(",");
    });
    const blob=new Blob([[header.map(csv).join(","),...body].join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`burger-usage-${range.fromDate}-${range.toDate}.csv`;link.click();URL.revokeObjectURL(url);
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <PageTitle title="Sales by Item" meta="Items, burger recipe usage, modifiers, upsells and included set components from one exact reporting range"/>
    <ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok"/>
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search current report…" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"/></div>
      {tab==="items"?<button onClick={exportItemCsv} disabled={!rows.length} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40"><Download className="h-4 w-4"/>Export CSV</button>:null}
      {tab==="burgers"?<button onClick={exportBurgerCsv} disabled={!burgerRows.length} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40"><Download className="h-4 w-4"/>Export burger matrix</button>:null}
    </div>
    <div className="flex flex-wrap gap-2">{([['items','Items'],['burgers','Burger Usage'],['modifiers','Modifiers'],['upsells','Upsells'],['set-components','Set Components']] as [Tab,string][]).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`rounded-xl px-4 py-2 text-xs font-black ${tab===key?"bg-slate-950 text-white":"border bg-white text-slate-600"}`}>{label}</button>)}</div>
    {tab==="items"?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Items sold" value={totals.quantity.toLocaleString()}/><Metric label="Net sales" value={money(totals.net)}/><Metric label="COGS" value={totals.cogsAvailable?money(totals.cogs):"—"}/><Metric label="Gross margin" value={percent(margin)}/></div>:null}
    {tab==="burgers"?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Burger items" value={String(burgers.data?.coverage.menuItems??0)}/><Metric label="Burgers sold" value={quantity(burgers.data?.coverage.soldQuantity??0)}/><Metric label="Recipe-linked sold" value={quantity(burgers.data?.coverage.mappedSoldQuantity??0)}/><Metric label="Usage coverage" value={percent(burgers.data?.coverage.coveragePct)}/></div>:null}
    {loading&&<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading sales analysis…</div>}
    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error.message}</div>}
    {!loading&&!error&&tab==="items"&&<ItemsTable rows={rows}/>}
    {!loading&&!error&&tab==="burgers"&&<BurgerUsageTable rows={burgerRows} columns={ingredientColumns} scope={burgers.data?.scope}/>}
    {!loading&&!error&&(tab==="modifiers"||tab==="upsells")&&<ComponentTable rows={tab==="modifiers"?modifierRows:upsellRows}/>}
    {!loading&&!error&&tab==="set-components"&&<><SetComponentTable rows={setRows}/>{components.data?.limitations?.historicalSetComponents?<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{components.data.limitations.historicalSetComponents}</div>:null}</>}
  </div>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;}
function ItemsTable({rows}:{rows:Item[]}){return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3 text-right">Refund</th><th className="px-4 py-3 text-right">Net Sales</th><th className="px-4 py-3 text-right">COGS</th><th className="px-4 py-3 text-right">Gross Profit</th><th className="px-4 py-3 text-right">Margin</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row=><tr key={row.item_key} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-black">{row.item_name}</div>{row.sku?<div className="text-[10px] text-slate-400">{row.sku}</div>:null}</td><td className="px-4 py-3">{row.category||"Other"}</td><td className="px-4 py-3 text-xs">{sourceLabel(row.sources)}</td><td className="px-4 py-3 text-right font-bold">{Number(row.quantity).toLocaleString()}</td><td className="px-4 py-3 text-right">{money(row.gross_sales)}</td><td className="px-4 py-3 text-right">{money(row.discounts)}</td><td className="px-4 py-3 text-right">{money(row.refunds)}</td><td className="px-4 py-3 text-right font-black">{money(row.net_sales)}</td><td className="px-4 py-3 text-right">{money(row.cost_of_goods)}</td><td className="px-4 py-3 text-right">{money(row.gross_profit)}</td><td className="px-4 py-3 text-right">{percent(row.margin_pct)}</td></tr>)}</tbody></table></div></div>;}
function BurgerUsageTable({rows,columns,scope}:{rows:BurgerRow[];columns:{key:string;name:string;unit:string}[];scope?:string}){return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b bg-amber-50 px-4 py-3 text-xs text-amber-950">Expected usage comes only from linked recipe lines. A blank cell means no verified recipe ingredient exists; it is not assumed as zero. {scope}</div><div className="overflow-x-auto"><table className="w-full min-w-max text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left">Burger</th><th className="px-4 py-3 text-right">Sold</th><th className="px-4 py-3 text-left">Recipe</th><th className="px-4 py-3 text-left">Status</th>{columns.map(column=><th key={column.key} className="min-w-28 px-4 py-3 text-right"><div>{column.name}</div><div className="font-normal normal-case">Expected {column.unit}</div></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row=>{const usage=new Map(row.ingredients.map(ingredient=>[ingredient.key,ingredient]));return <tr key={row.menuItemId} className="hover:bg-slate-50"><td className="sticky left-0 z-10 bg-white px-4 py-3 font-black">{row.itemName}</td><td className="px-4 py-3 text-right font-black">{quantity(row.soldQuantity)}</td><td className="px-4 py-3">{row.recipeName||"—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.recipeStatus==="READY"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900"}`}>{row.recipeStatus==="READY"?"READY":row.recipeStatus==="NOT_LINKED"?"NOT LINKED":"RECIPE EMPTY"}</span></td>{columns.map(column=>{const ingredient=usage.get(column.key);return <td key={column.key} className="px-4 py-3 text-right">{ingredient?<><div className="font-black">{quantity(ingredient.expectedQuantity)}</div><div className="text-[10px] text-slate-400">{quantity(ingredient.quantityPerItem)} / burger</div></>:"—"}</td>})}</tr>})}</tbody></table></div></div>;}
function ComponentTable({rows}:{rows:ComponentRow[]}){return <div className="overflow-hidden rounded-2xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Group</th><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Revenue</th></tr></thead><tbody className="divide-y">{rows.map((row,index)=><tr key={`${row.group}-${row.name}-${index}`}><td className="px-4 py-3">{row.group}</td><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3 text-xs">{sourceLabel(row.sources)}</td><td className="px-4 py-3 text-right font-bold">{Number(row.quantity).toLocaleString()}</td><td className="px-4 py-3 text-right">{money(row.revenue)}</td></tr>)}</tbody></table></div>;}
function SetComponentTable({rows}:{rows:SetComponent[]}){return <div className="overflow-hidden rounded-2xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Component</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-right">Qty</th></tr></thead><tbody className="divide-y">{rows.map(row=><tr key={row.key}><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3">{row.category||"Other"}</td><td className="px-4 py-3 text-xs">{sourceLabel(row.sources)}</td><td className="px-4 py-3 text-right font-bold">{Number(row.quantity).toLocaleString()}</td></tr>)}</tbody></table></div>;}
