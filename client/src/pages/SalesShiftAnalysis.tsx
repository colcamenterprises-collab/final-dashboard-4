import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    codex_handoff?: { issues: string[]; recommendations: string[]; instruction: string } | null;
  };
  created_at: string;
  created_by: string;
}

interface StockSummary {
  ok: boolean;
  date?: string;
  burgerBuns?: number;
  meatWeightG?: number;
  drinksJson?: Record<string, number>;
  submittedAt?: string;
  error?: string;
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
const fmtDate = (iso: string) => {
  const d = iso.includes('T') ? iso.slice(0, 10) : iso;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

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

function normalizeDate(raw: string): string {
  return raw.includes('T') ? raw.slice(0, 10) : raw;
}

export default function SalesShiftAnalysis() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [cashBanked, setCashBanked] = useState('0');
  const [qrBanked, setQrBanked] = useState('0');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const managerName = 'dashboard';

  // ── Auto-load: find the most recent shift with real data ──────────────────
  const { data: latestShift } = useQuery<{ ok: boolean; date: string; source: string }>({
    queryKey: ['latest-valid-shift'],
    queryFn: () => getJson('/api/latest-valid-shift'),
  });

  useEffect(() => {
    if (latestShift?.ok && latestShift.date && !selectedDate) {
      setSelectedDate(normalizeDate(latestShift.date));
    }
  }, [latestShift, selectedDate]);

  const date = selectedDate ?? '';

  // ── Core data queries ─────────────────────────────────────────────────────
  const { data: formData, isLoading: formLoading } = useQuery<ShiftData>({
    queryKey: ['daily-sales', date],
    queryFn: () => getJson(`/api/daily-sales-v2/${date}`),
    enabled: !!date,
  });

  const { data: posData, isLoading: posLoading } = useQuery<ShiftData>({
    queryKey: ['pos-shift', date],
    queryFn: () => getJson(`/api/pos-shift/${date}`),
    enabled: !!date,
  });

  const { data: stockData } = useQuery<StockSummary>({
    queryKey: ['daily-stock-summary', date],
    queryFn: () => getJson(`/api/daily-stock-summary/${date}`),
    enabled: !!date,
  });

  const { data: allShifts } = useQuery<ShiftSnapshotRow[]>({
    queryKey: ['shift-snapshots'],
    queryFn: () => getJson('/api/shift-snapshots'),
  });

  const { data: bobReportData, refetch: refetchBobReport } = useQuery<{ ok: boolean; report: BobReport | null }>({
    queryKey: ['bob-analysis', date],
    queryFn: () => getJson(`/api/ai-ops/bob/analysis/${date}`),
    enabled: !!date,
  });
  const bobReport = bobReportData?.report ?? null;

  const { data: adjustmentsData, refetch: refetchAdjustments } = useQuery<{
    ok: boolean; date: string; count: number; adjustments: BobAdjustment[];
  }>({
    queryKey: ['bob-adjustments', date],
    queryFn: () => getJson(`/api/ai-ops/bob/adjustments/${date}`),
    enabled: !!date,
  });
  const adjustments = adjustmentsData?.adjustments ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const runAnalysisMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai-ops/bob/run-analysis', { shift_date: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bob-analysis', date] });
      queryClient.invalidateQueries({ queryKey: ['bob-adjustments', date] });
      refetchBobReport();
      refetchAdjustments();
    },
  });

  const emailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai-ops/bob/email/trigger', { shift_date: date }),
    onSuccess: (data: any) => {
      setEmailStatus(data?.email_sent ? `Sent to ${data.recipient}` : 'Send failed — check Gmail');
      setTimeout(() => setEmailStatus(null), 6000);
      queryClient.invalidateQueries({ queryKey: ['bob-analysis', date] });
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
        body: JSON.stringify({ date, cash_banked: toNum(cashBanked), qr_banked: toNum(qrBanked), notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pnl'] });
      queryClient.invalidateQueries({ queryKey: ['shift-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['pos-shift', date] });
      alert('Shift approved successfully');
    },
  });

  // ── Computed rows ─────────────────────────────────────────────────────────
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
    ? bobReport.status === 'ok' ? 'border-emerald-300'
    : bobReport.status === 'warning' ? 'border-amber-300'
    : 'border-red-300'
    : 'border-slate-200';

  const drinksEntries = Object.entries(stockData?.drinksJson ?? {}).sort((a, b) => b[1] - a[1]);

  if (!date) {
    return (
      <div className="p-6 flex items-center gap-3 text-sm text-slate-500">
        <div className="animate-spin w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full" />
        Loading latest completed shift…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales &amp; Shift Analysis</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Viewing: <span className="font-medium text-slate-700">{fmtDate(date)}</span>
            {latestShift?.source && (
              <span className="ml-2 text-slate-400">· auto-loaded from {latestShift.source}</span>
            )}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => { setSelectedDate(e.target.value); setEmailStatus(null); }}
          className="border border-slate-200 rounded-[4px] px-3 py-1.5 text-sm"
        />
      </div>

      {/* ── Data availability ── */}
      <div className="flex gap-2 text-xs flex-wrap">
        <span className={`px-2 py-1 rounded border ${formHasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          Form: {formHasData ? `฿${fmt(toNum(formData?.total))}` : 'no form data'}
        </span>
        <span className={`px-2 py-1 rounded border ${posHasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          POS: {posHasData
            ? `฿${fmt(toNum(posData?.total))} · ${toNum(posData?.txn_count)} txns`
            : 'no POS data'}
        </span>
        <span className={`px-2 py-1 rounded border ${stockData?.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
          Stock form: {stockData?.ok ? 'submitted' : 'not submitted'}
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BOB / CLAWBOT ANALYSIS — TOP POSITION (prominent, always visible)
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className={`border-2 ${bobBorderClass}`}>
        <CardHeader className="py-3 border-b border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-900 text-white text-xs font-bold">B</span>
              BOB / ClawBot Analysis
              {bobReport && (
                <Badge className={`text-xs ${statusColors[bobReport.status] || statusColors.pending}`}>
                  {bobReport.status.toUpperCase()}
                </Badge>
              )}
              {bobReport?.data_json?.email_sent?.sent && (
                <span className="text-xs text-emerald-600">✓ emailed</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {emailStatus && (
                <span className={`text-xs px-2 py-1 rounded border ${emailStatus.includes('Sent') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {emailStatus}
                </span>
              )}
              {bobReport && (
                <Button size="sm" variant="outline" className="text-xs h-7 px-3"
                  onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending}>
                  {emailMutation.isPending ? 'Sending…' : '✉ Email Report'}
                </Button>
              )}
              {bobReport && (
                <a href={`/api/ai-ops/bob/analysis-csv/${date}`} download={`bob-analysis-${date}.csv`}
                  className="inline-flex items-center gap-1 border border-slate-200 rounded-[4px] px-3 h-7 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                  ↓ CSV
                </a>
              )}
              <Button size="sm" variant="outline" className="text-xs h-7 px-3"
                onClick={() => runAnalysisMutation.mutate()} disabled={runAnalysisMutation.isPending}>
                {runAnalysisMutation.isPending ? 'Running…' : 'Run Analysis'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {!bobReport && !runAnalysisMutation.isPending && (
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-[4px] border border-slate-200">
              <p className="text-xs text-slate-600">No analysis report exists for {fmtDate(date)}.</p>
              <Button size="sm" className="h-7 px-3 text-xs bg-slate-900 text-white"
                onClick={() => runAnalysisMutation.mutate()}>
                Generate Now
              </Button>
            </div>
          )}
          {runAnalysisMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse py-2">
              <div className="w-3 h-3 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
              Running Bob shift analysis…
            </div>
          )}
          {runAnalysisMutation.isError && (
            <p className="text-xs text-red-600 px-1">Analysis run failed — check server logs.</p>
          )}

          {bobReport && (
            <div className="space-y-3">
              {/* Summary line */}
              <p className="text-sm text-slate-800 font-medium">{bobReport.summary}</p>

              {/* POS vs Form quick figures */}
              {(bobReport.data_json?.pos || bobReport.data_json?.form) && (
                <div className="grid grid-cols-2 gap-3">
                  {bobReport.data_json.pos && (
                    <div className="bg-slate-50 rounded-[4px] border border-slate-200 px-3 py-2">
                      <p className="text-xs text-slate-500 mb-1">POS (Loyverse)</p>
                      <p className="text-base font-semibold text-slate-800 font-mono">฿{fmt(bobReport.data_json.pos.total_baht ?? 0)}</p>
                      <p className="text-xs text-slate-400">{bobReport.data_json.pos.txn_count ?? 0} transactions</p>
                    </div>
                  )}
                  {bobReport.data_json.form && (
                    <div className="bg-slate-50 rounded-[4px] border border-slate-200 px-3 py-2">
                      <p className="text-xs text-slate-500 mb-1">Staff Form</p>
                      <p className="text-base font-semibold text-slate-800 font-mono">฿{fmt(bobReport.data_json.form.total_baht ?? 0)}</p>
                      <p className="text-xs text-slate-400">reported total</p>
                    </div>
                  )}
                </div>
              )}

              {/* Issues */}
              {issues.length > 0 && (
                <div className="border border-red-200 rounded-[4px] p-3 bg-white">
                  <p className="text-xs font-semibold text-red-700 mb-2">⚠ {issues.length} issue{issues.length !== 1 ? 's' : ''} flagged</p>
                  <ul className="space-y-1">
                    {issues.map((issue, i) => (
                      <li key={i} className="text-xs text-red-700 flex gap-2">
                        <span className="shrink-0">·</span>{issueText(issue)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {issues.length === 0 && bobReport.status === 'ok' && (
                <div className="border border-emerald-200 rounded-[4px] px-3 py-2 text-xs text-emerald-700">
                  No issues flagged for this shift.
                </div>
              )}

              {/* Recommendations */}
              {(bobReport.data_json?.recommendations?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Recommended actions:</p>
                  <ul className="space-y-1">
                    {bobReport.data_json.recommendations!.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-2">
                        <span className="text-emerald-600 shrink-0">→</span>{rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top items */}
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

              {/* Codex handoff */}
              {bobReport.data_json?.codex_handoff && (
                <div className="bg-slate-900 text-slate-100 rounded p-3 text-xs font-mono">
                  <p className="text-slate-400 mb-1">── CODEX HANDOFF ──</p>
                  <p className="text-amber-300">Status: {bobReport.status.toUpperCase()} | Date: {bobReport.shift_date}</p>
                  <p className="text-slate-300 mt-1">{bobReport.data_json.codex_handoff.instruction}</p>
                  <p className="text-slate-500 mt-1">Requires manager approval before implementation.</p>
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

      {/* ══════════════════════════════════════════════════════════════════════
          ROLLS / MEAT / DRINKS — from daily_stock_v2 (Form 2 source of truth)
      ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="py-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-800">Rolls · Meat · Drinks Priority</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {!stockData?.ok ? (
            <p className="text-xs text-slate-400 py-1">
              {stockData?.error ?? 'No stock form submitted for this date. Stock data will appear here once Form 2 is completed.'}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Buns + Meat row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-[4px] p-3">
                  <p className="text-xs text-slate-500 mb-1">Burger Buns (opening count)</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono">{stockData.burgerBuns}</p>
                  <p className="text-xs text-slate-400 mt-0.5">units</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-[4px] p-3">
                  <p className="text-xs text-slate-500 mb-1">Meat Weight (opening)</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono">{((stockData.meatWeightG ?? 0) / 1000).toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">kg ({stockData.meatWeightG}g)</p>
                </div>
              </div>

              {/* Drinks table */}
              {drinksEntries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Drinks — opening counts</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {drinksEntries.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-[4px] px-2.5 py-1.5">
                        <span className="text-xs text-slate-600 truncate">{name}</span>
                        <span className="text-xs font-semibold text-slate-800 ml-2 font-mono shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400">
                Form 2 submitted: {stockData.submittedAt
                  ? new Date(stockData.submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }) + ' BKK'
                  : '—'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Form vs POS Comparison table ── */}
      {(formLoading || posLoading) ? (
        <div className="text-sm text-slate-500">Loading comparison…</div>
      ) : (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-slate-700">Form vs POS Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium text-slate-600">Category</th>
                  <th className="text-right p-3 font-medium text-slate-600">Staff Form</th>
                  <th className="text-right p-3 font-medium text-slate-600">POS / Loyverse</th>
                  <th className="text-right p-3 font-medium text-slate-600">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={`border-b ${r.flagged ? 'bg-red-50' : ''}`}>
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
          </CardContent>
        </Card>
      )}

      {/* ── Analysis Adjustments ── */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              Analysis Adjustments
              {adjustments.length > 0 && (
                <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">{adjustments.length}</Badge>
              )}
            </CardTitle>
            <span className="text-xs text-slate-400">Bob-layer amendments — never writes to source tables</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {adjustments.length === 0 ? (
            <p className="text-xs text-slate-400 p-4">No adjustments recorded for {fmtDate(date)}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
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
                    <tr key={adj.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-700">
                        <span className="text-slate-400">{adj.source_table}.</span>{adj.source_field}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">{adj.original_value ?? '—'}</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">{adj.adjusted_value}</td>
                      <td className="p-3 text-slate-600 max-w-[200px]">{adj.reason}</td>
                      <td className="p-3">
                        <Badge className={`text-xs ${reviewStatusColors[adj.review_status] || 'bg-slate-100 text-slate-600'}`}>
                          {adj.review_status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {adj.review_status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => reviewMutation.mutate({ id: adj.id, status: 'approved' })} disabled={reviewMutation.isPending}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => reviewMutation.mutate({ id: adj.id, status: 'rejected' })} disabled={reviewMutation.isPending}>
                              Reject
                            </Button>
                          </div>
                        )}
                        {adj.review_status !== 'pending' && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-slate-500"
                            onClick={() => reviewMutation.mutate({ id: adj.id, status: 'pending' })} disabled={reviewMutation.isPending}>
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

      {/* ── Shift Approval ── */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-slate-700">Shift Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-slate-600">Manager</span>
              <input value={managerName} readOnly className="border border-slate-200 rounded-[4px] px-2 py-1.5 bg-slate-50 text-sm" />
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
            <Button className="bg-slate-900 text-white w-fit text-sm"
              onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving…' : 'Approve & Close Shift'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Shift History ── */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-slate-700">All Shifts History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left p-3 font-medium text-slate-600">Date</th>
                <th className="text-left p-3 font-medium text-slate-600">Status</th>
                <th className="text-right p-3 font-medium text-slate-600">POS Total</th>
                <th className="text-right p-3 font-medium text-slate-600">Form Total</th>
              </tr>
            </thead>
            <tbody>
              {(allShifts || []).map((row) => {
                const rowDate = normalizeDate(row.date);
                return (
                  <tr key={rowDate}
                    className={`border-b cursor-pointer hover:bg-slate-50 ${rowDate === date ? 'bg-emerald-50' : ''}`}
                    onClick={() => setSelectedDate(rowDate)}>
                    <td className="p-3 font-mono text-xs">{fmtDate(rowDate)}</td>
                    <td className="p-3">
                      <Badge className={`text-xs ${row.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {row.approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono">{fmt(toNum(row.pos_data?.total))}</td>
                    <td className="p-3 text-right font-mono">{fmt(toNum(row.form_data?.total))}</td>
                  </tr>
                );
              })}
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
