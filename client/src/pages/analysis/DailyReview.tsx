import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type StaffComparisonData = {
  totalSales: number | null;
  cashSales: number | null;
  grabSales: number | null;
  scanSales: number | null;
  expensesTotal: number | null;
  rollsEnd: number | null;
  meatEnd: number | null;
  drinksCount: number | null;
};

type PosShiftReportData = {
  totalSales: number | null;
  startingCash: number | null;
  cashPayments: number | null;
  grab: number | null;
  scan: number | null;
  expenses: number | null;
  expectedCash: number | null;
  actualCash: number | null;
  difference: number | null;
};

type DailyComparisonShiftResponse = {
  date: string;
  shiftWindow: string;
  staffData: StaffComparisonData | { message: string };
  posShiftReport: PosShiftReportData | { message: string };
  differences: {
    totalSales: number | null;
    cash: number | null;
    grab: number | null;
    scan: number | null;
    expenses: number | null;
  };
};

interface DailySalesRow {
  id: string;
  shift_date: string;
  completed_by: string;
  total_sales: number;
  cash_sales: number;
  qr_sales: number;
  grab_sales: number;
  aroi_sales: number;
  shopping_total: number;
  wages_total: number;
  others_total: number;
  total_expenses: number;
  rolls_end: number;
  meat_end_g: number;
  expected_cash_bank: number;
  expected_qr_bank: number;
  expected_total_bank: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);
const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0 });
};

const isMessage = (value: unknown): value is { message: string } =>
  Boolean(value && typeof value === "object" && "message" in value);

export default function DailyReview() {
  const [month, setMonth] = useState(thisMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [approving, setApproving] = useState(false);
  const { toast } = useToast();

  const { data: dailySalesRows = [], isLoading: isDailySalesLoading } = useQuery<DailySalesRow[]>({
    queryKey: ["/api/analysis/daily-sales", month],
    queryFn: async () => {
      const r = await fetch(`/api/analysis/daily-sales?month=${month}`);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    },
  });

  const { data: comparison, isLoading: isComparisonLoading } = useQuery<DailyComparisonShiftResponse>({
    queryKey: ["/api/analysis/daily-comparison", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/analysis/daily-comparison?date=${selectedDate}`);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    },
    enabled: Boolean(selectedDate),
  });

  const staffData = comparison && !isMessage(comparison.staffData) ? comparison.staffData : null;
  const posShift = comparison && !isMessage(comparison.posShiftReport) ? comparison.posShiftReport : null;

  const comparisonRows = useMemo(() => {
    return [
      {
        label: "Total Sales",
        staff: staffData?.totalSales ?? null,
        pos: posShift?.totalSales ?? null,
        diff: comparison?.differences.totalSales ?? null,
      },
      {
        label: "Cash",
        staff: staffData?.cashSales ?? null,
        pos: posShift?.cashPayments ?? null,
        diff: comparison?.differences.cash ?? null,
      },
      {
        label: "Grab",
        staff: staffData?.grabSales ?? null,
        pos: posShift?.grab ?? null,
        diff: comparison?.differences.grab ?? null,
      },
      {
        label: "Scan (QR)",
        staff: staffData?.scanSales ?? null,
        pos: posShift?.scan ?? null,
        diff: comparison?.differences.scan ?? null,
      },
      {
        label: "Expenses",
        staff: staffData?.expensesTotal ?? null,
        pos: posShift?.expenses ?? null,
        diff: comparison?.differences.expenses ?? null,
      },
      {
        label: "Rolls Remaining",
        staff: staffData?.rollsEnd ?? null,
        pos: null,
        diff: null,
      },
      {
        label: "Meat Remaining (g)",
        staff: staffData?.meatEnd ?? null,
        pos: null,
        diff: null,
      },
      {
        label: "Drinks Remaining",
        staff: staffData?.drinksCount ?? null,
        pos: null,
        diff: null,
      },
    ];
  }, [comparison?.differences, staffData, posShift]);

  const managerRole = (typeof window !== "undefined" && window.localStorage.getItem("user-role")) || "";
  const canApprove = managerRole.toLowerCase() === "manager" && approvedBy.trim().length > 0;

  const renderCell = (value: number | null, testId?: string) => {
    if (value === null || value === undefined) {
      return (
        <span
          className="inline-block rounded bg-gray-100 px-2 py-1 text-xs text-gray-400"
          title="Missing – check form submission or Loyverse sync"
          data-testid={testId}
        >
          Missing
        </span>
      );
    }
    return <span data-testid={testId}>{fmt(value)}</span>;
  };

  const renderDiff = (value: number | null) => {
    if (value === null || value === undefined) {
      return (
        <span
          className="inline-block rounded bg-gray-100 px-2 py-1 text-xs text-gray-400"
          title="Missing – check form submission or Loyverse sync"
        >
          Missing
        </span>
      );
    }
    if (value === 0) return <span>{fmt(value)}</span>;
    return <span className="font-semibold text-red-600">{fmt(value)}</span>;
  };

  const generateApprovalPdf = () => {
    if (!comparison) return;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Daily Shift Review", 14, 18);
    doc.setFontSize(10);
    doc.text(`Date: ${comparison.date}`, 14, 26);
    doc.text(`Shift Window: ${comparison.shiftWindow}`, 14, 32);
    doc.text(`Approved By: ${approvedBy.trim()}`, 14, 38);
    if (notes.trim()) {
      doc.text(`Notes: ${notes.trim()}`, 14, 44);
    }

    const body = comparisonRows.map((row) => [
      row.label,
      row.staff === null ? "Missing" : fmt(row.staff),
      row.pos === null ? "Missing" : fmt(row.pos),
      row.diff === null ? "Missing" : fmt(row.diff),
    ]);

    autoTable(doc, {
      startY: notes.trim() ? 52 : 46,
      head: [["Item", "Staff Form", "POS Shift Report", "Difference"]],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240] },
    });

    if (posShift) {
      const cashStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 90;
      doc.setFontSize(11);
      doc.text("POS Cash Controls", 14, cashStartY);
      autoTable(doc, {
        startY: cashStartY + 4,
        head: [["Metric", "Value"]],
        body: [
          ["Starting Cash", posShift.startingCash === null ? "Missing" : fmt(posShift.startingCash)],
          ["Expected Cash", posShift.expectedCash === null ? "Missing" : fmt(posShift.expectedCash)],
          ["Actual Cash", posShift.actualCash === null ? "Missing" : fmt(posShift.actualCash)],
          ["Difference", posShift.difference === null ? "Missing" : fmt(posShift.difference)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240] },
      });
    }

    doc.save(`shift-approval-${comparison.date}.pdf`);
  };

  const approveShift = async () => {
    if (!selectedDate) {
      toast({
        title: "Select a date",
        description: "Choose a shift date to approve.",
        variant: "destructive",
      });
      return;
    }
    if (!approvedBy.trim()) {
      toast({
        title: "Manager name required",
        description: "Enter the approving manager name.",
        variant: "destructive",
      });
      return;
    }

    setApproving(true);
    try {
      const response = await fetch("/api/analysis/approve-shift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": managerRole,
        },
        body: JSON.stringify({
          date: selectedDate,
          notes: notes.trim() || null,
          approvedBy: approvedBy.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Approval failed");
      }

      generateApprovalPdf();

      toast({
        title: "Shift approved",
        description: "Shift approved, snapshot created, PDF ready, data sent to P&L.",
      });
    } catch (error: any) {
      toast({
        title: "Approval failed",
        description: error?.message || "Unable to approve shift.",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] p-4 space-y-6">
      <header className="border-b pb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-sm font-extrabold">Daily Sales & Shift Analysis</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600">Selected date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
          {comparison?.shiftWindow && (
            <span className="text-xs text-gray-500">
              Shift window: {comparison.shiftWindow}
            </span>
          )}
        </div>

        {isComparisonLoading && <div className="text-sm text-gray-600">Loading shift comparison…</div>}
        {!isComparisonLoading && comparison && (
          <div className="rounded border p-4">
            <div className="flex flex-col gap-2">
              {isMessage(comparison.staffData) && (
                <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
                  Staff form: {comparison.staffData.message}
                </div>
              )}
              {isMessage(comparison.posShiftReport) && (
                <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
                  Loyverse shift report: {comparison.posShiftReport.message}
                </div>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500">Item</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500">Staff Form</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500">Loyverse Shift Report</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b">
                      <td className="px-3 py-2 text-gray-600">{row.label}</td>
                      <td className="px-3 py-2">{renderCell(row.staff)}</td>
                      <td className="px-3 py-2">{renderCell(row.pos)}</td>
                      <td className="px-3 py-2">{renderDiff(row.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-500">Staff Daily Sales & Stock v2</h3>
                <div className="mt-2 text-sm text-gray-700">
                  <div>Total Sales: {renderCell(staffData?.totalSales ?? null)}</div>
                  <div>Cash: {renderCell(staffData?.cashSales ?? null)}</div>
                  <div>Grab: {renderCell(staffData?.grabSales ?? null)}</div>
                  <div>Scan (QR): {renderCell(staffData?.scanSales ?? null)}</div>
                  <div>Expenses: {renderCell(staffData?.expensesTotal ?? null)}</div>
                  <div>Rolls Remaining: {renderCell(staffData?.rollsEnd ?? null)}</div>
                  <div>Meat Remaining (g): {renderCell(staffData?.meatEnd ?? null)}</div>
                  <div>Drinks Remaining: {renderCell(staffData?.drinksCount ?? null)}</div>
                </div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-500">Loyverse Shift Report Totals</h3>
                <div className="mt-2 text-sm text-gray-700">
                  <div>Total Sales: {renderCell(posShift?.totalSales ?? null)}</div>
                  <div>Cash Payments: {renderCell(posShift?.cashPayments ?? null)}</div>
                  <div>Grab: {renderCell(posShift?.grab ?? null)}</div>
                  <div>Scan (QR): {renderCell(posShift?.scan ?? null)}</div>
                  <div>Expenses (Paid Out): {renderCell(posShift?.expenses ?? null)}</div>
                </div>
                <div className="mt-3 border-t pt-3 text-sm text-gray-700">
                  <div>Starting Cash: {renderCell(posShift?.startingCash ?? null)}</div>
                  <div>Expected Cash: {renderCell(posShift?.expectedCash ?? null)}</div>
                  <div>Actual Cash: {renderCell(posShift?.actualCash ?? null)}</div>
                  <div>Difference: {renderCell(posShift?.difference ?? null)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="border-t pt-4">
        <h2 className="text-sm font-bold mb-3">Manager Review & Sign Off</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-500">Manager Name</label>
            <input
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              value={approvedBy}
              onChange={(event) => setApprovedBy(event.target.value)}
              placeholder="Manager name"
            />
            <div className="mt-2 text-xs text-gray-500">
              Approval requires manager role.
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Notes / Explanation</label>
            <textarea
              className="mt-1 w-full rounded border p-2 text-sm min-h-[120px]"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Record findings or explanations for this shift."
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={approveShift}
            disabled={!canApprove || approving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {approving ? "Approving…" : "Approve & Close Shift"}
          </button>
          {!canApprove && (
            <span className="text-xs text-gray-500">Manager role required to approve.</span>
          )}
        </div>
      </section>

      <section className="border-t pt-6 mt-8">
        <div className="mb-4">
          <h2 className="text-sm font-extrabold mb-4">All Shifts Data</h2>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <input
              id="export-by-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
            <button
              onClick={() => selectedDate && window.open(`/api/analysis/daily-sales/export.csv?date=${selectedDate}`, "_blank")}
              className="border rounded px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!selectedDate}
            >
              Export by Date (CSV)
            </button>
          </div>

          {isDailySalesLoading && <p className="text-sm mt-4">Loading...</p>}
          {!isDailySalesLoading && dailySalesRows.length === 0 && (
            <p className="text-sm text-gray-500 mt-4">No data available</p>
          )}
        </div>

        {!isDailySalesLoading && dailySalesRows.length > 0 && (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            <table className="border-collapse text-xs sm:text-sm" style={{ minWidth: "1400px" }}>
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-3 py-2 text-left whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Completed By</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Cash</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">QR</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Grab</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Other</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Exp Cash</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Exp QR</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Exp Total</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Shopping</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Wages</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Other Exp</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Tot Exp</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Rolls</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Meat (g)</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Export</th>
                </tr>
              </thead>
              <tbody>
                {dailySalesRows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{r.shift_date}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.completed_by}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.total_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.cash_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.qr_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.grab_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.aroi_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.expected_cash_bank || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.expected_qr_bank || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.expected_total_bank || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.shopping_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.wages_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.others_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.total_expenses || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.rolls_end || 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.meat_end_g || 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <a
                        className="underline text-xs text-emerald-600 hover:text-emerald-700"
                        href={`/api/analysis/daily-sales/export.csv?id=${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Export
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
