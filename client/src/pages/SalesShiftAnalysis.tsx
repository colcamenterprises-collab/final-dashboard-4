import { useMemo, useState } from 'react';
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
    pos?: { total_baht: number; refunds_baht: number; txn_count: number };
    form?: { total_baht: number; submitted_by: string };
    stock?: { rolls_variance: number | null; meat_variance_g: number | null };
    top_items?: { name: string; sold: number; category: string }[];
    issues?: string[];
    recommendations?: string[];
    codex_handoff?: {
      issues: string[];
      recommendations: string[];
      instruction: string;
    } | null;
  };
  created_at: string;
  created_by: string;
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

export default function SalesShiftAnalysis() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayBkk());
  const [notes, setNotes] = useState('');
  const [cashBanked, setCashBanked] = useState('0');
  const [qrBanked, setQrBanked] = useState('0');
  const managerName = 'dashboard';

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

  const { data: bobReportData, refetch: refetchBobReport } = useQuery<{ ok: boolean; report: BobReport | null }>({
    queryKey: ['bob-analysis', selectedDate],
    queryFn: () => getJson(`/api/ai-ops/bob/analysis/${selectedDate}`),
  });
  const bobReport = bobReportData?.report ?? null;

  const runAnalysisMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai-ops/bob/run-analysis', { shift_date: selectedDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bob-analysis', selectedDate] });
      refetchBobReport();
    },
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

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales &amp; Shift Analysis</h1>
          <p className="text-xs text-slate-500 mt-0.5">Single truth screen — Form vs POS comparison + Bob Review</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-slate-200 rounded-[4px] px-3 py-1.5 text-sm"
        />
      </div>

      {/* ── Data availability badges ── */}
      <div className="flex gap-2 text-xs">
        <span className={`px-2 py-1 rounded border ${formHasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          Form data: {formHasData ? `฿${fmt(toNum(formData?.total))}` : 'none for this date'}
        </span>
        <span className={`px-2 py-1 rounded border ${posHasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          POS data: {posHasData
            ? `฿${fmt(toNum(posData?.total))} · ${toNum(posData?.txn_count)} txns${posData?.source === 'receipt_truth_line' ? ' (Loyverse)' : ''}`
            : 'no receipts for this date'}
        </span>
      </div>

      {/* ── Comparison table ── */}
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

      {/* ── BOB REVIEW ── */}
      <Card className={`border-2 ${bobReport ? (statusColors[bobReport.status] || statusColors.pending).includes('emerald') ? 'border-emerald-200' : bobReport.status === 'warning' ? 'border-amber-200' : 'border-red-200' : 'border-slate-200'}`}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">🤖</span> BOB REVIEW
              {bobReport && (
                <Badge className={`text-xs ml-2 ${statusColors[bobReport.status] || statusColors.pending}`}>
                  {bobReport.status.toUpperCase()}
                </Badge>
              )}
            </CardTitle>
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

              {(bobReport.data_json?.issues?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Issues found:</p>
                  <ul className="space-y-1">
                    {bobReport.data_json.issues!.map((issue, i) => (
                      <li key={i} className="text-xs text-red-700 flex gap-2">
                        <span className="mt-0.5 shrink-0">⚠</span>{issue}
                      </li>
                    ))}
                  </ul>
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

              <p className="text-xs text-slate-400">Last run: {new Date(bobReport.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} BKK</p>
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

      {/* ── All shifts history ── */}
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
              {(allShifts || []).map((row) => (
                <tr
                  key={row.date}
                  className={`border-b cursor-pointer hover:bg-slate-50 ${row.date === selectedDate ? 'bg-emerald-50' : ''}`}
                  onClick={() => setSelectedDate(row.date)}
                >
                  <td className="p-3 font-mono text-xs">{row.date}</td>
                  <td className="p-3">
                    <Badge className={`text-xs ${row.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(toNum(row.pos_data?.total))}</td>
                  <td className="p-3 text-right font-mono">{fmt(toNum(row.form_data?.total))}</td>
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
