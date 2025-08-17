import { useState } from "react";
import PageShell from "@/layouts/PageShell";

export default function MenuImport(){
  const [source, setSource] = useState("grab");
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"csv"|"xlsx"|"json">("csv");
  const [text, setText] = useState("");
  const [base64, setBase64] = useState("");
  const [filename, setFilename] = useState("");
  const [done, setDone] = useState<any>(null);

  function onFile(e:any) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      setFileType("xlsx");
      const r = new FileReader();
      r.onload = () => {
        const b64 = (r.result as string).split(",")[1];
        setBase64(b64);
      };
      r.readAsDataURL(f); // will give base64
    } else {
      setFileType(ext === "json" ? "json" : "csv");
      const r = new FileReader();
      r.onload = () => setText(String(r.result || ""));
      r.readAsText(f);
    }
  }

  async function upload(){
    const body:any = { name, source, filename, fileType, version:"v1" };
    if (fileType === "xlsx") body.base64 = base64;
    else body.text = text;

    const r = await fetch("/api/menus/import", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    setDone(j);
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Import Menu</h1>
        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm font-medium">Menu Name
              <input className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Grab 2025-08"/>
            </label>
            <label className="text-sm font-medium">Source
              <select className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={source} onChange={e=>setSource(e.target.value)}>
                <option value="house">House</option>
                <option value="pos">POS</option>
                <option value="grab">Grab</option>
                <option value="foodpanda">Foodpanda</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm font-medium">File
              <input className="mt-1 w-full text-sm" type="file" onChange={onFile}/>
            </label>
          </div>

          <button className="border rounded-xl px-4 py-2 text-sm" onClick={upload}>Import</button>
          {done && (
            <div className="text-sm mt-2">
              {done.ok ? `Imported ${done.imported} items into ${done.menuId}` : `Error: ${done.error || "failed"}`}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}