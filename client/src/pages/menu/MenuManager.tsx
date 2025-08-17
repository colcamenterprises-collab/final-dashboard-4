import { useEffect, useState } from "react";
import PageShell from "@/layouts/PageShell";

type Menu = { id:string; name:string; source:string; fileType:string; importedAt:string; version?:string|null };

export default function MenuManager(){
  const [menus, setMenus] = useState<Menu[]>([]);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [compare, setCompare] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [mindmap, setMindmap] = useState<any>(null);

  async function load() {
    const r = await fetch("/api/menus");
    const j = await r.json();
    setMenus(j.menus || []);
  }
  useEffect(()=>{ load(); }, []);

  async function doCompare(){
    if(!a || !b) return;
    const r = await fetch(`/api/menus/${a}/compare`, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ otherMenuId: b })
    });
    setCompare(await r.json());
  }
  async function doReview(){
    if(!a) return;
    const r = await fetch(`/api/menus/${a}/review`, { method:"POST" });
    setReview(await r.json());
  }
  async function loadMindmap(){
    if(!a) return;
    const r = await fetch(`/api/menus/${a}/mindmap`);
    setMindmap(await r.json());
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Menu Management</h1>

        <div className="rounded-2xl border bg-white p-5">
          <div className="h2 mb-3">Menus</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left">
              <th>Name</th><th>Source</th><th>Type</th><th>Version</th><th>Imported</th>
            </tr></thead>
            <tbody>
              {menus.map(m=>(
                <tr key={m.id} className="border-t">
                  <td>{m.name}</td>
                  <td className="capitalize">{m.source}</td>
                  <td>{m.fileType}</td>
                  <td>{m.version ?? "-"}</td>
                  <td>{new Date(m.importedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border bg-white p-5">
            <div className="h2 mb-2">Compare Menus</div>
            <select className="border rounded-xl px-3 py-2 text-sm w-full mb-2" value={a} onChange={e=>setA(e.target.value)}>
              <option value="">Select base menu (A)</option>
              {menus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select className="border rounded-xl px-3 py-2 text-sm w-full mb-2" value={b} onChange={e=>setB(e.target.value)}>
              <option value="">Select compare to (B)</option>
              {menus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="border rounded-xl px-3 py-2 text-sm" onClick={doCompare}>Run Compare</button>
            {compare?.ok && (
              <div className="mt-3 text-sm">
                <div className="font-medium">Missing in {compare.B}:</div>
                <ul className="list-disc ml-4">{compare.missingInB.map((x:any,i:number)=><li key={i}>{x.name}</li>)}</ul>
                <div className="font-medium mt-2">Missing in {compare.A}:</div>
                <ul className="list-disc ml-4">{compare.missingInA.map((x:any,i:number)=><li key={i}>{x.name}</li>)}</ul>
                <div className="font-medium mt-2">Price mismatches:</div>
                <ul className="list-disc ml-4">{compare.priceMismatches.map((x:any,i:number)=><li key={i}>{x.name}: A ฿{x.A} vs B ฿{x.B}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <div className="h2 mb-2">Chef Review</div>
            <select className="border rounded-xl px-3 py-2 text-sm w-full mb-2" value={a} onChange={e=>setA(e.target.value)}>
              <option value="">Select menu</option>
              {menus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="border rounded-xl px-3 py-2 text-sm" onClick={doReview}>Run Review</button>
            {review?.ok && (
              <div className="mt-3 text-sm space-y-2">
                <div>Items reviewed: {review.summary.itemsReviewed}</div>
                <div>Low margin: {review.summary.lowMarginCount}</div>
                <div>Uncosted: {review.summary.uncostedCount}</div>
                <div className="font-medium mt-2">Recommendations</div>
                <ul className="list-disc ml-4">
                  {review.recommendations.costCuts.map((x:string,i:number)=><li key={i}>{x}</li>)}
                  {review.recommendations.upsells.map((x:string,i:number)=><li key={i}>{x}</li>)}
                  {review.recommendations.promoIdeas.map((x:string,i:number)=><li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <div className="h2 mb-2">Mind Map</div>
            <select className="border rounded-xl px-3 py-2 text-sm w-full mb-2" value={a} onChange={e=>setA(e.target.value)}>
              <option value="">Select menu</option>
              {menus.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="border rounded-xl px-3 py-2 text-sm" onClick={loadMindmap}>Load</button>
            {mindmap?.ok && (
              <div className="mt-3 text-sm">
                <div className="font-medium">Nodes: {mindmap.nodes.length}, Edges: {mindmap.edges.length}</div>
                {/* simple tree preview */}
                <ul className="list-disc ml-4 max-h-64 overflow-auto">
                  {mindmap.nodes.filter((n:any)=>n.type==="item").slice(0,50).map((n:any)=>(
                    <li key={n.id}>{n.label}</li>
                  ))}
                </ul>
                <div className="text-neutral-500 mt-1">Full graph data available for react-flow later.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}