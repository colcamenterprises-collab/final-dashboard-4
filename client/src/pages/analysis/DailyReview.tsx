import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, CheckCircle, AlertTriangle } from "lucide-react";
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
        <Badge variant="secondary" className="text-xs text-slate-400" data-testid={testId}>
          Missing
        </Badge>
      );
    }
    return <span className="text-sm text-slate-700" data-testid={testId}>{fmt(value)}</span>;
  };

  const renderDiff = (value: number | null) => {
    if (value === null || value === undefined) {
      return (
        <Badge variant="secondary" className="text-xs text-slate-400">
          Missing
        </Badge>
      );
    }
    if (value === 0) return <span className="text-sm text-slate-700">{fmt(value)}</span>;
    return <span className="text-sm font-semibold text-red-600">{fmt(value)}</span>;
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
    <div className="mx-auto max-w-[1100px] p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Daily Sales & Shift Analysis</h1>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-600">Month</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-auto rounded-[4px] text-sm"
          />
        </div>
      </div>

      <Card className="rounded-[4px] border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-emerald-600" />
            Shift Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm text-slate-600">Selected date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-auto rounded-[4px] text-sm"
            />
            {comparison?.shiftWindow && (
              <span className="text-xs text-slate-500">
                Shift window: {comparison.shiftWindow}
              </span>
            )}
          </div>

          {isComparisonLoading && <div className="text-sm text-slate-500">Loading shift comparison...</div>}
          {!isComparisonLoading && comparison && (
            <div className="space-y-4">
              {isMessage(comparison.staffData) && (
                <div className="flex items-center gap-2 rounded-[4px] border border-slate-200 bg-slate-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Staff form: {comparison.staffData.message}</span>
                </div>
              )}
              {isMessage(comparison.posShiftReport) && (
                <div className="flex items-center gap-2 rounded-[4px] border border-slate-200 bg-slate-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">Loyverse shift report: {comparison.posShiftReport.message}</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-[4px] border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold text-slate-600">Item</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Staff Form</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Loyverse Shift Report</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm text-slate-600">{row.label}</TableCell>
                        <TableCell>{renderCell(row.staff)}</TableCell>
                        <TableCell>{renderCell(row.pos)}</TableCell>
                        <TableCell>{renderDiff(row.diff)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="rounded-[4px] border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-600">Staff Daily Sales & Stock v2</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-slate-700">
                    <div>Total Sales: {renderCell(staffData?.totalSales ?? null)}</div>
                    <div>Cash: {renderCell(staffData?.cashSales ?? null)}</div>
                    <div>Grab: {renderCell(staffData?.grabSales ?? null)}</div>
                    <div>Scan (QR): {renderCell(staffData?.scanSales ?? null)}</div>
                    <div>Expenses: {renderCell(staffData?.expensesTotal ?? null)}</div>
                    <div>Rolls Remaining: {renderCell(staffData?.rollsEnd ?? null)}</div>
                    <div>Meat Remaining (g): {renderCell(staffData?.meatEnd ?? null)}</div>
                    <div>Drinks Remaining: {renderCell(staffData?.drinksCount ?? null)}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-[4px] border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-600">Loyverse Shift Report Totals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-slate-700">
                    <div>Total Sales: {renderCell(posShift?.totalSales ?? null)}</div>
                    <div>Cash Payments: {renderCell(posShift?.cashPayments ?? null)}</div>
                    <div>Grab: {renderCell(posShift?.grab ?? null)}</div>
                    <div>Scan (QR): {renderCell(posShift?.scan ?? null)}</div>
                    <div>Expenses (Paid Out): {renderCell(posShift?.expenses ?? null)}</div>
                    <div className="border-t border-slate-200 pt-2 mt-2">Starting Cash: {renderCell(posShift?.startingCash ?? null)}</div>
                    <div>Expected Cash: {renderCell(posShift?.expectedCash ?? null)}</div>
                    <div>Actual Cash: {renderCell(posShift?.actualCash ?? null)}</div>
                    <div>Difference: {renderCell(posShift?.difference ?? null)}</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Manager Review & Sign Off
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1 space-y-2">
              <Label className="text-sm text-slate-600">Manager Name</Label>
              <Input
                className="rounded-[4px] text-sm"
                value={approvedBy}
                onChange={(event) => setApprovedBy(event.target.value)}
                placeholder="Manager name"
              />
              <p className="text-xs text-slate-400">Approval requires manager role.</p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm text-slate-600">Notes / Explanation</Label>
              <Textarea
                className="rounded-[4px] text-sm min-h-[120px]"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Record findings or explanations for this shift."
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={approveShift}
              disabled={!canApprove || approving}
              className="rounded-[4px] bg-emerald-600 text-sm text-white hover:bg-emerald-700"
            >
              {approving ? "Approving..." : "Approve & Close Shift"}
            </Button>
            {!canApprove && (
              <span className="text-xs text-slate-400">Manager role required to approve.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4 text-emerald-600" />
            All Shifts Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto rounded-[4px] text-sm"
            />
            <Button
              onClick={() => selectedDate && window.open(`/api/analysis/daily-sales/export.csv?date=${selectedDate}`, "_blank")}
              disabled={!selectedDate}
              className="rounded-[4px] bg-emerald-600 text-sm text-white hover:bg-emerald-700"
            >
              Export by Date (CSV)
            </Button>
          </div>

          {isDailySalesLoading && <p className="text-sm text-slate-500">Loading...</p>}
          {!isDailySalesLoading && dailySalesRows.length === 0 && (
            <p className="text-sm text-slate-400">No data available</p>
          )}

          {!isDailySalesLoading && dailySalesRows.length > 0 && (
            <div className="overflow-x-auto rounded-[4px] border border-slate-200" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
              <Table style={{ minWidth: "1400px" }}>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-600 whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 whitespace-nowrap">Completed By</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Total</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Cash</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">QR</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Grab</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Other</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Exp Cash</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Exp QR</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Exp Total</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Shopping</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Wages</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Other Exp</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Tot Exp</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Rolls</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Meat (g)</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">Export</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySalesRows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">{r.shift_date}</TableCell>
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">{r.completed_by}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.total_sales || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.cash_sales || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.qr_sales || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.grab_sales || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.aroi_sales || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.expected_cash_bank || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.expected_qr_bank || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.expected_total_bank || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.shopping_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.wages_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.others_total || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{(r.total_expenses || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{r.rolls_end || 0}</TableCell>
                      <TableCell className="text-sm text-slate-700 text-right whitespace-nowrap">{r.meat_end_g || 0}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <a
                          className="text-xs text-emerald-600 hover:text-emerald-700 underline"
                          href={`/api/analysis/daily-sales/export.csv?id=${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Export
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
