import { useState } from "react";
import PageShell from "@/layouts/PageShell";

export default function DescriptionTool(){
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState<number|''>('');
  const [mods, setMods] = useState<string>("");
  const [tone, setTone] = useState<"grab"|"foodpanda"|"default">("grab");
  const [out, setOut] = useState<any>(null);

  async function gen(){
    const r = await fetch("/api/menus/description/generate", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        itemName, basePrice: price || undefined,
        modifiers: mods.split(",").map(s=>s.trim()).filter(Boolean),
        tone
      })
    });
    setOut(await r.json());
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Delivery Partner Description Generator</h1>
        <div className="rounded-2xl border bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm font-medium">Item name
            <input className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={itemName} onChange={e=>setItemName(e.target.value)} placeholder="Double Smash"/>
          </label>
          <label className="text-sm font-medium">Base price (THB)
            <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={price} onChange={e=>setPrice(e.target.value === "" ? "" : +e.target.value)} />
          </label>
          <label className="text-sm font-medium">Modifiers (comma-separated)
            <input className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={mods} onChange={e=>setMods(e.target.value)} placeholder="Cheese,Bacon,Double Patty"/>
          </label>
          <label className="text-sm font-medium">Tone
            <select className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={tone} onChange={e=>setTone(e.target.value as any)}>
              <option value="grab">Grab style</option>
              <option value="foodpanda">Foodpanda style</option>
              <option value="default">Default</option>
            </select>
          </label>
          <div className="md:col-span-3">
            <button className="border rounded-xl px-4 py-2 text-sm" onClick={gen}>Generate</button>
          </div>
          {out?.ok && (
            <div className="md:col-span-3 text-sm space-y-2">
              <div><span className="font-medium">Short:</span> {out.short}</div>
              <div><span className="font-medium">Long:</span> {out.long}</div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}