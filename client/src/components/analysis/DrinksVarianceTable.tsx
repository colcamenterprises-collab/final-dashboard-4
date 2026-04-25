/**
 * DrinksVarianceTable — Drinks Stock Reconciliation
 * Rebuilt per FINAL DB spec (Apr 2026).
 *
 * Columns: SKU | Item Name | Sold Direct | Sold via Modifiers | Total Sold |
 *          Start | Purchased | End | Expected | Variance | Review
 *
 * Rules:
 * - All 10 canonical drink SKUs shown, even if every count = 0
 * - Any non-zero variance → red cell
 * - Non-zero variance → Review action button visible
 * - Review modal captures: item, SKU, shift date, variance, owner note, reviewed by
 * - WATER ambiguity (Soda Water / Bottle Water modifiers) → shows warning, modifier = —
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DrinkRow {
  sku: string;
  item_name: string;
  stock_key: string;
  sold_direct: number;
  sold_via_modifiers: number | null;
  ambiguous_modifier: boolean;
  total_sold: number;
  start: number | null;
  purchased: number;
  end: number | null;
  expected: number | null;
  variance: number | null;
  has_review: boolean;
}

interface VarianceResponse {
  ok: boolean;
  date: string;
  prev_date: string;
  row_count: number;
  stock_source: string;
  data: DrinkRow[];
}

interface ReviewRecord {
  id: number;
  shift_date: string;
  item_name: string;
  sku: string | null;
  variance_amount: number;
  owner_note: string;
  reviewed_by: string;
  reviewed_at: string;
}

interface ReviewsResponse {
  ok: boolean;
  data: ReviewRecord[];
}

interface ReviewModal {
  item_name: string;
  sku: string;
  variance: number;
}

interface Props {
  date: string;
}

function fmt(v: number | null): string {
  if (v === null) return '—';
  return v > 0 ? `+${v}` : String(v);
}

export default function DrinksVarianceTable({ date }: Props) {
  const queryClient = useQueryClient();

  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [viewingReviews, setViewingReviews] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<VarianceResponse>({
    queryKey: ['/api/analysis/drinks-variance', date],
    queryFn: () => fetch(`/api/analysis/drinks-variance?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  const { data: reviewData, refetch: refetchReviews } = useQuery<ReviewsResponse>({
    queryKey: ['/api/analysis/drinks-variance/reviews', date],
    queryFn: () => fetch(`/api/analysis/drinks-variance/reviews?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (body: {
      shift_date: string;
      item_name: string;
      sku: string | null;
      variance_amount: number;
      owner_note: string;
      reviewed_by: string;
    }) => apiRequest('POST', '/api/analysis/drinks-variance/reviews', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/drinks-variance', date] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/drinks-variance/reviews', date] });
      setReviewModal(null);
      setReviewerName('');
      setReviewNote('');
      setReviewError('');
    },
    onError: () => { setReviewError('Failed to save review. Please try again.'); },
  });

  function openReviewModal(row: DrinkRow) {
    setReviewModal({ item_name: row.item_name, sku: row.sku, variance: row.variance! });
    setReviewerName('');
    setReviewNote('');
    setReviewError('');
  }

  function submitReview() {
    if (!reviewModal) return;
    if (!reviewerName.trim()) { setReviewError('Your name is required.'); return; }
    if (!reviewNote.trim()) { setReviewError('Review note is required.'); return; }
    reviewMutation.mutate({
      shift_date: date,
      item_name: reviewModal.item_name,
      sku: reviewModal.sku,
      variance_amount: reviewModal.variance,
      owner_note: reviewNote.trim(),
      reviewed_by: reviewerName.trim(),
    });
  }

  const reviewsByItem = new Map<string, ReviewRecord[]>();
  if (reviewData?.data) {
    for (const r of reviewData.data) {
      const arr = reviewsByItem.get(r.item_name) ?? [];
      arr.push(r);
      reviewsByItem.set(r.item_name, arr);
    }
  }

  function fmtTs(iso: string) {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Drinks Stock Reconciliation</h2>
          <span className="text-xs text-slate-500">{date}</span>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-xs text-red-600">Failed to load drinks variance data.</p>
        )}

        {data && !isLoading && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">SKU</th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Item Name</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Sold Direct</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Sold via Modifiers</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Total Sold</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Start</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Purchased</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">End</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Expected</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Variance</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => {
                    const hasVariance = row.variance !== null && row.variance !== 0;
                    const isReviewed = reviewsByItem.has(row.item_name);
                    return (
                      <tr
                        key={row.sku}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      >
                        <td className="px-2 py-1.5 text-slate-400 tabular-nums text-[11px]">{row.sku}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-800 whitespace-nowrap">
                          {row.item_name}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">{row.sold_direct}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">
                          {row.ambiguous_modifier ? (
                            <span
                              className="text-amber-600 cursor-help"
                              title="WATER modifier is shared between Soda Water and Bottle Water — cannot split. See water_used total in modifier totals."
                            >
                              ⚠ ambiguous
                            </span>
                          ) : (
                            <span className="text-slate-700">{row.sold_via_modifiers ?? 0}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums font-semibold text-slate-800">{row.total_sold}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">
                          {row.start !== null ? row.start : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">{row.purchased}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">
                          {row.end !== null ? row.end : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">
                          {row.expected !== null ? row.expected : <span className="text-slate-400">—</span>}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-center font-semibold tabular-nums ${
                            row.variance === null
                              ? 'text-slate-400'
                              : row.variance !== 0
                              ? 'text-red-600 bg-red-50'
                              : 'text-slate-600'
                          }`}
                        >
                          {row.variance === null ? '—' : fmt(row.variance)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {hasVariance ? (
                            isReviewed ? (
                              <button
                                type="button"
                                onClick={() => setViewingReviews(row.item_name)}
                                className="text-[10px] px-2 py-0.5 rounded border border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 whitespace-nowrap"
                              >
                                ✓ reviewed
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openReviewModal(row)}
                                className="text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 whitespace-nowrap"
                              >
                                Review
                              </button>
                            )
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1">
              <p className="text-[10px] text-slate-400">
                Formula: Expected = Start + Purchased − Total Sold · Variance = End − Expected
                · Start sourced from {data.prev_date} · Stock: {data.stock_source}
              </p>
              {data.data.some((r) => r.ambiguous_modifier) && (
                <p className="text-[10px] text-amber-600">
                  ⚠ Soda Water &amp; Bottle Water share the WATER modifier code — sold-via-modifiers cannot
                  be split between them. Check water_used total in set row data.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Review modal ── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Variance Review Required</h3>
            <div className="text-xs text-slate-500 mb-4 space-y-0.5">
              <p>Item: <span className="font-semibold text-slate-700">{reviewModal.item_name}</span></p>
              <p>SKU: <span className="font-semibold text-slate-700">{reviewModal.sku}</span></p>
              <p>Shift date: <span className="font-semibold text-slate-700">{date}</span></p>
              <p>Variance: <span className={`font-semibold ${reviewModal.variance !== 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {fmt(reviewModal.variance)}
              </span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reviewed by (owner) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => { setReviewerName(e.target.value); setReviewError(''); }}
                  placeholder="e.g. Cam"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => { setReviewNote(e.target.value); setReviewError(''); }}
                  placeholder="Explain the variance — e.g. spillage, staff drink, stock count error…"
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="px-4 py-2 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={reviewMutation.isPending}
                className="px-4 py-2 text-xs bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {reviewMutation.isPending ? 'Saving…' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View review history modal ── */}
      {viewingReviews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Reviews — {viewingReviews}</h3>
              <button
                type="button"
                onClick={() => setViewingReviews(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(reviewsByItem.get(viewingReviews) ?? []).map((r) => (
                <div key={r.id} className="border border-slate-200 rounded p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold ${r.variance_amount !== 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      Variance: {fmt(Number(r.variance_amount))}
                    </span>
                    <span className="text-slate-400">{fmtTs(r.reviewed_at)}</span>
                  </div>
                  <p className="text-slate-700 mb-1">{r.owner_note}</p>
                  <p className="text-slate-400">By: {r.reviewed_by}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingReviews(null)}
                className="px-4 py-2 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
