import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DrinkVarianceRow {
  item_name: string;
  sku: string | null;
  category: string;
  starting_stock: number;
  purchased: number;
  items_sold: number;
  modifier_sold: number;
  end_stock: number;
  adjustment: number;
  variance: number;
}

interface DrinksVarianceResponse {
  ok: boolean;
  date: string;
  prev_date: string;
  row_count: number;
  data: DrinkVarianceRow[];
}

interface AdjustmentRecord {
  id: number;
  shift_date: string;
  item_name: string;
  sku: string | null;
  adjustment_qty: number;
  note: string;
  adjusted_by: string;
  adjusted_at: string;
}

interface AdjustmentsResponse {
  ok: boolean;
  date: string;
  data: AdjustmentRecord[];
}

interface PendingAdjustment {
  itemName: string;
  sku: string | null;
  qty: number;
}

interface Props {
  date: string;
}

export default function DrinksVarianceTable({ date }: Props) {
  const queryClient = useQueryClient();

  // Per-row adjustment values (live input — may not yet be saved)
  const [inputs, setInputs] = useState<Record<string, string>>({});
  // Modal state
  const [pending, setPending] = useState<PendingAdjustment | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalError, setModalError] = useState('');
  // View-note modal
  const [viewingItem, setViewingItem] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<DrinksVarianceResponse>({
    queryKey: ['/api/analysis/drinks-variance', date],
    queryFn: () => fetch(`/api/analysis/drinks-variance?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 60_000,
  });

  const { data: adjData } = useQuery<AdjustmentsResponse>({
    queryKey: ['/api/analysis/drinks-adjustments', date],
    queryFn: () => fetch(`/api/analysis/drinks-adjustments?date=${date}`).then((r) => r.json()),
    enabled: !!date,
    staleTime: 30_000,
  });

  // Initialise inputs from saved adjustments when data loads
  useEffect(() => {
    if (!adjData?.data) return;
    const saved: Record<string, string> = {};
    // Use the LATEST adjustment per item (last in time order)
    for (const rec of adjData.data) {
      saved[rec.item_name] = String(rec.adjustment_qty);
    }
    setInputs((prev) => ({ ...prev, ...saved }));
  }, [adjData?.data]);

  const saveMutation = useMutation({
    mutationFn: (body: {
      shift_date: string;
      item_name: string;
      sku: string | null;
      adjustment_qty: number;
      note: string;
      adjusted_by: string;
    }) => apiRequest('POST', '/api/analysis/drinks-adjustments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/drinks-adjustments', date] });
    },
  });

  // Build a map: item_name → latest saved adjustment record
  const latestAdjByItem = new Map<string, AdjustmentRecord>();
  if (adjData?.data) {
    for (const rec of adjData.data) {
      latestAdjByItem.set(rec.item_name, rec);
    }
  }

  // All records grouped by item for history view
  const allAdjByItem = new Map<string, AdjustmentRecord[]>();
  if (adjData?.data) {
    for (const rec of adjData.data) {
      const arr = allAdjByItem.get(rec.item_name) ?? [];
      arr.push(rec);
      allAdjByItem.set(rec.item_name, arr);
    }
  }

  function getAdjustment(itemName: string): number {
    const val = inputs[itemName];
    return val !== undefined ? parseInt(val, 10) || 0 : 0;
  }

  function calcVariance(row: DrinkVarianceRow): number {
    return (
      row.starting_stock +
      row.purchased -
      row.items_sold -
      row.modifier_sold -
      row.end_stock +
      getAdjustment(row.item_name)
    );
  }

  function handleAdjChange(itemName: string, sku: string | null, raw: string) {
    setInputs((prev) => ({ ...prev, [itemName]: raw }));
    const qty = parseInt(raw, 10);
    if (!isNaN(qty) && qty !== 0) {
      // Open modal to capture note
      setPending({ itemName, sku, qty });
      setModalName('');
      setModalNote('');
      setModalError('');
    }
  }

  function handleModalConfirm() {
    if (!pending) return;
    if (!modalName.trim()) { setModalError('Name is required.'); return; }
    if (!modalNote.trim()) { setModalError('Note is required.'); return; }

    saveMutation.mutate({
      shift_date: date,
      item_name: pending.itemName,
      sku: pending.sku,
      adjustment_qty: pending.qty,
      note: modalNote.trim(),
      adjusted_by: modalName.trim(),
    }, {
      onSuccess: () => { setPending(null); },
      onError: () => { setModalError('Failed to save. Please try again.'); },
    });
  }

  function handleModalCancel() {
    // Revert the input to the last saved value (or 0)
    if (pending) {
      const saved = latestAdjByItem.get(pending.itemName);
      setInputs((prev) => ({
        ...prev,
        [pending.itemName]: saved ? String(saved.adjustment_qty) : '0',
      }));
    }
    setPending(null);
  }

  function fmtDateTime(iso: string) {
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded p-4 mb-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Drinks Stock Variance</h2>
          <span className="text-xs text-slate-500">{date}</span>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-xs text-red-600">Failed to load drinks variance data.</p>
        )}

        {data && !isLoading && (
          <>
            {data.data.length === 0 ? (
              <p className="text-xs text-slate-500">No drinks data available for {date}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Item name</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">SKU</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Category</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Starting Stock</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Purchased</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Items Sold</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Modifier Sold</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">End Stock</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Adjustment</th>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((row, i) => {
                      const adj = getAdjustment(row.item_name);
                      const variance = calcVariance(row);
                      const hasSaved = latestAdjByItem.has(row.item_name);
                      const savedAdj = latestAdjByItem.get(row.item_name);
                      return (
                        <tr
                          key={row.item_name}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                        >
                          <td className="px-2 py-1.5 text-slate-800 font-medium whitespace-nowrap">{row.item_name}</td>
                          <td className="px-2 py-1.5 text-center text-slate-500 tabular-nums">{row.sku ?? '—'}</td>
                          <td className="px-2 py-1.5 text-center text-slate-600">{row.category}</td>
                          <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.starting_stock}</td>
                          <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.purchased}</td>
                          <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.items_sold}</td>
                          <td className="px-2 py-1.5 text-center text-slate-500 tabular-nums">{row.modifier_sold}</td>
                          <td className="px-2 py-1.5 text-center text-slate-700 tabular-nums">{row.end_stock}</td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={inputs[row.item_name] ?? '0'}
                                onChange={(e) => handleAdjChange(row.item_name, row.sku, e.target.value)}
                                className={`w-16 text-center text-xs border rounded px-1 py-0.5 bg-white focus:outline-none focus:border-emerald-500 ${
                                  hasSaved ? 'border-amber-400 text-amber-700' : 'border-slate-300 text-slate-700'
                                }`}
                              />
                              {hasSaved && (
                                <button
                                  type="button"
                                  title={`View note: ${savedAdj?.note}`}
                                  onClick={() => setViewingItem(row.item_name)}
                                  className="text-amber-500 hover:text-amber-700 flex-shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className={`px-2 py-1.5 text-center font-semibold tabular-nums ${
                            variance > 0
                              ? 'text-red-600'
                              : variance < 0
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}>
                            {variance > 0 ? `+${variance}` : variance}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              Variance = Starting Stock + Purchased &minus; Items Sold &minus; Modifier Sold &minus; End Stock + Adjustment.
              Starting stock sourced from {data.prev_date} end stock.
              {latestAdjByItem.size > 0 && (
                <span className="ml-1 text-amber-600">{latestAdjByItem.size} adjustment{latestAdjByItem.size > 1 ? 's' : ''} recorded.</span>
              )}
            </p>
          </>
        )}
      </div>

      {/* ── Adjustment Note Modal ── */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Adjustment Note Required</h3>
            <p className="text-xs text-slate-500 mb-4">
              Recording <span className="font-semibold text-slate-700">{pending.qty > 0 ? `+${pending.qty}` : pending.qty}</span> adjustment
              for <span className="font-semibold text-slate-700">{pending.itemName}</span> on {date}.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => { setModalName(e.target.value); setModalError(''); }}
                  placeholder="e.g. Cam"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for adjustment <span className="text-red-500">*</span></label>
                <textarea
                  value={modalNote}
                  onChange={(e) => { setModalNote(e.target.value); setModalError(''); }}
                  placeholder="Explain why this adjustment is being made…"
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {modalError && <p className="text-xs text-red-600">{modalError}</p>}
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={handleModalCancel}
                className="px-4 py-2 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                disabled={saveMutation.isPending}
                className="px-4 py-2 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Adjustment History Modal ── */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Adjustment History — {viewingItem}</h3>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(allAdjByItem.get(viewingItem) ?? []).map((rec) => (
                <div key={rec.id} className="border border-slate-200 rounded p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold ${rec.adjustment_qty > 0 ? 'text-amber-600' : rec.adjustment_qty < 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                      {rec.adjustment_qty > 0 ? `+${rec.adjustment_qty}` : rec.adjustment_qty} units
                    </span>
                    <span className="text-slate-400">{fmtDateTime(rec.adjusted_at)}</span>
                  </div>
                  <p className="text-slate-700 mb-1">{rec.note}</p>
                  <p className="text-slate-400">By: {rec.adjusted_by}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
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
