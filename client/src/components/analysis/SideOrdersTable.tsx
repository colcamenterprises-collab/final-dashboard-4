/**
 * SideOrdersTable — Side Orders Sales Truth
 *
 * Columns: SKU | Item Name | POS Category | Sold Direct | Sold via Sets | Total Sold | Notes
 * Route:   GET /api/analysis/side-orders?date=YYYY-MM-DD
 */

import { useQuery } from '@tanstack/react-query';

type SideOrderRow = {
  sku: string;
  item_name: string;
  pos_category: string;
  sold_direct: number;
  sold_via_sets: number;
  total_sold: number;
  is_fries_based: boolean;
  notes: string | null;
};

type SideOrdersResponse = {
  ok: boolean;
  date: string;
  total_sets_sold: number;
  set_skus: string[];
  fries_set_sku: string;
  data: SideOrderRow[];
};

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right = false, bold = false, muted = false, accent = false }: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <td className={`px-3 py-2 text-xs border-b border-slate-100 whitespace-nowrap ${right ? 'text-right tabular-nums' : ''} ${bold ? 'font-semibold text-slate-900' : muted ? 'text-slate-400' : accent ? 'text-emerald-600 font-semibold' : 'text-slate-700'}`}>
      {children}
    </td>
  );
}

export default function SideOrdersTable({ date }: { date: string }) {
  const { data, isLoading, isError } = useQuery<SideOrdersResponse>({
    queryKey: ['/api/analysis/side-orders', date],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/side-orders?date=${date}`);
      if (!res.ok) throw new Error('Failed to load side orders');
      return res.json();
    },
    enabled: !!date,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)}
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Failed to load side orders data.
      </div>
    );
  }

  const rows = data.data ?? [];
  const totalSets = data.total_sets_sold;
  const sumDirect = rows.reduce((s, r) => s + r.sold_direct, 0);
  const sumViaSets = rows.reduce((s, r) => s + r.sold_via_sets, 0);
  const sumTotal = rows.reduce((s, r) => s + r.total_sold, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Side Orders</span>
        <span className="text-xs text-slate-400">{date}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Item Name</Th>
              <Th>POS Category</Th>
              <Th right>Sold Direct</Th>
              <Th right>Sold via Sets</Th>
              <Th right>Total Sold</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-xs text-slate-400">
                  No side order data for this shift
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.sku}-${row.item_name}`} className="hover:bg-slate-50/60">
                  <Td muted>{row.sku}</Td>
                  <Td bold={row.sold_via_sets > 0}>{row.item_name}</Td>
                  <Td muted>{row.pos_category}</Td>
                  <Td right>{row.sold_direct}</Td>
                  <Td right accent={row.sold_via_sets > 0}>
                    {row.sold_via_sets > 0 ? `+${row.sold_via_sets}` : '—'}
                  </Td>
                  <Td right bold>{row.total_sold}</Td>
                  <Td muted={!row.notes}>{row.notes ?? '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-700">Total</td>
                <td className="px-3 py-2 text-xs font-semibold text-right tabular-nums text-slate-900">{sumDirect}</td>
                <td className="px-3 py-2 text-xs font-semibold text-right tabular-nums text-emerald-600">
                  {sumViaSets > 0 ? `+${sumViaSets}` : '—'}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-right tabular-nums text-slate-900">{sumTotal}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-100">
        <p className="text-[10px] text-slate-400">
          Total sets sold: <span className="font-semibold text-slate-600">{totalSets}</span>
          {' '}→ {totalSets} fries serving{totalSets !== 1 ? 's' : ''} assigned to French Fries (10030)
        </p>
      </div>
    </div>
  );
}
