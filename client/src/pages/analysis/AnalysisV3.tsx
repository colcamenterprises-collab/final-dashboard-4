/**
 * Analysis V3 — POS Item Sales Mirror
 *
 * Raw item sales from lv_receipt + lv_line_item only.
 * No stock, no recipes, no variance, no modifiers, no inference.
 * Output mirrors Loyverse item sales report.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ItemSalesRow {
  item_name: string;
  sku: string | null;
  category: string | null;
  items_sold: number;
}

interface ItemSalesResponse {
  ok: boolean;
  start: string;
  end: string;
  receipt_count: number;
  refund_count: number;
  row_count: number;
  total_items_sold: number;
  category_available: boolean;
  data: ItemSalesRow[];
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildShiftISO(date: string, time: string, nextDay: boolean): string {
  const [h, m] = time.split(':').map(Number);
  const base = DateTime.fromISO(date, { zone: 'Asia/Bangkok' });
  const dt = (nextDay ? base.plus({ days: 1 }) : base).set({ hour: h, minute: m, second: 0, millisecond: 0 });
  return dt.toISO()!;
}

function fmtBkk(iso: string): string {
  try {
    return DateTime.fromISO(iso).setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm');
  } catch { return iso; }
}

function todayBkkDate(): string {
  return DateTime.now().setZone('Asia/Bangkok').toISODate()!;
}

// ─── Table Helpers ──────────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right, muted, bold }: { children: React.ReactNode; right?: boolean; muted?: boolean; bold?: boolean }) {
  return (
    <td className={`px-3 py-2 text-xs border-b border-slate-100 ${right ? 'text-right tabular-nums' : 'text-left'} ${bold ? 'font-semibold text-slate-900' : muted ? 'text-slate-400' : 'text-slate-700'}`}>
      {children}
    </td>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AnalysisV3() {
  const [shiftDate, setShiftDate] = useState(todayBkkDate());
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('03:00');
  const [filterText, setFilterText] = useState('');

  // End time <= 12:00 → next calendar day (overnight shift)
  const endIsNextDay = useMemo(() => {
    const [sh] = startTime.split(':').map(Number);
    const [eh] = endTime.split(':').map(Number);
    return eh < sh;
  }, [startTime, endTime]);

  const startISO = useMemo(() => buildShiftISO(shiftDate, startTime, false), [shiftDate, startTime]);
  const endISO = useMemo(() => buildShiftISO(shiftDate, endTime, endIsNextDay), [shiftDate, endTime, endIsNextDay]);

  const { data, isLoading, isError, error } = useQuery<ItemSalesResponse>({
    queryKey: ['/api/analysis/v3/item-sales', startISO, endISO],
    queryFn: () =>
      fetch(`/api/analysis/v3/item-sales?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`)
        .then((r) => r.json()),
    enabled: !!shiftDate && !!startTime && !!endTime,
    staleTime: 60_000,
  });

  const filteredRows = useMemo(() => {
    if (!data?.data) return [];
    if (!filterText.trim()) return data.data;
    const q = filterText.toLowerCase();
    return data.data.filter(
      (r) =>
        r.item_name.toLowerCase().includes(q) ||
        (r.sku ?? '').toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q)
    );
  }, [data?.data, filterText]);

  // Group rows by category for display
  const grouped = useMemo(() => {
    const out = new Map<string, ItemSalesRow[]>();
    for (const row of filteredRows) {
      const cat = row.category ?? '—';
      if (!out.has(cat)) out.set(cat, []);
      out.get(cat)!.push(row);
    }
    return out;
  }, [filteredRows]);

  const categoryTotals = useMemo(() => {
    const out = new Map<string, number>();
    for (const [cat, rows] of grouped.entries()) {
      out.set(cat, rows.reduce((s, r) => s + r.items_sold, 0));
    }
    return out;
  }, [grouped]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">POS Item Sales Mirror</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Raw item sales from Loyverse · source: <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">lv_receipt + lv_line_item</code> only · no stock, no recipes, no inference
          </p>
        </div>

        {/* Controls */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-800">Shift Window</span>
          </div>
          <div className="px-4 py-3 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Shift Date</label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Start Time (BKK)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">End Time (BKK)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-slate-500"
              />
              {endIsNextDay && (
                <p className="text-[10px] text-slate-400 mt-0.5">+1 day (overnight shift)</p>
              )}
            </div>
            <div className="text-xs text-slate-500 self-end pb-2.5">
              {shiftDate && startTime && endTime && (
                <span>
                  Window: <span className="font-semibold text-slate-700">{fmtBkk(startISO)}</span>
                  {' → '}
                  <span className="font-semibold text-slate-700">{fmtBkk(endISO)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {data?.ok && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Receipts', value: data.receipt_count },
              { label: 'Refunds excluded', value: data.refund_count },
              { label: 'Line items (rows)', value: data.row_count },
              { label: 'Total items sold', value: data.total_items_sold },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Category notice */}
        {data?.ok && !data.category_available && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span className="font-semibold">Category not available</span> — The Loyverse item catalog (<code>item_catalog</code>) has not been synced. All items show category as "—". Quantities are unaffected.
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            Failed to load item sales: {(error as Error)?.message ?? 'Unknown error'}
          </div>
        )}

        {/* Item Sales Table */}
        {data?.ok && !isLoading && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <span className="text-sm font-semibold text-slate-800">Item Sales</span>
                <span className="ml-2 text-xs text-slate-400">{data.total_items_sold} items · {data.row_count} rows · {data.receipt_count} receipts</span>
              </div>
              <input
                type="text"
                placeholder="Filter items…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-400 w-48"
              />
            </div>

            {filteredRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                {data.row_count === 0 ? 'No item sales found in this time window.' : 'No items match filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <Th>Item Name</Th>
                      <Th>SKU</Th>
                      <Th>Category</Th>
                      <Th right>Items Sold</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.category_available
                      ? /* Grouped by category */
                        [...grouped.entries()].map(([cat, rows]) => (
                          <>
                            <tr key={`hdr-${cat}`} className="bg-slate-100/70">
                              <td colSpan={3} className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200">
                                {cat}
                              </td>
                              <td className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 text-right tabular-nums border-b border-slate-200">
                                {categoryTotals.get(cat)}
                              </td>
                            </tr>
                            {rows.map((row, idx) => (
                              <tr key={`${cat}-${row.sku ?? row.item_name}-${idx}`} className="hover:bg-slate-50/60">
                                <Td>{row.item_name}</Td>
                                <Td muted>{row.sku ?? '—'}</Td>
                                <Td muted>{row.category ?? '—'}</Td>
                                <Td right bold>{row.items_sold}</Td>
                              </tr>
                            ))}
                          </>
                        ))
                      : /* Flat list when no categories */
                        filteredRows.map((row, idx) => (
                          <tr key={`${row.sku ?? row.item_name}-${idx}`} className="hover:bg-slate-50/60">
                            <Td>{row.item_name}</Td>
                            <Td muted>{row.sku ?? '—'}</Td>
                            <Td muted>—</Td>
                            <Td right bold>{row.items_sold}</Td>
                          </tr>
                        ))
                    }
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-700">
                        Total{filterText ? ' (filtered)' : ''}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900 text-right tabular-nums">
                        {filteredRows.reduce((s, r) => s + r.items_sold, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="px-4 py-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">
                Source: <code>lv_receipt JOIN lv_line_item</code> · Window: {fmtBkk(data.start)} → {fmtBkk(data.end)} BKK
                · Refunded receipts excluded · Category from <code>item_catalog</code> (LEFT JOIN)
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
