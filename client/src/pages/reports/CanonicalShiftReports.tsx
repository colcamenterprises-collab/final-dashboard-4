import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type Expense = { item: string; shop?: string | null; category?: string | null; amount: number };
type Wage = { staff: string; type: string; amount: number };
type Shift = {
  shiftId: string; shiftDate: string; store: string; pos: string;
  openedAt: string; openedBy: string; closedAt: string; closedBy: string; cashierName: string;
  startingCash: number; cashPayments: number; cashRefunds: number; paidIn: number; paidOut: number;
  expectedCash: number; actualCash: number; difference: number; cashBanked: number; totalSales: number;
  expenseTotal: number; wageTotal: number; expenses: Expense[]; wages: Wage[];
  balanceStatus: "BALANCED" | "VARIANCE"; source: string;
};
type Response = { ok: boolean; reports: Shift[] };

const thb = (n: number) => `฿${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const dt = (s?: string) => s ? new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function CanonicalShiftReports() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery<Response>({ queryKey: ["/api/canonical-shift-reports/history"] });
  const reports = data?.reports ?? [];

  return <div className="mx-auto max-w-7xl space-y-5">
    <PageTitle title="Shift Reports" meta="Private management view · SBB POS + Daily Sales & Stock V2" />
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
      Expected cash = starting cash + cash payments + paid in − cash refunds − paid out. Staff POS screens do not expose expected cash or variance before submission.
    </div>
    {isLoading && <div className="p-8 text-center text-sm text-slate-400">Loading shift reports…</div>}
    {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Shift reports could not be loaded.</div>}
    {!isLoading && !isError && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Shift</th><th className="px-3 py-3 text-left">Opened</th><th className="px-3 py-3 text-left">Closed</th>
              <th className="px-3 py-3 text-right">Start</th><th className="px-3 py-3 text-right">Cash payments</th><th className="px-3 py-3 text-right">Refunds</th>
              <th className="px-3 py-3 text-right">Paid in</th><th className="px-3 py-3 text-right">Paid out</th><th className="px-3 py-3 text-right">Expected</th>
              <th className="px-3 py-3 text-right">Actual</th><th className="px-3 py-3 text-right">Difference</th><th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.map((r) => {
              const opened = openId === r.shiftId;
              return <Fragment key={r.shiftId}>
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-bold text-slate-900">{String(r.shiftDate).slice(0,10)}<div className="font-normal text-[10px] text-slate-400">{r.cashierName}</div></td>
                  <td className="px-3 py-3">{dt(r.openedAt)}</td><td className="px-3 py-3">{dt(r.closedAt)}</td>
                  <td className="px-3 py-3 text-right">{thb(r.startingCash)}</td><td className="px-3 py-3 text-right">{thb(r.cashPayments)}</td><td className="px-3 py-3 text-right">{thb(r.cashRefunds)}</td>
                  <td className="px-3 py-3 text-right">{thb(r.paidIn)}</td><td className="px-3 py-3 text-right">{thb(r.paidOut)}</td><td className="px-3 py-3 text-right font-semibold">{thb(r.expectedCash)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{thb(r.actualCash)}</td>
                  <td className={`px-3 py-3 text-right font-bold ${Math.abs(r.difference) < .005 ? "text-emerald-700" : "text-red-700"}`}>{thb(r.difference)}</td>
                  <td className="px-3 py-3"><button onClick={() => setOpenId(opened ? null : r.shiftId)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="View shift detail">{opened ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</button></td>
                </tr>
                {opened && <tr key={`${r.shiftId}-detail`}>
                  <td colSpan={12} className="bg-slate-50 px-5 py-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">Pay in / pay out</h3>
                        <div className="space-y-2 text-xs">
                          {r.expenses.map((e, i) => <div key={`e-${i}`} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><span>{e.item}{e.shop ? ` · ${e.shop}` : ""}</span><strong>{thb(e.amount)}</strong></div>)}
                          {r.wages.map((w, i) => <div key={`w-${i}`} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><span>Wages · {w.staff}</span><strong>{thb(w.amount)}</strong></div>)}
                          {!r.expenses.length && !r.wages.length && <p className="text-slate-400">No itemised payouts recorded.</p>}
                        </div>
                      </section>
                      <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">Shift control</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Store</div><strong>{r.store}</strong><div>POS</div><strong>{r.pos}</strong>
                          <div>Opened by</div><strong>{r.openedBy || "—"}</strong><div>Closed by</div><strong>{r.closedBy || "—"}</strong>
                          <div>Total sales</div><strong>{thb(r.totalSales)}</strong><div>Cash banked</div><strong>{thb(r.cashBanked)}</strong>
                          <div>Expenses</div><strong>{thb(r.expenseTotal)}</strong><div>Wages</div><strong>{thb(r.wageTotal)}</strong>
                        </div>
                      </section>
                    </div>
                  </td>
                </tr>}
              </Fragment>;
            })}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
}
