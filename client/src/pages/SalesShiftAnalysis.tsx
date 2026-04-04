import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ShiftData {
  total?: number;
  cash?: number;
  qr?: number;
  grab?: number;
  other?: number;
  exp_cash?: number;
  exp?: number;
  refunds?: number;
  txn_count?: number;
  closing_cash?: number;
  cash_banked?: number;
  qr_transfer?: number;
  net_position?: number;
  receipt_count?: number;
  receipt_numbers?: string[];
  source?: string;
}

interface ShiftSnapshotRow {
  date: string;
  approved: boolean;
  pos_data?: ShiftData;
  form_data?: ShiftData;
}

type ReconSeverity = "ok" | "warn" | "critical" | "unknown";
type AlertSeverity = "OK" | "Warning" | "Critical";

interface UsageReconData {
  ok: boolean;
  date: string;
  prevDate: string;
  engineBuilt: boolean;
  form2Available: boolean;
  prevForm2Available: boolean;
  overallSeverity: ReconSeverity;
  noPurchasesLogged?: boolean;
  buns: {
    expected: number | null; opening: number | null; received: number;
    closing: number | null; physicalUsed: number | null;
    variance: number | null; severity: ReconSeverity;
    thresholds: { warn: number; critical: number };
  };
  meat: {
    expectedGrams: number | null; openingGrams: number | null; receivedGrams: number;
    closingGrams: number | null; physicalUsedGrams: number | null;
    varianceGrams: number | null; severity: ReconSeverity;
    thresholds: { warn: number; critical: number };
  };
  drinks: {
    totalExpected: number; totalPhysicalUsed: number | null; totalVariance: number | null;
    rows: {
      field: string; label: string;
      expected: number | null; opening: number | null; received: number;
      closing: number | null; physicalUsed: number | null;
      variance: number | null; severity: ReconSeverity;
    }[];
    thresholds: { warn: number; critical: number };
  };
  confidence: { engineRowCount: number; unmappedItems: number; estimatedModifiers: number };
}

const categories: Array<{ key: keyof ShiftData; label: string }> = [
  { key: 'total', label: 'Total Sales' },
  { key: 'cash', label: 'Cash' },
  { key: 'qr', label: 'QR / Promptpay' },
  { key: 'grab', label: 'GrabFood' },
  { key: 'other', label: 'Other' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'exp_cash', label: 'Expenses (Cash)' },
  { key: 'exp', label: 'Expenses (Total)' },
];

const toNum = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });
const todayBkk = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const TABLE_TEXT_CLASS = 'text-xs';
const TABLE_CELL_CLASS = 'p-2';
const INPUT_CLASS = 'border border-slate-200 rounded-[4px] px-2.5 py-1.5 leading-5 bg-white text-slate-800';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function severityLabel(severity: ReconSeverity): AlertSeverity {
  if (severity === 'critical') return 'Critical';
  if (severity === 'warn') return 'Warning';
  return 'OK';
}

export default function SalesShiftAnalysis() {
  const [selectedDate, setSelectedDate] = useState(todayBkk());
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  // Auto-load: on first mount, resolve the latest shift that has data and jump to it
  useEffect(() => {
    if (autoLoaded) return;
    setAutoLoaded(true);
    fetch('/api/latest-valid-shift')
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j?.date && j.date !== todayBkk()) {
          setSelectedDate(j.date);
        }
      })
      .catch(() => { /* silently fall back to today */ });
  }, [autoLoaded]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selectedDate]);

  const { data: formData, isLoading: formLoading } = useQuery<ShiftData>({
    queryKey: ['daily-sales', selectedDate],
    queryFn: () => getJson(`/api/daily-sales-v2/${selectedDate}`),
  });

  const { data: posData, isLoading: posLoading } = useQuery<ShiftData>({
    queryKey: ['pos-shift', selectedDate],
    queryFn: () => getJson(`/api/pos-shift/${selectedDate}`),
  });

  const { data: allShifts } = useQuery<ShiftSnapshotRow[]>({
    queryKey: ['shift-snapshots'],
    queryFn: () => getJson('/api/shift-snapshots'),
  });

  const { data: usageRecon, isLoading: reconLoading } = useQuery<UsageReconData | null>({
    queryKey: ['usage-reconciliation', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/usage-reconciliation?date=${selectedDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });


  const rows = useMemo(() => {
    return categories.map(({ key, label }) => {
      const form = toNum(formData?.[key]);
      const pos = toNum(posData?.[key]);
      const diff = form - pos;
      const absDiff = Math.abs(diff);
      const flagged = key !== 'exp_cash' && key !== 'exp' && absDiff > Math.max(5, pos * 0.05);
      return { label, form, pos, diff, absDiff, flagged };
    });
  }, [formData, posData]);

  const filteredShifts = useMemo(() => {
    if (!allShifts?.length) return [];
    return allShifts.filter((row) => {
      const d = new Date(`${row.date}T00:00:00Z`);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    });
  }, [allShifts]);

  const historyPageSize = 10;
  const totalHistoryPages = Math.max(1, Math.ceil(filteredShifts.length / historyPageSize));
  const pagedHistory = filteredShifts.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);
  const anomalyRows = useMemo(() => {
    if (!usageRecon?.ok) return [];
    const rows: Array<{
      category: string;
      item: string;
      expected: string;
      actual: string;
      variance: string;
      severity: AlertSeverity;
      notes: string;
    }> = [];
    const bunsSeverity = severityLabel(usageRecon.buns.severity);
    rows.push({
      category: 'Buns',
      item: 'Burger Buns',
      expected: usageRecon.buns.expected === null ? '—' : fmtInt(usageRecon.buns.expected),
      actual: usageRecon.buns.physicalUsed === null ? '—' : fmtInt(usageRecon.buns.physicalUsed),
      variance: usageRecon.buns.variance === null ? '—' : `${usageRecon.buns.variance >= 0 ? '+' : ''}${fmtInt(usageRecon.buns.variance)}`,
      severity: bunsSeverity,
      notes: bunsSeverity === 'Critical' ? 'Usage materially outside expected range' : bunsSeverity === 'Warning' ? 'Moderate buns variance' : 'Within threshold',
    });
    const meatSeverity = severityLabel(usageRecon.meat.severity);
    rows.push({
      category: 'Meat',
      item: 'Beef (g)',
      expected: usageRecon.meat.expectedGrams === null ? '—' : fmtInt(usageRecon.meat.expectedGrams),
      actual: usageRecon.meat.physicalUsedGrams === null ? '—' : fmtInt(usageRecon.meat.physicalUsedGrams),
      variance: usageRecon.meat.varianceGrams === null ? '—' : `${usageRecon.meat.varianceGrams >= 0 ? '+' : ''}${fmtInt(usageRecon.meat.varianceGrams)}g`,
      severity: meatSeverity,
      notes: meatSeverity === 'Critical' ? 'Material meat usage mismatch' : meatSeverity === 'Warning' ? 'Below/above expected usage' : 'Within threshold',
    });
    usageRecon.drinks.rows.forEach((drink) => {
      const drinkSeverity = severityLabel(drink.severity);
      rows.push({
        category: 'Drinks',
        item: drink.label,
        expected: drink.expected === null ? '—' : fmtInt(drink.expected),
        actual: drink.physicalUsed === null ? '—' : fmtInt(drink.physicalUsed),
        variance: drink.variance === null ? '—' : `${drink.variance >= 0 ? '+' : ''}${fmtInt(drink.variance)}`,
        severity: drinkSeverity,
        notes: drinkSeverity === 'Critical' ? 'Major unexplained variance' : drinkSeverity === 'Warning' ? 'Monitor drink variance' : 'Within threshold',
      });
    });
    return rows;
  }, [usageRecon]);

  const drinkAnomalyCount = anomalyRows.filter((row) => row.category === 'Drinks' && row.severity !== 'OK').length;

  const posHasData = toNum(posData?.total) > 0;
  const formHasData = toNum(formData?.total) > 0;
  return (
    <div className="admin-page w-full max-w-5xl mx-auto p-4 space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 page-title">Sales &amp; Shift Analysis</h1>
          <p className="text-xs text-slate-500 mt-0.5">Management summary, anomaly detection, and cross-shift review</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); }}
          className={INPUT_CLASS}
        />
      </div>

      {/* ── Data availability badges ── */}
      <div className="flex gap-2 text-xs flex-wrap">
        <span className={`px-2 py-1 rounded-[4px] border ${formHasData ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
          Form data: {formHasData ? `฿${fmt(toNum(formData?.total))}` : 'none for this date'}
        </span>
        <span className={`px-2 py-1 rounded-[4px] border ${posHasData ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
          POS data: {posHasData
            ? `฿${fmt(toNum(posData?.total))} · ${toNum(posData?.txn_count)} txns${posData?.source === 'receipt_truth_line' ? ' (Loyverse)' : ''}`
            : 'no receipts for this date'}
        </span>
      </div>

      {/* ── Form vs POS Comparison (1) ── */}
      {(formLoading || posLoading) ? (
        <div className="text-sm text-slate-500">Loading comparison...</div>
      ) : (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-slate-700">Form vs POS Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className={`w-full ${TABLE_TEXT_CLASS}`}>
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Category</th>
                  <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Staff Form</th>
                  <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>POS / Loyverse</th>
                  <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={`border-b ${r.flagged ? 'bg-red-100/40' : ''}`}>
                    <td className={`${TABLE_CELL_CLASS} text-slate-700`}>{r.label}</td>
                    <td className={`${TABLE_CELL_CLASS} text-right font-mono`}>{fmt(r.form)}</td>
                    <td className={`${TABLE_CELL_CLASS} text-right font-mono`}>{fmt(r.pos)}</td>
                    <td className={`${TABLE_CELL_CLASS} text-right font-mono ${r.flagged ? 'text-red-600 font-semibold' : r.absDiff < 1 ? 'text-slate-400' : 'text-slate-700'}`}>
                      {r.diff >= 0 ? '+' : ''}{fmt(r.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stock Anomalies / Issues (2) ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-slate-700">Stock Anomalies / Issues (Selected Shift)</CardTitle>
            {usageRecon && (
              <Badge className={`text-xs ${
                usageRecon.overallSeverity === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                usageRecon.overallSeverity === 'warn'     ? 'bg-amber-100 text-amber-800 border-amber-200' :
                usageRecon.overallSeverity === 'ok'       ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                            'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {usageRecon.overallSeverity.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reconLoading ? (
            <div className="text-sm text-slate-500">Loading anomaly data...</div>
          ) : !usageRecon || !usageRecon.ok ? (
            <div className="text-sm text-amber-700">Stock anomalies unavailable for this date.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className={`rounded-[4px] border p-3 ${
                  usageRecon.buns.severity === 'critical' ? 'border-red-300 bg-red-100/40' :
                  usageRecon.buns.severity === 'warn' ? 'border-amber-300 bg-amber-100/40' : 'border-emerald-300 bg-emerald-100/20'
                }`}>
                  <div className="text-slate-500 text-xs mb-1">Buns Status</div>
                  <div className="text-xs text-slate-400">Expected: <span className="font-mono text-slate-700">{usageRecon.buns.expected ?? '—'}</span></div>
                  <div className="text-xs text-slate-400">Actual / Physical: <span className="font-mono text-slate-700">{usageRecon.buns.physicalUsed ?? '—'}</span></div>
                  <div className={`text-xs font-semibold mt-1 ${
                    usageRecon.buns.severity === 'critical' ? 'text-red-700' :
                    usageRecon.buns.severity === 'warn' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {severityLabel(usageRecon.buns.severity)}
                  </div>
                </div>
                <div className={`rounded-[4px] border p-3 ${
                  usageRecon.meat.severity === 'critical' ? 'border-red-300 bg-red-100/40' :
                  usageRecon.meat.severity === 'warn' ? 'border-amber-300 bg-amber-100/40' : 'border-emerald-300 bg-emerald-100/20'
                }`}>
                  <div className="text-slate-500 text-xs mb-1">Meat Status</div>
                  <div className="text-xs text-slate-400">Expected: <span className="font-mono text-slate-700">{usageRecon.meat.expectedGrams !== null ? usageRecon.meat.expectedGrams.toLocaleString() : '—'}</span></div>
                  <div className="text-xs text-slate-400">Actual / Physical: <span className="font-mono text-slate-700">{usageRecon.meat.physicalUsedGrams !== null ? usageRecon.meat.physicalUsedGrams.toLocaleString() : '—'}</span></div>
                  <div className={`text-xs font-semibold mt-1 ${
                    usageRecon.meat.severity === 'critical' ? 'text-red-700' :
                    usageRecon.meat.severity === 'warn' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {severityLabel(usageRecon.meat.severity)}
                  </div>
                </div>
                <div className={`rounded-[4px] border p-3 ${
                  drinkAnomalyCount > 2 ? 'border-red-300 bg-red-100/40' :
                  drinkAnomalyCount > 0 ? 'border-amber-300 bg-amber-100/40' : 'border-emerald-300 bg-emerald-100/20'
                }`}>
                  <div className="text-slate-500 text-xs mb-1">Drink Anomalies</div>
                  <div className="text-xs text-slate-400">Anomaly rows: <span className="font-mono text-slate-700">{drinkAnomalyCount}</span></div>
                  <div className="text-xs text-slate-400">Tracked drinks: <span className="font-mono text-slate-700">{usageRecon.drinks.rows.length}</span></div>
                  <div className={`text-xs font-semibold mt-1 ${drinkAnomalyCount > 2 ? 'text-red-700' : drinkAnomalyCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {drinkAnomalyCount > 2 ? 'Critical' : drinkAnomalyCount > 0 ? 'Warning' : 'OK'}
                  </div>
                </div>
                <div className={`rounded-[4px] border p-3 ${
                  usageRecon.overallSeverity === 'critical' ? 'border-red-300 bg-red-100/40' :
                  usageRecon.overallSeverity === 'warn' ? 'border-amber-300 bg-amber-100/40' : 'border-emerald-300 bg-emerald-100/20'
                }`}>
                  <div className="text-slate-500 text-xs mb-1">Overall Stock Status</div>
                  <div className="text-xs text-slate-400">Buns variance: <span className="font-mono text-slate-700">{usageRecon.buns.variance ?? '—'}</span></div>
                  <div className="text-xs text-slate-400">Meat variance (g): <span className="font-mono text-slate-700">{usageRecon.meat.varianceGrams ?? '—'}</span></div>
                  <div className={`text-xs font-semibold mt-1 ${
                    usageRecon.overallSeverity === 'critical' ? 'text-red-700' :
                    usageRecon.overallSeverity === 'warn' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {severityLabel(usageRecon.overallSeverity)}
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="text-xs font-medium text-slate-500 mb-2">Shift Stock Anomalies / Issues</div>
                <table className={`w-full ${TABLE_TEXT_CLASS}`}>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Category</th>
                      <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Item</th>
                      <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Expected</th>
                      <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Actual / Physical / Recorded</th>
                      <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Variance</th>
                      <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Severity</th>
                      <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Notes / Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyRows.map((row) => (
                      <tr key={`${row.category}-${row.item}`} className={`border-b ${
                        row.severity === 'Critical' ? 'bg-red-100/40' :
                        row.severity === 'Warning' ? 'bg-amber-100/40' : ''
                      }`}>
                        <td className={`${TABLE_CELL_CLASS} text-slate-700`}>{row.category}</td>
                        <td className={`${TABLE_CELL_CLASS} text-slate-700`}>{row.item}</td>
                        <td className={`${TABLE_CELL_CLASS} text-right font-mono`}>{row.expected}</td>
                        <td className={`${TABLE_CELL_CLASS} text-right font-mono`}>{row.actual}</td>
                        <td className={`${TABLE_CELL_CLASS} text-right font-mono font-semibold ${
                          row.severity === 'Critical' ? 'text-red-700' :
                          row.severity === 'Warning' ? 'text-amber-700' : 'text-emerald-700'
                        }`}>
                          {row.variance}
                        </td>
                        <td className={`${TABLE_CELL_CLASS} text-slate-700`}>{row.severity}</td>
                        <td className={`${TABLE_CELL_CLASS} text-slate-600`}>{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {/* ── All Shifts History (3 / last) ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-slate-700">All Shifts History</CardTitle>
            <span className="text-xs text-slate-500">Showing last 30 days with Daily Sales &amp; Stock v2 Form 1 figures</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className={`w-full ${TABLE_TEXT_CLASS}`}>
            <thead>
              <tr className="border-b border-slate-200">
                <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Date</th>
                <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Status</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Total Sales</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Cash</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>QR / Promptpay</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>GrabFood</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Other</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Refunds</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Total Expenses</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Closing Cash</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Cash Banked</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>QR Transfer Amount</th>
                <th className={`text-right ${TABLE_CELL_CLASS} font-medium text-slate-600`}>NP</th>
                <th className={`text-left ${TABLE_CELL_CLASS} font-medium text-slate-600`}>Receipt Count / Receipt Numbers</th>
              </tr>
            </thead>
            <tbody>
              {pagedHistory.map((row) => (
                <tr
                  key={row.date}
                  className={`border-b cursor-pointer hover:bg-slate-100/40 transition-colors ${row.date === selectedDate ? 'bg-emerald-100/30 border-l-2 border-l-emerald-500' : ''}`}
                  onClick={() => setSelectedDate(row.date)}
                >
                  <td className={`${TABLE_CELL_CLASS} text-slate-700`}>{row.date}</td>
                  <td className={TABLE_CELL_CLASS}>
                    <Badge className={`text-xs ${row.approved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {row.approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.total))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.cash))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.qr))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.grab))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.other))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.refunds))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.exp))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.closing_cash))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.cash_banked))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.qr_transfer))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-right tabular-nums text-slate-700`}>{fmt(toNum(row.form_data?.net_position))}</td>
                  <td className={`${TABLE_CELL_CLASS} text-slate-700`}>
                    <details>
                      <summary className="cursor-pointer">
                        {toNum(row.form_data?.receipt_count)} receipts
                      </summary>
                      <div className="mt-1 text-[11px] text-slate-500 max-w-[280px] break-words">
                        {(row.form_data?.receipt_numbers?.length ?? 0) > 0
                          ? row.form_data?.receipt_numbers?.join(', ')
                          : 'No receipt numbers stored for this shift'}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {(pagedHistory.length === 0) && (
                <tr><td colSpan={15} className="p-4 text-center text-slate-400 text-xs">No shift history available</td></tr>
              )}
            </tbody>
          </table>
          </div>
          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-200">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500">Page {historyPage} / {totalHistoryPages}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                disabled={historyPage === totalHistoryPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
