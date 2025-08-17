import { Outlet, NavLink } from "react-router-dom";
import { Upload, Receipt, Bot } from "lucide-react";

export default function Analysis() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Analysis</h1>

      {/* quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NavLink to="upload" className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-3 hover:bg-neutral-50">
          <Upload className="h-5 w-5" />
          <div>
            <div className="text-lg font-semibold">Upload Statements</div>
            <div className="text-sm text-neutral-500">Bank/POS reports for reconciliation</div>
          </div>
        </NavLink>
        <NavLink to="receipts" className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-3 hover:bg-neutral-50">
          <Receipt className="h-5 w-5" />
          <div>
            <div className="text-lg font-semibold">Receipts</div>
            <div className="text-sm text-neutral-500">Manage scanned receipts</div>
          </div>
        </NavLink>
        <div className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-3">
          <Bot className="h-5 w-5" />
          <div>
            <div className="text-lg font-semibold">Jussi (Ops AI)</div>
            <div className="text-sm text-neutral-500">Ask questions about uploaded reports</div>
          </div>
        </div>
      </div>

      {/* two-panel: content + Jussi chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Outlet />
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm h-[520px]">
          <div className="text-lg font-semibold mb-3">Jussi — Ops AI</div>
          <div className="h-full grid place-items-center text-neutral-400 text-sm border rounded-xl">
            Chat panel placeholder (wired to your upload data)
          </div>
        </div>
      </div>
    </div>
  );
}