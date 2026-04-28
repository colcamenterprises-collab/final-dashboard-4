/**
 * BunsReconciliationTable — Core Stock, Buns Only
 *
 * Single-row reconciliation: Item | Start | Purchased | Used | End | Expected | Variance | Review
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type BunsData = {
  item: string;
  start: number;
  purchased: number;
  used: number;
  end: number;
  expected: number | null;
  variance: number | null;
  has_review: boolean;
  latest_review: { owner_note: string; reviewed_by: string; reviewed_at: string } | null;
};

type BunsResponse = {
  ok: boolean;
  date: string;
  prev_date?: string;
  status: 'complete' | 'incomplete_component_data';
  missing?: string[];
  data: BunsData | null;
  error?: string;
};

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

function ReviewModal({ date, variance, existing, onClose }: {
  date: string;
  variance: number;
  existing: BunsData['latest_review'];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(existing?.owner_note ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/analysis/buns-reconciliation/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_date: date, variance_amount: variance, owner_note: note, reviewed_by: 'Owner' }),
      });
      if (!resp.ok) throw new Error('Failed to save review');
      return resp.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/analysis/buns-reconciliation', date] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Review Bun Variance</h3>
        <p className="text-xs text-slate-500 mb-3">
          Shift: {date} · Variance:{' '}
          <span className={variance !== 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}>
            {variance > 0 ? `+${variance}` : variance} buns
          </span>
        </p>
        {existing && (
          <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <span className="font-medium">Previous note:</span> {existing.owner_note}
            <br /><span className="text-emerald-600">— {existing.reviewed_by}</span>
          </div>
        )}
        <label className="block text-xs font-medium text-slate-700 mb-1">Owner Note</label>
        <textarea
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs resize-none h-20 focus:outline-none focus:ring-1 focus:ring-slate-400"
          placeholder="Explain the variance (e.g. damaged buns, miscounted, delivery short…)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
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

export default function BunsReconciliationTable({ date }: { date: string }) {
  const [showReview, setShowReview] = useState(false);

  const { data: resp, isLoading, isError, error } = useQuery<BunsResponse>({
    queryKey: ['/api/analysis/buns-reconciliation', date],
    queryFn: () => fetch(`/api/analysis/buns-reconciliation?date=${date}`).then((r) => r.json()),
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
        Failed to load Buns data: {(error as Error)?.message ?? resp?.error ?? 'Unknown error'}
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

  return (
    <>
      {showReview && row.variance !== null && (
        <ReviewModal date={date} variance={row.variance} existing={row.latest_review} onClose={() => setShowReview(false)} />
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-800">Buns Stock Reconciliation</span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th right>Start</Th>
                <Th right>Purchased</Th>
                <Th right>Used</Th>
                <Th right>End</Th>
                <Th right>Expected</Th>
                <Th right>Variance</Th>
                <Th>Review</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50/60">
                <Td bold>{row.item}</Td>
                <Td right>{row.start}</Td>
                <Td right>{row.purchased}</Td>
                <Td right>{row.used}</Td>
                <Td right>{row.end}</Td>
                <Td right>{row.expected ?? '—'}</Td>
                <Td right red={hasVariance} muted={row.variance === null}>
                  {row.variance === null ? '—' : row.variance > 0 ? `+${row.variance}` : row.variance}
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

        <div className="px-4 py-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400">
            Expected = Start + Purchased − Used · Variance = End − Expected
            {row.latest_review && (
              <span className="ml-3 text-emerald-600">✓ "{row.latest_review.owner_note}"</span>
            )}
          </p>
        </div>
      </div>
    </>
  );
}
