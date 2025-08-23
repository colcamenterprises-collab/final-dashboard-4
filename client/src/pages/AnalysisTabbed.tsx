import { useEffect, useState } from "react";

const fmtTHB = (n:number)=> new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(Number(n)||0);

function Tab({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}) {
  return <button onClick={onClick} className={`px-3 py-2 rounded ${active?"bg-black text-white":"bg-gray-100"}`}>{label}</button>;
}

export default function AnalysisTabbed() {
  const [tab,setTab]=useState<"bank"|"pos"|"receipts"|"shift"|"jussi">("pos");
  const [batchId,setBatchId]=useState("");
  const [report,setReport]=useState<any>(null);
  const [receipts,setReceipts]=useState<any[]>([]);
  const [upload,setUpload]=useState({
    title:"", shiftStartISO:"", shiftEndISO:"",
    receiptsCsv:"", shiftReportCsv:"", itemSalesCsv:"", modifierSalesCsv:"", paymentTypeSalesCsv:""
  });
  const [uploadMsg,setUploadMsg]=useState<string>("");

  useEffect(()=>{
    if(tab==="jussi" && batchId){
      fetch(`/api/pos/${batchId}/analyze`).then(r=>r.json()).then(setReport).catch(()=>setReport(null));
    }
    if(tab==="receipts" && batchId){
      fetch(`/api/pos/receipts?batchId=${batchId}`).then(r=>r.json()).then(d=>setReceipts(d?.data||[])).catch(()=>setReceipts([]));
    }
  },[tab,batchId]);

  async function doUpload() {
    setUploadMsg("Uploading…");
    const res = await fetch("/api/pos/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(upload)});
    const data = await res.json();
    if(data?.batchId){ setBatchId(data.batchId); setUploadMsg(`Uploaded. batchId=${data.batchId}`); }
    else { setUploadMsg(`Upload failed: ${data?.error||"unknown error"}`); }
  }

  return (
    <div className="p-4 text-sm space-y-4">
      <h1 className="text-3xl font-extrabold mb-6">Analysis</h1>
      
      <div className="flex gap-2">
        <Tab label="Bank" active={tab==="bank"} onClick={()=>setTab("bank")} />
        <Tab label="POS Upload" active={tab==="pos"} onClick={()=>setTab("pos")} />
        <Tab label="Receipts" active={tab==="receipts"} onClick={()=>setTab("receipts")} />
        <Tab label="Shift Analysis" active={tab==="shift"} onClick={()=>setTab("shift")} />
        <Tab label="Jussi – Ops Review" active={tab==="jussi"} onClick={()=>setTab("jussi")} />
      </div>

      {/* Shared batch selector */}
      <div className="flex items-center gap-2">
        <input className="border px-2 py-1 rounded w-64" placeholder="POS Batch ID" value={batchId} onChange={e=>setBatchId(e.target.value)} />
        <span className="text-gray-500">After upload, this auto-fills.</span>
      </div>

      {tab==="pos" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="font-semibold">Shift Window (BKK)</div>
            <input className="border px-2 py-1 rounded w-full" placeholder="Title (optional)" value={upload.title} onChange={e=>setUpload(v=>({...v,title:e.target.value}))} />
            <input className="border px-2 py-1 rounded w-full" placeholder="Shift start ISO e.g. 2025-08-21T17:00:00+07:00" value={upload.shiftStartISO} onChange={e=>setUpload(v=>({...v,shiftStartISO:e.target.value}))} />
            <input className="border px-2 py-1 rounded w-full" placeholder="Shift end ISO e.g. 2025-08-22T03:00:00+07:00" value={upload.shiftEndISO} onChange={e=>setUpload(v=>({...v,shiftEndISO:e.target.value}))} />
            <div className="font-semibold mt-4">Paste CSV contents (exact exports)</div>
            <label className="block text-xs text-gray-600">Receipts CSV</label>
            <textarea className="border p-2 rounded w-full h-24" value={upload.receiptsCsv} onChange={e=>setUpload(v=>({...v,receiptsCsv:e.target.value}))}/>
            <label className="block text-xs text-gray-600">Shift Report CSV</label>
            <textarea className="border p-2 rounded w-full h-24" value={upload.shiftReportCsv} onChange={e=>setUpload(v=>({...v,shiftReportCsv:e.target.value}))}/>
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-gray-600">Item Sales Summary CSV</label>
            <textarea className="border p-2 rounded w-full h-24" value={upload.itemSalesCsv} onChange={e=>setUpload(v=>({...v,itemSalesCsv:e.target.value}))}/>
            <label className="block text-xs text-gray-600">Modifier Sales CSV</label>
            <textarea className="border p-2 rounded w-full h-24" value={upload.modifierSalesCsv} onChange={e=>setUpload(v=>({...v,modifierSalesCsv:e.target.value}))}/>
            <label className="block text-xs text-gray-600">Payment Type Sales CSV</label>
            <textarea className="border p-2 rounded w-full h-24" value={upload.paymentTypeSalesCsv} onChange={e=>setUpload(v=>({...v,paymentTypeSalesCsv:e.target.value}))}/>
            <button onClick={doUpload} className="mt-2 px-3 py-2 rounded bg-black text-white">Upload</button>
            <div className="text-xs text-gray-600">{uploadMsg}</div>
          </div>
        </div>
      )}

      {tab==="receipts" && (
        <div className="border rounded p-3">
          {!batchId && <div className="text-gray-500">Enter a Batch ID to view receipts.</div>}
          {!!batchId && (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Receipt ID</th>
                  <th className="text-left">Date/Time</th>
                  <th className="text-right">Total</th>
                  <th className="text-left">Payment</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r:any)=>(
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{r.receiptId}</td>
                    <td>{new Date(r.datetime).toLocaleString()}</td>
                    <td className="text-right">{fmtTHB(r.total)}</td>
                    <td>{r.payment || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab==="jussi" && (
        <div className="space-y-4">
          {!batchId && <div className="text-gray-500">Enter a Batch ID to run Jussi's analysis.</div>}
          {!!batchId && !report?.ok && <div className="text-gray-500">No analysis yet or API error.</div>}
          {report?.ok && (
            <>
              <div className="border rounded p-3">
                <div className="font-semibold mb-2">Window</div>
                <div>{report.report.batch.window.start || "-"} → {report.report.batch.window.end || "-"}</div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <div className="font-semibold mb-2">Staff (Daily Sales)</div>
                  <table className="w-full">
                    <tbody>
                      <tr><td>Total Sales</td><td className="text-right">{fmtTHB(report.report.staff.totalSales)}</td></tr>
                      <tr><td>Total Expenses</td><td className="text-right">{fmtTHB(report.report.staff.totalExpenses)}</td></tr>
                      <tr><td>Banked Cash</td><td className="text-right">{fmtTHB(report.report.staff.bankCash)}</td></tr>
                      <tr><td>Banked QR</td><td className="text-right">{fmtTHB(report.report.staff.bankQr)}</td></tr>
                      <tr><td>Closing Cash</td><td className="text-right">{fmtTHB(report.report.staff.closingCash)}</td></tr>
                      <tr><td>Rolls</td><td className="text-right">{report.report.staff.rolls ?? "-"}</td></tr>
                      <tr><td>Meat (g)</td><td className="text-right">{report.report.staff.meat ?? "-"}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="border rounded p-3">
                  <div className="font-semibold mb-2">POS (Shift Report)</div>
                  <table className="w-full">
                    <tbody>
                      <tr><td>Net Sales</td><td className="text-right">{fmtTHB(report.report.pos.netSales)}</td></tr>
                      <tr><td>Receipts</td><td className="text-right">{report.report.pos.receiptCount}</td></tr>
                      <tr><td>Cash Sales</td><td className="text-right">{fmtTHB(report.report.pos.cashSales)}</td></tr>
                      <tr><td>QR/Card Sales</td><td className="text-right">{fmtTHB(report.report.pos.qrSales)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="border rounded p-3">
                <div className="font-semibold mb-2">Variances</div>
                <table className="w-full">
                  <tbody>
                    <tr className={Math.abs(report.report.variances.totalSales)>40 ? "bg-red-50":""}>
                      <td>Total Sales (Staff - POS)</td>
                      <td className="text-right">{fmtTHB(report.report.variances.totalSales)}</td>
                    </tr>
                    <tr className={Math.abs(report.report.variances.bankCash)>0 ? "bg-red-50":""}>
                      <td>Banked Cash - POS Cash</td>
                      <td className="text-right">{fmtTHB(report.report.variances.bankCash)}</td>
                    </tr>
                    <tr className={Math.abs(report.report.variances.bankQr)>0 ? "bg-red-50":""}>
                      <td>Banked QR - POS QR/Card</td>
                      <td className="text-right">{fmtTHB(report.report.variances.bankQr)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {!!report.report.flags?.length && (
                <div className="border rounded p-3 bg-yellow-50">
                  <div className="font-semibold mb-2">Flags</div>
                  <ul className="list-disc ml-5">
                    {report.report.flags.map((f:string,i:number)=><li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab==="shift" && <div className="text-gray-500">Shift helpers (optional) — safe to ignore for now.</div>}
      {tab==="bank" && <div className="text-gray-500">Bank uploads come with the Expenses patch.</div>}
    </div>
  );
}