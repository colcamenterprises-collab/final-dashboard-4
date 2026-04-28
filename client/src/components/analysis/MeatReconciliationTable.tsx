/**
 * MeatReconciliationTable — Core Stock, Meat Only
 *
 * Single-row reconciliation: Item | Start | Purchased | Used | End | Expected | Variance | Review
 * Used = total patties × 90g per PATTY_MAP in backend.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type ItemBreakdownRow = {
  sku: string;
  item_name: string;
  qty: number;
  patties_each: number | null;
  patties_total: number | null;
  grams_total: number | null;
  is_chicken: boolean;
  note: string | null;
};

type MeatData = {
  item: string;
  start: number;
  purchased: number;
  used: number | null;
  end: number;
  expected: number | null;
  variance: number | null;
  has_review: boolean;
  latest_review: { owner_note: string; reviewed_by: string; reviewed_at: string } | null;
};

type MeatResponse = {
  ok: boolean;
  date: string;
  prev_date?: string;
  status: 'complete' | 'incomplete_component_data';
  missing?: string[];
  grams_per_patty?: number;
  total_patties?: number;
  has_unmapped?: boolean;
  unmapped_items?: string[];
  item_breakdown?: ItemBreakdownRow[];
  data: MeatData | null;
  error?: string;
};

function fmt(g: number | null): string {
  if (g === null) return '—';
  return `${g.toLocaleString()}g`;
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

function PattyBreakdown({ rows, totalPatties, gramsPerPatty }: { rows: ItemBreakdownRow[]; totalPatties: number; gramsPerPatty: number }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50">
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">Patty Breakdown — {gramsPerPatty}g per patty</p>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">SKU</th>
              <th className="text-left px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Item</th>
              <th className="text-right px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Sold</th>
              <th className="text-right px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Patties each</th>
              <th className="text-right px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Total patties</th>
              <th className="text-right px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Grams</th>
              <th className="text-left px-2 py-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.sku}-${i}`} className={r.note === 'MISSING_PATTY_MAPPING' ? 'bg-amber-50' : ''}>
                <td className="px-2 py-1 text-slate-400 text-[11px]">{r.sku}</td>
                <td className="px-2 py-1 text-slate-700">{r.item_name}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.qty}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.patties_each === null ? '?' : r.patties_each}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.patties_total === null ? '?' : r.patties_total}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{r.grams_total === null ? '?' : `${r.grams_total}g`}</td>
                <td className="px-2 py-1">
                  {r.note && (
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${r.note === 'MISSING_PATTY_MAPPING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.note}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-100">
              <td colSpan={4} className="px-2 py-1 text-xs font-semibold text-slate-700 text-right">Total</td>
              <td className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-900">{totalPatties}</td>
              <td className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-900">{(totalPatties * gramsPerPatty).toLocaleString()}g</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ReviewModal({ date, variance, existing, onClose }: { date: string; variance: number; existing: MeatData['latest_review']; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(existing?.owner_note ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/analysis/meat-reconciliation/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_date: date, variance_amount: variance, owner_note: note, reviewed_by: 'Owner' }),
      });
      if (!resp.ok) throw new Error('Failed to save review');
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/analysis/meat-reconciliation', date] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Review Meat Variance</h3>
        <p className="text-xs text-slate-500 mb-3">
          Shift: {date} · Variance:{' '}
          <span className={variance !== 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}>
            {variance > 0 ? `+${variance.toLocaleString()}g` : `${variance.toLocaleString()}g`}
          </span>
        </p>
        {existing && (
          <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <span className="font-medium">Previous note:</span> {existing.owner_note}
            <br /><span className="text-emerald-600">— {existing.reviewed_by}</span>
          </div>
        )}
        <label className="block text-xs font-medium text-slate-700 mb-1">Owner Note</label>
        <textarea className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs resize-none h-20 focus:outline-none focus:ring-1 focus:ring-slate-400" placeholder="Explain the variance…" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!note.trim() || mutation.isPending} className="px-3 py-1.5 text-xs rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
            {mutation.isPending ? 'Saving…' : 'Save Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MeatReconciliationTable({ date }: { date: string }) {
  const [showReview, setShowReview] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: resp, isLoading, isError, error } = useQuery<MeatResponse>({
    queryKey: ['/api/analysis/meat-reconciliation', date],
    queryFn: () => fetch(`/api/analysis/meat-reconciliation?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        {[...Array(2)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}
      </div>
    );
  }

  if (isError || !resp?.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Failed to load Meat data: {(error as Error)?.message ?? resp?.error ?? 'Unknown error'}
      </div>
    );
  }

  if (resp.status === 'incomplete_component_data' || resp.data === null) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <span className="font-semibold">incomplete_component_data</span> — missing:{' '}
        {resp.missing?.join(', ') ?? 'unknown'}. Stock data not yet recorded for this date.
      </div>
    );
  }

  const row = resp.data;
  const hasVariance = row.variance !== null && row.variance !== 0;
  const hasUnmapped = resp.has_unmapped ?? false;

  return (
    <>
      {showReview && row.variance !== null && (
        <ReviewModal date={date} variance={row.variance} existing={row.latest_review} onClose={() => setShowReview(false)} />
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">Meat Stock Reconciliation</span>
            {hasUnmapped && (
              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700">
                MISSING_PATTY_MAPPING
              </span>
            )}
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
                <Td right>{fmt(row.purchased)}</Td>
                <Td right>{row.used === null ? <span className="text-amber-600 font-medium">UNMAPPED</span> : fmt(row.used)}</Td>
                <Td right>{fmt(row.end)}</Td>
                <Td right>{fmt(row.expected)}</Td>
                <Td right red={hasVariance} muted={row.variance === null}>
                  {row.variance === null ? '—' : row.variance > 0 ? `+${row.variance.toLocaleString()}g` : `${row.variance.toLocaleString()}g`}
                </Td>
                <td className="px-3 py-2 text-xs border-b border-slate-100">
                  {hasVariance ? (
                    <button
                      onClick={() => setShowReview(true)}
                      className={`px-2 py-0.5 rounded text-[11px] border font-medium transition-colors whitespace-nowrap ${row.has_review ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'}`}
                    >
                      {row.has_review ? 'Reviewed ✓' : 'Review'}
                    </button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400">
            Expected = Start + Purchased − Used · Variance = End − Expected · {resp.grams_per_patty}g per patty
            {row.latest_review && <span className="ml-3 text-emerald-600">✓ "{row.latest_review.owner_note}"</span>}
          </span>
          {resp.item_breakdown && resp.item_breakdown.length > 0 && (
            <button onClick={() => setShowBreakdown((v) => !v)} className="text-[11px] text-slate-500 hover:text-slate-800 underline whitespace-nowrap">
              {showBreakdown ? 'Hide breakdown' : `Show patty breakdown (${resp.total_patties} patties)`}
            </button>
          )}
        </div>

        {showBreakdown && resp.item_breakdown && (
          <PattyBreakdown rows={resp.item_breakdown} totalPatties={resp.total_patties ?? 0} gramsPerPatty={resp.grams_per_patty ?? 90} />
        )}
      </div>
    </>
  );
}
