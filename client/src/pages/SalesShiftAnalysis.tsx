import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

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
  source?: string;
}

interface ShiftSnapshotRow {
  date: string;
  approved: boolean;
  pos_data?: ShiftData;
  form_data?: ShiftData;
}

interface BobReport {
  id: string;
  shift_date: string;
  analysis_type: string;
  status: string;
  summary: string;
  data_json: {
    pos?: { total_baht: number; refunds_baht: number; txn_count: number; payment_breakdown_available?: boolean };
    form?: { total_baht: number; submitted_by: string; cash_baht?: number; qr_baht?: number };
    stock?: { rolls_variance: number | null; meat_variance_g: number | null };
    top_items?: { name: string; sold: number; category: string }[];
    issues?: (string | { type?: string; message?: string; check?: string; detail?: string })[];
    recommendations?: string[];
    email_sent?: { sent: boolean; sent_at: string; recipient: string };
    codex_handoff?: {
      issues: string[];
      recommendations: string[];
      instruction: string;
    } | null;
  };
  created_at: string;
  created_by: string;
}

interface BobAdjustment {
  id: string;
  analysis_report_id: string;
  source_table: string;
  source_field: string;
  original_value: string | null;
  adjusted_value: string;
  reason: string;
  created_by: string;
  review_status: string;
  created_at: string;
}

interface DailyUsageData {
  date: string;
  receiptTruthBuiltAt: string | null;
  dailyUsageBuiltAt: string | null;
  summary: {
    expectedBuns: number;
    expectedBeefGrams: number;
    expectedChickenGrams: number;
    totalDrinksUsed: number;
    cokeUsed: number;
    cokeZeroUsed: number;
    spriteUsed: number;
    waterUsed: number;
    fantaOrangeUsed: number;
    fantaStrawberryUsed: number;
    schweppesManaoUsed: number;
  };
}

type ReconSeverity = "ok" | "warn" | "critical" | "unknown";

interface UsageReconData {
  ok: boolean;
  date: string;
  prevDate: string;
  engineBuilt: boolean;
  form2Available: boolean;
  prevForm2Available: boolean;
  overallSeverity: ReconSeverity;
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
const todayBkk = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const statusColors: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
};

const reviewStatusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

function issueText(issue: string | { type?: string; message?: string; check?: string; detail?: string }): string {
  if (typeof issue === 'string') return issue;
  return issue.message || issue.detail || issue.type || JSON.stringify(issue);
}

export default function SalesShiftAnalysis() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayBkk());
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [notes, setNotes] = useState('');
  const [cashBanked, setCashBanked] = useState('0');
  const [qrBanked, setQrBanked] = useState('0');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const managerName = 'dashboard';

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

  const { data: dailyUsage, isLoading: usageLoading } = useQuery<DailyUsageData | null>({
    queryKey: ['receipt-daily-usage', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts-truth/daily-usage?date=${selectedDate}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: usageRecon, isLoading: reconLoading } = useQuery<UsageReconData | null>({
    queryKey: ['usage-reconciliation', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/usage-reconciliation?date=${selectedDate}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: issueByShift, refetch: refetchIssues } = useQuery<{
    ok: boolean; date: string; issues: { id: number; severity: string; status: string; title: string }[]; openCount: number; criticalCount: number;
  } | null>({
    queryKey: ['issue-register-by-shift', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return null;
      const res = await fetch(`/api/issue-register/by-shift/${selectedDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const autoCreateIssuesMutation = useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch('/api/issue-register/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-register-by-shift', selectedDate] });
      refetchIssues();
    },
  });

  const { data: bobReportData, refetch: refetchBobReport } = useQuery<{ ok: boolean; report: BobReport | null }>({
    queryKey: ['bob-analysis', selectedDate],
    queryFn: () => getJson(`/api/ai-ops/bob/analysis/${selectedDate}`),
  });
  const bobReport = bobReportData?.report ?? null;

  const { data: adjustmentsData, refetch: refetchAdjustments } = useQuery<{
    ok: boolean; date: string; count: number; adjustments: BobAdjustment[];
  }>({
    queryKey: ['bob-adjustments', selectedDate],
    queryFn: () => getJson(`/api/ai-ops/bob/adjustments/${selectedDate}`),
  });
  const adjustments = adjustmentsData?.adjustments ?? [];

  const runAnalysisMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai-ops/bob/run-analysis', { shift_date: selectedDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bob-analysis', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['bob-adjustments', selectedDate] });
      refetchBobReport();
      refetchAdjustments();
    },
  });

  const emailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai-ops/bob/email/trigger', { shift_date: selectedDate }),
    onSuccess: (data: any) => {
      setEmailStatus(data?.email_sent ? `Sent to ${data.recipient}` : 'Send failed — check Gmail');
      setTimeout(() => setEmailStatus(null), 6000);
      queryClient.invalidateQueries({ queryKey: ['bob-analysis', selectedDate] });
    },
    onError: () => {
      setEmailStatus('Email trigger failed');
      setTimeout(() => setEmailStatus(null), 4000);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest('PATCH', `/api/ai-ops/bob/adjustments/${id}/review`, { review_status: status }),
    onSuccess: () => refetchAdjustments(),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/approve-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'manager', 'x-user-id': managerName },
        body: JSON.stringify({ date: selectedDate, cash_banked: toNum(cashBanked), qr_banked: toNum(qrBanked), notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pnl'] });
      queryClient.invalidateQueries({ queryKey: ['shift-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['pos-shift', selectedDate] });
      alert('Shift approved successfully');
    },
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

  const posHasData = toNum(posData?.total) > 0;
  const formHasData = toNum(formData?.total) > 0;
  const issues = bobReport?.data_json?.issues ?? [];
  const bobBorderClass = bobReport
    ? bobReport.status === 'ok' ? 'border-emerald-200'
    : bobReport.status === 'warning' ? 'border-amber-200'
    : 'border-red-200'
    : 'border-slate-200';

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Sales &amp; Shift Analysis</h1>
          <p className="text-xs text-slate-500 mt-0.5">Single truth screen — Form vs POS comparison + Bob Review</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setEmailStatus(null); }}
          className="border border-slate-200 rounded-[4px] px-3 py-1.5 text-sm"
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

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium text-slate-700">Expected Stock Usage (Stored Receipts Truth)</CardTitle>
            {dailyUsage && dailyUsage.receiptTruthBuiltAt && dailyUsage.dailyUsageBuiltAt &&
              dailyUsage.receiptTruthBuiltAt > dailyUsage.dailyUsageBuiltAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                ⚠ Usage out of date — rebuild required
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageLoading ? (
            <div className="text-sm text-slate-500">Loading stored daily usage...</div>
          ) : !dailyUsage ? (
            <div className="text-sm text-amber-700">No stored daily usage for this date. Rebuild Receipts Analysis first.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-slate-500 text-xs">Expected Buns</div>
                  <div className="font-semibold">{fmt(toNum(dailyUsage.summary.expectedBuns))}</div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-slate-500 text-xs">Expected Beef (g)</div>
                  <div className="font-semibold">{fmt(toNum(dailyUsage.summary.expectedBeefGrams))}</div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-slate-500 text-xs">Expected Chicken (g)</div>
                  <div className="font-semibold">{fmt(toNum(dailyUsage.summary.expectedChickenGrams))}</div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-slate-500 text-xs">Total Drinks Used</div>
                  <div className="font-semibold">{fmt(toNum(dailyUsage.summary.totalDrinksUsed))}</div>
                </div>
              </div>

              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-3 font-medium text-slate-600">Drink Type</th>
                    <th className="text-right p-3 font-medium text-slate-600">Expected Used</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Coke', dailyUsage.summary.cokeUsed],
                    ['Coke Zero', dailyUsage.summary.cokeZeroUsed],
                    ['Sprite', dailyUsage.summary.spriteUsed],
                    ['Water', dailyUsage.summary.waterUsed],
                    ['Orange Fanta', dailyUsage.summary.fantaOrangeUsed],
                    ['Strawberry Fanta', dailyUsage.summary.fantaStrawberryUsed],
                    ['Schweppes Manao', dailyUsage.summary.schweppesManaoUsed],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b">
                      <td className="p-3 text-slate-700">{label}</td>
                      <td className="p-3 text-right font-mono">{fmt(toNum(value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Usage Reconciliation: Engine vs Physical (Form 2) ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-slate-700">Stock Usage Reconciliation (Engine vs Form 2)</CardTitle>
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
            <div className="text-sm text-slate-500">Loading reconciliation data...</div>
          ) : !usageRecon || !usageRecon.ok ? (
            <div className="text-sm text-amber-700">Reconciliation unavailable for this date.</div>
          ) : (
            <>
              {/* Availability warnings */}
              {(!usageRecon.engineBuilt || !usageRecon.form2Available || !usageRecon.prevForm2Available) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {!usageRecon.engineBuilt && (
                    <span className="px-2 py-1 rounded-[4px] border bg-amber-100 text-amber-700 border-amber-200">Engine not built for this date — rebuild Receipts Analysis</span>
                  )}
                  {!usageRecon.form2Available && (
                    <span className="px-2 py-1 rounded-[4px] border bg-amber-100 text-amber-700 border-amber-200">Form 2 (closing counts) not submitted for this date</span>
                  )}
                  {!usageRecon.prevForm2Available && (
                    <span className="px-2 py-1 rounded-[4px] border bg-slate-100 text-slate-600 border-slate-200">Previous day Form 2 missing — opening stock unknown, physical usage not computed</span>
                  )}
                </div>
              )}

              {/* Buns + Meat headline tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {/* Buns */}
                <div className={`rounded border p-3 ${
                  usageRecon.buns.severity === 'critical' ? 'border-red-300 bg-red-50' :
                  usageRecon.buns.severity === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                }`}>
                  <div className="text-slate-500 text-xs mb-1">Buns</div>
                  <div className="text-xs text-slate-400">Expected: <span className="font-mono text-slate-700">{usageRecon.buns.expected ?? '—'}</span></div>
                  <div className="text-xs text-slate-400">Physical used: <span className="font-mono text-slate-700">{usageRecon.buns.physicalUsed ?? '—'}</span></div>
                  <div className={`text-xs font-semibold mt-1 ${
                    usageRecon.buns.severity === 'critical' ? 'text-red-700' :
                    usageRecon.buns.severity === 'warn' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    Δ {usageRecon.buns.variance !== null ? (usageRecon.buns.variance >= 0 ? '+' : '') + usageRecon.buns.variance : '—'}
                  </div>
                </div>
                {/* Buns breakdown */}
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-slate-500 text-xs mb-1">Buns Detail</div>
                  <div className="text-xs text-slate-400">Opening: <span className="font-mono">{usageRecon.buns.opening ?? '—'}</span></div>
                  <div className="text-xs text-slate-400">Received: <span className="font-mono">+{usageRecon.buns.received}</span></div>
                  <div className="text-xs text-slate-400">Closing: <span className="font-mono">{usageRecon.buns.closing ?? '—'}</span></div>
                </div>
                {/* Meat */}
                <div className={`rounded border p-3 ${
                  usageRecon.meat.severity === 'critical' ? 'border-red-300 bg-red-50' :
                  usageRecon.meat.severity === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                }`}>
                  <div className="text-slate-500 text-xs mb-1">Meat (g)</div>
                  <div className="text-xs text-slate-400">Expected: <span className="font-mono text-slate-700">{usageRecon.meat.expectedGrams !== null ? usageRecon.meat.expectedGrams.toLocaleString() : '—'}</span></div>
                  <div className="text-xs text-slate-400">Physical used: <span className="font-mono text-slate-700">{usageRecon.meat.physicalUsedGrams !== null ? usageRecon.meat.physicalUsedGrams.toLocaleString() : '—'}</span></div>
                  <div className={`text-xs font-semibold mt-1 ${
                    usageRecon.meat.severity === 'critical' ? 'text-red-700' :
                    usageRecon.meat.severity === 'warn' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    Δ {usageRecon.meat.varianceGrams !== null ? (usageRecon.meat.varianceGrams >= 0 ? '+' : '') + usageRecon.meat.varianceGrams.toLocaleString() + 'g' : '—'}
                  </div>
                </div>
                {/* Meat breakdown */}
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-slate-500 text-xs mb-1">Meat Detail</div>
                  <div className="text-xs text-slate-400">Opening: <span className="font-mono">{usageRecon.meat.openingGrams !== null ? usageRecon.meat.openingGrams.toLocaleString() + 'g' : '—'}</span></div>
                  <div className="text-xs text-slate-400">Received: <span className="font-mono">+{usageRecon.meat.receivedGrams.toLocaleString()}g</span></div>
                  <div className="text-xs text-slate-400">Closing: <span className="font-mono">{usageRecon.meat.closingGrams !== null ? usageRecon.meat.closingGrams.toLocaleString() + 'g' : '—'}</span></div>
                </div>
              </div>

              {/* Drinks reconciliation table */}
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="text-xs font-medium text-slate-500 mb-2">Drink Usage Reconciliation <span className="text-slate-400">(physical = opening + received − closing)</span></div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-2 font-medium text-slate-600">Drink</th>
                      <th className="text-right p-2 font-medium text-slate-600">Expected</th>
                      <th className="text-right p-2 font-medium text-slate-600">Opening</th>
                      <th className="text-right p-2 font-medium text-slate-600">+Received</th>
                      <th className="text-right p-2 font-medium text-slate-600">Closing</th>
                      <th className="text-right p-2 font-medium text-slate-600">Physical Used</th>
                      <th className="text-right p-2 font-medium text-slate-600">Variance Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageRecon.drinks.rows.map((row) => (
                      <tr key={row.field} className={`border-b ${
                        row.severity === 'critical' ? 'bg-red-100/40' :
                        row.severity === 'warn' ? 'bg-amber-100/40' : ''
                      }`}>
                        <td className="p-2 text-slate-700">{row.label}</td>
                        <td className="p-2 text-right font-mono">{row.expected ?? '—'}</td>
                        <td className="p-2 text-right font-mono text-slate-500">{row.opening ?? '—'}</td>
                        <td className="p-2 text-right font-mono text-slate-500">+{row.received}</td>
                        <td className="p-2 text-right font-mono text-slate-500">{row.closing ?? '—'}</td>
                        <td className="p-2 text-right font-mono">{row.physicalUsed ?? '—'}</td>
                        <td className={`p-2 text-right font-mono font-semibold ${
                          row.severity === 'critical' ? 'text-red-700' :
                          row.severity === 'warn' ? 'text-amber-700' :
                          row.severity === 'ok' ? 'text-emerald-700' : 'text-slate-400'
                        }`}>
                          {row.variance !== null ? (row.variance >= 0 ? '+' : '') + row.variance : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 font-semibold">
                      <td className="p-2 text-slate-700">Total Drinks</td>
                      <td className="p-2 text-right font-mono">{usageRecon.drinks.totalExpected}</td>
                      <td colSpan={3} />
                      <td className="p-2 text-right font-mono">{usageRecon.drinks.totalPhysicalUsed ?? '—'}</td>
                      <td className={`p-2 text-right font-mono ${
                        usageRecon.drinks.totalVariance !== null && Math.abs(usageRecon.drinks.totalVariance) > 4 ? 'text-red-700' :
                        usageRecon.drinks.totalVariance !== null && Math.abs(usageRecon.drinks.totalVariance) > 2 ? 'text-amber-700' :
                        usageRecon.drinks.totalVariance !== null ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        {usageRecon.drinks.totalVariance !== null ? (usageRecon.drinks.totalVariance >= 0 ? '+' : '') + usageRecon.drinks.totalVariance : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Confidence footer */}
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 border-t pt-3">
                <span>Engine rows: <strong>{usageRecon.confidence.engineRowCount}</strong></span>
                {usageRecon.confidence.unmappedItems > 0 && (
                  <span className="text-amber-600">Unmapped items: <strong>{usageRecon.confidence.unmappedItems}</strong></span>
                )}
                {usageRecon.confidence.estimatedModifiers > 0 && (
                  <span className="text-amber-600">Estimated modifiers: <strong>{usageRecon.confidence.estimatedModifiers}</strong></span>
                )}
                <span className="text-slate-400">Thresholds — Buns: warn &gt;{usageRecon.buns.thresholds.warn}/crit &gt;{usageRecon.buns.thresholds.critical} · Meat: warn &gt;{usageRecon.meat.thresholds.warn}g/crit &gt;{usageRecon.meat.thresholds.critical}g · Drinks/type: warn &gt;{usageRecon.drinks.thresholds.warn}/crit &gt;{usageRecon.drinks.thresholds.critical}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Comparison table ── */}
      {(formLoading || posLoading) ? (
        <div className="text-sm text-slate-500">Loading comparison...</div>
      ) : (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-slate-700">Form vs POS Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-medium text-slate-600">Category</th>
                  <th className="text-right p-3 font-medium text-slate-600">Staff Form</th>
                  <th className="text-right p-3 font-medium text-slate-600">POS / Loyverse</th>
                  <th className="text-right p-3 font-medium text-slate-600">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={`border-b ${r.flagged ? 'bg-red-100/40' : ''}`}>
                    <td className="p-3 text-slate-700">{r.label}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.form)}</td>
                    <td className="p-3 text-right font-mono">{fmt(r.pos)}</td>
                    <td className={`p-3 text-right font-mono ${r.flagged ? 'text-red-600 font-semibold' : r.absDiff < 1 ? 'text-slate-400' : 'text-slate-700'}`}>
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

      {/* ── BOB REVIEW ── */}
      <Card className={`border-2 ${bobBorderClass}`}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">🤖</span> BOB REVIEW
              {bobReport && (
                <Badge className={`text-xs ml-2 ${statusColors[bobReport.status] || statusColors.pending}`}>
                  {bobReport.status.toUpperCase()}
                </Badge>
              )}
              {bobReport?.data_json?.email_sent?.sent && (
                <span className="text-xs text-emerald-600 ml-1">✓ emailed</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {emailStatus && (
                <span className={`text-xs px-2 py-1 rounded-[4px] border ${emailStatus.includes('Sent') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                  {emailStatus}
                </span>
              )}
              {bobReport && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-3"
                  onClick={() => emailMutation.mutate()}
                  disabled={emailMutation.isPending}
                >
                  {emailMutation.isPending ? 'Sending…' : '✉ Email Report'}
                </Button>
              )}
              {bobReport && (
                <a
                  href={`/api/ai-ops/bob/analysis-csv/${selectedDate}`}
                  download={`bob-analysis-${selectedDate}.csv`}
                  className="inline-flex items-center gap-1 border border-slate-200 rounded-[4px] px-3 h-7 text-xs text-slate-700 hover:bg-slate-100/60 transition-colors"
                >
                  ↓ CSV
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-3"
                onClick={() => runAnalysisMutation.mutate()}
                disabled={runAnalysisMutation.isPending}
              >
                {runAnalysisMutation.isPending ? 'Running…' : 'Run Bob Analysis'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {!bobReport && !runAnalysisMutation.isPending && (
            <p className="text-xs text-slate-500">No analysis run for {selectedDate} yet. Click "Run Bob Analysis" to generate.</p>
          )}
          {runAnalysisMutation.isPending && (
            <div className="text-xs text-slate-500 animate-pulse">Running shift analysis…</div>
          )}
          {runAnalysisMutation.isError && (
            <p className="text-xs text-red-600">Analysis failed — check server logs.</p>
          )}
          {bobReport && (
            <div className="space-y-3">
              <p className="text-sm text-slate-800">{bobReport.summary}</p>

              {issues.length > 0 && (
                <div className="border border-red-200 rounded-[4px] p-3 bg-white">
                  <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                    <span>⚠</span> Issues found ({issues.length})
                  </p>
                  <ul className="space-y-1">
                    {issues.map((issue, i) => (
                      <li key={i} className="text-xs text-red-700 flex gap-2">
                        <span className="mt-0.5 shrink-0">·</span>
                        {issueText(issue)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {issues.length === 0 && bobReport.status === 'ok' && (
                <div className="border border-emerald-200 rounded-[4px] px-3 py-2 text-xs text-emerald-700 bg-white">
                  No issues flagged for this shift.
                </div>
              )}

              {(bobReport.data_json?.recommendations?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Recommended actions:</p>
                  <ul className="space-y-1">
                    {bobReport.data_json.recommendations!.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-2">
                        <span className="mt-0.5 shrink-0 text-emerald-600">→</span>{rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(bobReport.data_json?.top_items?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Top items sold:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bobReport.data_json.top_items!.map((item, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {item.name} ({item.sold})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {bobReport.data_json?.codex_handoff && (
                <div className="bg-slate-900 text-slate-100 rounded p-3 text-xs font-mono">
                  <p className="text-slate-400 mb-2">── CODEX HANDOFF ──</p>
                  <p className="text-amber-300">Status: {bobReport.status.toUpperCase()} | Date: {bobReport.shift_date}</p>
                  <p className="text-slate-300 mt-1">Instruction: {bobReport.data_json.codex_handoff.instruction}</p>
                  <p className="text-slate-500 mt-1">Requires approval before implementation.</p>
                </div>
              )}

              <p className="text-xs text-slate-400">
                Last run: {new Date(bobReport.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} BKK
                {bobReport.data_json?.email_sent && (
                  <span className="ml-2 text-emerald-500">
                    · Emailed {new Date(bobReport.data_json.email_sent.sent_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} BKK
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ANALYSIS ADJUSTMENTS ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              Analysis Adjustments
              {adjustments.length > 0 && (
                <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                  {adjustments.length}
                </Badge>
              )}
            </CardTitle>
            <span className="text-xs text-slate-400">Bob's analysis-layer amendments — never writes to source tables</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {adjustments.length === 0 ? (
            <p className="text-xs text-slate-400 p-4">No adjustments recorded for {selectedDate}. Bob can write adjustments via the API.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-3 font-medium text-slate-600">Field</th>
                    <th className="text-right p-3 font-medium text-slate-600">Original</th>
                    <th className="text-right p-3 font-medium text-slate-600">Adjusted</th>
                    <th className="text-left p-3 font-medium text-slate-600">Reason</th>
                    <th className="text-left p-3 font-medium text-slate-600">Status</th>
                    <th className="text-left p-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adj) => (
                    <tr key={adj.id} className="border-b hover:bg-slate-100/40">
                      <td className="p-3 font-mono text-slate-700">
                        <span className="text-slate-400">{adj.source_table}.</span>{adj.source_field}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">{adj.original_value ?? '—'}</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">{adj.adjusted_value}</td>
                      <td className="p-3 text-slate-600 max-w-[220px]">{adj.reason}</td>
                      <td className="p-3">
                        <Badge className={`text-xs ${reviewStatusColors[adj.review_status] || 'bg-slate-100 text-slate-600'}`}>
                          {adj.review_status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {adj.review_status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => reviewMutation.mutate({ id: adj.id, status: 'approved' })}
                              disabled={reviewMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => reviewMutation.mutate({ id: adj.id, status: 'rejected' })}
                              disabled={reviewMutation.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {adj.review_status !== 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-slate-500"
                            onClick={() => reviewMutation.mutate({ id: adj.id, status: 'pending' })}
                            disabled={reviewMutation.isPending}
                          >
                            Reset
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Approval form ── */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-slate-700">Shift Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-slate-600">Manager</span>
              <input value={managerName} readOnly className="border border-slate-200 rounded-[4px] px-2 py-1.5 bg-slate-100 text-sm text-slate-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-slate-600">Cash Banked (฿)</span>
              <input type="number" value={cashBanked} onChange={(e) => setCashBanked(e.target.value)} className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-slate-600">QR Banked (฿)</span>
              <input type="number" value={qrBanked} onChange={(e) => setQrBanked(e.target.value)} className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-xs font-medium text-slate-600">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border border-slate-200 rounded-[4px] px-2 py-1.5 min-h-16 text-sm" />
            </label>
            <Button
              className="bg-slate-900 text-white w-fit text-sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving…' : 'Approve & Close Shift'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Issue Register summary for selected date ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              Issue Register
              {issueByShift && issueByShift.openCount > 0 && (
                <Badge className={`text-xs rounded-[4px] ${issueByShift.criticalCount > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                  {issueByShift.openCount} open{issueByShift.criticalCount > 0 ? ` · ${issueByShift.criticalCount} critical` : ''}
                </Badge>
              )}
              {issueByShift && issueByShift.openCount === 0 && (issueByShift.issues ?? []).length > 0 && (
                <Badge className="text-xs rounded-[4px] bg-emerald-100 text-emerald-700 border-emerald-200">All resolved</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs rounded-[4px] h-7 px-2"
                onClick={() => autoCreateIssuesMutation.mutate(selectedDate)}
                disabled={autoCreateIssuesMutation.isPending}
              >
                {autoCreateIssuesMutation.isPending ? 'Scanning…' : 'Scan for Issues'}
              </Button>
              <Link to="/operations/issue-register">
                <Button size="sm" variant="outline" className="text-xs rounded-[4px] h-7 px-2">
                  View All Issues →
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {autoCreateIssuesMutation.isSuccess && (() => {
            const r = autoCreateIssuesMutation.data as any;
            return (
              <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-[4px] px-3 py-2">
                Scan complete — {r?.created?.length ?? 0} new issues created, {r?.skipped?.length ?? 0} checks passed
              </div>
            );
          })()}
          {!issueByShift || (issueByShift.issues ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No issues logged for {selectedDate}. Run "Scan for Issues" to auto-detect from reconciliation data.</p>
          ) : (
            <div className="space-y-1.5">
              {(issueByShift.issues ?? []).slice(0, 6).map(issue => (
                <div key={issue.id} className="flex items-center gap-2 text-xs">
                  <Badge className={`text-xs rounded-[4px] shrink-0 ${
                    issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200' :
                    issue.severity === 'HIGH' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>{issue.severity}</Badge>
                  <Badge className={`text-xs rounded-[4px] shrink-0 ${
                    issue.status === 'OPEN' ? 'bg-red-100 text-red-700 border-red-200' :
                    issue.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}>{issue.status.replace('_',' ')}</Badge>
                  <span className="text-slate-700 truncate">{issue.title}</span>
                </div>
              ))}
              {(issueByShift.issues ?? []).length > 6 && (
                <p className="text-xs text-slate-400">+{issueByShift.issues.length - 6} more — <Link to="/operations/issue-register" className="text-emerald-600 underline">view all</Link></p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── All shifts history ── */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-slate-700">All Shifts History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-3 font-medium text-slate-600">Date</th>
                <th className="text-left p-3 font-medium text-slate-600">Status</th>
                <th className="text-right p-3 font-medium text-slate-600">POS Total</th>
                <th className="text-right p-3 font-medium text-slate-600">Form Total</th>
              </tr>
            </thead>
            <tbody>
              {(allShifts || []).map((row) => (
                <tr
                  key={row.date}
                  className={`border-b cursor-pointer hover:bg-slate-100/40 transition-colors ${row.date === selectedDate ? 'bg-emerald-100/30 border-l-2 border-l-emerald-500' : ''}`}
                  onClick={() => setSelectedDate(row.date)}
                >
                  <td className="p-3 text-sm text-slate-700">{row.date}</td>
                  <td className="p-3">
                    <Badge className={`text-xs ${row.approved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {row.approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right text-sm tabular-nums text-slate-700">{fmt(toNum(row.pos_data?.total))}</td>
                  <td className="p-3 text-right text-sm tabular-nums text-slate-700">{fmt(toNum(row.form_data?.total))}</td>
                </tr>
              ))}
              {(!allShifts || allShifts.length === 0) && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400 text-xs">No shift history available</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
