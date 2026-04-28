/**
 * FriesReconciliationTable — Core Stock, French Fries
 *
 * Single-row reconciliation: Item | Start | Purchased | Used | End | Expected | Variance | Review
 * 130g per serving. FRIES_USAGE_SKUS: 10018, 10010, 10045, 10030, 10035
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type UsageBreakdownRow = { sku: string; item_name: string; servings: number; grams: number; source: 'direct_sale' | 'set_meal' };

type FriesData = {
  item: string; start: number; purchased: number; used: number; end: number;
  expected: number | null; variance: number | null; has_review: boolean;
  latest_review: { owner_note: string; reviewed_by: string; reviewed_at: string } | null;
};

type FriesResponse = {
  ok: boolean; date: string; prev_date?: string;
  status: 'complete' | 'incomplete_component_data'; missing?: string[];
  grams_per_serving?: number; total_servings?: number; direct_servings?: number; set_servings?: number;
  usage_breakdown?: UsageBreakdownRow[]; stock_source?: { start: string; end: string };
  data: FriesData | null; error?: string;
};

function fmt(g: number | null | undefined): string {
  if (g === null || g === undefined) return '—';
  return `${Number(g).toLocaleString()}g`;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, red, muted, bold }: { children: React.ReactNode; right?: boolean; red?: boolean; muted?: boolean; bold?: boolean }) {
  return (
    <td className={`px-3 py-2 text-xs border-b border-slate-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${red ? 'bg-red-50 text-red-600 font-semibold' : muted ? 'text-slate-400' : bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
      {children}
    </td>
  );
}

function UsageBreakdown({ rows, totalServings, gramsPerServing }: { rows: UsageBreakdownRow[]; totalServings: number; gramsPerServing: number }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50">
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">Usage Breakdown — {gramsPerServing}g per serving</p>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">SKU</th>
              <th className="text-left px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Item</th>
              <th className="text-right px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Servings</th>
              <th className="text-right px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Grams</th>
              <th className="text-left px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.sku}-${i}`}>
                <td className="px-2 py-1 text-slate-400 text-[11px]">{r.sku}</td>
                <td className="px-2 py-1 text-slate-700">{r.item_name}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.servings}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.grams.toLocaleString()}g</td>
                <td className="px-2 py-1">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${r.source === 'set_meal' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.source === 'set_meal' ? 'set meal' : 'direct sale'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-100">
              <td colSpan={2} className="px-2 py-1 text-xs font-semibold text-slate-700 text-right">Total</td>
              <td className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-900">{totalServings}</td>
              <td className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-900">{(totalServings * gramsPerServing).toLocaleString()}g</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ReviewModal({ date, variance, existing, onClose }: { date: string; variance: number; existing: FriesData['latest_review']; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(existing?.owner_note ?? '');
  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/analysis/fries-reconciliation/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_date: date, variance_amount: variance, owner_note: note, reviewed_by: 'Owner' }),
      });
      if (!resp.ok) throw new Error('Failed to save review');
      return resp.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/analysis/fries-reconciliation', date] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Review French Fries Variance</h3>
        <p className="text-xs text-slate-500 mb-3">Shift: {date} · Variance: <span className={variance !== 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}>{variance > 0 ? `+${variance.toLocaleString()}g` : `${variance.toLocaleString()}g`}</span></p>
        {existing && <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800"><span className="font-medium">Previous note:</span> {existing.owner_note}<br /><span className="text-emerald-600">— {existing.reviewed_by}</span></div>}
        <label className="block text-xs font-medium text-slate-700 mb-1">Owner Note</label>
        <textarea className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs resize-none h-20 focus:outline-none focus:ring-1 focus:ring-slate-400" placeholder="Explain the variance…" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!note.trim() || mutation.isPending} className="px-3 py-1.5 text-xs rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">{mutation.isPending ? 'Saving…' : 'Save Review'}</button>
        </div>
      </div>
    </div>
  );
}

export default function FriesReconciliationTable({ date }: { date: string }) {
  const [showReview, setShowReview] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: resp, isLoading, isError, error } = useQuery<FriesResponse>({
    queryKey: ['/api/analysis/fries-reconciliation', date],
    queryFn: () => fetch(`/api/analysis/fries-reconciliation?date=${date}`).then((r) => r.json()),
    enabled: !!date, staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}</div>;
  }
  if (isError || !resp?.ok) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">Failed to load French Fries data: {(error as Error)?.message ?? resp?.error ?? 'Unknown error'}</div>;
  }
  if (resp.status === 'incomplete_component_data' || resp.data === null) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><span className="font-semibold">incomplete_component_data</span> — missing: {resp.missing?.join(', ') ?? 'unknown'}. Fries end-of-shift stock not yet recorded.</div>;
  }

  const row = resp.data;
  const hasVariance = row.variance !== null && row.variance !== 0;

  return (
    <>
      {showReview && row.variance !== null && <ReviewModal date={date} variance={row.variance} existing={row.latest_review} onClose={() => setShowReview(false)} />}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">French Fries Stock Reconciliation</span>
            <span className="text-[11px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">130g / serving</span>
          </div>
          <span className="text-xs text-slate-400">{date}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th right>Start (g)</Th>
                <Th right>Purchased (g)</Th>
                <Th right>Used (g)</Th>
                <Th right>End (g)</Th>
                <Th right>Expected (g)</Th>
                <Th right>Variance (g)</Th>
                <Th>Review</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50/60">
                <Td bold>{row.item}</Td>
                <Td right>{fmt(row.start)}</Td>
                <Td right muted>{fmt(row.purchased)}</Td>
                <Td right>{fmt(row.used)}</Td>
                <Td right>{fmt(row.end)}</Td>
                <Td right>{fmt(row.expected)}</Td>
                <Td right red={hasVariance} muted={row.variance === null}>
                  {row.variance === null ? '—' : row.variance > 0 ? `+${row.variance.toLocaleString()}g` : `${row.variance.toLocaleString()}g`}
                </Td>
                <td className="px-3 py-2 text-xs border-b border-slate-100">
                  {hasVariance ? (
                    <button onClick={() => setShowReview(true)} className={`px-2 py-0.5 rounded text-[11px] border font-medium transition-colors whitespace-nowrap ${row.has_review ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'}`}>
                      {row.has_review ? 'Reviewed ✓' : 'Review'}
                    </button>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400">
            Expected = Start + Purchased − Used · Variance = End − Expected · Source: {resp.stock_source?.start ?? '—'}
            {row.latest_review && <span className="ml-3 text-emerald-600">✓ "{row.latest_review.owner_note}"</span>}
          </span>
          {resp.usage_breakdown && resp.usage_breakdown.length > 0 && (
            <button onClick={() => setShowBreakdown((v) => !v)} className="text-[11px] text-slate-500 hover:text-slate-800 underline whitespace-nowrap">
              {showBreakdown ? 'Hide breakdown' : `Show usage breakdown (${resp.total_servings} servings)`}
            </button>
          )}
        </div>

        {showBreakdown && resp.usage_breakdown && (
          <UsageBreakdown rows={resp.usage_breakdown} totalServings={resp.total_servings ?? 0} gramsPerServing={resp.grams_per_serving ?? 130} />
        )}
      </div>
    </>
  );
}
