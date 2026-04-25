/**
 * SideOrdersTable — Side Orders Sales Truth (V3 PATCH 1)
 *
 * Columns: SKU | Item Name | POS Category | Sold Direct | Sold via Sets | Total Sold | Notes
 * Route:   GET /api/analysis/side-orders?date=YYYY-MM-DD
 *
 * Isolated component — does not touch Drinks, Burgers & Sets, Buns, or Meat.
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
    <th
      className={`border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 whitespace-nowrap ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right = false,
  bold = false,
  muted = false,
  highlight = false,
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <td
      className={`border border-gray-700 px-3 py-2 text-xs whitespace-nowrap ${
        right ? 'text-right tabular-nums' : ''
      } ${bold ? 'font-semibold' : ''} ${
        muted ? 'text-gray-500' : highlight ? 'text-emerald-400' : 'text-gray-200'
      }`}
    >
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
      <div className="text-xs text-gray-400 py-4 text-center">Loading side orders…</div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <div className="text-xs text-red-400 py-4 text-center">
        Failed to load side orders data.
      </div>
    );
  }

  const rows = data.data ?? [];
  const totalSets = data.total_sets_sold;

  // Totals
  const sumDirect = rows.reduce((s, r) => s + r.sold_direct, 0);
  const sumViaSets = rows.reduce((s, r) => s + r.sold_via_sets, 0);
  const sumTotal = rows.reduce((s, r) => s + r.total_sold, 0);

  return (
    <div className="space-y-2">
      {/* Set pool badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400">
          Total sets sold:{' '}
          <span className="font-semibold text-gray-200">{totalSets}</span>
          {' '}→ {totalSets} fries serving{totalSets !== 1 ? 's' : ''} assigned to French Fries (10030)
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-gray-700">
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
                <td
                  colSpan={7}
                  className="border border-gray-700 px-3 py-4 text-center text-xs text-gray-500"
                >
                  No side order data for this shift
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.sku}-${row.item_name}`}
                  className={`hover:bg-gray-800/50 transition-colors ${
                    row.sold_via_sets > 0 ? 'bg-emerald-950/20' : ''
                  }`}
                >
                  <Td muted>{row.sku}</Td>
                  <Td bold={row.sold_via_sets > 0}>{row.item_name}</Td>
                  <Td muted>{row.pos_category}</Td>
                  <Td right>{row.sold_direct}</Td>
                  <Td right highlight={row.sold_via_sets > 0}>
                    {row.sold_via_sets > 0 ? `+${row.sold_via_sets}` : '—'}
                  </Td>
                  <Td right bold>
                    {row.total_sold}
                  </Td>
                  <Td muted={!row.notes}>{row.notes ?? '—'}</Td>
                </tr>
              ))
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-800">
                <td
                  colSpan={3}
                  className="border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300"
                >
                  Total
                </td>
                <td className="border border-gray-700 px-3 py-2 text-xs font-semibold text-right tabular-nums text-gray-200">
                  {sumDirect}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-xs font-semibold text-right tabular-nums text-emerald-400">
                  {sumViaSets > 0 ? `+${sumViaSets}` : '—'}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-xs font-semibold text-right tabular-nums text-gray-100">
                  {sumTotal}
                </td>
                <td className="border border-gray-700 px-3 py-2 text-xs text-gray-500">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
