import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

interface ShiftData {
  total?: number | null;
  cash?: number | null;
  qr?: number | null;
  grab?: number | null;
  other?: number | null;
  exp_cash?: number | null;
  exp?: number | null;
  refunds?: number | null;
  txn_count?: number | null;
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

const toNum = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v: number | null | undefined) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [selectedDate, setSelectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cashBanked, setCashBanked] = useState('0');
  const [qrBanked, setQrBanked] = useState('0');
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const managerName = 'dashboard';

  const { data: latestValidShift, isLoading: latestShiftLoading } = useQuery<{ ok: boolean; date: string; source: string }>({
    queryKey: ['latest-valid-shift'],
    queryFn: () => getJson('/api/latest-valid-shift'),
  });

  useEffect(() => {
    if (!selectedDate && latestValidShift?.date) {
      setSelectedDate(latestValidShift.date);
    }
  }, [latestValidShift, selectedDate]);

  const { data: formData, isLoading: formLoading } = useQuery<ShiftData>({
    queryKey: ['daily-sales', selectedDate],
    queryFn: () => getJson(`/api/daily-sales-v2/${selectedDate}`),
    enabled: Boolean(selectedDate),
  });

  const { data: posData, isLoading: posLoading } = useQuery<ShiftData>({
    queryKey: ['pos-shift', selectedDate],
    queryFn: () => getJson(`/api/pos-shift/${selectedDate}`),
    enabled: Boolean(selectedDate),
  });

  const { data: allShifts } = useQuery<ShiftSnapshotRow[]>({
    queryKey: ['shift-snapshots'],
    queryFn: () => getJson('/api/shift-snapshots'),
  });

  const { data: bobReportData, refetch: refetchBobReport } = useQuery<{ ok: boolean; report: BobReport | null }>({
    queryKey: ['bob-analysis', selectedDate],
    queryFn: () => getJson(`/api/ai-ops/bob/analysis/${selectedDate}`),
    enabled: Boolean(selectedDate),
  });
  const bobReport = bobReportData?.report ?? null;

  const { data: adjustmentsData, refetch: refetchAdjustments } = useQuery<{
    ok: boolean; date: string; count: number; adjustments: BobAdjustment[];
  }>({
    queryKey: ['bob-adjustments', selectedDate],
    queryFn: () => getJson(`/api/ai-ops/bob/adjustments/${selectedDate}`),
    enabled: Boolean(selectedDate),
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

  const availableShiftDates = useMemo(() => {
    const snapshotDates = (allShifts || [])
      .filter((row) => row?.date)
      .filter((row) => toNum(row?.pos_data?.total) > 0 || toNum(row?.form_data?.total) > 0)
      .map((row) => row.date);
    return Array.from(new Set([...(latestValidShift?.date ? [latestValidShift.date] : []), ...snapshotDates])).sort((a, b) => b.localeCompare(a));
  }, [allShifts, latestValidShift]);

  const priorityRows = useMemo(() => {
    const topItems = bobReport?.data_json?.top_items || [];
    const stock = bobReport?.data_json?.stock || {};
    return [
      {
        label: 'Rolls',
        sold: topItems.filter((item) => item.name.toLowerCase().includes('burger') || item.name.toLowerCase().includes('roll')).reduce((sum, item) => sum + Number(item.sold || 0), 0),
        variance: stock.rolls_variance ?? null,
      },
      {
        label: 'Meat',
        sold: topItems.filter((item) => item.name.toLowerCase().includes('meat') || item.name.toLowerCase().includes('beef')).reduce((sum, item) => sum + Number(item.sold || 0), 0),
        variance: stock.meat_variance_g ?? null,
      },
      {
        label: 'Drinks',
        sold: topItems.filter((item) => item.category?.toLowerCase().includes('drink') || item.name.toLowerCase().includes('coke') || item.name.toLowerCase().includes('sprite')).reduce((sum, item) => sum + Number(item.sold || 0), 0),
        variance: null,
      },
    ].map((row) => ({
      ...row,
      status: row.variance === null ? 'INSUFFICIENT_DATA' : Math.abs(Number(row.variance)) > 0 ? 'REVIEW' : 'OK',
    }));
  }, [bobReport]);

  const bobSummaryRows = useMemo(() => ([
    { label: 'Shift Summary', value: bobReport?.summary || 'No Bob summary recorded for this shift.' },
    { label: 'Anomalies', value: issues.length > 0 ? issues.map(issueText).join(' | ') : 'No anomalies recorded.' },
    { label: 'Review Notes', value: bobReport?.data_json?.codex_handoff?.instruction || 'No review notes recorded.' },
    { label: 'Key Issues', value: bobReport?.data_json?.codex_handoff?.issues?.length ? bobReport.data_json.codex_handoff.issues.join(' | ') : 'No key issues recorded.' },
    { label: 'Recommended Actions', value: bobReport?.data_json?.recommendations?.length ? bobReport.data_json.recommendations.join(' | ') : 'No recommended actions recorded.' },
  ]), [bobReport, issues]);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales &amp; Shift Analysis</h1>
          <p className="text-xs text-slate-500 mt-0.5">Latest valid shift auto-load, historical recall, and Bob review in one page.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            value={selectedDate}
            max={todayBkk()}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setEmailStatus(null);
            }}
            className="border border-slate-200 rounded-[4px] px-3 py-1.5 text-sm"
          />
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setEmailStatus(null);
            }}
            className="border border-slate-200 rounded-[4px] px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Select prior shift</option>
            {availableShiftDates.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-slate-700">Shift Selection</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-2">
          <div className="flex flex-wrap gap-3">
            <span>Latest valid shift: <span className="font-medium">{latestValidShift?.date || 'UNAVAILABLE'}</span></span>
            <span>Source: <span className="font-medium">{latestValidShift?.source || 'UNAVAILABLE'}</span></span>
            <span>Status: <span className="font-medium">{latestShiftLoading ? 'LOADING' : selectedDate ? 'READY' : 'WAITING'}</span></span>
          </div>
          <div className="text-xs text-slate-500">
            This page never defaults to today. It loads the most recent valid completed shift with POS or Daily Sales V2 data.
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 text-xs flex-wrap">
        <span className={`px-2 py-1 rounded border ${formHasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          Form data: {formHasData ? `฿${fmt(toNum(formData?.total))}` : 'none for this date'}
        </span>
        <span className={`px-2 py-1 rounded border ${posHasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          POS data: {posHasData
            ? `฿${fmt(toNum(posData?.total))} · ${toNum(posData?.txn_count)} txns${posData?.source === 'receipt_truth_line' ? ' (Loyverse)' : ''}`
            : 'no receipts for this date'}
        </span>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-slate-700">Priority Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left p-3 font-medium text-slate-600">Priority Item</th>
                <th className="text-right p-3 font-medium text-slate-600">Sold / Signals</th>
                <th className="text-right p-3 font-medium text-slate-600">Variance</th>
                <th className="text-right p-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {priorityRows.map((row) => (
                <tr key={row.label} className="border-b">
                  <td className="p-3 font-medium text-slate-700">{row.label}</td>
                  <td className="p-3 text-right font-mono">{row.sold || 0}</td>
                  <td className="p-3 text-right font-mono">{row.variance === null ? 'NULL' : row.variance}</td>
                  <td className="p-3 text-right">
                    <Badge variant={row.status === 'OK' ? 'default' : row.status === 'REVIEW' ? 'destructive' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(formLoading || posLoading) ? (
        <div className="text-sm text-slate-500">Loading comparison...</div>
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

      <Card className="border border-slate-200">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold text-slate-800">Bob / ClawBot Shift Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {bobSummaryRows.map((row) => (
                <tr key={row.label} className="border-b align-top">
                  <td className="p-3 w-48 font-medium text-slate-700">{row.label}</td>
                  <td className="p-3 text-slate-700">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className={`border-2 ${bobBorderClass}`}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">BOB</span> REVIEW
              {bobReport && (
                <Badge className={`text-xs ml-2 ${statusColors[bobReport.status] || statusColors.pending}`}>
                  {bobReport.status.toUpperCase()}
                </Badge>
              )}
              {bobReport?.data_json?.email_sent?.sent && (
                <span className="text-xs text-emerald-600 ml-1">emailed</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {emailStatus && (
                <span className={`text-xs px-2 py-1 rounded border ${emailStatus.includes('Sent') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {emailStatus}
                </span>
              )}
              {bobReport && (
                <Button size="sm" variant="outline" className="text-xs h-7 px-3" onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending}>
                  {emailMutation.isPending ? 'Sending…' : 'Email Report'}
                </Button>
              )}
              {bobReport && (
                <a href={`/api/ai-ops/bob/analysis-csv/${selectedDate}`} download={`bob-analysis-${selectedDate}.csv`} className="inline-flex items-center gap-1 border border-slate-200 rounded-[4px] px-3 h-7 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                  CSV
                </a>
              )}
              <Button size="sm" variant="outline" className="text-xs h-7 px-3" onClick={() => runAnalysisMutation.mutate()} disabled={runAnalysisMutation.isPending || !selectedDate}>
                {runAnalysisMutation.isPending ? 'Running…' : 'Run Bob Analysis'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {!bobReport && !runAnalysisMutation.isPending && (
            <p className="text-xs text-slate-500">No analysis run for {selectedDate || 'this shift'} yet. Click "Run Bob Analysis" to generate.</p>
          )}
          {runAnalysisMutation.isPending && <div className="text-xs text-slate-500 animate-pulse">Running shift analysis…</div>}
          {runAnalysisMutation.isError && <p className="text-xs text-red-600">Analysis failed — check server logs.</p>}
          {bobReport && (
            <div className="space-y-3">
              <p className="text-sm text-slate-800">{bobReport.summary}</p>
              {issues.length > 0 && (
                <div className="border border-red-200 rounded-[4px] p-3 bg-white">
                  <p className="text-xs font-semibold text-red-700 mb-2">Issues found ({issues.length})</p>
                  <ul className="space-y-1">
                    {issues.map((issue, i) => (
                      <li key={i} className="text-xs text-red-700 flex gap-2"><span className="mt-0.5 shrink-0">·</span>{issueText(issue)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {issues.length === 0 && bobReport.status === 'ok' && (
                <div className="border border-emerald-200 rounded-[4px] px-3 py-2 text-xs text-emerald-700 bg-white">No issues flagged for this shift.</div>
              )}
              {(bobReport.data_json?.recommendations?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Recommended actions:</p>
                  <ul className="space-y-1">
                    {bobReport.data_json.recommendations!.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-2"><span className="mt-0.5 shrink-0 text-emerald-600">→</span>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(bobReport.data_json?.top_items?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Top items sold:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bobReport.data_json.top_items!.map((item, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">{item.name} ({item.sold})</span>
                    ))}
                  </div>
                </div>
              )}
              {bobReport.data_json?.codex_handoff && (
                <div className="bg-slate-900 text-slate-100 rounded p-3 text-xs font-mono">
                  <p className="text-slate-400 mb-2">CODEX HANDOFF</p>
                  <p className="text-amber-300">Status: {bobReport.status.toUpperCase()} | Date: {bobReport.shift_date}</p>
                  <p className="text-slate-300 mt-1">Instruction: {bobReport.data_json.codex_handoff.instruction}</p>
                  <p className="text-slate-500 mt-1">Requires approval before implementation.</p>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Last run: {new Date(bobReport.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} BKK
                {bobReport.data_json?.email_sent && (
                  <span className="ml-2 text-emerald-500">· Emailed {new Date(bobReport.data_json.email_sent.sent_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} BKK</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              Analysis Adjustments
              {adjustments.length > 0 && <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">{adjustments.length}</Badge>}
            </CardTitle>
            <span className="text-xs text-slate-400">Bob's analysis-layer amendments — never writes to source tables</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {adjustments.length === 0 ? (
            <p className="text-xs text-slate-400 p-4">No adjustments recorded for {selectedDate || 'this shift'}.</p>
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
                      <td className="p-3 font-mono text-slate-700"><span className="text-slate-400">{adj.source_table}.</span>{adj.source_field}</td>
                      <td className="p-3 text-right font-mono text-slate-500">{adj.original_value ?? '—'}</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">{adj.adjusted_value}</td>
                      <td className="p-3 text-slate-600 max-w-[220px]">{adj.reason}</td>
                      <td className="p-3"><Badge className={`text-xs ${reviewStatusColors[adj.review_status] || 'bg-slate-100 text-slate-600'}`}>{adj.review_status}</Badge></td>
                      <td className="p-3">
                        {adj.review_status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => reviewMutation.mutate({ id: adj.id, status: 'approved' })} disabled={reviewMutation.isPending}>Approve</Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50" onClick={() => reviewMutation.mutate({ id: adj.id, status: 'rejected' })} disabled={reviewMutation.isPending}>Reject</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-slate-500" onClick={() => reviewMutation.mutate({ id: adj.id, status: 'pending' })} disabled={reviewMutation.isPending}>Reset</Button>
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
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="border border-slate-200 rounded-[4px] px-2 py-1.5 text-sm" />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-slate-400">History available: {availableShiftDates.length} valid shifts</div>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || !selectedDate}>
              {approveMutation.isPending ? 'Approving…' : 'Approve Shift'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
